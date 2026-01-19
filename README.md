# OpenCode 配置项目

本项目包含 OpenCode AI 助手的配置文件、行为准则和自定义技能。

## 项目结构

```
.
├── AGENTS.md              # AI 行为准则文档
├── opencode.json          # OpenCode 主配置文件
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
- 语言与身份要求（仅使用中文，角色为跨平台高级软件工程师）
- 系统自动识别与适配规范
- 系统与环境管理规范（NixOS 遵循不可变原则，其他环境优先使用虚拟环境）
- 安全与配置隐私策略
- 工具调用优先原则
- 编码规范
- 文档生成策略

### opencode.json
OpenCode 主配置文件，包含：
- **主题设置**：使用 one-dark 主题
- **插件**：opencode-google-antigravity-auth
- **模型提供商**：
  - Google（Gemini 3 Pro、Gemini 3 Flash、Claude Sonnet 4.5、Claude Opus 4.5）
  - 智谱AI Coding Plan
  - 小米模型（Mimo V2 Flash）
  - 火山引擎模型（Ark Code）
- **MCP 集成**：
  - Context7 文档查询服务
  - system_info 本地系统信息服务
- **权限控制**：文件读写和命令执行权限配置

### script/system-info-mcp.py
一个基于 FastMCP 实现的本地工具，用于：
- 获取当前操作系统的详细发行版信息（如 NixOS, Ubuntu 等）
- 查询内核版本和 Python 运行环境
- 为跨平台适配提供环境感知支持

### skill/git-commit/SKILL.md
自定义 Git 提交技能，提供：
- 自动化的 Git 提交工作流
- 符合 Conventional Commits 规范的中文提交信息生成
- 历史风格一致性校验
- Emoji 与类型对照表

## 使用说明

### 环境要求
- 多平台适配：NixOS, Linux (Debian/Ubuntu/CentOS), Windows
- OpenCode AI 助手
- Python 环境（用于运行 script/ 下的 MCP 脚本）

### 配置加载
OpenCode 会自动加载本目录中的配置文件，AI 助手将遵循 `AGENTS.md` 中定义的行为准则，并利用 `system_info` 脚本自动适配环境。

### 技能与脚本使用
- **Git 提交技能**：当用户请求 "commit"、"提交"、"保存变更" 时，AI 助手会自动使用此技能进行规范的 Git 提交。
- **系统信息查询**：AI 助手会自动调用 `system_info` 获取环境详情，以确保执行正确的系统指令。

## 行为准则要点

1. **语言**：仅使用中文进行对话、解释和代码注释
2. **跨平台认知**：自动识别操作系统并适配指令（NixOS 禁用常规 Linux 修改指令）
3. **依赖管理**：NixOS 通过 devenv.nix 管理；其他环境优先使用虚拟环境，禁止非必要的全局安装
4. **安全隐私**：禁止读取/分析/输出敏感配置文件
5. **工具优先**：优先检索 MCP 工具或 Skills
6. **任务管理**：3 步以上复杂任务必须使用 Todo List


## 许可证

本项目配置遵循 OpenCode 的使用条款。