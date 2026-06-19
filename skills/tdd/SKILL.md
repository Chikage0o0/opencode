---
name: tdd
description: Test-driven development with red-green-refactor loop for AI agents. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor" or "红绿重构", wants integration tests, asks for test-first development, or needs to avoid fragile implementation-detail assertions. Emphasizes one-test-at-a-time, minimal implementation, named refactors, and asking users only on public API changes, data format changes, high-risk operations, or unclear behavioral priority.
---

# Test-Driven Development

## 核心原则

**核心原则**：测试应通过稳定、受支持的边界验证行为，而不是绑定实现细节。代码内部可以重构，测试不应因此失效。

**好测试**偏 integration-style：通过 public API、CLI、HTTP endpoint、组件可访问输出等真实使用路径执行代码。它描述系统“做了什么”，而不是“内部怎么做”。测试名应像规格说明：`user can checkout with valid cart` 清楚表达能力。

**坏测试**绑定实现细节：mock 内部协作者、测试 private method、断言调用次数/顺序，或绕过接口直接查内部存储。警告信号是：只做内部重构，行为没变，测试却失败。

参考：

- [tests.md](tests.md)：好/坏测试模式、低脆弱断言
- [mocking.md](mocking.md)：mock 边界、test double 分类
- [refactoring.md](refactoring.md)：只在 GREEN 后重构
- [test-techniques.md](test-techniques.md)：Property-Based、Snapshot、Approval、Mutation Testing

## 反模式：Horizontal Slices

不要把 RED 理解为“一次写完所有测试”，再把 GREEN 理解为“一次写完所有实现”。这会让测试基于想象中的结构，而不是每轮反馈后的真实行为与设计。

更好的方式是 vertical slices / tracer bullets：一次只把 Test List 中的一项转成可运行测试，然后写最小实现让它通过。每个小切片提供快速反馈；下一条测试可以根据需求、领域规则和刚暴露出的设计信息调整，但 expected value 必须来自规格、领域知识或公共契约，不能来自刚写出的实现输出。

```
不推荐（horizontal）：
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

推荐（vertical）：
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Fast Path：什么时候不用反复问用户

低风险且需求明确的任务可以直接进入 RED，不要每写一个测试都等待用户批准：

- 明确的小 bug fix，预期行为清楚
- 给现有 public API 补缺失测试
- 重命名 local/internal 标识符，不改变 public API
- 文档修正
- 保持 public behavior 不变的局部重构

以下情况必须先问用户：

- 影响 public API、数据格式、协议行为或数据库结构
- 存在多种实现路径且权衡不清楚
- 用户没有说明哪些行为优先级最高
- 涉及高风险领域：auth、security、deployment、destructive operations
- 不确定某个断言是在验证行为还是实现细节

## Workflow

### 0. Test List

在第一轮 RED 前，列一个短的行为清单，并按风险/价值粗略排序。不要在这里展开所有测试细节。

- 每项是行为，不是函数名或实现步骤
- 优先验证最有价值、最容易出错或最能打通路径的行为
- 每轮只把一项转成具体测试
- 随着反馈更新清单，不要批量写完所有测试

### 1. Planning

探索代码库时，使用项目已有领域词汇命名测试，尊重相关 ADR、接口边界和测试约定。

非 fast-path 任务在写代码前确认：

- [ ] 需要什么 public interface 或行为变化
- [ ] 哪些行为最重要，哪些暂不覆盖
- [ ] 是否存在 [deep modules](deep-modules.md) 的机会
- [ ] 接口是否便于测试，参考 [interface-design.md](interface-design.md)
- [ ] Test List 只列行为，不列实现步骤
- [ ] 用户已确认关键取舍

你不可能测试一切。优先覆盖关键路径、复杂逻辑、错误路径和曾经出错的行为。

### 2. Tracer Bullet

写一个只验证一个行为的测试：

```
RED:   写第一个行为测试 → 测试失败，且失败原因正确
GREEN: 写最小实现 → 测试通过
```

Tracer bullet 的目标是证明路径端到端可行，而不是一次做完整功能。

### 3. Incremental Loop

对剩余行为逐项循环：

```
RED:   写下一个测试 → 因目标行为尚未实现而失败
GREEN: 只写足够通过当前测试的生产代码 → 通过
```

规则：

- 一次一个测试
- 一个测试验证一个行为
- 只写当前测试所需的最小生产代码
- 不提前实现未来测试
- 测试聚焦外部可观察行为
- RED 必须因目标行为未实现而失败，不能是 typo、setup 错误或测试自身错误
- **GREEN 阶段禁止改测试**；如果测试错了，回到 RED 重新修正测试，再进入 GREEN

### 4. Refactor

所有测试 GREEN 后，查看 [refactor candidates](refactoring.md)：

- [ ] 消除重复
- [ ] 加深模块：把复杂度移到简单接口背后
- [ ] 在自然处应用 SOLID 原则
- [ ] 处理新代码暴露出的既有问题
- [ ] 每个 named refactor 后都运行测试

**RED 时绝不重构。** 每次重构都应有名字，例如 “extract helper”、“rename for clarity”、“introduce value object”，并且足够小：如果测试失败，你知道该撤回哪一步。

## AI Agent Guardrails

- **确认 RED**：修复前先读失败信息，确认失败原因是缺失行为，而不是环境、fixture 或断言写错。
- **GREEN 不改测试**：测试写好后，GREEN 阶段只改生产代码。若测试错了，明确回到 RED 修改。
- **不弱化断言**：不要删除断言、放宽断言，或把 actual output 粘贴成 expected value。
- **一个行为一个测试**：测试应只因一个行为失败；多个字段可以属于同一个逻辑结果，但不要做 kitchen-sink test。
- **机器可验证退出条件**：每轮以测试命令退出码为准，GREEN/REFACTOR 后测试套件应通过。
- **expected value 有来源**：期望值来自需求、领域规则、公共契约或人工确认，不来自当前实现碰巧输出的值。

## 每轮检查清单

```
[ ] 测试描述行为，不描述实现
[ ] 测试通过稳定受支持的边界执行
[ ] 内部重构时测试应保持稳定
[ ] RED 失败原因正确
[ ] GREEN 代码是当前测试的最小实现
[ ] GREEN 阶段没有改测试
[ ] 没有添加 speculative features
[ ] Refactor 已命名、只在 GREEN 后执行，并已验证
```
