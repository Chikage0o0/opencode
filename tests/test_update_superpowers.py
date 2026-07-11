import io
import importlib
import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest import mock


SKILLS = (
    "brainstorming",
    "dispatching-parallel-agents",
    "executing-plans",
    "finishing-a-development-branch",
    "receiving-code-review",
    "requesting-code-review",
    "subagent-driven-development",
    "systematic-debugging",
    "test-driven-development",
    "using-git-worktrees",
    "verification-before-completion",
    "writing-plans",
    "writing-skills",
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


class UpdateSuperpowersTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).parents[1] / "scripts" / "update-superpowers.py"
        spec = importlib.util.spec_from_file_location("update_superpowers", path)
        assert spec is not None and spec.loader is not None
        self.updater = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.updater)

    def make_source_tree(self, root: Path, version: str = "6.1.1") -> Path:
        source = root / f"superpowers-{version}"
        (source / "skills").mkdir(parents=True)
        (source / "package.json").write_text(json.dumps({"version": version}), encoding="utf-8")
        for skill in SKILLS:
            content = "---\nname: " + skill + "\ndescription: Original description\n---\n\nBody\n"
            if skill == "brainstorming":
                content += "skills/brainstorming/visual-companion.md\n"
            if skill == "executing-plans":
                content += "../using-superpowers/references/\n"
            path = source / "skills" / skill / "SKILL.md"
            path.parent.mkdir(parents=True)
            path.write_text(content, encoding="utf-8")
        using = source / "skills" / "using-superpowers" / "SKILL.md"
        using.parent.mkdir()
        using.write_text(
            "---\nname: using-superpowers\ndescription: Bootstrap\n---\n\nBootstrap body\n",
            encoding="utf-8",
        )
        for executable in EXECUTABLES:
            path = source / "skills" / executable
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("#!/bin/sh\n", encoding="utf-8")
        return source

    def tarball(self, source: Path) -> bytes:
        payload = io.BytesIO()
        with tarfile.open(fileobj=payload, mode="w:gz") as archive:
            archive.add(source, arcname=source.name)
            link = tarfile.TarInfo(f"{source.name}/AGENTS.md")
            link.type = tarfile.SYMTYPE
            link.linkname = "README.md"
            archive.addfile(link)
        return payload.getvalue()

    def test_validate_version_accepts_semver_and_rejects_other_input(self):
        self.assertEqual(self.updater.validate_version("6.1.1"), "6.1.1")
        for value in ("v6.1.1", "6.1", "6.1.1/../../x", "6.1.1\n"):
            with self.assertRaises(ValueError):
                self.updater.validate_version(value)

    def test_safe_extract_rejects_parent_traversal(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "unsafe.tar.gz"
            with tarfile.open(archive_path, "w:gz") as archive:
                info = tarfile.TarInfo("superpowers-6.1.1/../../escape")
                info.size = 1
                archive.addfile(info, io.BytesIO(b"x"))
            with tarfile.open(archive_path, "r:gz") as archive:
                with self.assertRaises(ValueError):
                    self.updater.safe_extract(archive, Path(temporary) / "output")

    def test_prepare_update_gates_skills_patches_paths_and_generates_command(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.make_source_tree(root)
            staged_skills, staged_command = self.updater.prepare_update(source, root / "staging", "6.1.1")
            self.assertEqual({path.name for path in staged_skills.iterdir()}, set(SKILLS))
            self.assertFalse((staged_skills / "using-superpowers").exists())
            for skill in SKILLS:
                text = (staged_skills / skill / "SKILL.md").read_text(encoding="utf-8")
                self.assertEqual(text.count(self.updater.GATE), 1)
            self.assertIn("./visual-companion.md", (staged_skills / "brainstorming" / "SKILL.md").read_text(encoding="utf-8"))
            self.assertIn("../../../commands/use-superpowers.md", (staged_skills / "executing-plans" / "SKILL.md").read_text(encoding="utf-8"))
            command = staged_command.read_text(encoding="utf-8")
            self.assertIn("<EXTREMELY-IMPORTANT>", command)
            self.assertIn("OpenCode's native `skill` tool", command)
            self.assertIn("Bootstrap body", command)
            self.assertNotIn("name: using-superpowers", command)

            repo = root / "repo"
            (repo / "scripts").mkdir(parents=True)
            (repo / "scripts" / "update-superpowers.py").write_text("", encoding="utf-8")
            payload = self.tarball(source)
            previous_file = self.updater.__file__
            self.updater.__file__ = str(repo / "scripts" / "update-superpowers.py")
            try:
                with mock.patch.object(self.updater, "urlopen", return_value=io.BytesIO(payload)), mock.patch.object(self.updater.subprocess, "run"):
                    self.assertEqual(self.updater.main(["6.1.1"]), 0)
            finally:
                self.updater.__file__ = previous_file
            self.assertTrue((repo / "commands" / "use-superpowers.md").exists())

    def test_prepare_update_rejects_package_version_mismatch(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.make_source_tree(root, "6.1.2")
            with self.assertRaises(ValueError):
                self.updater.prepare_update(source, root / "staging", "6.1.1")

    def test_prepare_update_rejects_missing_or_duplicate_patch_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.make_source_tree(root)
            brainstorming = source / "skills" / "brainstorming" / "SKILL.md"
            brainstorming.write_text(brainstorming.read_text(encoding="utf-8").replace("skills/brainstorming/visual-companion.md", "missing"), encoding="utf-8")
            with self.assertRaises(ValueError):
                self.updater.prepare_update(source, root / "missing", "6.1.1")
            source = self.make_source_tree(root / "duplicate")
            brainstorming = source / "skills" / "brainstorming" / "SKILL.md"
            brainstorming.write_text(brainstorming.read_text(encoding="utf-8") + "skills/brainstorming/visual-companion.md\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                self.updater.prepare_update(source, root / "duplicate-staging", "6.1.1")

    def test_prepare_update_rejects_missing_executable(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.make_source_tree(root)
            (source / "skills" / EXECUTABLES[0]).unlink()
            with self.assertRaises(FileNotFoundError):
                self.updater.prepare_update(source, root / "staging", "6.1.1")

    def test_install_update_restores_existing_targets_when_replace_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / "repo"
            old_skills = repo / "skills" / "superpowers"
            old_skills.mkdir(parents=True)
            (old_skills / "old.txt").write_text("old skills", encoding="utf-8")
            old_command = repo / "commands" / "use-superpowers.md"
            old_command.parent.mkdir()
            old_command.write_text("old command", encoding="utf-8")
            staged_skills = root / "staged-skills"
            staged_skills.mkdir()
            (staged_skills / "new.txt").write_text("new skills", encoding="utf-8")
            staged_command = root / "staged-command.md"
            staged_command.write_text("new command", encoding="utf-8")
            original_move = self.updater.shutil.move

            def fail_skills_replacement(source, destination, *args, **kwargs):
                if Path(source) == staged_skills:
                    raise OSError("replace failed")
                return original_move(source, destination, *args, **kwargs)

            with mock.patch.object(self.updater.shutil, "move", side_effect=fail_skills_replacement):
                with self.assertRaises(OSError):
                    self.updater.install_update(staged_skills, staged_command, repo)
            self.assertEqual((old_skills / "old.txt").read_text(encoding="utf-8"), "old skills")
            self.assertEqual(old_command.read_text(encoding="utf-8"), "old command")
