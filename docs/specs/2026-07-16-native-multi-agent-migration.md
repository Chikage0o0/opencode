# OpenCode 原生多 Agent 迁移设计

日期：2026-07-16

## 决策

移除 `oh-my-opencode-slim` 运行时插件和专用配置文件。使用 OpenCode 原生 agent、permission、skill、MCP 与 background `task` 实现原有的 1 个 Orchestrator + 5 个 specialist 体系。

保留两项原生 OpenCode 尚未直接提供给模型的调度能力，但改为本地小插件实现：

- Background Job Board。
- Orchestrator-only `cancel_task`。

不迁移 Observer、Council、Companion、Multiplexer、runtime preset switch、AST grep tools 和插件自更新逻辑。

## 固定来源

调度与 specialist 提示词以 `oh-my-opencode-slim v2.2.0` 为固定来源：

- Git commit：`6904ee9f184d98a929ae24dca8bd9e037d4f05f9`。
- npm shasum：`e26687b2540de6f7373945aca30f30a887d4955b`。
- npm integrity：`sha512-N90mUd1+G581iAkZAwfVJHtSXYXW0LhicQHDm3JLFSk5QxSQfgMP8UHSdn79v3DzY4Ke9yrroNJPruhYb3IRvQ==`。
- Release：<https://github.com/alvinunreal/oh-my-opencode-slim/releases/tag/v2.2.0>。
- 固定源码：<https://github.com/alvinunreal/oh-my-opencode-slim/tree/6904ee9f184d98a929ae24dca8bd9e037d4f05f9>。

`2.2.0` 是用户指定的迁移基线，不称为 npm 当前最新版本。模型映射来自迁移前的自定义 `default` preset；该 preset 名和模型组合不是上游 installer 默认值。

OpenCode 原生行为以本地 `1.18.1` 和对应官方文档/源码为准：

- Agents：<https://opencode.ai/docs/agents>。
- Permissions：<https://opencode.ai/docs/permissions>。
- Skills：<https://opencode.ai/docs/skills>。
- MCP：<https://opencode.ai/docs/mcp-servers>。
- OpenCode `v1.18.1`：<https://github.com/anomalyco/opencode/tree/v1.18.1>。

## 原生配置映射

| 原 Slim 配置                            | OpenCode 原生实现                                     |
| --------------------------------------- | ----------------------------------------------------- |
| `presets.default.<agent>.model/variant` | `opencode.json.agent.<agent>.model/variant`           |
| `skills: ["*", "!name"]`                | `permission.skill` 有序 pattern                       |
| `skills: []`                            | `permission.skill: "deny"`                            |
| `mcps` allowlist / denylist             | MCP 全局注册 + agent-specific `<server>_*` permission |
| `disabled_agents: ["observer"]`         | 不定义 Observer，不加入 `permission.task` allowlist   |
| Orchestrator prompt                     | `prompts/agents/orchestrator.md`                      |
| Specialist prompts                      | `prompts/agents/{agent}.md`                           |
| Slim agent factory                      | `opencode.json.agent` 原生声明                        |

OpenCode permission 采用最后匹配规则生效。Specialist 先 `"*": "deny"`，再放行其所需 read/write、skill 和 MCP namespace。这样新增工具默认不可用，避免只靠提示词维持只读或不委派约束。

迁移前的实际 debug 结果显示，Slim 生成的 Oracle 在全局 `"*": "allow"` 下仍能看到 `bash`、`task` 和写入类能力，与其只读提示词不一致。原生迁移把该意图落实为硬权限。

## Agent 路由

### Orchestrator

- 唯一 primary 调度器。
- 负责理解、短依赖图、调度、task ID/ownership 追踪、对账和验证。
- 可直接处理纯对话或调度成本明显更高的微小改动。
- `permission.task` 只允许 Oracle、Librarian、Explorer、Designer、Fixer 与既有 `git-commit`。
- 研究 MCP 和两个前端设计 Skill 禁用，促使研究与视觉工作进入对应 specialist lane。

### Oracle

- 架构、复杂根因、风险、高价值 review、YAGNI。
- 严格只读。

### Librarian

- 变化快的库、版本行为、官方文档和外部实现案例。
- 严格只读；使用 Context7、Grep MCP、Exa 与 browser tooling。

### Explorer

- 快速本地路径、文本、符号和结构定位。
- 严格只读；`ast_grep_search` 改为 `codegraph` + `grep/glob`。

### Designer

- 需要视觉、响应式、交互或动效判断的设计与实现。
- 可写；视觉意图由后续 lane 保持。

### Fixer

- 已完成研究和决策的边界明确实现。
- 可写；不允许外部研究和 subagent delegation。

## 调度提示词适配

保留 `v2.2.0`：

- Scheduler 而非默认 worker。
- specialist 路由阈值。
- 独立 lane / 依赖 lane / writer ownership / verification lane。
- background-first delegation。
- 不轮询运行中任务，不消费 incomplete output。
- task ID session reuse。
- Designer handoff 保护。
- terminal reconciliation 与最小相关验证。
- 直接、简短、无奉承沟通规范。

调整：

| 插件专属内容                   | 原生迁移                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------ |
| 每轮 phase hook                | 固化进 Orchestrator system prompt                                              |
| Background Job Board           | 本地 `background-jobs.ts` 注入                                                 |
| Slim `cancel_task`             | 本地小插件调用 OpenCode `session.abort`                                        |
| Board alias 自动改写 `task_id` | session reuse 只传真实 native task/session ID；alias 仅供 Job Board 和取消使用 |
| `ast_grep_search` / replace    | `codegraph`、`grep/glob`；修改仍走原生 edit/apply_patch                        |
| Observer / Council 路由        | 删除                                                                           |
| Companion / Multiplexer        | 删除                                                                           |

