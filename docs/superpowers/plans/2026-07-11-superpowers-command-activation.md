# Superpowers Command Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Superpowers `6.1.1` 从自动注入的 Git plugin 迁移为仅由 `/use-superpowers` 在当前 session 激活的本地 skills。

**Architecture:** 将除 `using-superpowers` 外的上游 skills 固定复制到 `skills/superpowers/`，并在每个 skill 的发现描述中加入 session 激活门控。`commands/use-superpowers.md` 直接内联上游 bootstrap 正文及 OpenCode tool mapping；命令消息本身作为当前 conversation 的激活标记。

**Tech Stack:** OpenCode JSON 配置、Markdown commands/skills、Python 3 标准库、Git

## Global Constraints

- 固定使用 Superpowers `6.1.1`，手动更新。
- 不安装、复制或注册独立的 `using-superpowers` skill。
- 未执行 `/use-superpowers` 的 session 不得自动加载 Superpowers 工作流。
- 激活状态只存在于当前 conversation history，不写全局状态文件。
- 不修改其他 plugins、已有本地 skills、agents 或 commands。
- OpenCode 配置、commands 和 skills 修改后必须退出并重启才生效。
- 未经用户明确要求，不创建 Git commit；计划中的检查点只检查 diff。

---

## File Structure

- Modify: `opencode.json` — 删除 Superpowers Git plugin 条目。
- Create: `commands/use-superpowers.md` — 当前 session 的显式激活入口，内联 bootstrap 与工具映射。
- Create: `skills/superpowers/<skill>/...` — 固定的上游 `6.1.1` skill 正文、参考资料和脚本；排除 `using-superpowers/`。
- Existing: `docs/superpowers/specs/2026-07-11-superpowers-command-activation-design.md` — 已批准设计，不再修改。

### Vendored skill directories

`brainstorming`、`dispatching-parallel-agents`、`executing-plans`、`finishing-a-development-branch`、`receiving-code-review`、`requesting-code-review`、`subagent-driven-development`、`systematic-debugging`、`test-driven-development`、`using-git-worktrees`、`verification-before-completion`、`writing-plans`、`writing-skills`。

---

### Task 1: Vendor and gate Superpowers skills

**Files:**
- Create: `skills/superpowers/brainstorming/**`
- Create: `skills/superpowers/dispatching-parallel-agents/**`
- Create: `skills/superpowers/executing-plans/**`
- Create: `skills/superpowers/finishing-a-development-branch/**`
- Create: `skills/superpowers/receiving-code-review/**`
- Create: `skills/superpowers/requesting-code-review/**`
- Create: `skills/superpowers/subagent-driven-development/**`
- Create: `skills/superpowers/systematic-debugging/**`
- Create: `skills/superpowers/test-driven-development/**`
- Create: `skills/superpowers/using-git-worktrees/**`
- Create: `skills/superpowers/verification-before-completion/**`
- Create: `skills/superpowers/writing-plans/**`
- Create: `skills/superpowers/writing-skills/**`

**Interfaces:**
- Consumes: installed package at `C:/Users/chika/.cache/opencode/packages/superpowers@git+https_/github.com/obra/superpowers.git/node_modules/superpowers`, whose `package.json` reports `6.1.1`.
- Produces: 13 discoverable local skills whose descriptions begin with the exact activation gate.

- [ ] **Step 1: Verify the pinned source before copying**

Run:

```bash
node -e "const p=require('C:/Users/chika/.cache/opencode/packages/superpowers@git+https_/github.com/obra/superpowers.git/node_modules/superpowers/package.json'); if(p.version!=='6.1.1') throw new Error('Expected 6.1.1, got '+p.version); console.log(p.version)"
```

Expected: prints `6.1.1` and exits `0`.

- [ ] **Step 2: Copy all upstream skill assets except `using-superpowers`**

Run this exact Python program from the repository root:

