# Superpowers Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 vendored Superpowers 的 executable mode 和本地引用，并提供按版本安全重建 skills 与 `/use-superpowers` command 的自动更新脚本。

**Architecture:** `scripts/update-superpowers.py` 以纯函数处理版本校验、tarball 安全解压、skill 转换和 command 生成；CLI 负责下载、临时 staging、替换回滚及 Git mode。离线 `unittest` 使用构造 tarball 覆盖成功、拒绝和回滚路径。

**Tech Stack:** Python 3 标准库、`unittest`、Git、Markdown skills/commands

## Global Constraints

- 输入只接受严格 `X.Y.Z`，上游固定为 `obra/superpowers` tag `v<version>`。
- 不 vendoring `using-superpowers`；只用其正文生成 `commands/use-superpowers.md`。
- 所有 vendored skill description 必须带 `/use-superpowers` 当前 session gate。
- 两个本地路径补丁必须各精确命中一次，否则更新失败。
- 7 个已知 executable 文件必须存在且 Git mode 为 `100755`。
- 下载、解压、转换和校验在临时目录完成；失败不得改变现有 skills 和 command。
- 无第三方 Python 依赖；不自动 commit、push 或修改其他配置。
- 用户已授权在当前隔离分支创建聚焦 task commits。

---

### Task 1: 修复当前 vendored 内容

**Files:**
- Modify mode: `skills/superpowers/brainstorming/scripts/start-server.sh`
- Modify mode: `skills/superpowers/brainstorming/scripts/stop-server.sh`
- Modify mode: `skills/superpowers/subagent-driven-development/scripts/review-package`
- Modify mode: `skills/superpowers/subagent-driven-development/scripts/sdd-workspace`
- Modify mode: `skills/superpowers/subagent-driven-development/scripts/task-brief`
- Modify mode: `skills/superpowers/systematic-debugging/find-polluter.sh`
- Modify mode: `skills/superpowers/writing-skills/render-graphs.js`
- Modify: `skills/superpowers/brainstorming/SKILL.md`
- Modify: `skills/superpowers/executing-plans/SKILL.md`

**Interfaces:**
- Consumes: Task 1 commit `71e13d5` 的 vendored tree。
- Produces: 当前 tree 中可执行的脚本和两个有效本地引用。

- [ ] **Step 1: 写失败检查**

运行：

```bash
python - <<'PY'
from pathlib import Path
import subprocess

expected = {
    'skills/superpowers/brainstorming/scripts/start-server.sh',
    'skills/superpowers/brainstorming/scripts/stop-server.sh',
    'skills/superpowers/subagent-driven-development/scripts/review-package',
    'skills/superpowers/subagent-driven-development/scripts/sdd-workspace',
    'skills/superpowers/subagent-driven-development/scripts/task-brief',
    'skills/superpowers/systematic-debugging/find-polluter.sh',
    'skills/superpowers/writing-skills/render-graphs.js',
}
rows = subprocess.check_output(['git', 'ls-files', '-s', *sorted(expected)], text=True).splitlines()
assert {row.split()[3] for row in rows if row.split()[0] == '100755'} == expected
assert './visual-companion.md' in Path('skills/superpowers/brainstorming/SKILL.md').read_text(encoding='utf-8')
assert '../../../commands/use-superpowers.md' in Path('skills/superpowers/executing-plans/SKILL.md').read_text(encoding='utf-8')
PY
```

Expected: FAIL，因为当前 mode 为 `100644` 且引用仍指向失效路径。

- [ ] **Step 2: 应用最小修复**

运行：

```bash
git update-index --chmod=+x \
  skills/superpowers/brainstorming/scripts/start-server.sh \
  skills/superpowers/brainstorming/scripts/stop-server.sh \
  skills/superpowers/subagent-driven-development/scripts/review-package \
  skills/superpowers/subagent-driven-development/scripts/sdd-workspace \
  skills/superpowers/subagent-driven-development/scripts/task-brief \
  skills/superpowers/systematic-debugging/find-polluter.sh \
  skills/superpowers/writing-skills/render-graphs.js
```

在 `brainstorming/SKILL.md` 中将唯一的：

```text
skills/brainstorming/visual-companion.md
```

替换为：

```text
./visual-companion.md
```

在 `executing-plans/SKILL.md` 中将唯一的：

```text
../using-superpowers/references/
```

替换为：

```text
../../../commands/use-superpowers.md
```

- [ ] **Step 3: 重跑检查并提交**

重跑 Step 1，Expected: PASS。然后运行：

```bash
git add skills/superpowers/brainstorming/SKILL.md skills/superpowers/executing-plans/SKILL.md
git commit -m "fix(skills): 修复 Superpowers 本地资产"
```

Expected: commit 包含 7 个 `100644 => 100755` mode changes 和 2 个单行引用修改。

---

### Task 2: TDD 实现自动更新器

**Files:**
- Create: `scripts/update-superpowers.py`
- Create: `tests/test_update_superpowers.py`

**Interfaces:**
- CLI: `python scripts/update-superpowers.py VERSION`
- `validate_version(value: str) -> str`
- `safe_extract(archive: tarfile.TarFile, destination: Path) -> Path`
- `gate_skill(skill_file: Path) -> None`
- `replace_exact(path: Path, old: str, new: str) -> None`
- `generate_command(using_skill: Path) -> str`
- `prepare_update(source_root: Path, staging_root: Path, version: str) -> tuple[Path, Path]`
- `install_update(staged_skills: Path, staged_command: Path, repo_root: Path) -> None`
- `main(argv: Sequence[str] | None = None) -> int`

