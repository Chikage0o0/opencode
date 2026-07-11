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

ACTIVATION_WRAPPER = """当前 session 已通过 `/use-superpowers` 激活 Superpowers。

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## OpenCode Tool Mapping

Use OpenCode's native `skill` tool to list and load skills.

- Create or update todos → `todowrite`
- `Subagent (general-purpose):` → `task` with `subagent_type: "general"`
- Invoke a skill → OpenCode's native `skill` tool
- Read files → `read`
- Create, edit, or delete files → `apply_patch`
- Run shell commands → `bash`
- Search files → `grep`, `glob`
- Fetch a URL → `webfetch`

"""


def validate_version(value: str) -> str:
    """验证并返回严格的三段式版本号。"""
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", value):
        raise ValueError(f"Invalid version: {value!r}; expected X.Y.Z")
    return value


def safe_extract(archive: tarfile.TarFile, destination: Path) -> Path:
    """验证 tar 成员后解压，并返回唯一的归档根目录。"""
    members = archive.getmembers()
    roots: set[str] = set()
    for member in members:
        name = member.name
        posix = PurePosixPath(name)
        windows = PureWindowsPath(name)
        if not name or posix.is_absolute() or windows.is_absolute() or ".." in posix.parts or ".." in windows.parts:
            raise ValueError(f"Unsafe archive path: {name!r}")
        if member.issym() or member.islnk():
            raise ValueError(f"Archive links are not allowed: {name!r}")
        if not posix.parts:
            raise ValueError(f"Invalid archive path: {name!r}")
        roots.add(posix.parts[0])
    if len(roots) != 1:
        raise ValueError("Archive must contain exactly one root directory")
    destination.mkdir(parents=True, exist_ok=True)
    archive.extractall(destination, members=members, filter="data")
    return destination / roots.pop()


def without_links(archive: tarfile.TarFile, destination: Path) -> Path:
    """复制普通成员到新归档，跳过上游仓库根目录的非运行时链接。"""
    sanitized = destination / "without-links.tar.gz"
    with tarfile.open(sanitized, "w:gz") as output:
        for member in archive.getmembers():
            if member.issym() or member.islnk():
                continue
            file_object = archive.extractfile(member) if member.isfile() else None
            output.addfile(member, file_object)
    return sanitized


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
    return "# /use-superpowers\n\n" + ACTIVATION_WRAPPER + text[match.end():].lstrip("\n")


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
    for source_skill in sorted(source_skills.iterdir()):
        if not source_skill.is_dir() or source_skill.name == "using-superpowers":
            continue
        shutil.copytree(source_skill, staged_skills / source_skill.name)
    skill_files = sorted(staged_skills.glob("*/SKILL.md"))
    if not skill_files:
        raise ValueError("No skills found in upstream archive")
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


def install_update(staged_skills: Path, staged_command: Path, repo_root: Path) -> None:
    """替换两个目标；任一替换失败时恢复更新前内容。"""
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
    except Exception:
        if target_skills.exists():
            shutil.rmtree(target_skills)
        if target_command.exists():
            target_command.unlink()
        if skills_backed_up:
            shutil.move(backup_skills, target_skills)
        if command_backed_up:
            shutil.move(backup_command, target_command)
        raise
    finally:
        shutil.rmtree(backup_root, ignore_errors=True)


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
                sanitized_archive = without_links(archive, temporary_root)
            with tarfile.open(sanitized_archive, "r:gz") as archive:
                source_root = safe_extract(archive, temporary_root / "source")
            staged_skills, staged_command = prepare_update(source_root, temporary_root / "staging", version)
            install_update(staged_skills, staged_command, repo_root)
        subprocess.run(
            ["git", "update-index", "--chmod=+x", *[f"skills/superpowers/{path}" for path in EXECUTABLES]],
            cwd=repo_root,
            check=True,
        )
        print(f"Updated Superpowers {version}: skills/superpowers and commands/use-superpowers.md")
        return 0
    except Exception as error:
        print(f"update-superpowers: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
