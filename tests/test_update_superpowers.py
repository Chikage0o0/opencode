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
        (source / "README.md").write_text("readme", encoding="utf-8")
        (source / "CLAUDE.md").write_text("claude", encoding="utf-8")
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
            "---\nname: using-superpowers\ndescription: Bootstrap\n---\n\n"
            "<EXTREMELY-IMPORTANT>\nBootstrap rule\n</EXTREMELY-IMPORTANT>\n\nBootstrap body\n",
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
            link.linkname = "CLAUDE.md"
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
                    self.updater.safe_extract(archive, Path(temporary) / "output", "6.1.1")

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
            expected_command = """---
description: Activate the vendored Superpowers workflow for the current session.
---

<EXTREMELY_IMPORTANT>
The user has explicitly activated Superpowers for this session by running `/use-superpowers`.
Treat this command message as the session activation marker. Apply the following rules to every subsequent response and action in this session. Do not claim activation in any other session.

<EXTREMELY-IMPORTANT>
Bootstrap rule
</EXTREMELY-IMPORTANT>

Bootstrap body

**Tool Mapping for OpenCode:**
When skills request actions, substitute OpenCode equivalents:
- Create or update todos → `todowrite`
- `Subagent (general-purpose):` → `task` with the closest available specialist `subagent_type`
- Invoke a skill → OpenCode's native `skill` tool
- Read files → `read`
- Create, edit, or delete files → `apply_patch`
- Run shell commands → `bash`
- Search files → `grep`, `glob`
- Fetch a URL → `webfetch`

Use OpenCode's native `skill` tool to load applicable Superpowers skills.
</EXTREMELY_IMPORTANT>
"""
            self.assertEqual(command, expected_command)
            self.assertEqual(command.count("<EXTREMELY_IMPORTANT>"), 1)
            self.assertEqual(command.count("</EXTREMELY_IMPORTANT>"), 1)

            repo = root / "repo"
            (repo / "scripts").mkdir(parents=True)
            (repo / "scripts" / "update-superpowers.py").write_text("", encoding="utf-8")
            payload = self.tarball(source)
            previous_file = self.updater.__file__
            self.updater.__file__ = str(repo / "scripts" / "update-superpowers.py")
            try:
                modes = {f"skills/superpowers/{path}": "100755" for path in EXECUTABLES}
                with mock.patch.object(self.updater, "urlopen", return_value=io.BytesIO(payload)), mock.patch.object(self.updater, "read_index_modes", return_value=modes), mock.patch.object(self.updater.subprocess, "run"):
                    self.assertEqual(self.updater.main(["6.1.1"]), 0)
            finally:
                self.updater.__file__ = previous_file
            self.assertTrue((repo / "commands" / "use-superpowers.md").exists())

    def test_safe_extract_allows_only_the_expected_agents_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "safe.tar.gz"
            with tarfile.open(archive_path, "w:gz") as archive:
                directory = tarfile.TarInfo("superpowers-6.1.1")
                directory.type = tarfile.DIRTYPE
                archive.addfile(directory)
                claude = tarfile.TarInfo("superpowers-6.1.1/CLAUDE.md")
                claude.size = 1
                archive.addfile(claude, io.BytesIO(b"x"))
                link = tarfile.TarInfo("superpowers-6.1.1/AGENTS.md")
                link.type = tarfile.SYMTYPE
                link.linkname = "CLAUDE.md"
                archive.addfile(link)
            with tarfile.open(archive_path, "r:gz") as archive:
                root = self.updater.safe_extract(archive, Path(temporary) / "output", "6.1.1")
            self.assertTrue((root / "AGENTS.md").is_symlink())

    def test_safe_extract_rejects_other_links_and_non_directory_root(self):
        with tempfile.TemporaryDirectory() as temporary:
            for name, link_type, link_target in (
                ("superpowers-6.1.1/other", tarfile.SYMTYPE, "CLAUDE.md"),
                ("superpowers-6.1.1/AGENTS.md", tarfile.LNKTYPE, "CLAUDE.md"),
                ("superpowers-6.1.1/AGENTS.md", tarfile.SYMTYPE, "../escape"),
            ):
                archive_path = Path(temporary) / f"{link_type.decode()}.tar.gz"
                with tarfile.open(archive_path, "w:gz") as archive:
                    directory = tarfile.TarInfo("superpowers-6.1.1")
                    directory.type = tarfile.DIRTYPE
                    archive.addfile(directory)
                    claude = tarfile.TarInfo("superpowers-6.1.1/CLAUDE.md")
                    claude.size = 1
                    archive.addfile(claude, io.BytesIO(b"x"))
                    info = tarfile.TarInfo(name)
                    info.type = link_type
                    info.linkname = link_target
                    archive.addfile(info)
                with tarfile.open(archive_path, "r:gz") as archive:
                    with self.assertRaisesRegex(ValueError, "hardlinks|symlink"):
                        self.updater.safe_extract(archive, Path(temporary) / "output", "6.1.1")
            archive_path = Path(temporary) / "file-root.tar.gz"
            with tarfile.open(archive_path, "w:gz") as archive:
                info = tarfile.TarInfo("superpowers-6.1.1")
                info.size = 1
                archive.addfile(info, io.BytesIO(b"x"))
            with tarfile.open(archive_path, "r:gz") as archive:
                with self.assertRaises(ValueError):
                    self.updater.safe_extract(archive, Path(temporary) / "output", "6.1.1")

    def test_safe_extract_rejects_wrong_root_name(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "wrong-root.tar.gz"
            with tarfile.open(archive_path, "w:gz") as archive:
                directory = tarfile.TarInfo("superpowers-6.1.2")
                directory.type = tarfile.DIRTYPE
                archive.addfile(directory)
            with tarfile.open(archive_path, "r:gz") as archive:
                with self.assertRaisesRegex(ValueError, "root"):
                    self.updater.safe_extract(archive, Path(temporary) / "output", "6.1.1")

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

    def test_prepare_update_rejects_skill_directory_without_skill_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.make_source_tree(root)
            (source / "skills" / "writing-skills" / "SKILL.md").unlink()
            with self.assertRaises(ValueError):
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

    def test_install_update_restores_files_and_index_when_mode_update_fails(self):
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
            staged_command = root / "staged-command.md"
            staged_command.write_text("new command", encoding="utf-8")
            modes = {
                "skills/superpowers/brainstorming/scripts/start-server.sh": "100755",
                "skills/superpowers/writing-skills/render-graphs.js": "100644",
            }
            with mock.patch.object(self.updater.subprocess, "run", side_effect=[OSError("index failed"), mock.Mock(), mock.Mock()]) as run:
                with self.assertRaisesRegex(OSError, "index failed"):
                    self.updater.install_update(staged_skills, staged_command, repo, index_modes=modes)
            self.assertEqual(run.call_args_list, [
                mock.call(["git", "update-index", "--chmod=+x", *sorted(modes)], cwd=repo, check=True),
                mock.call(["git", "update-index", "--chmod=+x", "skills/superpowers/brainstorming/scripts/start-server.sh"], cwd=repo, check=True),
                mock.call(["git", "update-index", "--chmod=-x", "skills/superpowers/writing-skills/render-graphs.js"], cwd=repo, check=True),
            ])
            self.assertEqual((old_skills / "old.txt").read_text(encoding="utf-8"), "old skills")
            self.assertEqual(old_command.read_text(encoding="utf-8"), "old command")

    def test_install_update_warns_when_successful_backup_cleanup_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / "repo"
            repo.mkdir()
            staged_skills = root / "staged-skills"
            staged_skills.mkdir()
            staged_command = root / "staged-command.md"
            staged_command.write_text("new command", encoding="utf-8")
            original_rmtree = self.updater.shutil.rmtree
            def fail_backup_cleanup(path, *args, **kwargs):
                if Path(path).name.startswith("update-superpowers-"):
                    raise OSError("cleanup failed")
                return original_rmtree(path, *args, **kwargs)
            with mock.patch.object(self.updater.shutil, "rmtree", side_effect=fail_backup_cleanup), mock.patch("builtins.print") as print_mock:
                self.updater.install_update(staged_skills, staged_command, repo)
            self.assertTrue((repo / "skills" / "superpowers").exists())
            self.assertTrue((repo / "commands" / "use-superpowers.md").exists())
            self.assertIn("backup kept", print_mock.call_args.args[0])

    def test_install_update_keeps_backup_and_reports_rollback_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / "repo"
            (repo / "skills" / "superpowers").mkdir(parents=True)
            (repo / "commands").mkdir()
            (repo / "commands" / "use-superpowers.md").write_text("old", encoding="utf-8")
            staged_skills = root / "staged-skills"
            staged_skills.mkdir()
            staged_command = root / "staged-command.md"
            staged_command.write_text("new", encoding="utf-8")
            original_move = self.updater.shutil.move
            def fail_install_and_restore(source, destination, *args, **kwargs):
                if Path(source) == staged_skills:
                    raise OSError("install failed")
                if Path(source).name == "superpowers" and "update-superpowers-" in str(source):
                    raise OSError("restore failed")
                return original_move(source, destination, *args, **kwargs)
            with mock.patch.object(self.updater.shutil, "move", side_effect=fail_install_and_restore):
                with self.assertRaisesRegex(RuntimeError, "install failed.*restore failed"):
                    self.updater.install_update(staged_skills, staged_command, repo)
            self.assertTrue(list(repo.glob("update-superpowers-*")))

    def test_install_update_attempts_remaining_rollback_after_skills_restore_fails(self):
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
            staged_command = root / "staged-command.md"
            staged_command.write_text("new command", encoding="utf-8")
            modes = {
                "skills/superpowers/brainstorming/scripts/start-server.sh": "100755",
                "skills/superpowers/writing-skills/render-graphs.js": "100644",
            }
            original_move = self.updater.shutil.move

            def fail_install_and_skills_restore(source, destination, *args, **kwargs):
                source_path = Path(source)
                if source_path == staged_skills:
                    raise OSError("install failed")
                if source_path.name == "superpowers" and "update-superpowers-" in str(source_path):
                    raise OSError("skills restore failed")
                return original_move(source, destination, *args, **kwargs)

            with mock.patch.object(self.updater.shutil, "move", side_effect=fail_install_and_skills_restore), mock.patch.object(self.updater.subprocess, "run", return_value=mock.Mock()) as run:
                with self.assertRaisesRegex(RuntimeError, "install failed.*skills restore failed"):
                    self.updater.install_update(staged_skills, staged_command, repo, index_modes=modes)
            self.assertEqual(old_command.read_text(encoding="utf-8"), "old command")
            self.assertEqual(run.call_args_list, [
                mock.call(["git", "update-index", "--chmod=+x", "skills/superpowers/brainstorming/scripts/start-server.sh"], cwd=repo, check=True),
                mock.call(["git", "update-index", "--chmod=-x", "skills/superpowers/writing-skills/render-graphs.js"], cwd=repo, check=True),
            ])
            self.assertTrue(list(repo.glob("update-superpowers-*")))

    def test_install_update_keeps_skills_backup_when_new_skills_removal_fails(self):
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
            staged_command = root / "staged-command.md"
            staged_command.write_text("new command", encoding="utf-8")
            modes = {
                "skills/superpowers/brainstorming/scripts/start-server.sh": "100755",
                "skills/superpowers/writing-skills/render-graphs.js": "100644",
            }
            original_move = self.updater.shutil.move
            original_rmtree = self.updater.shutil.rmtree

            def fail_command_install(source, destination, *args, **kwargs):
                if Path(source) == staged_command:
                    raise OSError("install failed")
                return original_move(source, destination, *args, **kwargs)

            def fail_new_skills_removal(path, *args, **kwargs):
                if Path(path) == repo / "skills" / "superpowers":
                    raise OSError("remove new skills failed")
                return original_rmtree(path, *args, **kwargs)

            with mock.patch.object(self.updater.shutil, "move", side_effect=fail_command_install) as move, mock.patch.object(self.updater.shutil, "rmtree", side_effect=fail_new_skills_removal), mock.patch.object(self.updater.subprocess, "run", return_value=mock.Mock()) as run:
                with self.assertRaisesRegex(RuntimeError, "remove new skills: remove new skills failed"):
                    self.updater.install_update(staged_skills, staged_command, repo, index_modes=modes)
            backup_skills = next(repo.glob("update-superpowers-*/superpowers"))
            self.assertEqual((backup_skills / "old.txt").read_text(encoding="utf-8"), "old skills")
            self.assertFalse((repo / "skills" / "superpowers" / "superpowers").exists())
            self.assertEqual(old_command.read_text(encoding="utf-8"), "old command")
            self.assertNotIn(mock.call(backup_skills, repo / "skills" / "superpowers"), move.call_args_list)
            self.assertEqual(run.call_args_list, [
                mock.call(["git", "update-index", "--chmod=+x", "skills/superpowers/brainstorming/scripts/start-server.sh"], cwd=repo, check=True),
                mock.call(["git", "update-index", "--chmod=-x", "skills/superpowers/writing-skills/render-graphs.js"], cwd=repo, check=True),
            ])

    def test_install_update_keeps_command_backup_when_new_command_removal_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / "repo"
            (repo / "skills" / "superpowers").mkdir(parents=True)
            old_command = repo / "commands" / "use-superpowers.md"
            old_command.parent.mkdir()
            old_command.write_text("old command", encoding="utf-8")
            staged_skills = root / "staged-skills"
            staged_skills.mkdir()
            staged_command = root / "staged-command.md"
            staged_command.write_text("new command", encoding="utf-8")
            original_unlink = Path.unlink

            def fail_new_command_removal(path, *args, **kwargs):
                if path == old_command:
                    raise OSError("remove new command failed")
                return original_unlink(path, *args, **kwargs)

            with mock.patch.object(Path, "unlink", fail_new_command_removal), mock.patch.object(self.updater.subprocess, "run", side_effect=OSError("index failed")), mock.patch.object(self.updater.shutil, "move", wraps=self.updater.shutil.move) as move:
                with self.assertRaisesRegex(RuntimeError, "remove new command: remove new command failed.*restore old command blocked"):
                    self.updater.install_update(staged_skills, staged_command, repo, index_modes={"skills/superpowers/brainstorming/scripts/start-server.sh": "100755"})
            backup_command = next(repo.glob("update-superpowers-*/use-superpowers.md"))
            self.assertEqual(backup_command.read_text(encoding="utf-8"), "old command")
            self.assertNotIn(mock.call(backup_command, old_command), move.call_args_list)