- [ ] **Step 1: 编写离线失败测试**

在 `tests/test_update_superpowers.py` 使用 `unittest`、`tempfile`、`tarfile` 和 `unittest.mock`。测试必须构造最小上游 tree，并分别断言：

```python
class UpdateSuperpowersTests(unittest.TestCase):
    def test_validate_version_accepts_semver_and_rejects_other_input(self): ...
    def test_safe_extract_rejects_parent_traversal(self): ...
    def test_prepare_update_gates_skills_patches_paths_and_generates_command(self): ...
    def test_prepare_update_rejects_package_version_mismatch(self): ...
    def test_prepare_update_rejects_missing_or_duplicate_patch_target(self): ...
    def test_prepare_update_rejects_missing_executable(self): ...
    def test_install_update_restores_existing_targets_when_replace_fails(self): ...
```

成功 fixture 必须包含 13 个当前 skill 目录、`using-superpowers/SKILL.md`、两个精确旧引用、7 个 executable 相对路径和 `package.json` version。网络调用通过 mock 返回 fixture tarball，不访问 GitHub。

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m unittest tests.test_update_superpowers -v`

Expected: FAIL with `ModuleNotFoundError` or missing updater functions.

- [ ] **Step 3: 实现最小更新器**

实现以下常量，集中保存不可变策略：

```python
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
```

实现要求：

- `validate_version` 使用 full match `[0-9]+\.[0-9]+\.[0-9]+`。
- `safe_extract` 在写文件前解析所有 member，拒绝绝对路径、`..` 和 hardlink；归档必须只有一个根目录。唯一批准的 symlink 是 archive 根目录的 `superpowers-<version>/AGENTS.md`，且必须精确指向同根 `CLAUDE.md` 普通文件；其他 symlink 一律拒绝。
- `gate_skill` 只修改首个 frontmatter 的唯一 `description:`，重复执行不得叠加 gate。
- `replace_exact` 要求 `text.count(old) == 1`。
- `prepare_update` 校验 package version，复制除 `using-superpowers` 外全部 skill，应用 gate、路径补丁及 executable 存在检查，并生成 staged command。
- `generate_command` 去除 `using-superpowers` frontmatter，使用已批准设计中的 activation wrapper 和 OpenCode tool mapping。
- `install_update` 先备份现有两个目标，再替换；任一步失败时恢复二者。
- `main` 下载到临时目录，完成 staging 后安装，再对 7 个已跟踪脚本运行 `git update-index --chmod=+x`；不运行 `git add`、commit 或 push。
- CLI 错误写 stderr 并返回非零；成功打印更新版本和两个目标路径。

- [ ] **Step 4: 运行窄测并修到通过**

Run: `python -m unittest tests.test_update_superpowers -v`

Expected: 7 tests PASS，0 failures/errors。

- [ ] **Step 5: 验证真实 v6.1.1 重建是幂等的**

先记录 `git status --short`，再运行：

```bash
python scripts/update-superpowers.py 6.1.1
git diff --check
git diff --stat
```

Expected: 下载官方 tag 成功；更新后的 skills/command 满足 gate、路径补丁和 executable 检查；除预期 command 首次创建或已有审查修复外，不产生无法解释的内容差异。

- [ ] **Step 6: 运行仓库回归测试并提交**

Run:

```bash
python -m unittest tests.test_update_superpowers -v
bun test
```

Expected: updater tests 全部通过；现有 Bun tests `14 pass, 0 fail`。

提交：

```bash
git add scripts/update-superpowers.py tests/test_update_superpowers.py commands/use-superpowers.md skills/superpowers
git commit -m "feat(skills): 添加 Superpowers 自动更新器"
```

---

### Task 3: 更新维护文档并做集成检查

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `scripts/update-superpowers.py VERSION`。
- Produces: 可重复执行的维护说明和最终验证证据。

- [ ] **Step 1: 添加维护命令**

在 README 的 OpenCode 配置维护区域添加正常维护者语体说明：

````markdown
### 更新 Superpowers skills

Superpowers 固定为本地副本，不通过 plugin 自动加载。更新到指定上游版本：

```bash
python scripts/update-superpowers.py 6.2.0
```

脚本会下载官方 `v<version>` tag，重建本地 skills 和 `/use-superpowers` command，并重放 session gate、本地路径补丁和 executable mode。更新后检查 diff、运行测试，再手动提交；脚本不会自动 commit 或 push。
````

- [ ] **Step 2: 运行最终静态检查**

Run:

```bash
python -m unittest tests.test_update_superpowers -v
bun test
git diff --check
git ls-files -s skills/superpowers/brainstorming/scripts/start-server.sh skills/superpowers/brainstorming/scripts/stop-server.sh skills/superpowers/subagent-driven-development/scripts/review-package skills/superpowers/subagent-driven-development/scripts/sdd-workspace skills/superpowers/subagent-driven-development/scripts/task-brief skills/superpowers/systematic-debugging/find-polluter.sh skills/superpowers/writing-skills/render-graphs.js
```

Expected: 所有测试通过；`git diff --check` 无输出；7 行 mode 全为 `100755`。

- [ ] **Step 3: 提交文档**

```bash
git add README.md
git commit -m "docs(skills): 说明 Superpowers 更新流程"
```
