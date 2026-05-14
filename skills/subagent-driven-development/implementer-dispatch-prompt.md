# 实现者分派提示词模板

在向真正的 implementer 子代理分派单个计划任务时，使用此模板。

**会话边界规则：** 当控制器从任务 N 移动到任务 N+1 时，必须启动新的 `implementer` 子代理会话。若同一任务内再次派遣 `implementer`（澄清、`NEEDS_CONTEXT`、`BLOCKED` 后补充上下文或修复循环），必须传入该任务中上一次 `implementer` 的 `task_id`。提交不是实现者派遣场景；任务提交只能由控制器通过 `git-commit` 技能处理。

```text
OpenCode `task` tool:
  description: "Implement Task N: [task title]"
  subagent_type: "implementer"
  prompt: |
    task_title: [Task N title]

    task_goal: [One-sentence task goal]

    spec_doc_path: [Path to spec document, or "none" if not applicable]

    task_scope: |
      [List the specific requirements from the spec that this task covers.
      Include acceptance criteria and expected behaviors.]

    plan_file: [Path to plan file]

    plan_line_range: [Start line - End line for this task in the plan file]

    repo_path: [Absolute repository path]

    constraints: |
      [Task-specific constraints, including:
      - do not broaden scope
      - never commit; approved task commits are handled only by the controller through the git-commit skill
      - no unrelated refactors
      - language, API, or compatibility constraints from the spec
      - any repo or branch restrictions that matter for this task]

    verification_requirements: |
      [List the exact verification commands to run and what success means for each.]

    expected_output: |
      Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
      Summary: what was implemented or attempted
      Verification: commands run and results
      Files changed: exact paths
      Concerns: important follow-up notes
      Blocking reason: if blocked
      Context needed: if more context is required

    Additional instructions:
    - Read the plan file at the specified line range to get full task details
    - Use spec_doc_path to understand the broader context and requirements
    - If key context is missing, return `NEEDS_CONTEXT` instead of guessing
    - If asked to commit, return `BLOCKED` and state that the controller must use the `git-commit` skill
```
