# OpenCode 配置项目

本项目包含 OpenCode AI 助手的配置文件、行为准则、自定义技能和插件，旨在为跨平台开发环境提供统一的 AI 助手行为规范和功能扩展。

## 项目结构

```
.
├── AGENTS.md                    # AI 行为准则文档
├── opencode.json                # OpenCode 主配置文件
├── tui.json                     # TUI 界面配置
├── .gitignore                  # Git 忽略文件
├── plugins/                    # 插件目录
│   └── superpowers.js          # Superpowers 插件
├── script/                     # 自定义脚本工具
│   └── system-info-mcp.py      # 系统信息查询 MCP 脚本
└── skills/                     # 技能目录
    ├── git-commit/             # Git 提交技能
    │   └── SKILL.md
    └── superpowers/            # 超级技能集合
        ├── using-superpowers/  # 技能使用指南
        ├── brainstorming/     # 头脑风暴技能
        ├── test-driven-development/  # 测试驱动开发
        ├── systematic-debugging/     # 系统化调试
        ├── executing-plans/   # 计划执行
        ├── subagent-driven-development/  # 子代理驱动开发
        ├── verification-before-completion/  # 完成前验证
        ├── requesting-code-review/  # 请求代码审查
        ├── receiving-code-review/   # 接收代码审查
        ├── finishing-a-development-branch/  # 完成开发分支
        ├── dispatching-parallel-agents/  # 分发并行代理
        ├── writing-skills/    # 写作技能
        ├── writing-plans/     # 写作计划
        ├── using-git-worktrees/  # 使用 Git 工作树
        └── ... (更多技能)
```

## 文件说明

### AGENTS.md
定义了 AI 助手在跨平台环境中的行为准则，支持 NixOS, Windows, Debian/Ubuntu, CentOS，包括：
- **语言与身份要求**：仅使用中文（对话、解释、注释），角色为跨平台高级软件工程师
- **系统与环境管理**：
  - 自动识别并适配当前操作系统环境
  - NixOS：禁用常规 Linux 修改指令，遵循不可变基础设施原则
  - Debian/Ubuntu/CentOS：遵循相应发行版的包管理约定（apt/yum/dnf）
  - Windows：使用 PowerShell/CMD 规范，注意路径差异及权限限制
- **依赖管理**：
  - 核心原则：禁止非必要的全局安装
  - NixOS：必须通过 `devenv.nix` 管理，临时工具使用 `nix run` 或 `nix shell`
  - 其他环境：优先使用语言级虚拟环境（如 venv, node_modules, gopath 等）
- **安全与配置隐私**：
  - 禁止读取/分析/输出敏感配置文件（.env、config.toml、config.json）
  - 引入新环境变量时必须更新示例文件
- **工具调用优先原则**：
  - 优先检索 MCP 工具或 Skill 工具
  - 无合适工具时才手动编写代码
  - 3 步以上复杂任务必须使用 Todo List
- **编码规范**：
  - Python：snake_case（变量/函数）、PascalCase（类）
  - JS/TS：camelCase（变量/函数）、PascalCase（类/组件）
  - 注释规范：中文，非必要不注释，必写解释"为什么"和高复杂度逻辑
- **文档生成策略**：
  - 默认仅提供代码修改、Diff 或简短解释
  - 用户明确要求时才生成文档
  - 更新代码后检查并同步相关文档

### opencode.json
OpenCode 主配置文件，包含：

**主题与插件**：
- 主题：one-dark
- 插件：@tarquinen/opencode-dcp、superpowers 插件
- 自动更新：启用

**AI 模型配置**：
- 小型模型：stepfun/step-3.5-flash（阶跃 3.5 Flash）
- 智能体：自定义对话标题生成助手

**MCP 集成**：
- **Context7**：远程服务，用于文档查询
- **system_info**：本地服务，通过 `uv run` 执行远程脚本 `https://github.com/Chikage0o0/opencode/raw/refs/heads/main/script/system-info-mcp.py`

