# Good and Bad Tests

## 好测试

**Integration-style**：通过真实接口测试行为，不 mock 内部零件。

```typescript
// GOOD: 验证外部可观察行为
// 使用显式、贴近领域的 factory；关键前置条件不要藏起来
test("user can checkout with valid cart", async () => {
  const cart = createCart({ items: [{ productId: "p1", qty: 1 }] });
  const payment = validVisa();

  const result = await checkout(cart, payment);

  expect(result.status).toBe("confirmed");
  expect(result.orderId).toBeDefined();
});
```

特征：

- 验证用户或调用方关心的行为
- 只通过 public API 或稳定受支持边界执行
- 内部重构后仍然稳定
- 描述 WHAT，而不是 HOW
- 一个测试验证一个逻辑行为；多个字段可以服务于同一个行为判断

## 低脆弱断言

优先断言**稳定、外部可观察的契约**：

- 领域结果：`status`、`orderId`、`balance`
- 稳定错误信号：status code、error type、用户可见消息
- 领域不变量：总额、数量、关系约束
- Public API 返回值
- 公开数据格式的关键字段与兼容性约束

避免绑定脆弱细节：

- 内部协作者调用次数或精确调用顺序
- incidental CSS class、DOM selector、内部 HTML 结构
- 大对象全量 equality，而测试只关心其中一两个字段
- 内部字段名、私有 DB row shape、非契约化 serialization details
- 日志文本或 stack trace 的精确措辞

```typescript
// BAD: 绑定内部 DOM 结构和样式实现
test("shows error", () => {
  render(<Form />);
  expect(screen.getByTestId("error").className).toContain("text-red-500");
});

// GOOD: 断言用户可见结果
test("shows error", () => {
  render(<Form />);
  expect(screen.getByText(/invalid email/i)).toBeVisible();
});
```

```typescript
// BAD: 全量对象 equality，新增无关字段也会破坏测试
expect(result).toEqual({
  id: "123",
  status: "confirmed",
  createdAt: expect.any(String),
  metadata: expect.any(Object),
});

// GOOD: 聚焦与行为相关的字段
expect(result.status).toBe("confirmed");
expect(result.id).toBeDefined();
```

## Test Data Builders and Factories

Factory 和 builder 可以降低噪音，但必须显式、贴近领域：

- 默认值应合理并在 builder 中可读
- 不要隐藏决定测试成败的关键前置条件
- 只 override 当前行为真正关心的字段
- 避免“magic helper”：一次静默设置二十个无关字段

```typescript
// GOOD: 关键前置条件可见
const cart = createCart({ items: [{ productId: "p1", qty: 2 }] });

// BAD: 看不出为什么它是 valid、有什么关键约束
const cart = makeHappyPathCart();
```

## 坏测试

**Implementation-detail tests**：绑定内部结构。

```typescript
// BAD: 测试实现细节；内部服务重构会导致测试失败
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

红旗：

- Mock 内部协作者
- 测试 private methods
- 断言调用次数/顺序，而不是结果
- 行为没变但重构会破坏测试
- 测试名描述 HOW，不描述 WHAT
- 绕过 public interface 验证内部状态

```typescript
// BAD: 绕过接口查内部存储；换存储引擎就会坏
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: 通过接口验证可观察行为
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

## Narrow Integration vs Broad Integration

**Narrow integration test**：验证一个模块与少量真实协作者的协作，仍保持在单一子系统边界内，例如 service + in-memory repository。它快、确定性强、失败定位清晰。

适合：

- 验证模块真实 wiring
- 协作者快速且确定性强
- 希望失败能定位到较小范围

**Broad integration / end-to-end test**：通过外部入口执行整条链路，例如 HTTP request、CLI command、UI event。它更真实，但更慢、更难诊断。

适合：

- 验证 auth、serialization、routing 等跨层行为
- Smoke test 关键用户路径
- narrow test 捕捉不到你担心的失败模式

默认偏向测试金字塔/蜂窝：大量 narrow integration tests，少量 broad integration tests。避免把所有回归都压到慢且 flaky 的 E2E 套件上。
