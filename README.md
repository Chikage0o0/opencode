# OpenCode 配置项目

本目录保存由 Nix/Home Manager 管理的 OpenCode 全局配置。多 agent 调度已使用 OpenCode 原生 agent、`task`、permission、skill 与 MCP 能力实现；运行时不再依赖 `oh-my-opencode-slim`。

`modules/home/opencode/default.nix` 会把本目录配置同步到 `~/.config/opencode/`。

## 基线

- OpenCode 验证版本：`1.18.1`。
- 上下文管理：`opencode-acp@1.12.6` + 本地 session-isolation 适配层，固定稳定版本，不跟随 `latest`。
- 调度提示词基线：`oh-my-opencode-slim v2.2.0`，commit `6904ee9f184d98a929ae24dca8bd9e037d4f05f9`。
- `v2.2.0` 是本配置固定采用的提示词来源，不代表 npm 当前 `latest`。
- 模型/provider 映射沿用迁移前的自定义 preset，不替换为上游 installer 默认模型。
- 后台 subagent 依赖 `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`。

## 目录结构

```text
.
├── AGENTS.md                         # 全局行为约定
├── opencode.json                     # 原生 agents、权限、MCP、模型与插件配置
├── acp.jsonc                         # Active Context Pruning 策略
├── package.json / package-lock.json  # 本地插件运行依赖与精确锁定
├── prompts/agents/
│   ├── orchestrator.md               # 2.2.0 调度规范的原生适配
│   ├── oracle.md
│   ├── librarian.md
│   ├── explorer.md
│   ├── designer.md
│   └── fixer.md
├── agents/
│   └── git-commit.md                 # 专用 Git 提交 subagent
├── commands/
│   └── git-commit.md                 # /git-commit 命令
├── plugins/
│   ├── acp-session-isolation.ts      # ACP per-session 适配入口
│   ├── background-jobs.ts            # Job Board + cancel_task 入口
│   ├── rtk.ts
│   ├── title-alert.ts
│   └── windows-git-env.ts
├── lib/
│   ├── acp-session-isolation.ts      # ACP 实例路由与同 session 锁
│   ├── background-jobs.ts            # 后台任务状态机、注入与取消实现
│   ├── title-alert-core.ts
│   └── windows-git-env.ts
├── vendor/opencode-acp/               # ACP 1.12.6 源码派生包与落盘安全补丁
├── tests/
│   ├── acp-session-isolation.test.ts
│   ├── acp-write-queue.test.ts
│   ├── background-jobs.test.ts
│   ├── rtk.test.ts
│   ├── title-alert.test.ts
│   └── windows-git-env.test.ts
├── skills/                           # 本地与同步的 Agent Skills
├── docs/specs/                       # 长期设计记录
└── README.md
```

## 原生 agent 体系

| Agent          | Mode     | Model / variant                | Skills                                                          | MCP / tools                                                              |
| -------------- | -------- | ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `orchestrator` | primary  | `openai/gpt-5.6-sol` / `high`  | 全部，排除两个前端设计 Skill                                    | 可调度五个 specialist 与 `git-commit`；研究 MCP 禁用；可用 `cancel_task` |
| `oracle`       | subagent | `openai/gpt-5.6-sol` / `xhigh` | `code-review`、`codebase-design`、`diagnosing-bugs`、`web-perf` | 严格只读；`codegraph`、`chrome-devtools`                                 |
| `librarian`    | subagent | `xai/grok-4.5` / `low`         | `research`                                                      | 严格只读；`context7`、`gh_grep`、`websearch`、`chrome-devtools`          |
| `explorer`     | subagent | `xai/grok-4.5` / `low`         | 无                                                              | 严格只读；`codegraph`                                                    |
| `designer`     | subagent | `xai/grok-4.5` / `high`        | 四个前端设计/实现 Skill                                         | 可写、可执行验证；`codegraph`、`chrome-devtools`                         |
| `fixer`        | subagent | `xai/grok-4.5` / `high`        | `tdd`、`diagnosing-bugs`、两个 Svelte Skill                     | 可写、可执行验证；`codegraph`                                            |

OpenCode 默认 `build`、`plan`、`explore`、`general` agents 继续禁用，`default_agent` 为 `orchestrator`。

所有启用的 subagent（包括 `git-commit`）都显式放行 ACP 的 6 个工具：`compress`、`decompress`、`prune`、`search_context`、`acp_status`、`acp_context_recap`。`acp.jsonc.experimental.allowSubAgents` 同时设为 `true`，因此不是只在 primary session 注册工具。

### 权限语义

Specialist 使用 fail-closed 配置：先写 `"*": "deny"`，再逐项放行。规则按顺序匹配，最后一个匹配项生效。

