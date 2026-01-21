# OpenCode 配置项目

本项目包含 OpenCode AI 助手的配置文件、行为准则和自定义技能，旨在为跨平台开发环境提供统一的 AI 助手行为规范和功能扩展。

## 项目结构

```
.
├── AGENTS.md              # AI 行为准则文档
├── opencode.json          # OpenCode 主配置文件
├── package.json           # 项目依赖配置
├── bun.lock               # Bun 锁定文件
├── .gitignore            # Git 忽略文件
├── script/               # 自定义脚本工具
│   └── system-info-mcp.py # 系统信息查询 MCP 脚本
└── skill/
    └── git-commit/       # Git 提交技能
        └── SKILL.md      # 技能说明文档
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
- 插件：opencode-google-antigravity-auth
- 自动更新：启用

**模型提供商**：
1. **Google**：
   - Gemini 3 Pro（预览版）：支持多模态输入（文本、图像、视频、音频、PDF），上下文窗口 1M tokens
   - Gemini 3 Flash：支持多模态输入，上下文窗口 1M tokens
   - Claude Sonnet 4.5：支持文本、图像、PDF 输入，上下文窗口 200K tokens
   - Claude Opus 4.5：支持文本、图像、PDF 输入，上下文窗口 200K tokens

2. **智谱AI Coding Plan**：
   - GLM 4.7：支持推理功能，上下文窗口 204.8K tokens

3. **小米模型**：
   - Mimo V2 Flash：支持推理功能，上下文窗口 262K tokens

4. **NVIDIA**：
   - GLM 4.7：通过 NVIDIA API 提供
   - Minimax M2.1：通过 NVIDIA API 提供

**MCP 集成**：
- **Context7**：远程服务，用于文档查询
- **system_info**：本地服务，通过 `uv run` 执行远程脚本 `https://github.com/Chikage0o0/opencode/raw/refs/heads/main/script/system-info-mcp.py`

**权限控制**：
- **Bash 命令**：
  - 默认：询问（ask）
  - 允许：`git status*`、`git diff*`、`git log*`、`npm *`、`ls`、`dir`、`type *`、`whoami`、`pwd`
  - 询问：`rm *`
- **文件读取**：
  - 禁止：.env、.env.*、.envrc、secrets/**、config/credentials.json、mise.local.toml、.direnv/**、devenv.local.nix、build
- **文件编辑**：默认询问

### package.json
项目依赖配置，当前仅包含：
- `@opencode-ai/plugin`：OpenCode AI 插件，版本 1.1.25

### bun.lock
Bun 包管理器的锁定文件，确保依赖版本的一致性。

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

### .gitignore
Git 忽略文件配置，当前忽略：
- `node_modules`：Node.js 依赖目录
- `package.json`：项目依赖配置文件
- `bun.lock`：Bun 锁定文件

**注意**：虽然这些文件在 .gitignore 中，但它们在仓库中。这可能是因为它们是项目必需的配置文件，需要被版本控制，或者 .gitignore 配置需要更新以排除这些文件。

## 使用说明

### 环境要求
- **多平台适配**：NixOS, Linux (Debian/Ubuntu/CentOS), Windows
- **OpenCode AI 助手**：安装并配置 OpenCode
- **Python 环境**：用于运行 script/ 下的 MCP 脚本（需要安装 `mcp` 依赖）
- **Bun**：用于管理 JavaScript 依赖（可选，但推荐）

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
  - JavaScript 依赖：使用 `bun install` 或 `npm install`
  - Python 依赖：使用虚拟环境（如 `venv`）或 `uv`
  - 系统级依赖：使用相应的包管理器（apt/yum/dnf）

## 行为准则要点

1. **语言**：仅使用中文进行对话、解释和代码注释
2. **跨平台认知**：自动识别操作系统并适配指令（NixOS 禁用常规 Linux 修改指令）
3. **依赖管理**：NixOS 通过 devenv.nix 管理；其他环境优先使用虚拟环境，禁止非必要的全局安装
4. **安全隐私**：禁止读取/分析/输出敏感配置文件
5. **工具优先**：优先检索 MCP 工具或 Skills
6. **任务管理**：3 步以上复杂任务必须使用 Todo List
7. **编码规范**：遵循语言特定的命名风格和注释规范
8. **文档生成**：默认仅提供代码修改，用户明确要求时才生成文档

## 项目更新历史

最近的更新包括：
- **模型提供商更新**：替换为 NVIDIA 并完善配置
- **MCP 配置更新**：system_info MCP 工具命令改为远程脚本地址
- **文档完善**：更新工具调用优先原则并完善换行符处理说明
- **功能增强**：新增系统信息工具并更新跨平台适配文档

## 许可证

本项目配置遵循 OpenCode 的使用条款。

## 贡献指南

如需贡献：
1. 修改配置文件时，请确保符合 AGENTS.md 中定义的行为准则
2. 更新代码后，检查并同步相关文档
3. 提交时使用 Git 提交技能，确保提交信息符合规范
4. 引入新环境变量或配置项时，必须更新示例文件（如 .env.example）