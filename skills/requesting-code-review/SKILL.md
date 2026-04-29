---
name: requesting-code-review
description: "派遣审查子代理对代码进行独立评审，及早发现问题。强制触发：完成重大功能后、合并到 main 前。可选触发：卡住时需要新鲜视角、重构前需要基线检查、修复复杂 bug 后。subagent-driven-development 场景中使用专用 reviewer 而非本技能的标准流程。"
---

# 请求代码审查

使用 `task` 工具派遣 OpenCode 审查子代理，在问题扩散之前捕获它们。审查者获得精心构建的评估上下文 —— 绝不包含你的会话历史。这让审查者专注于工作产出，而非你的思考过程，同时保留你自己的上下文以便继续工作。

**核心原则：** 及早审查，频繁审查。

## 何时请求审查

**强制要求：**
- 完成重大功能后
- 合并到 main 前

**可选但很有价值：**
- 卡住时（需要新视角）
- 重构前（基线检查）
- 修复复杂 bug 后

## 如何请求

**subagent-driven-development 例外：**

对于提交前任务审查，请勿使用下方的已提交范围流程。在该工作流中，控制器应等待规格合规性通过后，再派遣任务特定的提示词，提示词位于 `skills/subagent-driven-development/code-reviewer-dispatch-prompt.md`，用于审查当前工作树与 `BASE_SHA` 的差异。

审查已提交的范围（例如合并前的重大功能）时，请使用以下步骤。

**1. 获取 git SHA：**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 派遣审查子代理：**

使用 OpenCode 的 `task` 工具，并设置 `subagent_type: "code-reviewer"`，然后填写 `code-reviewer-dispatch-prompt.md` 中的提示词模板。

**需提供的字段：**
- `review_goal` —— 审查应支持什么决策
- `full_context` —— 你构建了什么以及它的重要性
- `requirements_context` —— 代码应满足的计划或需求
- `diff_base` —— 起始提交
- `diff_target` —— 已提交范围审查的结束提交

**3. 根据反馈采取行动：**
- 立即修复 Critical 级别的问题
- 继续前先修复 Important 级别的问题
- 记录 Minor 级别的问题稍后处理
- 如果审查者错了，予以反驳（给出理由）

## 示例

```
[Just completed a major feature and want review before merge]

You: Let me request code review before proceeding.

BASE_SHA=$(git merge-base HEAD origin/main)
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch reviewer subagent via OpenCode `task`]
  review_goal: Confirm the search indexing and repair feature is ready to merge
  full_context: Added indexing, verification, and repair flows for conversation search
  requirements_context: Task 2 from docs/plans/active/deployment-plan.md
  diff_base: a7981ec
  diff_target: 3df7661

[Subagent returns]:
  Status: CHANGES_REQUIRED
  Findings:
    [Important] Missing progress indicators for long-running repair operations
    [Minor] Magic number (100) for reporting interval
  Summary: Ready after fixing the important issue

You: [Fix progress indicators]
[Continue to Task 3]
```

## 与工作流集成

**Subagent-Driven Development：**
- 首先完成任务规格合规性审查
- 然后审查未提交任务与 `BASE_SHA` 的差异
- 使用 `skills/subagent-driven-development/code-reviewer-dispatch-prompt.md`（单个未提交任务审查），而非 `skills/requesting-code-review/code-reviewer-dispatch-prompt.md`（已提交范围审查）

**Executing Plans：**
- 每批（3 个任务）结束后进行审查
- 获取反馈、应用、继续

**Ad-Hoc Development：**
- 合并前审查
- 卡住时审查

## 危险信号

**切勿：**
- 因为"很简单"而跳过审查
- 忽略 Critical 级别的问题
- 在 Important 级别的问题未修复的情况下继续
- 与有效的技术反馈争辩

**如果审查者错了：**
- 用技术理由反驳
- 展示证明其有效的代码/测试
- 请求澄清

查看模板：`./code-reviewer-dispatch-prompt.md`