- 被 `permission.task` deny 的 subagent 不会出现在 Orchestrator 的 Task 候选描述中；直接调用会被拒绝。
- 被 `permission.skill` deny 的 Skill 对该 agent 隐藏；强行加载会被拒绝。
- 被 deny 的标准工具和 MCP tool 不会发送给模型；运行时权限层仍会阻止绕过调用。
- `cancel_task` 全局 deny，仅 `orchestrator` 显式 allow；`experimental.primary_tools` 再限制其只出现在 primary agent。
- ACP 工具对全部启用 agent 显式 allow；subagent 的 `"*": "deny"` 不会盖掉这些后置规则。

## 调度规范

`prompts/agents/orchestrator.md` 保留 `v2.2.0` 的核心调度契约：

- Orchestrator 负责理解、规划、调度、对账和验证，不是默认实现工人。
- 先建立独立 lane、依赖 lane、writer ownership 与验证 lane。
- 独立 specialist 默认使用 `task(..., background: true)`。
- 记录 task/session ID；依赖任务等待 terminal completion，不轮询运行中任务。
- 并发 writer 不得重叠写入范围。
- 复用 specialist session 时必须传真实 `task_id`。
- Designer 的视觉与交互意图不能被后续机械实现压平。
- 最终回复前对账全部后台任务、检查 diff 并运行最小相关验证。

原插件的 phase hook 已固化进 Orchestrator system prompt。Observer、Council、Companion、Multiplexer、preset runtime switch 等未配置能力不迁移。

## Background Job Board 与 `cancel_task`

`plugins/background-jobs.ts` 是自动加载的本地小插件，不需要写入 `opencode.json.plugin`。

它提供：

- 从 native `task` hook 注册后台任务。
- 记录 parent session、agent、task/session ID、alias、状态、目标、依赖、声明写入范围和结果摘要。
- 解析 OpenCode synthetic completion，并向 Orchestrator 注入精简 Job Board。
- `cancel_task` 按 parent-scoped task ID 或 alias 取消任务。

每个 background task prompt 首部应包含：

```text
<job-meta>{"dependencies":["exp-1"],"writeScopes":["src/auth/**"]}</job-meta>
```

依赖与写入范围是调度提示和冲突检查依据，不是文件锁。缺失 metadata 时账本会保留空依赖和未声明写入范围。

`cancel_task` 调用 OpenCode `session.abort`：停止该 task、同 task 的排队 extension 及后代执行。它不会删除 child session，也不会回滚已产生的文件修改。取消失败时任务保持 `running + statusUncertain`，不会假报成功。

Job Board 是内存态。OpenCode 重启或插件重载后不会恢复旧账本。

## ACP 上下文管理