## Background Job Board

本地插件使用进程内 `Map`，不持久化。它通过以下 hook 工作：

1. `tool.execute.before` 捕获 task 的 parent session、agent、目标和 `<job-meta>`。
2. `tool.execute.after` 从原生 metadata 或 task 文本注册 task/session ID 与初始状态。
3. `experimental.chat.messages.transform` 只解析 synthetic completion，更新 terminal 状态并向 Orchestrator 注入 Job Board。
4. `event` 用 `session.error/deleted` 补充异常生命周期。单独的 `idle` 可能表示等待输入，不足以证明任务 terminal，因此不会据此假报完成。

记录字段：

```text
taskID, parentSessionID, alias, agent, objective,
dependencies[], writeScopes[], state,
launchedAt, updatedAt, completedAt,
resultSummary, cancellationRequested,
statusUncertain, reconciled
```

原 Slim `v2.2.0` 的 Job record 没有 dependencies 和 write scopes；这些只出现在其调度文档。新插件扩展字段，并要求 Orchestrator 在 background prompt 首部提供：

```text
<job-meta>{"dependencies":["exp-1"],"writeScopes":["src/auth/**"]}</job-meta>
```

这些字段是 advisory metadata，不是锁。Shell 写入无法被通用 hook 完整识别，因此不把它描述为实际写入审计。

## `cancel_task`

OpenCode `1.18.1` 的 `session.abort` 会取消匹配 child session/task ID 的 native BackgroundJob、该 job 的排队 extension 和后代执行，然后中断 session runner。

插件调用 v1 client：

```ts
await client.session.abort({
  path: { id: taskID },
  query: { directory },
  throwOnError: true,
});
```

边界：

- 全局 permission deny；只对 primary Orchestrator allow。
- tool runtime 再检查 `toolContext.agent` 与 parent-scoped ownership。
- 只取消 Job Board 已登记且仍为 `running` 的任务。
- 先标 `cancel_requested`；API 返回 `data === true` 后才标 `cancelled`。
- abort 失败时恢复 `running + statusUncertain`。
- 不调用 `session.delete`，保留 child session 历史。
- 不回滚已写文件；替换 writer 前必须检查和协调局部改动。

这与 Slim `v2.2.0` 的实现有意不同：上游在 `session.delete` 可用时会在 abort 后删除 child session。当前用户要求是停止后续执行而非删除会话，因此不复制该 fallback。

## MCP

Slim 原来自动注册的 MCP 改为 `opencode.json` 显式配置：

```text
context7  https://mcp.context7.com/mcp
gh_grep  https://mcp.grep.app
websearch https://mcp.exa.ai/mcp?tools=web_search_exa
```

保留本地 `codegraph` 和 `chrome-devtools`。MCP 连接是全局的，agent permission 只控制工具暴露和调用。

## 删除边界

删除：

- `opencode.json.plugin` 中的 `oh-my-opencode-slim@2.2.0`。
- `oh-my-opencode-slim.json`。
- `skills/oh-my-opencode-slim/SKILL.md`。

保留：

- `.slim/`：现保存 ACP 1.12.6 固定上游审计 clone；旧 DCP clone 已删除。运行时使用 `vendor/opencode-acp/`，不依赖 ignored clone。
- `.oh-my-opencode-slim/skill-updates/2.2.0/deepwork`：忽略的本地 skill 更新缓存，不在本次迁移删除，避免丢失用户暂存内容。
- `skills/clonedeps/SKILL.md` 与 `skills/verification-planning/` 的既有用户改动。
- `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`。

## 风险

- Background subagent 和 `experimental.chat.messages.transform` 仍是实验能力；OpenCode 升级后必须冒烟验证。
- Job Board 是内存态，重启后丢失。
- native task metadata 或 synthetic completion 格式变化会影响自动跟踪；文本 parser 和 session event 是兼容兜底。
- `cancel_task` 不回滚文件，也不能保证 child 启动的所有外部进程都具备事务式清理。
- 当前 `@opencode-ai/plugin` 依赖为 `1.17.8`，本地 OpenCode 为 `1.18.1`；所用 v1 `session.abort` 和 hook shape 已兼容验证，但后续应单独安排版本对齐。

## 验证标准

- `opencode debug config --pure` 成功解析，无 Slim runtime plugin。
- 六个 agent 的 mode/model/variant/prompt 正确。
- Oracle/Librarian/Explorer 看不到 `bash/edit/task`。
- Designer/Fixer 可写但看不到 `task` 和未授权研究 MCP。
- Orchestrator 的 task target 仅为 allowlist。
- `cancel_task` 仅 Orchestrator 可见和可调用。
- 指定 Skill 可加载，deny Skill 被隐藏/拒绝。
- background task 注册、completion、Job Board 注入、alias cancel、abort failure 均有单测。
- 全量 Bun tests、JSON 解析、`git diff --check` 通过。

## 回滚

如原生 background task 在未来版本出现回归：

1. 从 Git 恢复本迁移前的 `opencode.json`、`oh-my-opencode-slim.json` 与专用 Skill。
2. 暂时移除 `plugins/background-jobs.ts`，避免与 Slim 内置 Job Board 重复注册。
3. 重启 OpenCode，再运行固定版本 doctor 与 background 冒烟测试。

不要同时运行 Slim Job Board 与本地 Job Board；两者会重复注册 `cancel_task` 和重复注入任务状态。
