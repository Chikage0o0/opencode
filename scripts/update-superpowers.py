#!/usr/bin/env python3
"""按指定 Superpowers tag 重建本地 skills 与 /use-superpowers command。"""

from __future__ import annotations

import json
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from typing import Sequence
from urllib.request import urlopen


REPOSITORY = "obra/superpowers"
TAG_URL = "https://github.com/obra/superpowers/archive/refs/tags/v{version}.tar.gz"
GATE = "Use ONLY when the current session has been activated by the user running /use-superpowers. "
PATH_PATCHES = (
    ("brainstorming/SKILL.md", "skills/brainstorming/visual-companion.md", "./visual-companion.md"),
    ("executing-plans/SKILL.md", "../using-superpowers/references/", "../../../commands/use-superpowers.md"),
)
EXECUTABLES = (
    "brainstorming/scripts/start-server.sh",
    "brainstorming/scripts/stop-server.sh",
    "subagent-driven-development/scripts/review-package",
    "subagent-driven-development/scripts/sdd-workspace",
    "subagent-driven-development/scripts/task-brief",
    "systematic-debugging/find-polluter.sh",
    "writing-skills/render-graphs.js",
)

COMMAND_FRONTMATTER = """---
description: Activate the vendored Superpowers workflow for the current session.
---

"""

ACTIVATION_OPENING = """<EXTREMELY_IMPORTANT>
The user has explicitly activated Superpowers for this session by running `/use-superpowers`.
Treat this command message as the session activation marker. Apply the following rules to every subsequent response and action in this session. Do not claim activation in any other session.

"""

OPEN_CODE_TOOL_MAPPING = """**Tool Mapping for OpenCode:**
When skills request actions, substitute OpenCode equivalents:
- Create or update todos → `todowrite`
- `Subagent (general-purpose):` → `task` with the closest available specialist `subagent_type`
- Invoke a skill → OpenCode's native `skill` tool
- Read files → `read`
- Create, edit, or delete files → `apply_patch`
- Run shell commands → `bash`
- Search files → `grep`, `glob`
- Fetch a URL → `webfetch`

Use OpenCode's native `skill` tool to load applicable Superpowers skills."""


def validate_version(value: str) -> str:
    """验证并返回严格的三段式版本号。"""
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", value):
        raise ValueError(f"Invalid version: {value!r}; expected X.Y.Z")
    return value


def safe_extract(archive: tarfile.TarFile, destination: Path, version: str) -> Path:
    """验证 tar 成员后解压，并返回唯一的归档根目录。"""
    members = archive.getmembers()
    roots: set[str] = set()
    members_by_name: dict[str, tarfile.TarInfo] = {}
    for member in members:
        name = member.name
        posix = PurePosixPath(name)
        windows = PureWindowsPath(name)
        if not name or posix.is_absolute() or windows.is_absolute() or ".." in posix.parts or ".." in windows.parts:
            raise ValueError(f"Unsafe archive path: {name!r}")
        if not posix.parts:
            raise ValueError(f"Invalid archive path: {name!r}")
        roots.add(posix.parts[0])
        members_by_name[name] = member
    if len(roots) != 1:
        raise ValueError("Archive must contain exactly one root directory")
    root = roots.pop()
    expected_root = f"superpowers-{version}"
    if root != expected_root:
        raise ValueError(f"Archive root must be {expected_root!r}, got {root!r}")
    if root not in members_by_name or not members_by_name[root].isdir():
        raise ValueError(f"Archive root must be a directory: {root!r}")
    agents_name = f"{root}/AGENTS.md"
    for member in members:
        if member.islnk():
            raise ValueError(f"Archive hardlinks are not allowed: {member.name!r}")
        if member.issym():
            if member.name != agents_name or member.linkname != "CLAUDE.md":
                raise ValueError(f"Unexpected archive symlink: {member.name!r} -> {member.linkname!r}")
            target = members_by_name.get(f"{root}/CLAUDE.md")
            if target is None or not target.isfile():
                raise ValueError("AGENTS.md symlink target must be the archive root CLAUDE.md file")
    destination.mkdir(parents=True, exist_ok=True)
    archive.extractall(destination, members=members, filter="data")
    return destination / root


