# Skill 产出 spec 与 plan 默认使用中文实施计划

> **给代理执行者：** REQUIRED SUB-SKILL: 使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务执行本计划。由于本次会修改现有 skill 文件，开始实施前还必须加载 `writing-skills`；在宣称完成前必须加载 `verification-before-completion`。步骤使用复选框 `- [ ]` 语法追踪。

**目标：** 让 `skills/brainstorming/SKILL.md` 与 `skills/writing-plans/SKILL.md` 明确要求 spec / plan 默认使用中文，同时允许用户显式要求其他语言覆盖默认值，并把 plan 模板中直接决定产物语言的标题、任务结构和固定问句切换为中文。

**架构：** 这是一次面向 skill 契约的最小文本改动，不改路径、不改生命周期、不翻译整个 skill 正文。实现分为三个闭环：先建立英文模板仍在场的 RED 基线，再分别修改 spec 产出契约与 plan 产出契约，最后用正反向搜索、代码评审和完成前验证确认只有目标语言契约发生变化。

**技术栈：** Markdown skill 文档、`rg`、OpenCode `apply_patch`、`writing-skills`、`requesting-code-review`、`verification-before-completion`

---

### 任务 1：建立中文化改造的 RED 基线

**文件：**
- 验证：`docs/specs/active/2026-04-09-skill-spec-plan-chinese-default-design.md`
- 验证：`skills/brainstorming/SKILL.md:109-132`
- 验证：`skills/writing-plans/SKILL.md:14-20`
- 验证：`skills/writing-plans/SKILL.md:46-62`
- 验证：`skills/writing-plans/SKILL.md:64-105`
- 验证：`skills/writing-plans/SKILL.md:136-162`

- [ ] **步骤 1：运行英文产物契约基线搜索**

```bash
rg -n 'Spec written and committed|# \[Feature Name\] Implementation Plan|Goal:|Architecture:|Tech Stack:|### Task N:' skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md
```

预期：两个目标文件中都能命中英文提示语或模板字段，证明当前产物契约仍偏向英文。

- [ ] **步骤 2：运行中文默认契约缺失基线搜索**

```bash
rg -n 'Default to Chinese for the spec document|Default to Chinese for the plan document|# \[功能名称\] 实施计划|### 任务 N：|Spec 已写入并提交到|Plan 已保存到' skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md
```

预期：无输出，证明默认中文契约、中文模板与中文固定问句都还没有落到核心 skill。

- [ ] **步骤 3：确认实现范围与已批准 spec 一致**

使用 OpenCode `read` 工具阅读 `docs/specs/active/2026-04-09-skill-spec-plan-chinese-default-design.md`。

预期：spec 明确把修改范围限制在 `skills/brainstorming/SKILL.md` 与 `skills/writing-plans/SKILL.md`，并保持路径、命名与生命周期规则不变。

- [ ] **步骤 4：不要提交**

在用户明确要求之前，不执行任何 git commit。

### 任务 2：让 brainstorming 默认产出中文 spec

**文件：**
- 修改：`skills/brainstorming/SKILL.md:109-130`
- 验证：`skills/brainstorming/SKILL.md`

- [ ] **步骤 1：在 spec 文档规则中加入默认中文与可覆盖契约**

```diff
*** Update File: skills/brainstorming/SKILL.md
@@
 - Write the validated design (spec) to `docs/specs/active/YYYY-MM-DD-<topic>-design.md`
 - Keep the spec in `docs/specs/active/` until the entire work item is complete, then move it to `docs/specs/completed/`
   - (User preferences for spec location override this default)
+- Default to Chinese for the spec document, including the title, headings, body text, lists, and fixed prompt language.
+- If the user explicitly requests English or another language for the spec, follow the user's instruction instead of the default.
+- Do not translate code blocks, shell commands, file paths, skill names, or identifiers unless the user explicitly asks for it.
 - Use elements-of-style:writing-clearly-and-concisely skill if available
```

这一步只改 spec 产物契约，不改路径与归档规则。

- [ ] **步骤 2：把 spec 审阅提示语改成中文**

