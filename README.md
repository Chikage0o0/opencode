# OpenCode 配置项目

本目录保存 OpenCode 全局配置。Agent 编排由 `oh-my-opencode-slim` 提供；本地仅保留 MCP、DCP、RTK、Windows Git 环境与少量自定义 Agent/Command。

## 运行基线

- OpenCode：`1.18.3`。
- Agent 编排：`oh-my-opencode-slim`，使用原生 background subagents。
- 上下文管理：`@chikage0o0/opencode-dcp@3.1.14`，关闭自动更新。
- 后台 Agent：环境变量 `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`。
- OpenCode 内置 `build`、`plan`、`explore`、`general` Agent 禁用；默认 Agent 为 `orchestrator`。

## 配置分层

| 文件                       | 职责                                             |
| -------------------------- | ------------------------------------------------ |
| `opencode.json`            | 插件注册、MCP、全局模型与 OpenCode 核心设置      |
| `oh-my-opencode-slim.json` | Agent 模型、variant、Skills、MCP 白名单、Council |
| `dcp.jsonc`                | Dynamic Context Pruning 策略                     |
| `agents/`                  | 与主编排体系独立的自定义 Agent                   |
| `commands/`                | 本地斜杠命令与 OpenSpec 命令                     |
| `skills/`                  | 本地、OpenSpec 与 oh-my-opencode-slim Skills     |
| `plugins/`                 | RTK、标题通知、Windows Git 环境等本地插件        |

不要在 `opencode.json` 重复定义 `orchestrator`、`oracle`、`librarian`、`explorer`、`designer`、`fixer` 或 `council`。这些 Agent 由 `oh-my-opencode-slim` 注册。

## OpenAI Agent 配置

模型选择结合 DeepSWE 图中的质量/成本结论和 Agent 职责：

| Agent          | Model / variant                 | 选择理由                         |
| -------------- | ------------------------------- | -------------------------------- |
| `orchestrator` | `openai/gpt-5.6-terra` / `high` | 综合性价比最高，负责规划、调度与结果对账 |
| `oracle`       | `openai/gpt-5.6-sol` / `high`   | 架构、复杂调试和严格审查         |
| `librarian`    | `openai/gpt-5.6-luna` / `medium` | 低成本文档和外部资料检索        |
| `explorer`     | `openai/gpt-5.6-luna` / `medium` | 低成本代码库检索                |
| `designer`     | `zhipuai-coding-plan/glm-5.2` / `high` | 高频 UI/UX 设计与实现            |
| `fixer`        | `openai/gpt-5.6-luna` / `high`  | 高频、有边界的实现任务           |
| `council`      | `openai/gpt-5.6-sol` / `high`   | 多模型结果综合与裁决             |

Council 仅建议手动用于高价值分歧决策。默认并行比较 `sol/max`、`terra/high`、`luna/max` 三种视角。

## Skills 与 MCP 分配

- `orchestrator`：允许本地 Matt 工作流和 `test-suite-cleanup`；屏蔽 OMO Slim 自带工作流及专家执行 Skill；MCP 仅 `codegraph`。
- `oracle`：代码审查、架构设计、测试反模式审计和 Web 性能；测试审计使用 `test-anti-patterns` 与 `test-analysis-extensions`；MCP 为 `codegraph`、`chrome-devtools`、`websearch`。
- `librarian`：无本地实现 Skill；MCP 为 `websearch`、`context7`、`gh_grep`。
- `explorer`：无 Skill；MCP 仅 `codegraph`。
- `designer`：前端设计、Svelte、shadcn-svelte、Web 性能；MCP 为 `codegraph`、`chrome-devtools`。
- `fixer`：TDD、冲突处理、限定范围的测试质量修复、Svelte 与 shadcn-svelte；MCP 为 `codegraph`、`context7`。
- `council`：代码审查与架构设计；不挂载外部 MCP。

## OpenSpec 与 Deepwork

- OpenSpec 管理 proposal、行为规格、设计、ADR、tasks、verify 和 archive。
- Deepwork 仅在大型或高风险变更的 apply 阶段负责分阶段调度、执行与验证。
- OpenSpec artifacts 是范围和契约的权威；Deepwork 不得静默改变需求、公共接口、持久化结构或 ADR。

## 本地插件

- `plugins/rtk.ts`：通过 RTK 压缩 Shell 输出。
- `plugins/title-alert.ts`：任务标题与通知。
- `plugins/windows-git-env.ts`：Windows 下发现 Git for Windows 并设置 Bash/Path。
- `@chikage0o0/opencode-dcp@3.1.14`：按 session 管理上下文压缩，命令为 `/dcp`、`/dcp-compress`。

旧的 `plugins/background-jobs.ts`、`lib/background-jobs.ts`、对应测试和 `prompts/agents/` 已移除。后台任务状态、取消和完成通知由 OpenCode 原生 background subagents 与 `oh-my-opencode-slim` 处理。

## 验证

```powershell
opencode --version
opencode debug config
opencode agent list --pure
opencode mcp list
bunx oh-my-opencode-slim@latest doctor
bun test
```

配置、Prompt、Skill、MCP 或插件修改通常在下一次 OpenCode 启动时生效；需要立即生效时重启 OpenCode。