```bash
python - <<'PY'
from pathlib import Path
import shutil

source = Path(r'C:/Users/chika/.cache/opencode/packages/superpowers@git+https_/github.com/obra/superpowers.git/node_modules/superpowers/skills')
target = Path('skills/superpowers')
expected = {
    'brainstorming',
    'dispatching-parallel-agents',
    'executing-plans',
    'finishing-a-development-branch',
    'receiving-code-review',
    'requesting-code-review',
    'subagent-driven-development',
    'systematic-debugging',
    'test-driven-development',
    'using-git-worktrees',
    'verification-before-completion',
    'writing-plans',
    'writing-skills',
}
actual = {path.name for path in source.iterdir() if path.is_dir()} - {'using-superpowers'}
if actual != expected:
    raise SystemExit(f'Unexpected Superpowers skill set: {sorted(actual)}')
if target.exists():
    raise SystemExit(f'Refusing to overwrite existing directory: {target}')
target.mkdir(parents=True)
for name in sorted(expected):
    shutil.copytree(source / name, target / name)
PY
```

Expected: exits `0`; `skills/superpowers/` contains exactly the 13 listed directories.

- [ ] **Step 3: Add the activation gate to top-level frontmatter descriptions**

Run:

```bash
python - <<'PY'
from pathlib import Path
import re

root = Path('skills/superpowers')
gate = 'Use ONLY when the current session has been activated by the user running /use-superpowers. '
files = sorted(root.glob('*/SKILL.md'))
if len(files) != 13:
    raise SystemExit(f'Expected 13 SKILL.md files, found {len(files)}')
for path in files:
    text = path.read_text(encoding='utf-8')
    match = re.match(r'\A---\n(?P<frontmatter>.*?)\n---\n', text, re.S)
    if not match:
        raise SystemExit(f'Missing frontmatter: {path}')
    frontmatter = match.group('frontmatter')
    lines = frontmatter.splitlines()
    description_indexes = [index for index, line in enumerate(lines) if line.startswith('description:')]
    if description_indexes != [1]:
        raise SystemExit(f'Expected one top-level description on line 3: {path}')
    index = description_indexes[0]
    original = lines[index].removeprefix('description:').strip()
    if original.startswith(('"', "'")) and original.endswith(original[0]):
        original = original[1:-1]
    lines[index] = f'description: "{gate}{original.replace(chr(34), chr(92) + chr(34))}"'
    replacement = '---\n' + '\n'.join(lines) + '\n---\n'
    path.write_text(replacement + text[match.end():], encoding='utf-8', newline='\n')
PY
```

Expected: exits `0`; only each file's first frontmatter `description` changes. Examples inside skill bodies remain unchanged.

- [ ] **Step 4: Verify the vendored tree and gates**

Run:

```bash
python - <<'PY'
from pathlib import Path
import re

root = Path('skills/superpowers')
gate = 'description: "Use ONLY when the current session has been activated by the user running /use-superpowers. '
skills = sorted(root.glob('*/SKILL.md'))
assert len(skills) == 13, len(skills)
assert not (root / 'using-superpowers').exists()
for skill in skills:
    text = skill.read_text(encoding='utf-8')
    assert re.match(r'\A---\nname: [a-z0-9-]+\n', text), skill
    assert gate in text.split('\n---\n', 1)[0], skill
print('verified 13 gated Superpowers skills')
PY
```

Expected: `verified 13 gated Superpowers skills`.

- [ ] **Step 5: Inspect the task diff checkpoint**

Run: `git status --short && git diff --stat`

Expected: only new files under `skills/superpowers/` plus the already approved design/plan documents are shown; no `using-superpowers` directory exists.

---

### Task 2: Create the session activation command

**Files:**
- Create: `commands/use-superpowers.md`

**Interfaces:**
- Consumes: upstream `skills/using-superpowers/SKILL.md` from fixed version `6.1.1`.
- Produces: `/use-superpowers`, a no-argument command whose message records activation and installs the bootstrap rules into current session context.

- [ ] **Step 1: Generate the command from the fixed upstream bootstrap**

Run:

```bash
python - <<'PY'
from pathlib import Path
import re

source = Path(r'C:/Users/chika/.cache/opencode/packages/superpowers@git+https_/github.com/obra/superpowers.git/node_modules/superpowers/skills/using-superpowers/SKILL.md')
target = Path('commands/use-superpowers.md')
if target.exists():
    raise SystemExit(f'Refusing to overwrite existing command: {target}')
text = source.read_text(encoding='utf-8')
match = re.match(r'\A---\n.*?\n---\n(?P<body>.*)\Z', text, re.S)
if not match:
    raise SystemExit('Cannot parse upstream using-superpowers frontmatter')
body = match.group('body').rstrip()
tool_mapping = '''**Tool Mapping for OpenCode:**
When skills request actions, substitute OpenCode equivalents:
- Create or update todos → `todowrite`
- `Subagent (general-purpose):` → `task` with the closest available specialist `subagent_type`
- Invoke a skill → OpenCode's native `skill` tool
- Read files → `read`
- Create, edit, or delete files → `apply_patch`
- Run shell commands → `bash`
- Search files → `grep`, `glob`
- Fetch a URL → `webfetch`

Use OpenCode's native `skill` tool to load applicable Superpowers skills.'''
command = f'''---
description: Activate the vendored Superpowers workflow for the current session.
---

<EXTREMELY_IMPORTANT>
The user has explicitly activated Superpowers for this session by running `/use-superpowers`.
Treat this command message as the session activation marker. Apply the following rules to every subsequent response and action in this session. Do not claim activation in any other session.

{body}

{tool_mapping}
</EXTREMELY_IMPORTANT>
'''
target.write_text(command, encoding='utf-8', newline='\n')
PY
```

Expected: exits `0` and creates `commands/use-superpowers.md` without a `$ARGUMENTS` placeholder.

- [ ] **Step 2: Verify command structure and inline content**

Run:

```bash
python - <<'PY'
from pathlib import Path

path = Path('commands/use-superpowers.md')
text = path.read_text(encoding='utf-8')
required = [
    'description: Activate the vendored Superpowers workflow for the current session.',
    'The user has explicitly activated Superpowers for this session by running `/use-superpowers`.',
    '## The Rule',
    '## Skill Priority',
    '## Red Flags',
    '**Tool Mapping for OpenCode:**',
    "OpenCode's native `skill` tool",
]
for value in required:
    assert value in text, value
assert '$ARGUMENTS' not in text
assert text.count('<EXTREMELY_IMPORTANT>') == 1
assert text.count('</EXTREMELY_IMPORTANT>') == 1
print('verified /use-superpowers command')
PY
```

Expected: `verified /use-superpowers command`.

- [ ] **Step 3: Inspect the task diff checkpoint**

Run: `git diff -- commands/use-superpowers.md && git status --short`

Expected: the command contains one frontmatter block, one activation wrapper, the complete upstream bootstrap body, and the OpenCode tool mapping.

---

### Task 3: Remove automatic plugin activation

**Files:**
- Modify: `opencode.json:51-56`

**Interfaces:**
- Consumes: existing `plugin` array.
- Produces: plugin array containing `opencode-direnv`, pinned DCP, and `oh-my-opencode-slim@2.1.1`, but no Superpowers entry.

- [ ] **Step 1: Record the expected precondition**

Run:

```bash
python - <<'PY'
import json
from pathlib import Path

plugins = json.loads(Path('opencode.json').read_text(encoding='utf-8-sig'))['plugin']
matches = [item for item in plugins if isinstance(item, str) and item.startswith('superpowers@')]
assert matches == ['superpowers@git+https://github.com/obra/superpowers.git'], matches
print('automatic Superpowers plugin is present')
PY
```

Expected: `automatic Superpowers plugin is present`.

- [ ] **Step 2: Delete only the Superpowers plugin entry**

Change this block:

```json
    "oh-my-opencode-slim@2.1.1",
    "superpowers@git+https://github.com/obra/superpowers.git"
```

to:

```json
    "oh-my-opencode-slim@2.1.1"
```

- [ ] **Step 3: Validate JSON and preserved plugin entries**