```diff
*** Update File: skills/brainstorming/SKILL.md
@@
-> "Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."
+> "Spec 已写入并提交到 `<path>`。请先审阅；如果你希望调整，请在开始编写实施计划之前告诉我。"
```

保持原有流程节点不变，只把固定提示语改成中文。

- [ ] **步骤 3：验证 brainstorming 已同时保留路径规则与新增中文契约**

```bash
rg -n 'docs/specs/active|docs/specs/completed|Default to Chinese for the spec document|If the user explicitly requests English or another language for the spec|Spec 已写入并提交到' skills/brainstorming/SKILL.md
```

预期：既能看到原有 `docs/specs/active` / `docs/specs/completed` 路径约束，也能看到默认中文、用户可覆盖和中文审阅提示语。

### 任务 3：让 writing-plans 默认产出中文 plan

**文件：**
- 修改：`skills/writing-plans/SKILL.md:18-20`
- 修改：`skills/writing-plans/SKILL.md:46-105`
- 修改：`skills/writing-plans/SKILL.md:136-162`
- 验证：`skills/writing-plans/SKILL.md`

- [ ] **步骤 1：在 plan 文档规则中加入默认中文与可覆盖契约**

```diff
*** Update File: skills/writing-plans/SKILL.md
@@
 **Save plans to:** `docs/plans/active/YYYY-MM-DD-<feature-name>.md`
 - (User preferences for plan location override this default)
 Keep the plan in `docs/plans/active/` until the entire work item is complete, then move it to `docs/plans/completed/`.
+- Default to Chinese for the plan document, including the title, section headings, task titles, step descriptions, list items, fixed prompts, and expected-result prose.
+- If the user explicitly requests English or another language for the plan, follow the user's instruction instead of the default.
+- Do not translate code blocks, shell commands, file paths, skill names, or identifiers unless the user explicitly asks for it.
```

这一步只补语言契约，不改 plan 文件路径与生命周期说明。

- [ ] **步骤 2：把 plan 头模板改成中文字段**

```diff
*** Update File: skills/writing-plans/SKILL.md
@@
-# [Feature Name] Implementation Plan
+# [功能名称] 实施计划
 
-> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
+> **给代理执行者：** REQUIRED SUB-SKILL: 使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务执行本计划。步骤使用复选框 `- [ ]` 语法追踪。
 
-**Goal:** [One sentence describing what this builds]
+**目标：** [一句话说明这份计划要完成什么]
 
-**Architecture:** [2-3 sentences about approach]
+**架构：** [2-3 句话说明实现思路]
 
-**Tech Stack:** [Key technologies/libraries]
+**技术栈：** [关键技术与库]
```

确保最上层标题、固定导语和头部字段都直接引导产出中文 plan。

- [ ] **步骤 3：把任务结构示例与交接问句改成中文**

```diff
*** Update File: skills/writing-plans/SKILL.md
@@
-### Task N: [Component Name]
+### 任务 N：[组件名称]
 
-**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`
+**文件：**
+- 新增：`exact/path/to/file.py`
+- 修改：`exact/path/to/existing.py:123-145`
+- 测试：`tests/exact/path/to/test.py`
 
- [ ] **Step 1: Write the failing test**
+- [ ] **步骤 1：先写失败测试**
@@
- [ ] **Step 2: Run test to verify it fails**
+- [ ] **步骤 2：运行测试并确认失败**
 
-Run: `pytest tests/path/test.py::test_name -v`
-Expected: FAIL with "function not defined"
+运行：`pytest tests/path/test.py::test_name -v`
+预期：FAIL，并看到 `function not defined`
@@
- [ ] **Step 3: Write minimal implementation**
+- [ ] **步骤 3：编写最小实现**
@@
- [ ] **Step 4: Run test to verify it passes**
+- [ ] **步骤 4：运行测试并确认通过**
 
