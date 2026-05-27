# OpenCode 配置项目

本目录保存一套由 Nix/Home Manager 管理的 OpenCode 全局配置。当前配置已经替换为 [`oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim) 稳定 release 版，不再保留旧的本地 agents/skills 工作流。

## 当前版本

- Plugin package: `oh-my-opencode-slim@1.1.1`
- Plugin config schema: `https://unpkg.com/oh-my-opencode-slim@1.1.1/oh-my-opencode-slim.schema.json`
- Active preset: `hybrid`
- 版本策略：使用 npm `latest` dist-tag 对应的稳定 release，不使用 beta 预发布版本。

`modules/home/opencode/default.nix` 会把本目录中的配置同步到 `~/.config/opencode/`。

## 目录结构

```text
.
├── AGENTS.md                         # 简短行为约定
├── opencode.json                     # OpenCode 主配置：插件、权限、MCP、默认 agent 禁用
├── tui.json                          # TUI 配置与 slim TUI 插件
├── oh-my-opencode-slim.json          # slim agent presets 与全局插件配置
├── agents/
│   └── git-commit.md                 # 专用 Git 提交 subagent
├── commands/
│   └── git-commit.md                 # /git-commit 命令，轻量调度到 subagent
├── plugins/
│   └── devenv.ts                     # devenv.sh 环境集成插件
├── skills/                           # slim bundled skills
│   ├── codemap.md
│   ├── simplify/
│   ├── codemap/
│   ├── clonedeps/
├── devenv.nix / devenv.yaml          # 本配置目录的开发环境
└── README.md
```

## 配置说明

### `opencode.json`

- 启用插件：
  - `opencode-acp@latest`（Active Context Pruning，DCP 的硬化增强分支）
  - `oh-my-opencode-slim@1.1.1`
- 禁用 OpenCode 内置 auto-compaction（`"compaction.auto": false`），由 ACP 接管上下文管理。
- 禁用 OpenCode 默认 `explore` / `general` agents，让 slim orchestrator 接管工作流。
- 启用 LSP：`"lsp": true`。
- 保留 `context7` MCP 与原有安全权限策略。
- 保留中文标题生成 agent。

> 注意：如果某个 host 通过 `platform.home.opencode.configFile` 指向 sops 渲染文件，则该文件会覆盖 Home Manager 生成的 `opencode.json`。示例 host 已通过读取本目录 `opencode.json` 并合并 provider 密钥来避免配置丢失。

### `oh-my-opencode-slim.json`

- `preset` 默认为 `hybrid`。
- 同时保留 `openai`、`opencode-go` 与 `hybrid` 三套 presets，便于在 OpenCode 内通过 `/preset` 切换。
- `openai` 用 GPT-5.5 承担 orchestrator/oracle，用 GPT-5.3-Codex 承担 council/designer/fixer，用 GPT-5.4-Mini 承担检索、探索与观察，控制缓存型请求成本。
- `opencode-go` 优先使用 Qwen3.6 Plus、Kimi K2.6、DeepSeek V4 Pro/Flash 与 MiniMax M2.7，在保持较高智力的同时提升速度和额度效率。
- `hybrid` 用 OpenAI 承担最高风险决策与审查，用 opencode-go 承担高频探索、修复、设计、检索和观察。
- `autoUpdate` 设置为 `false`，版本由 Nix 仓库显式控制。
- `disabled_agents: []` 启用 Observer。

### `/git-commit` command + subagent

- `commands/git-commit.md` 定义 `/git-commit` 命令，默认走 `subtask`/`task` 调度，不让主 agent 直接执行 `git commit`。
- `agents/git-commit.md` 是专用提交 subagent，自己读取 staged diff、必要文件内容和仓库历史，生成中文提交信息，并使用临时文件执行 `git commit -F`。
- `/git-commit <范围说明>` 会把参数作为 `task_scope`；`/git-commit` 不带参数时，由主 agent 根据当前对话、短 `git status` 和 staged set 生成一两句最小范围说明。
- command 不注入完整 diff、log 或历史样例，避免污染主 agent 上下文并降低提交成本。
- subagent 默认不 push、不改 git config、不做 destructive git 操作；提交成功后只返回紧凑结果。

## 启动与验证

应用 Home Manager/NixOS 配置后：

```bash
opencode models --refresh
opencode
```

进入 OpenCode 后运行：

```text
ping all agents
```

也可以诊断插件配置：

```bash
bunx oh-my-opencode-slim@1.1.1 doctor
```

## 维护建议

- 不要重新加入旧工作流；slim 插件自带 Pantheon agents，本目录只保留少量必要的自定义 agents/commands。
- 新增 repo-specific 覆盖时，优先使用 `.opencode/oh-my-opencode-slim.json`，不要直接修改插件包源码。
- 更新版本时优先跟随 npm `latest` 稳定 release；如需切回 beta，需同步确认 bundled skills 与环境变量要求。
