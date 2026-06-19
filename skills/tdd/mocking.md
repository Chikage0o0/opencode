# When to Mock

## 默认立场

默认使用你拥有的真实实现；只有在有明确理由时才使用 test double。目标是提高测试 fidelity，同时避免绑定内部调用方式。

通常适合使用 test double 的位置：

- 外部 API：payment、email、第三方服务
- 数据库：优先 test DB 或 fake repository；需要隔离时再 stub/mock
- Time/randomness：使用 clock/random provider
- File system：优先临时目录；必要时 fake 或 stub
- 慢、不稳定、不可控的依赖
- Legacy seam：为了在遗留代码中建立安全测试边界
- 故障注入：验证 timeout、错误码、重试耗尽等错误路径

默认不要 mock：

- 自己拥有的领域类或内部模块
- 只是为了断言调用次数/顺序的内部协作者
- 能快速、确定性运行的真实实现

优先使用 **fake** 而不是 mock：in-memory repository、stub clock、fake notification gateway 往往更接近真实契约，也让测试读起来像正常代码。

## Test Double 分类

| 类型 | 目的 | 示例 |
| --- | --- | --- |
| **Dummy** | 填充必要参数，但测试不会使用 | 传入 `{}` 作为未使用 options |
| **Stub** | 返回固定答案，提供间接输入 | repository 总是返回固定 user |
| **Spy** | 记录发生过的输出，供事后检查 | 捕获 emitted events 并断言某个事件 |
| **Mock** | 预设调用期望并验证交互 | 断言 `paymentGateway.charge` 被调用一次且金额正确 |
| **Fake** | 可工作的简化实现 | in-memory database，仍执行 unique constraint |

选对 double。多数业务测试中，fake/stub 比 mock 更不脆弱，因为它们不要求测试知道调用顺序。

## 不要直接 mock 不拥有的第三方类型

避免直接 mock 第三方 SDK。它们的返回 shape、异常、重试语义可能变化，mock 很容易变成错误模型。

更好的方式是**包装边界接口**，让业务代码依赖你拥有的契约：

```typescript
// GOOD: 业务代码依赖你拥有的接口
interface PaymentGateway {
  charge(amount: Money): Promise<ChargeResult>;
}

class StripePaymentGateway implements PaymentGateway {
  private client: StripeClient;
  constructor(client: StripeClient) {
    this.client = client;
  }
  async charge(amount: Money): Promise<ChargeResult> {
    // 把 Stripe-specific 类型转换成领域类型
  }
}
```

业务测试使用 `PaymentGateway` 的 fake/stub。Adapter（如 `StripePaymentGateway`）可用更窄的 integration test 单独验证。

## Designing for Mockability

在系统边界，设计容易替换的接口：

**1. 使用 dependency injection**

把外部依赖传入，而不是在函数内部创建：

```typescript
// GOOD: 容易替换 paymentClient
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// BAD: 外部依赖被硬编码在函数内部
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 优先 SDK-style interface，而不是 generic fetcher**

为每个外部操作提供明确函数，避免一个通用函数里塞条件逻辑：

```typescript
// GOOD: 每个函数有明确返回 shape
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: mock 需要根据 endpoint 写条件逻辑
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK-style interface 的好处：

- 每个 fake/stub 返回一个具体 shape
- 测试 setup 不需要复杂条件逻辑
- 更容易看出测试涉及哪些外部操作
- 每个 endpoint 有更清晰的类型边界
