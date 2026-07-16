# ACP session 隔离设计

## 背景

`opencode-acp@1.12.6` 在插件初始化时创建单个可变 `SessionState`。OpenCode 1.18.1 则按 project/worktree 复用插件实例；primary session 与并发 background subagent 会共享该状态。

上游 `ensureSessionInitialized()` 会在 session 变化时原地 reset，并跨多个 `await` 加载、重建和保存状态。两个 session 的 hook 交错时，可能读取、压缩或持久化到错误 session。仅设置 `experimental.allowSubAgents: false` 不能规避：上游 message transform 在判断 subagent 并早退前已经调用 `checkSession()`。

## 方案

`plugins/acp-session-isolation.ts` 不直接实现压缩算法，而是包装固定上游版本的本地源码派生包：

1. bootstrap 实例只提供配置 hook、工具 schema 与无 session 调用兜底。
2. 每个 `sessionID` 延迟创建一个独立上游 ACP 实例。
3. message/system/command/text/event hooks 按输入或消息中的 `sessionID` 路由。
4. 6 个 ACP 工具按 `ToolContext.sessionID` 路由。
5. 每个 session 使用独立 promise queue 串行化状态变更；不同 session 不共享锁。
6. OpenCode host config 在实例创建时同步；fan-out 同时进入各 session queue，等待全部实例 settle 后再聚合失败，保持 generation 顺序和 per-agent permission 语义。
7. `session.deleted` 在该 session queue 尾部 drain 写入、dispose 并驱逐实例；dispose 失败时保留实例，供全局退出重试。
8. 插件 dispose 先封闭新调用，等待运行中 session 操作，再统一 dispose；重复 dispose 返回同一 promise。
9. 延迟实例初始 config 失败时立即 dispose；若清理也失败，将实例保留到全局 dispose 再重试。

上游 1.12.6 的多个 fire-and-forget `saveSessionState()` 会在 hook 返回后继续写文件，外层 session queue 无法覆盖。`vendor/opencode-acp` 因此补充：

- 在首次 `await` 前按最终状态文件路径登记写入队列。
- 入队时立即 `JSON.stringify`，避免浅快照在等待期间被后续状态修改。
- 同一文件顺序写，不同 session 文件并行写；失败不会 poison 后续 tail，最后一次失败由对应 session drain 报告。
- 同目录临时文件写完后原子 rename，读取方不会看到半写 JSON。
- 读写前统一执行 storage single-flight 初始化；旧 DCP 状态先复制到唯一临时目录，再 rename 安装，绝不漏读同名旧 session，也不覆盖并发创建的新 ACP 状态；瞬时迁移失败不创建空完成标记，下次读写可重试。
- dispose 只 drain 当前实例 session 的待处理写入，不等待无关 session。

## 依赖与加载

- `vendor/opencode-acp` 源码基线固定为 tag `v1.12.6`、commit `f1a33d9f4ce55af808eb4e050717c914ed16084b`。
- 运行入口为该源码经上游 `npm run typecheck && npm run build` 生成并纳入版本控制的 `dist/index.js`；不在 OpenCode 安装阶段运行构建脚本。
- `package.json` 使用 `opencode-acp: file:vendor/opencode-acp`；`package-lock.json` 固定本地 link 与传递依赖。
- `.slim/clonedeps.json` 记录同一上游 commit；ignored clone 只用于审计，不参与运行。
- OpenCode 自动发现 `plugins/acp-session-isolation.ts`。
- `opencode.json.plugin` 不再直接列出 `opencode-acp`，防止上游单例与适配实例双重运行。

## 状态边界

迁移时按用户明确授权删除：

- `~/.local/share/opencode/storage/plugin/dcp/`
- `~/.local/share/opencode/storage/plugin/acp/`

历史 DCP clone 与 metadata 已移除；`.slim/clonedeps` 现为 ACP 1.12.6 上游审计缓存。ACP 会为新 session 重新创建状态文件。

## 验证标准

- 同一 session 的并发 hook 不重入。
- 不同 session 使用不同上游实例并可并行。
- 6 个 ACP 工具按 session 路由。
- 延迟实例收到 OpenCode host config。
- config、hook、tool 与 `session.deleted` 在同一 session 内互斥；删除不创建无用实例，并释放已存在实例。
- 写队列顺序、失败恢复与传播、跨 session 并行、call-time 快照、迁移暂存和 dispose drain 通过回归测试。
- OpenCode resolved config 的 `experimental.primary_tools` 只包含 `cancel_task`。
- 所有启用 subagent 实际暴露 6 个 ACP 工具。
- 全量 Bun tests、插件构建和 `git diff --check` 通过。

## 剩余边界

队列是进程内同步原语。两个 OpenCode 进程同时打开并写入同一个 session 时仍为 last-writer-wins；临时文件名包含 PID，原子 rename 保证文件完整，但不构成跨进程事务锁。
