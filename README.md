# OpenCode 配置项目

本仓库保存一套面向 [OpenCode](https://opencode.ai) 的本地配置，涵盖系统级行为约束、工作流技能、子代理提示词、插件和文档规范。

核心目标：

- 中文输出与最小风险执行规范
- 仓库级行为约束与权限配置
- OpenCode 权限、插件与 TUI 配置
- 一套受控的软件开发工作流技能体系（从需求探索到代码审查到分支收尾）

## 仓库结构

```text
.
├── AGENTS.md                    # 系统级行为约束（技能调用规则、中文化、注释规范）
├── opencode.json                # OpenCode 主配置（权限、插件、MCP）
├── tui.json                     # 终端界面配置（主题、快捷键）
│
├── skills/                      # 工作流技能定义（13 个）
│   ├── brainstorming/           # 需求探索与设计（含可视化配套脚本）
│   ├── test-driven-development/ # Red-Green-Refactor TDD 流程
│   ├── writing-plans/           # 从规格生成实现计划
│   ├── writing-skills/          # TDD 方法论编写 SKILL.md 文档
│   ├── subagent-driven-development/  # 主开发流程：子代理驱动实现
│   ├── executing-plans/         # 后备流程：当前会话直接执行计划
│   ├── dispatching-parallel-agents/  # 并行派发独立子任务
│   ├── systematic-debugging/    # 四阶段系统化调试
│   ├── git-commit/              # 受控 Git 提交流程
│   ├── requesting-code-review/  # 请求代码审查
│   ├── receiving-code-review/   # 处理审查反馈
│   ├── verification-before-completion/  # 完成声明前的验证关卡
│   └── finishing-a-development-branch/  # 分支收尾：合并/PR/丢弃
│
├── agents/                      # 子代理角色提示词（4 个）
│   ├── implementer.md           # 实现代理
│   ├── spec-reviewer.md         # 规格合规审查代理
│   ├── code-reviewer.md         # 代码审查代理
│   └── git-commit.md            # Git 提交代理
│
├── plugins/
│   └── devenv.ts                # devenv.sh 环境集成插件
│
├── docs/
│   ├── specs/                   # 设计规格文档
│   │   ├── active/              # 进行中的规格
│   │   └── completed/           # 已完成的规格
│   └── plans/                   # 实现计划文档
│       ├── active/              # 进行中的计划
│       └── completed/           # 已完成的计划
│
├── script/                      # 脚本目录（空）
└── README.md
```

## 文件说明

### `AGENTS.md`

定义 OpenCode 在本仓库中的系统级行为约束，核心内容：

- 强制技能检查：任何操作前先判断是否有对应技能，命中则必须调用
- 指令优先级：用户指令 > OpenCode 技能 > 默认行为
- 仓库默认值：全程中文对话与分析
- 命令缺失处理：缺少一次性命令行工具时，不先要求用户安装，优先用 `nix shell nixpkgs#<package> -c <command> ...` 临时执行
- 回退边界：多个临时工具合并进同一次 `nix shell`；若 `nix` 不可用、包名不确定、网络不可用，或涉及持久服务/项目环境改造，则说明原因并替代或询问
- 注释规范：面向维护者和 AI 协作者的注释，关注业务意图与约束，不注释代码表面行为
- Red Flags 清单：常见借口与对应的事实对照，防止跳过流程

### `opencode.json`

OpenCode 主配置，当前状态：

- `autoupdate` 为 `false`，`share` 为 `disabled`
- 中文对话标题生成提示词
- 已启用插件：`@tarquinen/opencode-dcp@latest`
- 已接入远程 MCP：`context7`（`https://mcp.context7.com/mcp`）
- Bash 权限：默认 `allow`，对 `rm`/`mv`/`cp` 等破坏性命令 `ask`，对 `chown`/`dd`/`mkfs` 等 `deny`
- 读取权限：显式禁止 `.env`、`.envrc`、`.direnv/**`、`secrets/**`、`**/.ssh/**` 等敏感路径
- 编辑权限：默认 `allow`

### `tui.json`

终端界面配置：

- 主题：`one-dark`
- 快捷键：`<leader>p` 打开命令列表

### `plugins/devenv.ts`

TypeScript 插件，在 shell 环境初始化时集成 [devenv.sh](https://devenv.sh/)：

- 从项目目录向上查找 `devenv.nix`/`devenv.yaml`/`devenv.yml`
- 调用 `devenv direnv-export` 获取环境变量
- 通过 bash 脚本解析导出内容，合并到 OpenCode 的 shell 环境
- 成功解析时静默 devenv/direnv 的加载日志，失败时保留错误输出
- 使用内存缓存复用同一项目、同一基础环境下的解析结果

需宿主环境安装 `devenv` 方可生效。

## 技能体系

| 技能 | 类型 | 说明 |
|------|------|------|
| `brainstorming` | 流程 | 通过协作对话探索需求与设计，终态为 writing-plans |
| `test-driven-development` | 刚性 | Red-Green-Refactor 循环，铁律：无失败测试无生产代码 |
| `writing-plans` | 流程 | 将规格分解为零上下文可执行的详尽实现计划 |
| `writing-skills` | 刚性 | 用 TDD 方法论编写技能文档：先测试基线行为再写文档 |
| `subagent-driven-development` | 流程 | 主开发流程，每次任务边界派遣新子代理，两阶段审查（规格+代码） |
| `executing-plans` | 流程 | 后备流程，在当前会话中执行计划（不使用子代理） |
| `dispatching-parallel-agents` | 流程 | 并行派发多个独立子任务给隔离上下文代理 |
| `systematic-debugging` | 刚性 | 四阶段调试：根因调查→模式分析→假设与测试→实施修复 |
| `git-commit` | 流程 | 通过 task 调用 git-commit 子代理执行提交，禁止裸执行 git commit |
| `requesting-code-review` | 流程 | 派遣审查子代理进行独立代码评审 |
| `receiving-code-review` | 刚性 | 处理审查反馈：先独立技术验证再决定是否实施 |
| `verification-before-completion` | 刚性 | 终端关卡：任何完成声明前必须运行验证命令并确认输出 |
| `finishing-a-development-branch` | 刚性 | 分支收尾：提供合并/PR/丢弃选项，测试未通过不得继续 |

## 子代理

| 代理 | 职责 |
|------|------|
| `implementer` | 执行一个划定范围的任务，自我审查，报告状态（DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED） |
| `spec-reviewer` | 审查实现是否符合规格要求，报告状态（APPROVED/CHANGES_REQUIRED/BLOCKED） |
| `code-reviewer` | 审查代码正确性、回归风险、测试覆盖，报告状态（APPROVED/CHANGES_REQUIRED/BLOCKED） |
| `git-commit` | 创建安全的、范围锁定的 Git 提交，含提交后校验 |

## 文档

`docs/specs/` 和 `docs/plans/` 分别存放设计规格与实现计划，各有 `active/`（进行中）和 `completed/`（已完成）两个目录。

## 使用方式

### 1. 放置配置

将本仓库中的配置文件同步到 OpenCode 对应配置目录，或按你的现有目录结构进行引用。

### 2. 确认运行依赖

- 已安装并可运行 OpenCode
- 若要使用 `context7`，宿主环境可以访问远程 MCP 服务
- 若要使用 `plugins/devenv.ts`，需安装 [devenv](https://devenv.sh/) 并在 `PATH` 中可用

### 3. 验证配置

建议验证以下几点：

- OpenCode 能正常读取 `AGENTS.md`
- `opencode.json` 中的权限规则已生效
- TUI 中可通过 `<leader>p` 打开命令列表
- 明确请求提交代码时，助手会走 `git-commit` 技能

## 维护建议

- 修改 `AGENTS.md`、`opencode.json`、`tui.json`、`skills/` 或 `plugins/` 后，同步更新 `README.md`
- 新增或修改技能/子代理时，保持 README 中的技能表与目录结构为最新
- 新增配置项时，只记录结构、键名和用途，不记录敏感值
- 文档写入 `docs/specs/` 或 `docs/plans/` 对应子目录，完成后移至 `completed/`

## 许可证

本仓库仅包含 OpenCode 配置与辅助文件，使用时请遵循 OpenCode 及相关插件各自的许可条款。
