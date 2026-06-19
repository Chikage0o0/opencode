# Advanced Test Techniques

这些技术是 example-based TDD 的补充，不是替代品。只有在它们能提高信心、降低维护成本时才使用。

## Property-Based Testing (PBT)

PBT 生成大量输入，并验证某个 property / invariant 总是成立。

适合：

- 有清晰不变量的纯函数：parsing、formatting、calculation
- Round-trip：`decode(encode(x)) === x`
- Idempotency、commutativity 等代数性质
- 发现人工样例想不到的边界情况

要求：

- 需要明确 oracle 或 invariant。作为业务正确性的 oracle，单纯 “does not crash” 通常太弱。
- 输入生成器必须遵守领域前置条件。
- Shrinking 很重要，否则失败难以理解。

例外：在 fuzzing、parser hardening、安全边界等场景，"does not crash / rejects invalid input safely" 可以是有价值的 safety property，但仍应明确安全含义。

风险：

- 没有真实 oracle 时，PBT 只是在证明 tautology。
- 不稳定 generator 会制造 flaky tests。
- PBT 不能替代用于说明具体行为的 example-based tests。

示例：

```typescript
// Invariant: reversing a list twice returns the original list
property("reverse(reverse(xs)) === xs", array(nat()), (xs) => {
  expect(reverse(reverse(xs))).toEqual(xs);
});
```

## Snapshot Testing

Snapshot test 捕获输出，并与后续运行结果比较。

适合：

- 稳定、语义化、会被人工 review 的输出：CLI help、错误目录、公开 schema 示例
- 很少有意变化的输出回归保护
- Public rendered contract 或 accessibility tree，而不是 incidental DOM/HTML 结构

风险：

- 盲目 “update all snapshots” 会摧毁测试价值；每次 snapshot 变化都必须 review。
- 大 snapshot 会隐藏真正 diff，让人不愿审查。
- Snapshot 很容易伪装成 implementation-detail test。

准则：

- Snapshot 要小，聚焦一个输出。
- 不要为了让 CI 通过而盲更新 snapshot。
- 重要行为优先使用显式断言。
- 对时间、随机 ID、路径等动态值使用 matcher 或正规化处理。

## Approval / Golden Testing

Approval testing 类似 snapshot testing，但要求人工明确批准 baseline。Golden file 通常是被审查过的期望输出。

适合：

- 改遗留代码前写 characterization tests
- 行为暂不清楚，但需要先保护现状
- 输出太大，显式写多个 assert 成本过高，但输出必须稳定

风险：

- 第一次 approval 可能锁定已有 bug。
- 和 snapshot 一样，过大的 golden file 容易无人审查。
- 它记录的是 “what is”，不一定是 “what should be”。

准则：

- 使用能清楚显示 diff 的工具。
- 对最关键值额外写少量显式断言。
- 只有理解输出变化原因后才 re-approve。

## Mutation Testing

Mutation testing 自动修改生产代码，例如翻转条件、删除语句，然后检查测试是否失败。

适合：

- 评估现有测试套件强度
- 发现“永远 GREEN”的弱测试
- 找出没有被测试触达的死代码或无效分支

风险：

- 慢；不要在每个 TDD cycle 运行。
- 会产生 equivalent mutants 等噪音。
- 高 mutation score 不保证行为正确，只说明测试会对一些代码变化作出反应。

准则：

- 默认把 mutation testing 当诊断工具，而不是硬性 gate。
- 团队成熟后可以设置温和 threshold，但不要追求 100%。
- 优先调查 surviving mutants；它们常指向缺失或过弱断言。

## 选择表

| Technique | 适合 | 注意 |
| --- | --- | --- |
| Property-Based | 清晰 invariants、纯函数 | oracle 弱或缺失 |
| Snapshot | 稳定、可 review 的输出 | 盲更新、巨大 diff |
| Approval / Golden | 遗留 characterization、大输出 | 锁定错误行为 |
| Mutation | 评估测试强度 | 慢、equivalent mutants |
