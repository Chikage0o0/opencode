# OpenCode 配置项目

这个仓库保存一套面向 OpenCode 的本地配置，重点包括：

- 中文输出与最小风险执行规范
- 默认面向 NixOS / Nix 工作流的行为约束
- OpenCode 权限、插件与 TUI 配置
- 受控 Git 提交流程技能
- 一个基于 `rtk rewrite` 的命令改写插件示例

## 当前仓库结构

```text
.
├── AGENTS.md
├── opencode.json
├── tui.json
├── plugins/
│   └── opencode-rtk.ts
├── skills/
│   └── git-commit/
│       └── SKILL.md
└── README.md
```

## 文件说明

### `AGENTS.md`

定义 OpenCode 在本仓库中的系统级行为约束，核心内容包括：

- 全程使用中文进行对话、解释和代码注释
- 默认按 NixOS / Nix 工作流处理命令、依赖和配置问题
- 禁止读取或输出敏感配置值
- 优先最小改动、最小风险、可验证交付
- 涉及 3 步以上任务时必须维护 Todo List
- 用户要求提交代码时，必须走 `git-commit` 技能，不能直接裸执行 `git commit`

### `opencode.json`

OpenCode 主配置，当前状态如下：

- `autoupdate` 为 `false`
- 配置了中文对话标题生成提示词
- 已启用插件：`opencode-direnv`、`opencode-swarm`、`openslimedit@latest`
- 已接入远程 MCP：`context7`
- Bash 权限默认 `ask`，并对白名单命令放行，如 `git status*`、`git diff*`、`rg *`、`rtk *`
- 显式禁止读取 `.env`、`.envrc`、`.direnv/**`、`devenv.local.nix` 等敏感路径

### `tui.json`

终端界面配置当前仅包含：

- 主题：`one-dark`
- 快捷键：`<leader>p` 打开命令列表

### `plugins/opencode-rtk.ts`

这是一个自定义 OpenCode 插件，作用是：

- 仅在执行 `bash` 或 `shell` 工具前介入
- 调用 `rtk rewrite <command>` 重写命令，以减少 token 消耗
- 对 `rg` 以及需要保留原始输出语义的 `git` 命令直接跳过改写
- 若系统中不存在 `rtk`，则自动禁用并保持原命令直通

注意：该文件是仓库内提供的插件源码；是否实际生效，取决于宿主环境是否加载该插件，以及 `PATH` 中是否可用 `rtk`

### `skills/git-commit/SKILL.md`

这是受控 Git 提交技能，要求：

- 仅在用户明确表达“提交到 Git / commit / 生成提交记录”等意图时触发
- 先检查仓库状态、冲突和暂存区，再锁定提交范围
- 通过临时文件执行 `git commit -F <tempfile>`，而不是 `git commit -m`
- 临时文件清理优先使用 `trap` 或 `rc` 之类普通变量名，避免触发 `zsh` 的只读变量 `status`
- 提交后必须校验提交标题、正文与提交范围
- 默认不执行 `git push`

## 使用方式

### 1. 放置配置

将本仓库中的配置文件同步到 OpenCode 对应配置目录，或按你的现有目录结构进行引用。

### 2. 确认运行依赖

根据当前配置，至少需要确认：

- 已安装并可运行 OpenCode
- 若要使用 `context7`，宿主环境可以访问远程 MCP 服务
- 若要使用 `plugins/opencode-rtk.ts`，需要先安装 `rtk`，安装说明见 `https://github.com/rtk-ai/rtk`
- 安装完成后，需确保 `rtk` 已在当前环境的 `PATH` 中可用
- 若工作流依赖 `direnv` 或 swarm 相关插件，宿主环境中需要存在对应插件能力

### 3. 验证配置是否生效

建议最小验证以下几点：

- OpenCode 能正常读取 `AGENTS.md`
- `opencode.json` 中的权限规则已生效
- TUI 中可通过 `<leader>p` 打开命令列表
- 明确请求提交代码时，助手会走 `git-commit` 技能

## 维护建议

- 修改 `AGENTS.md`、`opencode.json`、`tui.json`、`skills/` 或 `plugins/` 后，同步更新 `README.md`
- 新增配置项时，只记录结构、键名和用途，不记录敏感值
- 若后续真正启用 `plugins/opencode-rtk.ts`，建议在 `opencode.json` 或部署说明中补充加载方式，避免文档与实际生效路径不一致

## 许可证

本仓库仅包含 OpenCode 配置与辅助文件，使用时请遵循 OpenCode 及相关插件各自的许可条款。