**权限控制**：
- **Bash 命令**：
  - 默认：询问（ask）
  - 允许：`git status*`、`git diff*`、`git log*`、`git ls-files*`、`npm *`、`cargo check*`、`ls`、`dir`、`type *`、`whoami`、`pwd`、`grep *`、`rg *`、`find *`
  - 询问：`rm *`
  - 特殊允许：`commit.msg` 文件的删除操作
- **文件读取**：
  - 禁止：.env、.env.*、.envrc、secrets/**、config/credentials.json、mise.local.toml、.direnv/**、devenv.local.nix、build
- **文件编辑**：默认询问（commit.msg 除外，自动允许）

**模型提供商**：
- **StepFun**：提供 Step 3.5 Flash 模型，支持推理功能，上下文窗口 256K tokens，输出限制 64K tokens

### tui.json
OpenCode TUI（终端用户界面）配置文件，包含：
- 主题：one-dark
- 快捷键绑定：`<leader>p` 打开命令列表

### plugins/superpowers.js
Superpowers 插件，用于：
- 自动加载 skills/ 目录下的所有技能
- 通过系统提示词注入超级能力引导
- 支持技能发现和路径映射
- 将 Claude Code 的工具映射到 OpenCode 等效工具

### script/system-info-mcp.py
基于 FastMCP 实现的本地工具，用于：
- 获取当前操作系统的详细发行版信息（如 NixOS, Ubuntu 等）
- 查询内核版本和 Python 运行环境
- 为跨平台适配提供环境感知支持
- 通过 `uv run` 执行，作为 OpenCode 的 MCP 服务

### skill/git-commit/SKILL.md
自定义 Git 提交技能，提供：
- **自动化 Git 提交工作流**：自动分析暂存区、生成符合规范的中文提交信息并完成提交
- **Conventional Commits 规范**：遵循标准提交格式，支持中文描述
- **历史风格一致性校验**：分析历史提交记录，保持 Scope 命名、描述粒度和特殊标记的一致性
- **Emoji 与类型对照表**：提供丰富的提交类型标识（✨ feat、🐛 fix、📚 docs、🎨 style、♻️ refactor、⚡️ perf、🧪 test、📦 build、🚀 ci、🧹 chore、⏪ revert）

**提交工作流**：
1. **状态检测与暂存策略**：检查暂存区，决定是否执行 `git add`
2. **深度上下文分析**：读取文件上下文，理解代码意图
3. **历史风格一致性校验**：分析最近 10 条提交记录
4. **生成提交信息**：基于分析结果生成符合规范的提交信息
5. **执行提交**：使用生成的提交信息执行 Git 提交

### skills/superpowers/（超级技能集合）
一套完整的开发流程技能，涵盖从设计到部署的全流程：

**核心流程技能**：
- **using-superpowers**：技能使用指南，强制要求在任何任务开始前检查并调用相关技能
- **brainstorming**：头脑风暴技能，用于在实现功能前探索需求、设计架构和评估方案
- **test-driven-development**：测试驱动开发，遵循红-绿-重构循环，确保代码质量
- **systematic-debugging**：系统化调试，通过四阶段法（根因调查、模式分析、假设测试、实现修复）解决问题

**项目管理技能**：
- **executing-plans**：执行计划管理，用于按步骤实施复杂的实现计划
- **subagent-driven-development**：子代理驱动开发，通过角色分工（评审者、实现者、质量审查者）协作完成开发
- **verification-before-completion**：完成前验证，确保工作成果符合要求后再标记完成
- **requesting-code-review**：请求代码审查，遵循结构化的代码审查流程
- **receiving-code-review**：接收代码审查反馈，专业处理审查意见
- **finishing-a-development-branch**：完成开发分支，提供分支整合的结构化选项
- **dispatching-parallel-agents**：分发并行代理，同时处理多个独立任务

**专业领域技能**：
- **writing-skills**：写作技能指导，提供清晰的写作原则和最佳实践
- **writing-plans**：写作计划制定，在实现前创建详细的技术方案
- **using-git-worktrees**：使用 Git 工作树，创建隔离的开发环境

每个技能都遵循严格的工作流程和验证机制，确保开发过程的高质量和可追溯性。

### .gitignore
Git 忽略文件配置，当前忽略：
- `node_modules`：Node.js 依赖目录
- `package.json`：项目依赖配置文件
- `bun.lock`：Bun 锁定文件
- `commit.msg`：临时提交信息文件

**注意**：虽然 `package.json` 和 `bun.lock` 在 .gitignore 中，但它们在仓库中。这是因为这些文件是项目必需的配置文件，OpenCode 需要它们来管理插件依赖。

## 使用说明

### 环境要求
- **多平台适配**：NixOS, Linux (Debian/Ubuntu/CentOS), Windows
- **OpenCode AI 助手**：安装并配置 OpenCode
- **Python 环境**：用于运行 script/ 下的 MCP 脚本（需要安装 `mcp` 依赖）
- **Bun**：用于安装和管理 OpenCode 插件（@tarquinen/opencode-dcp、superpowers 插件）

### 配置加载
OpenCode 会自动加载本目录中的配置文件：
1. AI 助手将遵循 `AGENTS.md` 中定义的行为准则
2. 使用 `opencode.json` 中的配置进行模型选择、权限控制等
3. 自动调用 `system_info` MCP 服务获取环境详情，以确保执行正确的系统指令

### 技能与脚本使用
- **Git 提交技能**：当用户请求 "commit"、"提交"、"保存变更" 时，AI 助手会自动使用此技能进行规范的 Git 提交。
- **系统信息查询**：AI 助手会自动调用 `system_info` 获取环境详情，以确保执行正确的系统指令。
- **MCP 服务**：
  - **Context7**：用于查询文档和代码库信息
  - **system_info**：用于获取操作系统、内核版本等环境信息

### 依赖管理
- **NixOS**：通过 `devenv.nix` 管理依赖，临时工具使用 `nix run` 或 `nix shell`
- **其他环境**：
  - JavaScript 依赖：使用 `bun install` 安装 OpenCode 插件
  - Python 依赖：使用虚拟环境（如 `venv`）或 `uv`
  - 系统级依赖：使用相应的包管理器（apt/yum/dnf）

## 行为准则要点

1. **语言**：仅使用中文进行对话、解释和代码注释
2. **跨平台认知**：自动识别操作系统并适配指令（NixOS 禁用常规 Linux 修改指令）
3. **依赖管理**：NixOS 通过 devenv.nix 管理；其他环境优先使用虚拟环境，禁止非必要的全局安装
4. **安全隐私**：禁止读取/分析/输出敏感配置文件
5. **工具优先**：优先检索 MCP 工具或 Skills，3 步以上复杂任务必须使用 Todo List
6. **编码规范**：遵循语言特定的命名风格和注释规范
7. **文档生成**：默认仅提供代码修改，用户明确要求时才生成文档
8. **Git 操作**：必须使用 git-commit 技能进行提交，严禁手动运行 `git commit` 命令

## 项目更新历史

最近的更新包括：
- **配置简化**：将多模型提供商简化为 StepFun 单一提供商，聚焦 Step 3.5 Flash 模型
- **超级能力系统**：新增完整的 skills/superpowers/ 技能集合，涵盖设计、调试、测试、项目管理等全流程
- **插件系统**：新增 superpowers.js 插件，实现技能的自动发现和加载
- **TUI 配置**：新增 tui.json 配置，自定义终端界面主题和快捷键
- **权限增强**：扩展 Bash 命令允许列表，新增 `cargo check*`、`git ls-files*` 等命令
- **MCP 优化**：system_info 工具改为远程脚本地址，提升跨平台兼容性
- **文档完善**：全面更新项目结构和技能说明，保持与最新配置同步

## 许可证

本项目配置遵循 OpenCode 的使用条款。

## 贡献指南

如需贡献：
1. 修改配置文件时，请确保符合 AGENTS.md 中定义的行为准则
2. 更新代码后，检查并同步相关文档
3. 提交时使用 Git 提交技能，确保提交信息符合规范
4. 引入新环境变量或配置项时，必须更新示例文件（如 .env.example）