def gate_skill(skill_file: Path) -> None:
    """为首个 frontmatter 的唯一 description 添加一次 session gate。"""
    text = skill_file.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(?P<frontmatter>.*?)\n---\n", text, re.DOTALL)
    if not match:
        raise ValueError(f"Missing frontmatter: {skill_file}")
    lines = match.group("frontmatter").splitlines()
    indexes = [index for index, line in enumerate(lines) if line.startswith("description:")]
    if len(indexes) != 1:
        raise ValueError(f"Expected one description in frontmatter: {skill_file}")
    index = indexes[0]
    description = lines[index].removeprefix("description:").strip()
    if description[:1] in {"'", '"'} and description.endswith(description[:1]):
        description = description[1:-1]
    if not description.startswith(GATE):
        description = GATE + description
    lines[index] = 'description: "' + description.replace('"', '\\"') + '"'
    replacement = "---\n" + "\n".join(lines) + "\n---\n"
    skill_file.write_text(replacement + text[match.end():], encoding="utf-8", newline="\n")


def replace_exact(path: Path, old: str, new: str) -> None:
    """仅在 old 精确出现一次时替换，避免静默适配上游变化。"""
    text = path.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise ValueError(f"Expected exactly one occurrence of {old!r} in {path}")
    path.write_text(text.replace(old, new), encoding="utf-8", newline="\n")


def generate_command(using_skill: Path) -> str:
    """从上游 bootstrap 正文生成带本地 activation wrapper 的 command。"""
    text = using_skill.read_text(encoding="utf-8")
    match = re.match(r"\A---\n.*?\n---\n?", text, re.DOTALL)
    if not match:
        raise ValueError(f"Missing frontmatter: {using_skill}")
    body = text[match.end():].lstrip("\n").rstrip()
    return COMMAND_FRONTMATTER + ACTIVATION_OPENING + body + "\n\n" + OPEN_CODE_TOOL_MAPPING + "\n</EXTREMELY_IMPORTANT>\n"


def prepare_update(source_root: Path, staging_root: Path, version: str) -> tuple[Path, Path]:
    """在 staging 中完成来源校验、skills 转换与 command 生成。"""
    package = source_root / "package.json"
    try:
        package_version = json.loads(package.read_text(encoding="utf-8"))["version"]
    except (OSError, KeyError, json.JSONDecodeError) as error:
        raise ValueError(f"Invalid package.json: {package}") from error
    if package_version != version:
        raise ValueError(f"Package version mismatch: expected {version}, got {package_version}")

    source_skills = source_root / "skills"
    using_skill = source_skills / "using-superpowers" / "SKILL.md"
    if not using_skill.is_file():
        raise FileNotFoundError(f"Missing using-superpowers bootstrap: {using_skill}")
    staged_skills = staging_root / "skills" / "superpowers"
    staged_command = staging_root / "commands" / "use-superpowers.md"
    source_skill_directories = [path for path in sorted(source_skills.iterdir()) if path.is_dir() and path.name != "using-superpowers"]
    for source_skill in source_skill_directories:
        if not (source_skill / "SKILL.md").is_file():
            raise ValueError(f"Missing top-level SKILL.md: {source_skill}")
        shutil.copytree(source_skill, staged_skills / source_skill.name)
    skill_files = sorted(staged_skills.glob("*/SKILL.md"))
    if len(skill_files) != len(source_skill_directories):
        raise ValueError("Every copied skill directory must contain exactly one top-level SKILL.md")
    for skill_file in skill_files:
        gate_skill(skill_file)
    for relative_path, old, new in PATH_PATCHES:
        replace_exact(staged_skills / relative_path, old, new)
    for executable in EXECUTABLES:
        if not (staged_skills / executable).is_file():
            raise FileNotFoundError(f"Missing executable: {executable}")
    staged_command.parent.mkdir(parents=True, exist_ok=True)
    staged_command.write_text(generate_command(using_skill), encoding="utf-8", newline="\n")
    return staged_skills, staged_command


