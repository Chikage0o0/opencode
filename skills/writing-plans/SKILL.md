---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/plans/active/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)
Keep the plan in `docs/plans/active/` until the entire work item is complete, then move it to `docs/plans/completed/`.
- Default to Chinese for the plan document, including the title, section headings, task titles, step descriptions, list items, fixed prompts, and expected-result prose.
- If the user explicitly requests English or another language for the plan, follow the user's instruction instead of the default.
- Do not translate code blocks, shell commands, file paths, skill names, or identifiers unless the user explicitly asks for it.

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [功能名称] 实施计划

> **给代理执行者：** REQUIRED SUB-SKILL: 使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务执行本计划。步骤使用复选框 `- [ ]` 语法追踪。

**目标：** [一句话说明这份计划要完成什么]

**架构：** [2-3 句话说明实现思路]

**技术栈：** [关键技术与库]

---
```

## Task Structure

````markdown
### 任务 N：[组件名称]

**文件：**
- 新增：`exact/path/to/file.py`
- 修改：`exact/path/to/existing.py:123-145`
- 测试：`tests/exact/path/to/test.py`

- [ ] **步骤 1：先写失败测试**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **步骤 2：运行测试并确认失败**

运行：`pytest tests/path/test.py::test_name -v`
预期：FAIL，并看到 `function not defined`

- [ ] **步骤 3：编写最小实现**

```python
def function(input):
    return expected
```

- [ ] **步骤 4：运行测试并确认通过**

运行：`pytest tests/path/test.py::test_name -v`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- Reference relevant skills by exact skill name/path so the OpenCode controller can load them explicitly
- DRY, YAGNI, TDD, frequent commits

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Execution Handoff

After saving the plan, before offering any execution choice or starting implementation, ask with the OpenCode `question` tool:

**"Plan 已保存到 `docs/plans/active/<filename>.md`。在开始实施前，你要我先提交当前的 plan/spec 文档吗？"**

- This question is mandatory even if the user says to start coding immediately or already states a preferred execution mode.
- Do not combine this with the execution-mode question. Resolve the document-commit decision first.

**If the user wants the documents committed:**
- **REQUIRED SUB-SKILL:** Use `git-commit`
- Commit the current plan document plus any related spec edits that are part of the implementation handoff.
- After the commit succeeds, offer the execution choice below.

**If the user does not want a document commit yet:**
- Do not commit the docs.
- Offer the execution choice below.

After the document-commit question is resolved, offer execution choice with the OpenCode `question` tool:

**"有两种执行方式：**

**1. Subagent-Driven（推荐）** - 我为每个任务派发一个新的 subagent，在任务之间做评审，迭代更快

**2. Inline Execution** - 在当前会话中使用 `executing-plans` 执行任务，按检查点分批推进

**你希望采用哪一种？"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use `subagent-driven-development`
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use `executing-plans`
- Batch execution with checkpoints for review