Run:

```bash
python - <<'PY'
import json
from pathlib import Path

config = json.loads(Path('opencode.json').read_text(encoding='utf-8-sig'))
plugins = config['plugin']
assert config['$schema'] == 'https://opencode.ai/config.json'
assert plugins == [
    'opencode-direnv',
    '@tarquinen/opencode-dcp@git+https://github.com/Chikage0o0/opencode-dynamic-context-pruning.git#588ba2a5bc2160065131469097d5ab5639af9bd6',
    'oh-my-opencode-slim@2.1.1',
]
print('validated opencode.json plugin migration')
PY
```

Expected: `validated opencode.json plugin migration`.

- [ ] **Step 4: Inspect the task diff checkpoint**

Run: `git diff -- opencode.json`

Expected: exactly one plugin array entry is removed; no other configuration changes.

---

### Task 4: Static integration verification and manual restart checks

**Files:**
- Verify: `opencode.json`
- Verify: `commands/use-superpowers.md`
- Verify: `skills/superpowers/**`

**Interfaces:**
- Consumes: outputs of Tasks 1–3.
- Produces: evidence that the static configuration satisfies the design, followed by restart-only runtime checks.

- [ ] **Step 1: Run one static integration check**

Run:

```bash
python - <<'PY'
from pathlib import Path
import json

config = json.loads(Path('opencode.json').read_text(encoding='utf-8-sig'))
assert not any(isinstance(item, str) and item.startswith('superpowers@') for item in config['plugin'])
root = Path('skills/superpowers')
skills = sorted(root.glob('*/SKILL.md'))
assert len(skills) == 13
assert not (root / 'using-superpowers').exists()
for path in skills:
    frontmatter = path.read_text(encoding='utf-8').split('\n---\n', 1)[0]
    assert '/use-superpowers' in frontmatter, path
command = Path('commands/use-superpowers.md').read_text(encoding='utf-8')
assert 'The user has explicitly activated Superpowers for this session' in command
assert '## The Rule' in command
assert '**Tool Mapping for OpenCode:**' in command
print('static integration checks passed')
PY
```

Expected: `static integration checks passed`.

- [ ] **Step 2: Review the complete diff**

Run: `git status --short && git diff -- opencode.json commands/use-superpowers.md skills/superpowers docs/superpowers/specs/2026-07-11-superpowers-command-activation-design.md docs/superpowers/plans/2026-07-11-superpowers-command-activation.md`

Expected: no unrelated files changed; no secrets, generated caches, package changes, symlinks, or `using-superpowers` skill were added.

- [ ] **Step 3: Restart OpenCode**

Quit the current OpenCode process completely, then start it normally from `C:/Users/chika/.config/opencode`.

Expected: OpenCode starts without `ConfigInvalidError`; `/use-superpowers` appears in command completion; the 13 gated skills are discoverable.

- [ ] **Step 4: Verify default-off behavior in a fresh session**

Create a new session and send a small ordinary request without running `/use-superpowers`.

Expected: the first user message contains no plugin-injected `<EXTREMELY_IMPORTANT>` bootstrap, and no vendored Superpowers skill is loaded merely because the ordinary request matches its original trigger.

- [ ] **Step 5: Verify current-session activation**

Create another new session, run `/use-superpowers`, then request a task that clearly matches `brainstorming` or `systematic-debugging`.

Expected: the command's inline bootstrap is present in conversation history; the matching vendored skill is loaded through OpenCode's `skill` tool before other action; subsequent requests in the same session continue following the bootstrap.

- [ ] **Step 6: Verify activation does not leak**

Create one more new session and repeat an ordinary matching request without running the command.

Expected: Superpowers remains inactive; no activation marker or bootstrap carries over from the previous session.

- [ ] **Step 7: Final status checkpoint**

Run: `git status --short`

Expected: only the approved design, implementation plan, `opencode.json`, `commands/use-superpowers.md`, and `skills/superpowers/**` are modified/untracked. Do not commit unless the user explicitly requests it.