def read_index_modes(repo_root: Path, paths: Sequence[str]) -> dict[str, str]:
    """读取目标文件当前 Git index mode。"""
    result = subprocess.run(["git", "ls-files", "-s", "--", *paths], cwd=repo_root, check=True, capture_output=True, text=True)
    modes = {parts[3]: parts[0] for line in result.stdout.splitlines() if len(parts := line.split(maxsplit=3)) == 4}
    if set(modes) != set(paths):
        raise ValueError("All executable paths must already be tracked")
    return modes


def restore_index_modes(repo_root: Path, modes: dict[str, str]) -> None:
    """恢复 Git index executable bit。"""
    for mode, flag in (("100755", "+x"), ("100644", "-x")):
        paths = sorted(path for path, current_mode in modes.items() if current_mode == mode)
        if paths:
            subprocess.run(["git", "update-index", f"--chmod={flag}", *paths], cwd=repo_root, check=True)


def install_update(staged_skills: Path, staged_command: Path, repo_root: Path, index_modes: dict[str, str] | None = None) -> None:
    """替换文件并可选更新 index；任何失败都恢复文件和 index。"""
    target_skills = repo_root / "skills" / "superpowers"
    target_command = repo_root / "commands" / "use-superpowers.md"
    backup_root = Path(tempfile.mkdtemp(prefix="update-superpowers-", dir=repo_root))
    backup_skills = backup_root / "superpowers"
    backup_command = backup_root / "use-superpowers.md"
    skills_backed_up = command_backed_up = False
    try:
        if target_skills.exists():
            shutil.move(target_skills, backup_skills)
            skills_backed_up = True
        if target_command.exists():
            shutil.move(target_command, backup_command)
            command_backed_up = True
        target_skills.parent.mkdir(parents=True, exist_ok=True)
        target_command.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(staged_skills, target_skills)
        shutil.move(staged_command, target_command)
        if index_modes is not None:
            subprocess.run(["git", "update-index", "--chmod=+x", *sorted(index_modes)], cwd=repo_root, check=True)
    except Exception as original_error:
        rollback_errors: list[Exception] = []
        try:
            if target_skills.exists():
                shutil.rmtree(target_skills)
            if target_command.exists():
                target_command.unlink()
            if skills_backed_up:
                shutil.move(backup_skills, target_skills)
            if command_backed_up:
                shutil.move(backup_command, target_command)
            if index_modes is not None:
                restore_index_modes(repo_root, index_modes)
        except Exception as rollback_error:
            rollback_errors.append(rollback_error)
        if rollback_errors:
            raise RuntimeError(f"Update failed: {original_error}; rollback failed: {rollback_errors[0]}; backup kept at {backup_root}") from original_error
        shutil.rmtree(backup_root)
        raise
    else:
        try:
            shutil.rmtree(backup_root)
        except OSError as cleanup_error:
            print(f"update-superpowers: update succeeded but backup kept at {backup_root}: {cleanup_error}", file=sys.stderr)


def main(argv: Sequence[str] | None = None) -> int:
    """下载、准备、安装指定版本；错误写入 stderr 并返回非零。"""
    arguments = list(sys.argv[1:] if argv is None else argv)
    if len(arguments) != 1:
        print("Usage: python scripts/update-superpowers.py VERSION", file=sys.stderr)
        return 2
    try:
        version = validate_version(arguments[0])
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="update-superpowers-") as temporary:
            temporary_root = Path(temporary)
            archive_path = temporary_root / "superpowers.tar.gz"
            with urlopen(TAG_URL.format(version=version)) as response:
                archive_path.write_bytes(response.read())
            with tarfile.open(archive_path, "r:gz") as archive:
                source_root = safe_extract(archive, temporary_root / "source", version)
            staged_skills, staged_command = prepare_update(source_root, temporary_root / "staging", version)
            executable_paths = [f"skills/superpowers/{path}" for path in EXECUTABLES]
            install_update(staged_skills, staged_command, repo_root, read_index_modes(repo_root, executable_paths))
        print(f"Updated Superpowers {version}: skills/superpowers and commands/use-superpowers.md")
        return 0
    except Exception as error:
        print(f"update-superpowers: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