运行时基于官方 [`opencode-acp@1.12.6`](https://github.com/ranxianglei/opencode-acp/releases/tag/v1.12.6)，替换原 DCP Git fork。`vendor/opencode-acp` 固定到 tag `v1.12.6` / commit `f1a33d9f`，只叠加 session 并发与落盘安全补丁；源码和经上游 `typecheck + build` 生成的 `dist/` 一并保留。`package.json` 通过 `file:vendor/opencode-acp` 加载，`package-lock.json` 固定依赖树。`plugins/acp-session-isolation.ts` 自动加载该插件工厂，避免在 `opencode.json.plugin` 重复注册。策略文件为 `acp.jsonc`：

- 固定稳定版本并关闭 ACP 自更新。
- 保留迁移前的 `80,000` / `160,000` token 阈值、range 模式、最近 4 轮保护和用户消息保护。
- `experimental.allowSubAgents: true`；所有 subagent 均可主动压缩、恢复和检索自己的上下文。
- OpenCode 内置 `compaction.auto` 关闭，避免与 ACP 状态冲突；`compaction.prune` 保持原配置。
- `/acp` 是主命令；`/dcp` 仅作为上游兼容别名。

ACP 1.12.6 在每个 project 插件实例内只创建一个可变 `SessionState`，而 OpenCode 会让 primary 与 background child session 共享该插件实例。直接加载上游包会在并发 session 间交错切换状态。适配层因此：

- 按 `sessionID` 创建并缓存独立的上游 ACP 实例。
- 所有 ACP hook 和 6 个工具都路由到对应 session 实例。
- 同一 session 的有状态操作串行化；不同 session 保持并行。
- 把 OpenCode host config 同步给每个延迟创建的实例，保留 per-agent permission 判断。
- `session.deleted` 释放对应实例；插件退出先等待运行中 hook/tool，再 drain 状态写入。
- 状态文件按目标路径排队并通过同目录临时文件原子替换，避免旧快照后写和半写 JSON；末次写入失败会在 session drain 时上报。
- 读写前统一执行 storage single-flight 初始化；旧 DCP 状态先复制到唯一临时目录，再 rename 安装，不漏读同名旧 session，也不覆盖并发创建的新 ACP 状态。

`prune` 会不可逆地移除指定工具类型的旧输出，但不会删除项目文件。需要恢复的压缩块应使用 `decompress`，不要用 `prune`。

历史 DCP clone 已移除；`.slim/clonedeps/repos/ranxianglei__opencode-acp/` 仅保存固定上游基线，运行时使用可追踪的 `vendor/opencode-acp/`。迁移时已按用户明确授权清空旧 DCP/ACP plugin state；新状态由 session-isolation 适配层按需重新生成。

隔离和写队列覆盖同一 OpenCode 进程内的 primary/background sessions。若两个 OpenCode 进程同时写同一个 session，文件仍是 last-writer-wins；原子替换只保证 JSON 完整，不提供跨进程锁。

## MCP

`opencode.json` 原生注册：

- `codegraph`：本地 `codegraph serve --mcp`。
- `chrome-devtools`：本地 `bunx chrome-devtools-mcp@latest`。
- `context7`：`https://mcp.context7.com/mcp`。
- `gh_grep`：`https://mcp.grep.app`。
- `websearch`：`https://mcp.exa.ai/mcp?tools=web_search_exa`。

MCP server 在进程级连接；per-agent permission 控制 tool schema 暴露和调用，不隔离 server 进程生命周期。

## Background subagent 开关

- Windows 用户环境变量已设置 `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`。
- `devenv.nix` 同步设置该变量。
- 该值是启动时环境变量，不是 `opencode.json.experimental.background_subagents`。
- 修改后必须重启 OpenCode。

## Windows Git 环境

- `plugins/windows-git-env.ts` 仅在 Windows 启用，从 `Path`、`GIT_HOME`、常见安装目录和 Scoop 路径发现 Git for Windows。
- 发现后把默认 shell 指向同一安装目录的 `bin\bash.exe`。
- shell 环境优先加入 Git 的 `bin`、`cmd`、`mingw64\bin`、`usr\bin`，同时保留父进程和 direnv 注入。
- 插件不修改全局 `process.env`。

如果 host 通过 `platform.home.opencode.configFile` 指向 sops 渲染文件，该文件会覆盖 Home Manager 生成的 `opencode.json`；host 配置必须显式合并本目录内容与 provider 密钥。

## Skills

本地 `skills/` 与全局 `~/.agents/skills/` 均由 OpenCode 原生发现。Matt Pocock skills 的来源与版本记录在 `~/.agents/.skill-lock.json`。

更新 skills CLI 管理的全局 skills：

```bash
npx skills@latest update --global --yes
```

职责划分：

- Orchestrator 负责多 agent 调度。
- `tdd`、`diagnosing-bugs` 约束 Fixer 实现。
- `code-review`、`codebase-design` 支持 Oracle 审查与设计分析。
- `research` 支持 Librarian 调研。
- 其他 Skill 由 Orchestrator 或用户按需加载。

## `/git-commit`

- `commands/git-commit.md` 把显式提交请求调度到 `git-commit` subagent。
- `agents/git-commit.md` 只处理已 staged 范围，自己读取 diff、文件内容和历史并生成中文提交信息。
- 默认不 push、不改 git config、不做 destructive Git 操作。
- `cancel_task` 对该 subagent 不可用。

## 启动与验证

```powershell
opencode --version
npm ci --ignore-scripts
npm ls opencode-acp
opencode debug config --pure
opencode agent list --pure
opencode debug agent orchestrator --pure
opencode debug agent oracle --pure
opencode debug agent librarian --pure
opencode debug agent explorer --pure
opencode debug agent designer --pure
opencode debug agent fixer --pure
opencode debug agent git-commit --pure
opencode mcp list
bun test
```

后台冒烟测试：

```text
只读测试。用 background task 并行委派 Explorer 定位 README、Librarian 查询 OpenCode agent 官方文档。每个 prompt 写 job-meta；记录 task ID；不要轮询。等待 completion 后整合 Job Board。不要修改文件。
```

## 维护

- Prompt 基线固定到 `v2.2.0` tag/commit；升级必须重新审计上游 agent prompts 和调度差异。
- ACP 固定为 `1.12.6`；升级时核对工具名、配置 schema、subagent hook 和持久化状态兼容性。
- `vendor/opencode-acp/LOCAL_PATCHES.md` 记录上游 commit 与本地补丁；升级时重新基于新 tag 审计并重建 `dist/`，不要直接覆盖。
- 不要在 `opencode.json.plugin` 直接加入 `opencode-acp`；否则会与 `plugins/acp-session-isolation.ts` 双重加载。
- OpenCode 升级后重点回归 `task` 输出 metadata、synthetic completion 格式、experimental hook 和 `session.abort`。
- 不要在 `opencode.json.plugin` 重复注册 `plugins/background-jobs.ts`。
- `.slim/clonedeps.json` 中的 ACP clone 是上游审计缓存；运行依赖是 `vendor/opencode-acp/`。
- 迁移设计与取舍见 `docs/specs/2026-07-16-native-multi-agent-migration.md`。
