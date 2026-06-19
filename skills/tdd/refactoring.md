# Refactor Candidates

## 什么时候重构

只在测试套件 **GREEN** 时重构。RED 时不要重构。

每个 named refactor 后都运行测试。如果测试失败，撤回这一步，再尝试更小的改动。

## Named Refactor Steps

每次重构都要小而有名字：

- **Extract duplication** → 提取 function/class
- **Rename for clarity** → 变量、函数或类型名不再匹配用途时重命名
- **Introduce value object** → 用领域类型替代 primitive obsession
- **Break long methods** → 提取 private helper，但测试仍通过 public interface 验证
- **Deepen shallow modules** → 合并过浅模块，或把复杂度隐藏在更小接口背后
- **Move logic to where data lives** → 修复 feature envy
- **Replace conditional with polymorphism** → 当分支持续增长时考虑

规则：

1. 一次一个 named refactor
2. 每一步后运行测试
3. 保持 public behavior 不变
4. 重构时不添加功能

## 常见 Code Smells

| Smell | 常见重构 |
| --- | --- |
| Duplication | Extract helper 或 abstraction |
| Long method | 按同一抽象层次提取 private methods |
| Large class | 拆分职责 |
| Primitive obsession | Introduce value object |
| Feature envy | Move method 到拥有数据的类/模块 |
| Shotgun surgery | 把相关变化收敛到一个模块 |
| Divergent change | 分离因不同原因变化的职责 |
| Speculative generality | 删除未使用抽象 |

## 什么时候不重构

- 测试仍在失败
- 即将改动的行为没有测试覆盖
- 改动会改变外部可观察行为；那是 feature change，不是 refactor
- 重构范围大且无法回滚；先切成更小的 named steps
- 代码即将被删除或替换

## 重构检查清单

```
[ ] 开始前测试为 GREEN
[ ] Refactor 有名字且足够小
[ ] Public behavior 未改变
[ ] 这一步后测试通过
[ ] 没有添加新功能
```
