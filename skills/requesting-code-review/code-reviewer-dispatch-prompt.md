# 代码审查者调度提示模板

使用此模板在调度真正的 code-reviewer 子代理进行已提交范围或分支范围审查时。

```text
OpenCode `task` tool:
  description: "Review committed range: [review goal]"
  subagent_type: "code-reviewer"
  prompt: |
    review_goal: [What this review should decide, for example merge readiness or milestone readiness]

    full_context: |
      [Describe what was implemented, why it matters, and any branch or release context
      the reviewer needs to understand the change.]

    requirements_context: |
      [Paste the relevant plan or spec excerpts that define expected behavior.
      Include enough detail that the reviewer can judge missing behavior and risk.]

    diff_base: [BASE_SHA]

    diff_target: [HEAD_SHA]

    current_diff_or_range: |
      Review the committed range with:
      - git diff --stat [BASE_SHA]..[HEAD_SHA]
      - git diff [BASE_SHA]..[HEAD_SHA]

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
    - Findings first, summary second.
    - Review the actual committed range instead of relying on the author summary.
    - If there are no findings, say `Findings: none`.
```
