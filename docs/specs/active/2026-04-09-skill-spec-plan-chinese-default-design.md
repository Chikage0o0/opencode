# Skill 产出 spec 与 plan 默认使用中文设计

## 目标

让项目内负责产出 `spec` 与 `plan` 的核心 skill 在默认情况下生成中文文档，包括标题、章节标题、正文说明、列表项与固定话术；同时保留用户显式指定其他语言时的覆盖能力。

## 背景

当前仓库级 `AGENTS` 已要求对话与说明默认使用中文，但 `skills/brainstorming/SKILL.md` 与 `skills/writing-plans/SKILL.md` 仍然以英文描述产物模板和固定提示：

- `brainstorming` 负责写设计文档（spec），但没有把产物语言约束写成显式规则
- `writing-plans` 负责写实施计划（plan），固定文档头模板仍是英文

这会导致模型虽然处于中文仓库上下文，仍可能产出英文或中英混合的 spec / plan，尤其是在套用英文模板时更容易偏向英文。

## 设计决策

### 1. 只修改直接决定产物语言的核心 skill

本次改造仅修改以下两个文件：

- `skills/brainstorming/SKILL.md`
- `skills/writing-plans/SKILL.md`

不扩散到 reviewer prompt、其他 supporting file，除非实施时发现它们会直接破坏“产物默认中文”。当前已知问题可以在两个核心 skill 内解决，因此不做额外 churn。

### 2. 语言策略为“默认中文，用户显式要求可覆盖”

对 `spec` 与 `plan` 的语言契约统一定义为：

- 默认使用中文撰写文档
- 如果用户明确要求英文或其他语言，则以用户要求为准
- 该覆盖只作用于文档自然语言部分，不影响代码、命令、路径、标识符等技术内容

这样可以同时满足仓库默认中文约束与用户优先级更高的显式指令。

### 3. spec 与 plan 的中文范围一致

`spec` 与 `plan` 都采用相同的中文化范围：

- 文档标题
- 各级章节标题
- 正文说明
- 列表项说明
- 固定提示语
- 对命令预期结果的文字描述

以下内容保持原样，不做无意义翻译：

- 代码块内容
- shell 命令
- 文件路径
- skill 名称
- 函数名、类型名、类名、配置键等标识符

### 4. `brainstorming` 负责约束 spec 产物语言

在 `skills/brainstorming/SKILL.md` 的写作与交接阶段加入明确规则：

- 生成 spec 时默认使用中文
- 用户若明确要求其他语言，可覆盖默认值
- 用户审阅 spec 的固定提示语也应使用中文，以减少中英文切换

路径与命名规则保持不变，仍为：

- `docs/specs/active/YYYY-MM-DD-<topic>-design.md`

### 5. `writing-plans` 负责约束 plan 产物语言与头模板

在 `skills/writing-plans/SKILL.md` 中加入 plan 默认中文规则，并把强制头模板改成中文版本。头模板应从英文：

- `# [Feature Name] Implementation Plan`
- `Goal`
- `Architecture`
- `Tech Stack`

改为中文等价版本，例如：

- `# [功能名称] 实施计划`
- `目标`
- `架构`
- `技术栈`

这样可直接消除模板级英文诱导，降低 plan 被英文结构带偏的概率。

### 6. 不改变路径、命名与生命周期规则

本次只解决文档语言，不调整以下既有契约：

- spec 路径仍为 `docs/specs/active/` 与 `docs/specs/completed/`
- plan 路径仍为 `docs/plans/active/` 与 `docs/plans/completed/`
- 文件命名规则保持现状
- 文档归档时机保持现状

## 数据流与执行流程

### spec 阶段

1. `brainstorming` 完成设计澄清
2. 写入 `docs/specs/active/...` 设计文档
3. 文档自然语言部分默认使用中文
4. 若用户显式要求英文或其他语言，则按用户要求写入

### plan 阶段

1. `writing-plans` 基于已批准 spec 生成实施计划
2. 写入 `docs/plans/active/...` 计划文档
3. 计划头模板与正文默认使用中文
4. 若用户显式要求英文或其他语言，则按用户要求覆盖

## 错误处理与边界

- 不把“中文默认”写成绝对强制规则，避免与用户显式语言要求冲突
- 不翻译代码、命令、路径与标识符，避免引入技术歧义
- 不进行整份 skill 文本全面翻译，避免无关改动干扰后续维护
- 如果实施时发现 supporting file 中存在直接生成英文产物的硬编码模板，再按最小原则补改

## 验证策略

### 文本验证

验证两个核心 skill 都明确包含以下信息：

1. spec 默认中文，用户可覆盖
2. plan 默认中文，用户可覆盖
3. plan 的固定文档头模板已切换为中文字段

### 行为验证

至少从文档层面回答以下问题，且答案都应为“是”：

1. 走 `brainstorming` 写 spec 时，默认会产出中文标题与正文吗？
2. 走 `writing-plans` 写 plan 时，默认会产出中文标题与正文吗？
3. 如果用户明确要求英文，skill 是否允许覆盖默认中文？
4. 技术标识符是否仍保持原样，不会被误翻译？

## 非目标

- 不把整个 `skills/brainstorming/SKILL.md` 翻译成中文
- 不把整个 `skills/writing-plans/SKILL.md` 翻译成中文
- 不修改 `docs/specs` 与 `docs/plans` 的路径规则
- 不修改 reviewer prompt 与其他 supporting file，除非实施时发现其会直接破坏默认中文产物
