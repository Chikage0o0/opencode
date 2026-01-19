# OpenCode 配置项目

本项目包含 OpenCode AI 助手的配置文件、行为准则和自定义技能。

## 项目结构

```
.
├── AGENTS.md              # AI 行为准则文档
├── opencode.json          # OpenCode 主配置文件
├── .gitignore            # Git 忽略文件
└── skill/
    └── git-commit/       # Git 提交技能
        └── SKILL.md      # 技能说明文档
```

## 文件说明

### AGENTS.md
定义了 AI 助手在 NixOS 环境中的行为准则，包括：
- 语言与身份要求（仅使用中文）
- 系统与环境管理规范
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
- **MCP 集成**：Context7 文档查询服务
- **权限控制**：文件读写和命令执行权限配置

### skill/git-commit/SKILL.md
自定义 Git 提交技能，提供：
- 自动化的 Git 提交工作流
- 符合 Conventional Commits 规范的中文提交信息生成
- 历史风格一致性校验
- Emoji 与类型对照表

## 使用说明

### 环境要求
- NixOS 环境
- OpenCode AI 助手

### 配置加载
OpenCode 会自动加载本目录中的配置文件，AI 助手将遵循 `AGENTS.md` 中定义的行为准则。

### 技能使用
- **Git 提交技能**：当用户请求 "commit"、"提交"、"保存变更" 时，AI 助手会自动使用此技能进行规范的 Git 提交。

## 行为准则要点

1. **语言**：仅使用中文进行对话、解释和代码注释
2. **系统认知**：明确认知为 NixOS 环境，禁用常规 Linux 指令
3. **依赖管理**：必须通过 devenv.nix 管理，禁止全局安装
4. **安全隐私**：禁止读取/分析/输出敏感配置文件
5. **工具优先**：优先检索 MCP 工具或 Skills
6. **任务管理**：3 步以上复杂任务必须使用 Todo List

## 许可证

本项目配置遵循 OpenCode 的使用条款。