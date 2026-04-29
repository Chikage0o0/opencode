---
name: verification-before-completion
description: "终端关卡：在任何完成/成功声明前强制运行验证命令并确认输出，证据在断言之前。触发：即将说「完成了」「修好了」「通过了」时、提交前、创建 PR 前、移到下一任务前、委派给代理前。禁止含混表述如「应该能工作」「可能好了」「似乎可以」。无例外——没有新鲜验证证据就没有完成声明。"
---

# 完成前验证

## 概述

未经验证就声称工作完成，不是高效，而是不诚实。

**核心原则：** 永远先拿出证据，再做出声明。

**违反规则的字面规定，就是违反规则的精神实质。**

## 铁律

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

如果你在当前这次对话中还没有运行验证命令，你就不能声称它通过了。

## 关卡函数

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## 常见失败

| 声明 | 需要 | 不足以证明 |
|-------|----------|----------------|
| 测试通过 | 测试命令输出：0 失败 | 之前的运行结果、"应该能通过" |
| Linter 无错误 | Linter 输出：0 错误 | 部分检查、外推 |
| 构建成功 | 构建命令：exit 0 | Linter 通过、日志看起来正常 |
| Bug 已修复 | 测试原始症状：通过 | 代码已修改、假设已修复 |
| 回归测试有效 | 红绿循环已验证 | 测试只通过一次 |
| 代理已完成 | VCS diff 显示有变更 | 代理报告"成功" |
| 需求已满足 | 逐行核对清单 | 测试通过 |

## 危险信号 —— 立刻停止

- 使用"应该"、"可能"、"似乎"
- 在验证前表达满意（"太棒了！"、"完美！"、"完成了！"等）
- 即将 commit/push/PR 却没有验证
- 轻信代理的成功报告
- 依赖部分验证
- 想着"就这一次"
- 累了，想快点收工
- **任何在未运行验证的情况下暗示成功的措辞**

## 防止合理化借口

| 借口 | 现实 |
|--------|---------|
| "现在应该能工作了" | 去运行验证 |
| "我有信心" | 信心 ≠ 证据 |
| "就这一次" | 没有例外 |
| "Linter 通过了" | Linter ≠ 编译器 |
| "代理说成功了" | 独立验证 |
| "我累了" | 疲惫 ≠ 借口 |
| "部分检查就够了" | 部分检查什么也证明不了 |
| "措辞不同所以规则不适用" | 精神高于字面 |

## 关键模式

**测试：**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**回归测试（TDD 红绿循环）：**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**构建：**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**需求：**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**代理委派：**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## 为什么这很重要

来自 24 次失败记忆的教训：
- 你的人类搭档说"我不相信你"——信任破裂
- 带未定义函数就交付——会导致崩溃
- 遗漏需求就交付——功能不完整
- 在虚假的完成上浪费时间 → 重新定向 → 返工
- 违反了："诚实是核心价值观。如果你撒谎，你就会被替换。"

## 何时应用

**在以下情况之前，永远执行：**
- 任何形式的成功/完成声明
- 任何形式的满意表达
- 任何关于工作状态的正面陈述
- 提交代码、创建 PR、完成任务
- 转移到下一个任务
- 委派给代理

**规则适用于：**
- 确切的措辞
- 转述和同义词
- 成功的暗示
- 任何暗示完成/正确的沟通

## 底线

**验证没有捷径。**

运行命令。阅读输出。然后再声明结果。

这是不可协商的。
