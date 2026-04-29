# Spec Reviewer 调度提示模板

请在调度真正的 `spec-reviewer` 子代理执行单个计划任务审查周期时使用此模板。

**会话边界规则：** 仅针对同一任务的修复-审查循环复用同一个审查者会话。对于不同的计划任务，请开启一个新会话。

```text
OpenCode `task` tool:
  description: "Review spec compliance for Task N: [task title]"
  subagent_type: "spec-reviewer"
  prompt: |
    review_target: [Task N title and short scope]

    spec_doc_path: [Path to spec document, or "none" if not applicable]

    task_scope: |
      [List the specific requirements from the spec that this task covers.
      Include acceptance criteria and expected behaviors.]

    plan_file: [Path to plan file]

    plan_line_range: [Start line - End line for this task in the plan file]

    base_reference: [BASE_SHA or other exact review reference]

    current_diff_or_range: |
      [Tell the reviewer exactly what to inspect, for example:
      - git diff --stat [BASE_SHA]
      - git diff [BASE_SHA]
      or another precise committed range]

    review_constraints: |
      [This review is requirement-compliance only.
      Check for missing requirements, extra behavior, wrong interpretation,
      and ambiguity that blocks approval.
      Do not block on naming taste, refactor preferences, or style-only feedback.]

    expected_output: |
      Status: APPROVED | CHANGES_REQUIRED | BLOCKED
      missing_requirements:
      - none
      extra_behavior:
      - none
      ambiguous_items:
      - none
      blocking_findings:
      - none
      review_summary: one short paragraph

    Additional instructions:
    - Read the plan file at the specified line range to get full task details
    - Use spec_doc_path to understand the broader context and requirements
    - Inspect the actual code and diff. Do not trust the implementer report.
    - Use file:line references for every material finding.
```
