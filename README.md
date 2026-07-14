# OpenCode 配置项目

本目录保存一套由 Nix/Home Manager 管理的 OpenCode 全局配置。当前配置已经替换为 [`oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim) 稳定 release 版，不再保留旧的本地 agents/skills 工作流。

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
├── agents/
│   └── git-commit.md                 # 专用 Git 提交 subagent
├── commands/
│   └── git-commit.md                 # /git-commit 命令，轻量调度到 subagent
├── plugins/
│   ├── openai-instructions.ts        # GPT-5+ OpenAI instructions 兼容插件
│   └── title-alert.ts                # 终端标题状态提醒插件
├── skills/                           # slim bundled skills 与本地补充 skills
│   ├── codemap.md
│   ├── codemap/
│   ├── clonedeps/
│   ├── oh-my-opencode-slim/
│   ├── reflect/
│   ├── simplify/
├── devenv.nix / devenv.yaml          # 本配置目录的开发环境
└── README.md
```

## 配置说明

### `opencode.json`

- 启用插件：
  - `@tarquinen/opencode-dcp@latest`
  - `oh-my-opencode-slim@2.2.0`
- 禁用 OpenCode 默认 `explore` / `general` agents，让 slim orchestrator 接管工作流。
- 关闭全部 LSP：`"lsp": false`。
- 保留 `context7` MCP 与原有安全权限策略。
- 保留中文标题生成 agent。
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

- `codemap/` 与 `codemap.md`
- `clonedeps/`
- `oh-my-opencode-slim/`
- `reflect/`
- `simplify/`

本目录还保留若干本地补充 skills（例如 `tdd/`、`diagnose/`、`write-a-skill/` 等），它们不是 npm 包随附内容。

当前仅保留本配置实际使用的 bundled skills；不附带会与本地 OpenSpec 主流程和 Git 工作区策略竞争的可选工作流。

### 更新 Superpowers skills

Superpowers 固定为本地副本，不通过 plugin 自动加载。更新到指定上游版本：

```bash
python scripts/update-superpowers.py 6.2.0
```

脚本会下载官方 `v<version>` tag，重建本地 skills 和 `/use-superpowers` command，并重放 session gate、本地路径补丁和 executable mode。更新后检查 diff、运行测试，再手动提交；脚本不会自动 commit 或 push。

### `/git-commit` command + subagent

- `commands/git-commit.md` 定义 `/git-commit` 命令，默认走 `subtask`/`task` 调度，不让主 agent 直接执行 `git commit`。
- `agents/git-commit.md` 是专用提交 subagent，自己读取 staged diff、必要文件内容和仓库历史，生成中文提交信息，并使用临时文件执行 `git commit -F`。
- `/git-commit <范围说明>` 会把参数作为 `task_scope`；`/git-commit` 不带参数时，由主 agent 根据当前对话、短 `git status` 和 staged set 生成一两句最小范围说明。
- command 不注入完整 diff、log 或历史样例，避免污染主 agent 上下文并降低提交成本。
- subagent 默认不 push、不改 git config、不做 destructive git 操作；提交成功后只返回紧凑结果。

### `/improve-codebase-architecture` command

- `commands/improve-codebase-architecture.md` 定义架构深度扫描命令，替代旧的 `skills/improve-codebase-architecture/`。
- 命令会读取项目领域词汇和 ADR，生成临时目录中的可视化 HTML 报告，再让用户选择候选项进入 `/grilling`。
- 报告模板自包含在 command 文件中，避免依赖已删除的 skill 附件文件。

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

- 不要重新加入旧工作流；slim 插件自带 Pantheon agents，本目录只保留少量必要的自定义 agents/commands。
- 新增 repo-specific 覆盖时，优先使用 `.opencode/oh-my-opencode-slim.json`，不要直接修改插件包源码。
- 更新版本必须显式修改 `opencode.json`、`oh-my-opencode-slim.json` schema 与本文档；不要改回未固定版本或 `latest`。