-Run: `pytest tests/path/test.py::test_name -v`
-Expected: PASS
+运行：`pytest tests/path/test.py::test_name -v`
+预期：PASS
@@
- [ ] **Step 5: Commit**
+- [ ] **步骤 5：提交**
@@
-**"Plan complete and saved to `docs/plans/active/<filename>.md`. Before we start implementation, do you want me to commit the current plan/spec documents first?"**
+**"Plan 已保存到 `docs/plans/active/<filename>.md`。在开始实施前，你要我先提交当前的 plan/spec 文档吗？"**
@@
-**"Two execution options:**
+**"有两种执行方式：**
 
-**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
+**1. Subagent-Driven（推荐）** - 我为每个任务派发一个新的 subagent，在任务之间做评审，迭代更快
 
-**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints
+**2. Inline Execution** - 在当前会话中使用 `executing-plans` 执行任务，按检查点分批推进
 
-**Which approach?"**
+**你希望采用哪一种？"**
```

代码块中的命令、路径与标识符保持原样，只翻译 plan 的自然语言骨架。

- [ ] **步骤 4：验证 writing-plans 已切换到中文模板与中文问句**

```bash
rg -n 'Default to Chinese for the plan document|# \[功能名称\] 实施计划|### 任务 N：|\*\*目标：\*\*|\*\*架构：\*\*|\*\*技术栈：\*\*|Plan 已保存到|有两种执行方式|Subagent-Driven（推荐）|Inline Execution' skills/writing-plans/SKILL.md
```

预期：命中默认中文契约、中文头模板、中文任务结构示例与中文执行交接问句。

- [ ] **步骤 5：确认旧的英文模板字段已从关键生成位置移除**

```bash
rg -n '# \[Feature Name\] Implementation Plan|Goal:|Architecture:|Tech Stack:|### Task N:|Plan complete and saved to|Two execution options:' skills/writing-plans/SKILL.md
```

预期：无输出，说明直接决定 plan 产物语言的关键模板已不再保留英文版本。

### 任务 4：做收尾验证并请求评审

**文件：**
- 验证：`skills/brainstorming/SKILL.md`
- 验证：`skills/writing-plans/SKILL.md`
- 审阅：`docs/specs/active/2026-04-09-skill-spec-plan-chinese-default-design.md`
- 审阅：`docs/plans/active/2026-04-09-skill-spec-plan-chinese-default.md`

- [ ] **步骤 1：运行正向验证，确认 spec 与 plan 的默认中文契约都已落地**

```bash
rg -n 'Default to Chinese for the spec document|Spec 已写入并提交到|Default to Chinese for the plan document|# \[功能名称\] 实施计划|### 任务 N：|Plan 已保存到|有两种执行方式' skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md
```

预期：能同时看到 spec 规则、spec 审阅提示语、plan 规则、plan 中文模板和 plan 中文交接问句。

- [ ] **步骤 2：运行变更范围检查，确认只改了两个目标 skill 文件**

```bash
git diff --stat -- skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md
```

预期：输出只涉及 `skills/brainstorming/SKILL.md` 与 `skills/writing-plans/SKILL.md`，符合 spec 的最小改动边界。

- [ ] **步骤 3：使用 `requesting-code-review` 对当前 diff 做评审**

评审范围只包含 `skills/brainstorming/SKILL.md` 与 `skills/writing-plans/SKILL.md` 当前 diff。

预期：没有阻塞性问题；如果有阻塞性问题，先修复再继续。

- [ ] **步骤 4：使用 `verification-before-completion` 复核完成声明所需证据**

把本计划中的正反向 `rg` 结果和 `git diff --stat` 结果作为完成证据重新检查一遍，确认回答以下四个问题都为“是”：

```text
1. brainstorming 现在会默认要求 spec 使用中文吗？
2. writing-plans 现在会默认要求 plan 使用中文吗？
3. 用户明确要求英文或其他语言时，默认中文会被覆盖吗？
4. 技术标识符、命令、路径和代码块仍然保持原样吗？
```

预期：四个问题都能从修改后的 skill 文本中直接指到证据。

- [ ] **步骤 5：不要提交，向用户汇报并等待下一步指令**

除非用户明确要求提交，否则只汇报验证结果，不执行 git commit。
