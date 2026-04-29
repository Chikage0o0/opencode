---
name: receiving-code-review
description: "接收代码审查反馈后的处理流程。触发：收到审查反馈，尤其反馈表述不清晰或技术上存疑时——必须先做独立技术验证再决定是否实施，禁止表演性附和（如「你说得对」）。核心原则：技术正确性优先于社交舒适。发生在 requesting-code-review 返回反馈之后、实施修改之前。"
---

# 代码审查接收

## 概述

代码审查需要的是技术评估，而不是情感表演。

**核心原则：** 实施前先验证。有疑问先询问。技术正确性优先于社交舒适。

## 响应模式

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## 禁止的回应

**绝不要：**
- "You're absolutely right!"（明确违反会话指令）
- "Great point!" / "Excellent feedback!"（表演性回应）
- "Let me implement that now"（验证前就直接实施）

**应该：**
- 重述技术需求
- 提出澄清问题
- 如果错误，用技术理由提出异议
- 直接开始工作（行动胜于言语）

## 处理不明确的反馈

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**示例：**
```
your human partner: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## 按来源分类的处理

### 来自 human partner
- **可信** — 理解后直接实施
- **仍然需要询问** 如果范围不明确
- **不要表演性附和**
- **直接行动** 或技术确认

### 来自外部审查者
```
BEFORE implementing:
  1. Check: Technically correct for THIS codebase?
  2. Check: Breaks existing functionality?
  3. Check: Reason for current implementation?
  4. Check: Works on all platforms/versions?
  5. Check: Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with your human partner's prior decisions:
  Stop and discuss with your human partner first
```

**human partner 的规则：** "外部反馈 — 保持怀疑，但仔细检查"

## 针对“专业”功能的 YAGNI 检查

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: Then implement properly
```

**human partner 的规则：** "你和审查者都向我汇报。如果我们不需要这个功能，就不要添加。"

## 实施顺序

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

## 何时提出异议

在以下情况提出异议：
- 建议会破坏现有功能
- 审查者缺乏完整上下文
- 违反 YAGNI（未使用的功能）
- 对本技术栈而言技术上不正确
- 存在遗留/兼容性原因
- 与 human partner 的架构决策冲突

**如何提出异议：**
- 使用技术理由，而不是防御性态度
- 提出具体问题
- 引用现有的测试/代码
- 如果涉及架构问题，请 human partner 介入

**如果不好意思直接提出异议，请发出信号：** "Strange things are afoot at the Circle K"

## 确认正确的反馈

当反馈确实正确时：
```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show in the code]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks for catching that!"
❌ "Thanks for [anything]"
❌ ANY gratitude expression
```

**为什么不要感谢：** 行动胜于言语。直接修复。代码本身就表明你听取了反馈。

**如果你发现自己要写 "Thanks"：** 删除它。陈述修复内容代替。

## 优雅地纠正你的异议

如果你提出异议后发现自己是错的：
```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
✅ "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

❌ Long apology
❌ Defending why you pushed back
❌ Over-explaining
```

事实性地陈述纠正内容，然后继续。

## 常见错误

| 错误 | 修正 |
|---------|-----|
| 表演性附和 | 陈述需求或直接行动 |
| 盲目实施 | 先对照代码库验证 |
| 批量修改但不测试 | 逐个修改，逐个测试 |
| 默认审查者是对的 | 检查是否会破坏现有功能 |
| 回避异议 | 技术正确性 > 社交舒适 |
| 部分实施 | 先澄清所有项目 |
| 无法验证仍继续 | 说明限制，请求指示 |

## 真实示例

**表演性附和（不好）：**
```
Reviewer: "Remove legacy code"
❌ "You're absolutely right! Let me remove that..."
```

**技术验证（好）：**
```
Reviewer: "Remove legacy code"
✅ "Checking... build target is 10.15+, this API needs 13+. Need legacy for backward compat. Current impl has wrong bundle ID - fix it or drop pre-13 support?"
```

**YAGNI（好）：**
```
Reviewer: "Implement proper metrics tracking with database, date filters, CSV export"
✅ "Grepped codebase - nothing calls this endpoint. Remove it (YAGNI)? Or is there usage I'm missing?"
```

**不明确项目（好）：**
```
your human partner: "Fix items 1-6"
You understand 1,2,3,6. Unclear on 4,5.
✅ "Understand 1,2,3,6. Need clarification on 4 and 5 before implementing."
```

## GitHub 线程回复

在回复 GitHub 上的行内审查评论时，请在评论线程中回复（`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`），而不是作为顶级 PR 评论。

## 核心原则

**外部反馈 = 需要评估的建议，而不是必须遵循的命令。**

验证。质疑。然后实施。

不要表演性附和。始终坚守技术严谨。
