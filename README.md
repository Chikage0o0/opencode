# OpenCode 配置项目

本目录保存一套由 Nix/Home Manager 管理的 OpenCode 全局配置。当前配置使用 [`oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim) 稳定 release 版负责多 agent 调度，并使用 [`mattpocock/skills`](https://github.com/mattpocock/skills) 提供可组合的工程方法；不再保留 Superpowers 工作流。

## 当前版本

- Plugin package: `oh-my-opencode-slim@2.2.0`
- Plugin config schema: `https://unpkg.com/oh-my-opencode-slim@2.2.0/oh-my-opencode-slim.schema.json`
- Active preset: `default`
- 版本策略：固定 npm release `2.2.0`；不跟随 `latest`，不启用插件自更新检测。

`modules/home/opencode/default.nix` 会把本目录中的配置同步到 `~/.config/opencode/`。

## 目录结构

```text
.
├── AGENTS.md                         # 简短行为约定
├── opencode.json                     # OpenCode 主配置：插件、权限、MCP、默认 agent 禁用
├── oh-my-opencode-slim.json          # slim agent presets 与全局插件配置
├── dcp.jsonc                         # Dynamic Context Pruning 策略
├── agents/
│   └── git-commit.md                 # 专用 Git 提交 subagent
├── commands/
│   └── git-commit.md                 # /git-commit 命令，轻量调度到 subagent
├── plugins/
│   ├── rtk.ts                        # 透明重写命令为 rtk，节省 token
│   ├── title-alert.ts                # 终端标题状态提醒插件
│   └── windows-git-env.ts            # Windows 下发现 Git for Windows 并设 shell/PATH
├── lib/
│   ├── title-alert-core.ts           # 标题提醒状态机与 OSC 转义渲染（可测）
│   └── windows-git-env.ts            # Git 环境探测与 PATH 优先级（可测）
├── skills/                           # slim bundled skills 与本地补充 skills
│   ├── clonedeps/
│   ├── frontend-design/
│   ├── make-interfaces-feel-better/
│   ├── oh-my-opencode-slim/
│   ├── shadcn-svelte/
│   ├── svelte-code-writer/
│   ├── verification-planning/
│   ├── web-perf/
│   └── ...
├── tests/
│   ├── windows-git-env.test.ts
│   └── title-alert.test.ts
├── docs/specs/                       # 配置本身的长期设计记录
├── devenv.nix / devenv.yaml          # 本配置目录的开发环境
├── starship.toml                     # devenv shell 终端提示配置
└── README.md
```

## 配置说明

### `opencode.json`

- 启用插件：
  - `opencode-direnv`
  - `@tarquinen/opencode-dcp@git+https://github.com/Chikage0o0/opencode-dynamic-context-pruning.git#588ba2a5bc2160065131469097d5ab5639af9bd6`
  - `oh-my-opencode-slim@2.2.0`
- 禁用 OpenCode 默认 `build` / `plan` / `explore` / `general` agents，让 slim orchestrator 接管工作流。
- 关闭全部 LSP：`"lsp": false`。
- MCP：`codegraph`（本地 `codegraph serve --mcp`）与 `chrome-devtools`（`bunx chrome-devtools-mcp@latest`）。
- 保留中文标题生成 agent（`title`）。
- Windows 下默认 shell 由 `plugins/windows-git-env.ts` 动态指向发现到的 Git Bash。

### Background subagent 实验开关

- OpenCode 的后台 subagent 功能通过用户环境变量启用：`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`。
- 该开关是运行时环境变量，不是 `opencode.json` 的 `experimental` 字段；不要把 `background_subagents` 之类键写入 `opencode.json`。
- 当前 Windows 用户环境变量已设置为 `true`；新开的终端和重启后的 OpenCode 会读取该值。
- `devenv.nix` 也同步设置了该变量，保证本配置目录的开发 shell 与系统用户环境一致。

### Windows Git 环境

- `plugins/windows-git-env.ts` 仅在 Windows 上启用，会从 `Path`、`GIT_HOME`、常见安装目录以及 Scoop 用户目录动态发现 Git for Windows。
- 发现后会通过 OpenCode `config` hook 把默认 shell 指向同一安装目录下的 `bin\bash.exe`，无需在 `opencode.json` 写死本机路径。
- shell 命令环境会把该安装目录下的 `bin` 放在 `Path` 第一位，随后加入 `cmd`、`mingw64\bin`、`usr\bin`，避免优先命中 Scoop shim 或 Windows 自带 `bash.exe`。
- 插件不修改全局 `process.env`；每次执行只在已有 `shell.env` 或父进程 `Path` 前追加 Git 目录，保留系统环境、启动终端临时变量以及 direnv 等前序插件的注入。

> 注意：如果某个 host 通过 `platform.home.opencode.configFile` 指向 sops 渲染文件，则该文件会覆盖 Home Manager 生成的 `opencode.json`。示例 host 已通过读取本目录 `opencode.json` 并合并 provider 密钥来避免配置丢失。

### `oh-my-opencode-slim.json`

- `preset` 默认为 `default`。
- `default` preset 按 agent 分配模型、skills 与 MCP 访问。
- `autoUpdate` 设置为 `false`，配合 `opencode.json` 中的 `oh-my-opencode-slim@2.2.0` 固定版本，避免插件自更新检测或自动安装新版本。
- `disabled_agents: ["observer"]` 禁用 Observer。

### Bundled skills

本目录保留以下 bundled skills 的本地副本：

- `clonedeps/`
- `oh-my-opencode-slim/`
- `verification-planning/`
- 其余 `frontend-design`、`make-interfaces-feel-better`、`shadcn-svelte`、`svelte-code-writer`、`web-perf` 为本地补充 skills，不是 npm 包随附内容。

当前仅保留本配置实际使用的 bundled skills；不附带会与本地 OpenSpec 主流程和 Git 工作区策略竞争的可选工作流。

### Matt Pocock engineering skills

Matt Pocock skills 通过 Agent Skills 标准安装在 `~/.agents/skills/`，来源与版本记录在 `~/.agents/.skill-lock.json`。OpenCode 会直接发现这些全局 skills；当前安装其官方 README 中列出的 22 个 engineering/productivity skills。

更新全部由 skills CLI 管理的全局 skills：

```bash
npx skills@latest update --global --yes
```

职责划分：

- OMO Slim Orchestrator 是唯一的多 agent 调度器。
- `tdd` 与 `diagnosing-bugs` 提供 Fixer 的实现纪律。
- `code-review` 与 `codebase-design` 提供 Oracle 的审查方法。
- `research` 提供 Librarian 的可复用调研方法。
- `domain-modeling`、`grill-with-docs` 等由 Orchestrator 或用户按需触发。
- `to-spec`、`to-tickets`、`implement` 已安装但不作为默认主流程，避免与 OpenSpec 和 OMO Slim 重复维护规格或争夺调度权。

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
bunx oh-my-opencode-slim@2.2.0 doctor
```

## 维护建议

- 不要重新加入会接管规划、worktree 和 subagent 调度的完整工作流；保持 OpenSpec 管规格、OMO Slim 管调度、Matt skills 管工程方法。
- 新增 repo-specific 覆盖时，优先使用 `.opencode/oh-my-opencode-slim.json`，不要直接修改插件包源码。
- DCP 运行版本与本地 clone 版本独立：`opencode.json` 的插件 pin 到 git ref `588ba2a…`，而 `.slim/clonedeps.json` 记录的本地 clone 解析为 `3.1.14`。本地 clone 仅用于开发/联调 DCP 源码；运行期仍走 pin 的 git ref。两者有意解耦，更新时需分别维护。
- 更新版本必须显式修改 `opencode.json`、`oh-my-opencode-slim.json` schema 与本文档；不要改回未固定版本或 `latest`。
