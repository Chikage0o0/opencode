# 小型任务开发流程

当任务规模判断为小型任务（< 3 个文件）且用户同意直接开发时，使用此流程。

## 流程概述

1. **主代理实现** — 直接在当前会话中实现功能
2. **派遣子代理代码审查** — 使用 `code-reviewer` 子代理审查实现
3. **处理审查反馈** — 修复问题并重新审查
4. **完成任务** — 审查通过后提交并收尾

## 详细步骤

### 步骤 1：主代理实现

- 直接在当前会话中实现功能
- 遵循 TDD 原则：先写测试，再写实现
- 完成后进行自检

### 步骤 2：派遣子代理代码审查

使用 `task` 工具派遣 `code-reviewer` 子代理，提供以下上下文：

- 设计上下文（来自头脑风暴阶段的相关设计部分）
- 当前工作差异（`git diff`）

### 步骤 3：处理审查反馈

- 如果审查发现问题，主代理修复
- 修复后重新派遣审查子代理
- 重复直到审查通过

### 步骤 4：完成任务

- 审查通过后，提交代码
- 使用 `finishing-a-development-branch` 技能完成收尾

## 子代理审查提示词模板

```text
OpenCode `task` tool:
  description: "Review code for small task: [task title]"
  subagent_type: "code-reviewer"
  prompt: |
    review_goal: Review the implementation for correctness, regression risk, and test coverage.

    design_context: |
      [Paste the relevant design sections from the brainstorming session.
      Include requirements, architecture decisions, and acceptance criteria.]

    current_diff_or_range: |
      Review the uncommitted changes with:
      - git diff --stat
      - git diff

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
    - Do not block on pure preference or speculative future refactors.
    - If there are no findings, say `Findings: none`.
```
