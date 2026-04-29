# Code Reviewer 调度提示模板

使用此模板在调度真正的 `code-reviewer` 子代理，对单个未提交的 plan 任务进行代码审查。

**会话边界规则：** 仅在同一任务的修复-审查循环中复用同一个审查者会话。针对不同的 plan 任务，请开启新会话。

```text
OpenCode `task` tool:
  description: "Review code for Task N: [task title]"
  subagent_type: "code-reviewer"
  prompt: |
    review_goal: Review the current task before commit for correctness, regression risk, unsafe assumptions, and test gaps.

    spec_doc_path: [Path to spec document, or "none" if not applicable]

    task_scope: |
      [List the specific requirements from the spec that this task covers.
      Include acceptance criteria and expected behaviors.]

    plan_file: [Path to plan file]

    plan_line_range: [Start line - End line for this task in the plan file]

    diff_base: [BASE_SHA]

    diff_target: working-tree

    current_diff_or_range: |
      Review the uncommitted task diff against [BASE_SHA] with:
      - git diff --stat [BASE_SHA]
      - git diff [BASE_SHA]

    severity_policy: |
      Critical: correctness, security, data loss, or broken core behavior
      Important: likely regression, missing validation, unsafe assumptions, or material test gaps
      Minor: non-blocking maintainability or clarity improvements

    expected_output: |
      Status: APPROVED | CHANGES_REQUIRED | BLOCKED
      Findings:
      - [severity] file:line - issue, risk, and required fix direction
      Summary: short secondary summary after findings

    Additional instructions:
    - Read the plan file at the specified line range to get full task details
    - Use spec_doc_path to understand the broader context and requirements
    - Findings first, summary second.
    - Do not block on pure preference or speculative future refactors.
    - If there are no findings, say `Findings: none`.
```
