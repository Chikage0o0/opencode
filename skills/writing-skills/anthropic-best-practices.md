# Skill 编写最佳实践

> 学习如何编写有效的 Skill，让 Claude 能够成功发现和使用。

优秀的 Skill 简洁、结构清晰，并经过实际使用测试。本指南提供实用的编写建议，帮助你编写 Claude 能够有效发现和使用的 Skill。

关于 Skill 工作原理的概念性背景，请参阅 [Skills 概述](/en/docs/agents-and-tools/agent-skills/overview)。

## 核心原则

### 简洁是关键

[上下文窗口](https://platform.claude.com/docs/en/build-with-claude/context-windows) 是一种公共资源。你的 Skill 与 Claude 需要了解的所有其他内容共享上下文窗口，包括：

* 系统提示词
* 对话历史
* 其他 Skill 的元数据
* 你的实际请求

并非 Skill 中的每个 token 都有直接成本。启动时，只会预加载所有 Skill 的元数据（名称和描述）。Claude 仅在 Skill 变得相关时才会读取 SKILL.md，并仅在需要时读取其他文件。然而，在 SKILL.md 中保持简洁仍然很重要：一旦 Claude 加载了它，每个 token 都会与对话历史和其他上下文竞争。

**默认假设**：Claude 已经非常聪明

只添加 Claude 尚不了解的上下文。对每条信息提出质疑：

* "Claude 真的需要这个解释吗？"
* "我可以假设 Claude 已经知道这一点吗？"
* "这段文字是否值得它消耗的 token 成本？"

**好例子：简洁**（约 50 个 token）：

````markdown  theme={null}
## 提取 PDF 文本

使用 pdfplumber 提取文本：

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**坏例子：过于冗长**（约 150 个 token）：

```markdown  theme={null}
## 提取 PDF 文本

PDF（便携式文档格式）文件是一种常见的文件格式，包含
文本、图像和其他内容。要从 PDF 中提取文本，你需要
使用一个库。有许多可用于 PDF 处理的库，但我们
推荐 pdfplumber，因为它易于使用且能处理大多数情况。
首先，你需要使用 pip 安装它。然后你可以使用下面的代码...
```

简洁版本假设 Claude 知道什么是 PDF 以及库如何工作。

### 设置适当的自由度

将具体程度与任务的脆弱性和可变性相匹配。

**高自由度**（基于文本的指令）：

适用于：

* 多种方法都有效
* 决策取决于上下文
* 启发式方法指导方法

示例：

```markdown  theme={null}
## 代码审查流程

1. 分析代码结构和组织
2. 检查潜在的 bug 或边界情况
3. 提出可读性和可维护性改进建议
4. 验证是否符合项目约定
```

**中等自由度**（伪代码或带参数的脚本）：

适用于：

* 存在首选模式
* 允许一些变化
* 配置会影响行为

示例：

````markdown  theme={null}
## 生成报告

使用此模板并根据需要进行自定义：

```python
def generate_report(data, format="markdown", include_charts=True):
    # 处理数据
    # 以指定格式生成输出
    # 可选包含可视化图表
```
````

**低自由度**（特定脚本，很少或没有参数）：

适用于：

* 操作脆弱且容易出错
* 一致性至关重要
* 必须遵循特定顺序

示例：

````markdown  theme={null}
## 数据库迁移

精确运行此脚本：

```bash
python scripts/migrate.py --verify --backup
```

不要修改命令或添加额外的标志。
````

**类比**：将 Claude 想象成一个在路径上探索的机器人：

* **两侧是悬崖的窄桥**：只有一条安全的前进道路。提供具体的护栏和精确指令（低自由度）。示例：必须按精确顺序运行的数据库迁移。
* **没有危险的开放场地**：许多路径都能通向成功。给出大致方向，相信 Claude 能找到最佳路线（高自由度）。示例：代码审查，其中上下文决定最佳方法。

### 用你计划使用的所有模型进行测试

Skill 作为模型的补充，因此有效性取决于底层模型。用你计划使用的所有模型测试你的 Skill。

**按模型分类的测试考虑**：

* **Claude Haiku**（快速、经济）：Skill 是否提供了足够的指导？
* **Claude Sonnet**（平衡）：Skill 是否清晰高效？
* **Claude Opus**（强大的推理能力）：Skill 是否避免了过度解释？

对 Opus 效果完美的内容可能需要为 Haiku 提供更多细节。如果你计划在多个模型中使用 Skill，请力求适用于所有模型的指令。

## Skill 结构

<Note>
  **YAML Frontmatter**：SKILL.md 的 frontmatter 需要两个字段：

  * `name` - Skill 的可读名称（最多 64 个字符）
  * `description` - Skill 功能和使用时机的单行描述（最多 1024 个字符）

  关于完整的 Skill 结构详情，请参阅 [Skills 概述](/en/docs/agents-and-tools/agent-skills/overview#skill-structure)。
</Note>

### 命名约定

使用一致的命名模式，使 Skill 更易于引用和讨论。我们建议使用**动名词形式**（动词 + -ing）作为 Skill 名称，因为这能清楚地描述 Skill 提供的活动或能力。

**良好的命名示例（动名词形式）**：

* "Processing PDFs"
* "Analyzing spreadsheets"
* "Managing databases"
* "Testing code"
* "Writing documentation"

**可接受的替代方案**：

* 名词短语："PDF Processing"、"Spreadsheet Analysis"
* 动作导向："Process PDFs"、"Analyze Spreadsheets"

**避免**：

* 模糊名称："Helper"、"Utils"、"Tools"
* 过于笼统："Documents"、"Data"、"Files"
* Skill 集合中不一致的模式

一致的命名使得：

* 在文档和对话中引用 Skill 更容易
* 一眼就能理解 Skill 的功能
* 组织和搜索多个 Skill 更方便
* 维护一个专业、连贯的 Skill 库

### 编写有效的描述

`description` 字段支持 Skill 发现，应包含 Skill 的功能以及何时使用它。

<Warning>
  **始终使用第三人称**。描述会被注入系统提示词中，不一致的人称视角会导致发现问题。

  * **好：** "Processes Excel files and generates reports"
  * **避免：** "I can help you process Excel files"
  * **避免：** "You can use this to process Excel files"
</Warning>

**具体并包含关键术语**。同时包含 Skill 的功能以及使用它的具体触发条件/上下文。

每个 Skill 只有一个描述字段。描述对于 Skill 选择至关重要：Claude 使用它从可能 100 多个可用 Skill 中选择正确的 Skill。你的描述必须提供足够的细节，让 Claude 知道何时选择此 Skill，而 SKILL.md 的其余部分提供实现细节。

有效示例：

**PDF Processing skill：**

```yaml  theme={null}
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

**Excel Analysis skill：**

```yaml  theme={null}
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.
```

**Git Commit Helper skill：**

```yaml  theme={null}
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

避免以下模糊描述：

```yaml  theme={null}
description: Helps with documents
```

```yaml  theme={null}
description: Processes data
```

```yaml  theme={null}
description: Does stuff with files
```

### 渐进式披露模式

SKILL.md 作为概览，根据需要指引 Claude 查看详细资料，就像入职指南中的目录一样。关于渐进式披露工作原理的解释，请参阅概述中的 [Skill 工作原理](/en/docs/agents-and-tools/agent-skills/overview#how-skills-work)。

**实用指导**：

* 为获得最佳性能，保持 SKILL.md 正文在 500 行以内
* 接近此限制时，将内容拆分到单独的文件中
* 使用以下模式有效组织指令、代码和资源

#### 视觉概览：从简单到复杂

一个基本的 Skill 从只包含元数据和指令的 SKILL.md 文件开始：

<img src="https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=87782ff239b297d9a9e8e1b72ed72db9" alt="Simple SKILL.md file showing YAML frontmatter and markdown body" data-og-width="2048" width="2048" data-og-height="1153" height="1153" data-path="images/agent-skills-simple-file.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?w=280&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=c61cc33b6f5855809907f7fda94cd80e 280w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?w=560&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=90d2c0c1c76b36e8d485f49e0810dbfd 560w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?w=840&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=ad17d231ac7b0bea7e5b4d58fb4aeabb 840w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?w=1100&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=f5d0a7a3c668435bb0aee9a3a8f8c329 1100w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?w=1650&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=0e927c1af9de5799cfe557d12249f6e6 1650w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-simple-file.png?w=2500&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=46bbb1a51dd4c8202a470ac8c80a893d 2500w" />

随着 Skill 的增长，你可以打包额外的内容，Claude 只在需要时加载它们：

<img src="https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=a5e0aa41e3d53985a7e3e43668a33ea3" alt="Bundling additional reference files like reference.md and forms.md." data-og-width="2048" width="2048" data-og-height="1327" height="1327" data-path="images/agent-skills-bundling-content.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?w=280&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=f8a0e73783e99b4a643d79eac86b70a2 280w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?w=560&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=dc510a2a9d3f14359416b706f067904a 560w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?w=840&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=82cd6286c966303f7dd914c28170e385 840w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?w=1100&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=56f3be36c77e4fe4b523df209a6824c6 1100w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?w=1650&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=d22b5161b2075656417d56f41a74f3dd 1650w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-bundling-content.png?w=2500&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=3dd4bdd6850ffcc96c6c45fcb0acd6eb 2500w" />

完整的 Skill 目录结构可能如下所示：

```
pdf/
├── SKILL.md              # 主要指令（触发时加载）
├── FORMS.md              # 表单填写指南（按需加载）
├── reference.md          # API 参考（按需加载）
├── examples.md           # 使用示例（按需加载）
└── scripts/
    ├── analyze_form.py   # 实用脚本（执行，不加载）
    ├── fill_form.py      # 表单填写脚本
    └── validate.py       # 验证脚本
```

#### 模式 1：带参考资料的高级指南

````markdown  theme={null}
---
name: PDF Processing
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## 快速开始

使用 pdfplumber 提取文本：
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## 高级功能

**表单填写**：完整指南请参阅 [FORMS.md](FORMS.md)
**API 参考**：所有方法请参阅 [REFERENCE.md](REFERENCE.md)
**示例**：常见模式请参阅 [EXAMPLES.md](EXAMPLES.md)
````

Claude 仅在需要时加载 FORMS.md、REFERENCE.md 或 EXAMPLES.md。

#### 模式 2：按领域组织

对于包含多个领域的 Skill，按领域组织内容以避免加载不相关的上下文。当用户询问销售指标时，Claude 只需要读取与销售相关的 schema，而不是财务或营销数据。这样可以保持 token 使用量低且上下文聚焦。

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

````markdown SKILL.md theme={null}
# BigQuery Data Analysis

## 可用数据集

**Finance**：收入、ARR、计费 → 请参阅 [reference/finance.md](reference/finance.md)
**Sales**：机会、管道、账户 → 请参阅 [reference/sales.md](reference/sales.md)
**Product**：API 使用、功能、采用 → 请参阅 [reference/product.md](reference/product.md)
**Marketing**：活动、归因、邮件 → 请参阅 [reference/marketing.md](reference/marketing.md)

## 快速搜索

使用 grep 查找特定指标：

```bash
grep -i "revenue" reference/finance.md
grep -i "pipeline" reference/sales.md
grep -i "api usage" reference/product.md
```
````

#### 模式 3：条件详情

显示基本内容，链接到高级内容：

```markdown  theme={null}
# DOCX Processing

## 创建文档

使用 docx-js 创建新文档。请参阅 [DOCX-JS.md](DOCX-JS.md)。

## 编辑文档

对于简单编辑，直接修改 XML。

**对于修订跟踪**：请参阅 [REDLINING.md](REDLINING.md)
**对于 OOXML 详情**：请参阅 [OOXML.md](OOXML.md)
```

Claude 仅在用户需要这些功能时才读取 REDLINING.md 或 OOXML.md。

### 避免深度嵌套引用

Claude 可能会在被其他引用文件引用的文件中部分读取内容。当遇到嵌套引用时，Claude 可能会使用 `head -100` 等命令预览内容，而不是读取整个文件，导致信息不完整。

**保持引用从 SKILL.md 出发只有一级深度**。所有引用文件应直接从 SKILL.md 链接，以确保 Claude 在需要时读取完整文件。

**坏例子：太深**：

```markdown  theme={null}
# SKILL.md
请参阅 [advanced.md](advanced.md)...

# advanced.md
请参阅 [details.md](details.md)...

# details.md
这是实际的信息...
```

**好例子：一级深度**：

```markdown  theme={null}
# SKILL.md

**基本用法**：[SKILL.md 中的说明]
**高级功能**：请参阅 [advanced.md](advanced.md)
**API 参考**：请参阅 [reference.md](reference.md)
**示例**：请参阅 [examples.md](examples.md)
```

### 为较长的引用文件添加目录

对于超过 100 行的引用文件，在顶部包含目录。这确保 Claude 即使在使用部分读取进行预览时，也能看到可用信息的完整范围。

**示例**：

```markdown  theme={null}
# API 参考

## 目录
- 认证和设置
- 核心方法（创建、读取、更新、删除）
- 高级功能（批量操作、webhooks）
- 错误处理模式
- 代码示例

## 认证和设置
...

## 核心方法
...
```

Claude 然后可以根据需要读取完整文件或跳转到特定部分。

关于这种基于文件系统的架构如何实现渐进式披露的详细信息，请参阅下方高级部分中的 [运行时环境](#runtime-environment) 章节。

## 工作流和反馈循环

### 对复杂任务使用工作流

将复杂操作分解为清晰的顺序步骤。对于特别复杂的工作流，提供一个清单，Claude 可以将其复制到响应中并在进展过程中逐项勾选。

**示例 1：研究综合工作流**（针对无代码的 Skill）：

````markdown  theme={null}
## 研究综合工作流

复制此清单并跟踪你的进度：

```
研究进度：
- [ ] 步骤 1：阅读所有源文档
- [ ] 步骤 2：识别关键主题
- [ ] 步骤 3：交叉引用声明
- [ ] 步骤 4：创建结构化摘要
- [ ] 步骤 5：验证引用
```

**步骤 1：阅读所有源文档**

审阅 `sources/` 目录中的每个文档。记录主要论点和支持证据。

**步骤 2：识别关键主题**

寻找跨来源的模式。哪些主题反复出现？来源在哪些方面达成一致或存在分歧？

**步骤 3：交叉引用声明**

对于每个主要声明，验证它是否出现在源材料中。记录哪个来源支持每个观点。

**步骤 4：创建结构化摘要**

按主题组织发现。包括：
- 主要声明
- 来自来源的支持证据
- 冲突的观点（如果有）

**步骤 5：验证引用**

检查每个声明是否引用了正确的源文档。如果引用不完整，返回步骤 3。
````

此示例展示了工作流如何应用于不需要代码的分析任务。清单模式适用于任何复杂的多步骤过程。

**示例 2：PDF 表单填写工作流**（针对包含代码的 Skill）：

````markdown  theme={null}
## PDF 表单填写工作流

复制此清单并在完成时勾选项目：

```
任务进度：
- [ ] 步骤 1：分析表单（运行 analyze_form.py）
- [ ] 步骤 2：创建字段映射（编辑 fields.json）
- [ ] 步骤 3：验证映射（运行 validate_fields.py）
- [ ] 步骤 4：填写表单（运行 fill_form.py）
- [ ] 步骤 5：验证输出（运行 verify_output.py）
```

**步骤 1：分析表单**

运行：`python scripts/analyze_form.py input.pdf`

这会提取表单字段及其位置，保存到 `fields.json`。

**步骤 2：创建字段映射**

编辑 `fields.json` 为每个字段添加值。

**步骤 3：验证映射**

运行：`python scripts/validate_fields.py fields.json`

在继续之前修复任何验证错误。

**步骤 4：填写表单**

运行：`python scripts/fill_form.py input.pdf fields.json output.pdf`

**步骤 5：验证输出**

运行：`python scripts/verify_output.py output.pdf`

如果验证失败，返回步骤 2。
````

清晰的步骤防止 Claude 跳过关键验证。清单有助于 Claude 和你跟踪多步骤工作流的进度。

### 实现反馈循环

**常见模式**：运行验证器 → 修复错误 → 重复

这种模式极大地提高了输出质量。

**示例 1：风格指南合规性**（针对无代码的 Skill）：

```markdown  theme={null}
## 内容审查流程

1. 按照 STYLE_GUIDE.md 中的指南起草内容
2. 对照清单审查：
   - 检查术语一致性
   - 验证示例是否符合标准格式
   - 确认所有必需的部分都存在
3. 如果发现问题：
   - 记录每个问题及具体的章节引用
   - 修订内容
   - 再次审查清单
4. 仅在满足所有要求时才继续
5. 定稿并保存文档
```

这展示了使用参考文档而非脚本的验证循环模式。"验证器"是 STYLE_GUIDE.md，Claude 通过阅读和比较来执行检查。

**示例 2：文档编辑流程**（针对包含代码的 Skill）：

```markdown  theme={null}
## 文档编辑流程

1. 对 `word/document.xml` 进行编辑
2. **立即验证**：`python ooxml/scripts/validate.py unpacked_dir/`
3. 如果验证失败：
   - 仔细阅读错误信息
   - 修复 XML 中的问题
   - 再次运行验证
4. **仅在验证通过时才继续**
5. 重建：`python ooxml/scripts/pack.py unpacked_dir/ output.docx`
6. 测试输出文档
```

验证循环可以及早发现错误。

## 内容指南

### 避免时效性信息

不要包含会过时的信息：

**坏例子：时效性强**（将来会出错）：

```markdown  theme={null}
如果你在 2025 年 8 月之前执行此操作，请使用旧 API。
2025 年 8 月之后，请使用新 API。
```

**好例子**（使用"旧模式"章节）：

```markdown  theme={null}
## 当前方法

使用 v2 API 端点：`api.example.com/v2/messages`

## 旧模式

<details>
<summary>旧版 v1 API（已于 2025-08 弃用）</summary>

v1 API 使用：`api.example.com/v1/messages`

此端点已不再支持。
</details>
```

旧模式章节提供历史背景，而不会使主要内容变得杂乱。

### 使用一致的术语

选择一个术语并在整个 Skill 中统一使用：

**好 - 一致**：

* 始终使用 "API endpoint"
* 始终使用 "field"
* 始终使用 "extract"

**坏 - 不一致**：

* 混用 "API endpoint"、"URL"、"API route"、"path"
* 混用 "field"、"box"、"element"、"control"
* 混用 "extract"、"pull"、"get"、"retrieve"

一致性帮助 Claude 理解和遵循指令。

## 常见模式

### 模板模式

为输出格式提供模板。将严格程度与你的需求相匹配。

**对于严格要求**（如 API 响应或数据格式）：

````markdown  theme={null}
## 报告结构

始终使用此精确的模板结构：

```markdown
# [分析标题]

## 执行摘要
[关键发现的一段概述]

## 关键发现
- 发现 1 及支持数据
- 发现 2 及支持数据
- 发现 3 及支持数据

## 建议
1. 具体可执行的建议
2. 具体可执行的建议
```
````

**对于灵活指导**（当适应性有用时）：

````markdown  theme={null}
## 报告结构

以下是一个合理的默认格式，但请根据分析情况自行判断：

```markdown
# [分析标题]

## 执行摘要
[概述]

## 关键发现
[根据你的发现调整章节]

## 建议
[针对特定情境定制]
```

根据具体分析类型调整章节。
````

### 示例模式

对于输出质量取决于看到示例的 Skill，提供输入/输出对，就像常规提示一样：

````markdown  theme={null}
## 提交信息格式

按照以下示例生成提交信息：

**示例 1：**
输入：添加了使用 JWT 令牌的用户认证
输出：
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**示例 2：**
输入：修复了报告中日期显示不正确的问题
输出：
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

**示例 3：**
输入：更新了依赖项并重构了错误处理
输出：
```
chore: update dependencies and refactor error handling

- Upgrade lodash to 4.17.21
- Standardize error response format across endpoints
```

遵循此风格：type(scope): brief description，然后是详细解释。
````

示例帮助 Claude 比单独描述更清楚地理解所需的风格和详细程度。

### 条件工作流模式

引导 Claude 通过决策点：

```markdown  theme={null}
## 文档修改工作流

1. 确定修改类型：

   **创建新内容？** → 遵循下面的"创建工作流"
   **编辑现有内容？** → 遵循下面的"编辑工作流"

2. 创建工作流：
   - 使用 docx-js 库
   - 从头构建文档
   - 导出为 .docx 格式

3. 编辑工作流：
   - 解包现有文档
   - 直接修改 XML
   - 每次更改后验证
   - 完成后重新打包
```

<Tip>
  如果工作流变得庞大或复杂，包含许多步骤，请考虑将它们推送到单独的文件中，并告诉 Claude 根据当前任务读取适当的文件。
</Tip>

## 评估和迭代

### 先构建评估

**在编写大量文档之前创建评估。** 这确保你的 Skill 解决实际问题，而不是记录想象的问题。

**评估驱动开发**：

1. **识别差距**：在没有 Skill 的情况下，让 Claude 执行代表性任务。记录具体的失败或缺失的上下文
2. **创建评估**：构建三个测试这些差距的场景
3. **建立基线**：测量 Claude 在没有 Skill 时的表现
4. **编写最小指令**：创建刚好足够的内容来解决差距并通过评估
5. **迭代**：执行评估，与基线比较，并优化

这种方法确保你解决的是实际问题，而不是预测可能永远不会出现的需求。

**评估结构**：

```json  theme={null}
{
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF file and save it to output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Successfully reads the PDF file using an appropriate PDF processing library or command-line tool",
    "Extracts text content from all pages in the document without missing any pages",
    "Saves the extracted text to a file named output.txt in a clear, readable format"
  ]
}
```

<Note>
  此示例演示了带有简单测试评分标准的数据驱动评估。我们目前不提供内置的评估运行方式。用户可以创建自己的评估系统。评估是衡量 Skill 效果的事实来源。
</Note>

### 与 Claude 迭代开发 Skill

最有效的 Skill 开发过程涉及 Claude 本身。与一个 Claude 实例（"Claude A"）合作创建将被其他实例（"Claude B"）使用的 Skill。Claude A 帮助你设计和优化指令，而 Claude B 在真实任务中测试它们。这种方法之所以有效，是因为 Claude 模型既理解如何编写有效的 agent 指令，也理解 agents 需要什么信息。

**创建新 Skill**：

1. **在没有 Skill 的情况下完成任务**：使用正常提示与 Claude A 一起解决问题。在合作过程中，你会自然地提供上下文、解释偏好并分享程序性知识。注意你反复提供的信息。

2. **识别可重用的模式**：完成任务后，确定你提供的哪些上下文对类似的未来任务有用。

   **示例**：如果你完成了 BigQuery 分析，你可能提供了表名、字段定义、过滤规则（如"始终排除测试账户"）和常见查询模式。

3. **让 Claude A 创建 Skill**："创建一个 Skill，捕获我们刚才使用的 BigQuery 分析模式。包括表 schema、命名约定以及关于过滤测试账户的规则。"

   <Tip>
     Claude 模型原生理解 Skill 格式和结构。你不需要特殊的系统提示词或"编写 skill"的 skill 来让 Claude 帮助创建 Skills。只需让 Claude 创建一个 Skill，它就会生成具有适当 frontmatter 和正文内容的、结构正确的 SKILL.md 内容。
   </Tip>

4. **审查简洁性**：检查 Claude A 是否添加了不必要的解释。询问："删除关于胜率含义的解释——Claude 已经知道那是什么。"

5. **改进信息架构**：让 Claude A 更有效地组织内容。例如："将此组织为表 schema 放在单独的引用文件中。我们以后可能会添加更多表。"

6. **在类似任务上测试**：使用 Claude B（加载了 Skill 的新实例）在相关用例上测试 Skill。观察 Claude B 是否能找到正确的信息、正确应用规则并成功处理任务。

7. **基于观察进行迭代**：如果 Claude B 遇到困难或遗漏了什么，带着具体细节返回 Claude A："当 Claude 使用此 Skill 时，它忘记按 Q4 日期过滤。我们应该添加一个关于日期过滤模式的章节吗？"

**迭代现有 Skill**：

改进 Skill 时，相同的分层模式会继续。你在以下之间交替：

* **与 Claude A 合作**（帮助你优化 Skill 的专家）
* **与 Claude B 测试**（使用 Skill 执行实际工作的 agent）
* **观察 Claude B 的行为**并将洞察带回 Claude A

1. **在实际工作流中使用 Skill**：给 Claude B（加载了 Skill）实际任务，而不是测试场景

2. **观察 Claude B 的行为**：注意它在哪些地方遇到困难、成功或做出意外的选择

   **观察示例**："当我让 Claude B 生成区域销售报告时，它编写了查询但忘记了过滤测试账户，即使 Skill 提到了这条规则。"

3. **返回 Claude A 进行改进**：分享当前的 SKILL.md 并描述你观察到的内容。询问："我注意到 Claude B 在要求区域报告时忘记了过滤测试账户。Skill 提到了过滤，但可能不够突出？"

4. **审查 Claude A 的建议**：Claude A 可能会建议重新组织以使规则更突出，使用更强的语言如"必须过滤"而不是"始终过滤"，或重构工作流章节。

5. **应用和测试更改**：用 Claude A 的优化更新 Skill，然后在类似的请求上再次与 Claude B 测试

6. **基于使用重复**：随着你遇到新场景，继续这种观察-优化-测试循环。每次迭代都基于真实的 agent 行为而非假设来改进 Skill。

**收集团队反馈**：

1. 与团队成员分享 Skill 并观察他们的使用
2. 询问：Skill 是否在预期时激活？指令是否清晰？缺少什么？
3. 整合反馈以解决你自己使用模式中的盲点

**为什么这种方法有效**：Claude A 理解 agent 的需求，你提供领域专业知识，Claude B 通过实际使用揭示差距，迭代优化基于观察到的行为而非假设来改进 Skill。

### 观察 Claude 如何导航 Skill

在迭代 Skill 时，注意 Claude 在实践中实际如何使用它们。观察：

* **意外的探索路径**：Claude 是否以你未预料的顺序读取文件？这可能表明你的结构不如你想象的那么直观
* **遗漏的连接**：Claude 是否未能遵循对重要文件的引用？你的链接可能需要更明确或更突出
* **过度依赖某些章节**：如果 Claude 反复读取同一个文件，考虑该内容是否应放在主 SKILL.md 中
* **被忽略的内容**：如果 Claude 从不访问打包的文件，它可能是不必要的或在主指令中信号不足

基于这些观察而非假设进行迭代。Skill 元数据中的 "name" 和 "description" 尤其关键。Claude 在决定是否响应当前任务触发 Skill 时会使用这些。确保它们清楚地描述 Skill 的功能以及何时应该使用它。

## 应避免的反模式

### 避免 Windows 风格路径

始终在文件路径中使用正斜杠，即使在 Windows 上：

* ✓ **好**：`scripts/helper.py`、`reference/guide.md`
* ✗ **避免**：`scripts\helper.py`、`reference\guide.md`

Unix 风格路径在所有平台上都有效，而 Windows 风格路径在 Unix 系统上会导致错误。

### 避免提供过多选项

除非必要，不要呈现多种方法：

````markdown  theme={null}
**坏例子：选择太多**（令人困惑）：
"你可以使用 pypdf，或 pdfplumber，或 PyMuPDF，或 pdf2image，或..."

**好例子：提供默认值**（带有逃生通道）：
"使用 pdfplumber 提取文本：
```python
import pdfplumber
```

对于需要 OCR 的扫描 PDF，请改用 pdf2image 和 pytesseract。"
````

## 高级：包含可执行代码的 Skill

以下章节专注于包含可执行脚本的 Skill。如果你的 Skill 仅使用 markdown 指令，请跳至 [有效 Skill 的检查清单](#checklist-for-effective-skills)。

### 解决问题，不要推卸

为 Skill 编写脚本时，处理错误条件而不是推卸给 Claude。

**好例子：显式处理错误**：

```python  theme={null}
def process_file(path):
    """处理文件，如果不存在则创建它。""""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        # 创建带有默认内容的文件而不是失败
        print(f"File {path} not found, creating default")
        with open(path, 'w') as f:
            f.write('')
        return ''
    except PermissionError:
        # 提供替代方案而不是失败
        print(f"Cannot access {path}, using default")
        return ''
```

**坏例子：推卸给 Claude**：

```python  theme={null}
def process_file(path):
    # 直接失败，让 Claude 想办法
    return open(path).read()
```

配置参数也应该有正当理由并记录在案，以避免"巫毒常量"（Ousterhout 定律）。如果你不知道正确的值，Claude 如何确定它？

**好例子：自文档化**：

```python  theme={null}
# HTTP 请求通常在 30 秒内完成
# 更长的超时时间考虑了慢速连接
REQUEST_TIMEOUT = 30

# 三次重试平衡了可靠性与速度
# 大多数间歇性故障在第二次重试时解决
MAX_RETRIES = 3
```

**坏例子：魔术数字**：

```python  theme={null}
TIMEOUT = 47  # 为什么是 47？
RETRIES = 5   # 为什么是 5？
```

### 提供实用脚本

即使 Claude 可以编写脚本，预制的脚本也有优势：

**实用脚本的好处**：

* 比生成的代码更可靠
* 节省 token（无需在上下文中包含代码）
* 节省时间（无需代码生成）
* 确保跨使用的一致性

<img src="https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=4bbc45f2c2e0bee9f2f0d5da669bad00" alt="Bundling executable scripts alongside instruction files" data-og-width="2048" width="2048" data-og-height="1154" height="1154" data-path="images/agent-skills-executable-scripts.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?w=280&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=9a04e6535a8467bfeea492e517de389f 280w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?w=560&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=e49333ad90141af17c0d7651cca7216b 560w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?w=840&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=954265a5df52223d6572b6214168c428 840w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?w=1100&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=2ff7a2d8f2a83ee8af132b29f10150fd 1100w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?w=1650&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=48ab96245e04077f4d15e9170e081cfb 1650w, https://mintcdn.com/anthropic-claude-docs/4Bny2bjzuGBK7o00/images/agent-skills-executable-scripts.png?w=2500&fit=max&auto=format&n=4Bny2bjzuGBK7o00&q=85&s=0301a6c8b3ee879497cc5b5483177c90 2500w" />

上图展示了可执行脚本如何与指令文件协同工作。指令文件（forms.md）引用脚本，Claude 可以在不将其内容加载到上下文中的情况下执行它。

**重要区别**：在你的指令中明确 Claude 应该：

* **执行脚本**（最常见）："运行 `analyze_form.py` 提取字段"
* **将其作为参考阅读**（针对复杂逻辑）："查看 `analyze_form.py` 了解字段提取算法"

对于大多数实用脚本，执行是首选，因为它更可靠且高效。有关脚本执行工作原理的详细信息，请参阅下面的 [运行时环境](#runtime-environment) 章节。

**示例**：

````markdown  theme={null}
## 实用脚本

**analyze_form.py**：从 PDF 提取所有表单字段

```bash
python scripts/analyze_form.py input.pdf > fields.json
```

输出格式：
```json
{
  "field_name": {"type": "text", "x": 100, "y": 200},
  "signature": {"type": "sig", "x": 150, "y": 500}
}
```

**validate_boxes.py**：检查重叠的边界框

```bash
python scripts/validate_boxes.py fields.json
# 返回："OK" 或列出冲突
```

**fill_form.py**：将字段值应用到 PDF

```bash
python scripts/fill_form.py input.pdf fields.json output.pdf
```
````

### 使用视觉分析

当输入可以渲染为图像时，让 Claude 分析它们：

````markdown  theme={null}
## 表单布局分析

1. 将 PDF 转换为图像：
   ```bash
   python scripts/pdf_to_images.py form.pdf
   ```

2. 分析每页图像以识别表单字段
3. Claude 可以直观地看到字段位置和类型
````

<Note>
  在此示例中，你需要编写 `pdf_to_images.py` 脚本。
</Note>

Claude 的视觉能力有助于理解布局和结构。

### 创建可验证的中间输出

当 Claude 执行复杂的开放式任务时，它可能会犯错。"计划-验证-执行"模式通过让 Claude 首先以结构化格式创建计划，然后用脚本验证该计划再执行，从而及早发现错误。

**示例**：想象让 Claude 根据电子表格更新 PDF 中的 50 个表单字段。如果没有验证，Claude 可能会引用不存在的字段、创建冲突的值、遗漏必填字段或错误地应用更新。

**解决方案**：使用上面显示的工作流模式（PDF 表单填写），但添加一个中间 `changes.json` 文件，在应用更改之前进行验证。工作流变为：分析 → **创建计划文件** → **验证计划** → 执行 → 验证。

**为什么这个模式有效：**

* **及早发现错误**：验证在应用更改之前发现问题
* **机器可验证**：脚本提供客观的验证
* **可逆的计划**：Claude 可以在不触碰原始文件的情况下迭代计划
* **清晰的调试**：错误信息指向具体问题

**何时使用**：批量操作、破坏性更改、复杂验证规则、高风险操作。

**实现提示**：使验证脚本具有详细的特定错误信息，如"未找到字段 'signature_date'。可用字段：customer_name, order_total, signature_date_signed"，以帮助 Claude 修复问题。

### 包依赖

Skill 在具有平台特定限制的代码执行环境中运行：

* **claude.ai**：可以从 npm 和 PyPI 安装包并从 GitHub 仓库拉取
* **Anthropic API**：没有网络访问权限且没有运行时包安装

在 SKILL.md 中列出所需的包，并在 [代码执行工具文档](/en/docs/agents-and-tools/tool-use/code-execution-tool) 中验证它们是否可用。

### 运行时环境

Skill 在具有文件系统访问权限、bash 命令和代码执行能力的代码执行环境中运行。关于此架构的概念性解释，请参阅概述中的 [Skill 架构](/en/docs/agents-and-tools/agent-skills/overview#the-skills-architecture)。

**这如何影响你的编写：**

**Claude 如何访问 Skill：**

1. **元数据预加载**：启动时，所有 Skill 的 YAML frontmatter 中的名称和描述都会加载到系统提示词中
2. **按需读取文件**：Claude 使用 bash Read 工具在需要时从文件系统访问 SKILL.md 和其他文件
3. **高效执行脚本**：实用脚本可以通过 bash 执行，而无需将其完整内容加载到上下文中。只有脚本的输出消耗 token
4. **大文件无上下文惩罚**：引用文件、数据或文档在实际读取之前不会消耗上下文 token

* **文件路径很重要**：Claude 像文件系统一样导航你的 skill 目录。使用正斜杠（`reference/guide.md`），而不是反斜杠
* **文件名应具有描述性**：使用能表明内容的名称：`form_validation_rules.md`，而不是 `doc2.md`
* **为发现而组织**：按领域或功能组织目录
  * 好：`reference/finance.md`、`reference/sales.md`
  * 坏：`docs/file1.md`、`docs/file2.md`
* **打包综合资源**：包含完整的 API 文档、广泛的示例、大型数据集；在访问之前没有上下文惩罚
* **对于确定性操作优先使用脚本**：编写 `validate_form.py` 而不是让 Claude 生成验证代码
* **明确执行意图**：
  * "运行 `analyze_form.py` 提取字段"（执行）
  * "查看 `analyze_form.py` 了解提取算法"（作为参考阅读）
* **测试文件访问模式**：通过使用真实请求进行测试，验证 Claude 能否导航你的目录结构

**示例：**

```
bigquery-skill/
├── SKILL.md (overview, points to reference files)
└── reference/
    ├── finance.md (revenue metrics)
    ├── sales.md (pipeline data)
    └── product.md (usage analytics)
```

当用户询问收入时，Claude 读取 SKILL.md，看到对 `reference/finance.md` 的引用，并调用 bash 只读取该文件。sales.md 和 product.md 文件保留在文件系统上，在需要之前消耗零上下文 token。这种基于文件系统的模型正是实现渐进式披露的原因。Claude 可以导航并有选择地加载每个任务所需的确切内容。

关于技术架构的完整详细信息，请参阅 Skills 概述中的 [Skill 工作原理](/en/docs/agents-and-tools/agent-skills/overview#how-skills-work)。

### MCP 工具引用

如果你的 Skill 使用 MCP（Model Context Protocol）工具，请始终使用完全限定工具名称以避免"找不到工具"错误。

**格式**：`ServerName:tool_name`

**示例**：

```markdown  theme={null}
使用 BigQuery:bigquery_schema 工具检索表 schema。
使用 GitHub:create_issue 工具创建 issue。
```

其中：

* `BigQuery` 和 `GitHub` 是 MCP 服务器名称
* `bigquery_schema` 和 `create_issue` 是这些服务器中的工具名称

如果没有服务器前缀，Claude 可能无法定位工具，尤其是在有多个 MCP 服务器可用时。

### 不要假设工具已安装

不要假设包可用：

````markdown  theme={null}
**坏例子：假设已安装**：
"使用 pdf 库处理文件。"

**好例子：明确依赖关系**：
"安装所需包：`pip install pypdf`

然后使用它：
```python
from pypdf import PdfReader
reader = PdfReader("file.pdf")
```"
````

## 技术说明

### YAML frontmatter 要求

SKILL.md frontmatter 需要 `name`（最多 64 个字符）和 `description`（最多 1024 个字符）字段。关于完整的结构详情，请参阅 [Skills 概述](/en/docs/agents-and-tools/agent-skills/overview#skill-structure)。

### Token 预算

为获得最佳性能，保持 SKILL.md 正文在 500 行以内。如果你的内容超过此限制，请使用前面描述的渐进式披露模式将其拆分为单独的文件。关于架构详情，请参阅 [Skills 概述](/en/docs/agents-and-tools/agent-skills/overview#how-skills-work)。

## 有效 Skill 的检查清单

在分享 Skill 之前，请验证：

### 核心质量

* [ ] 描述具体并包含关键术语
* [ ] 描述包含 Skill 的功能以及何时使用它
* [ ] SKILL.md 正文在 500 行以内
* [ ] 额外的详情在单独的文件中（如果需要）
* [ ] 没有时效性信息（或在"旧模式"章节中）
* [ ] 整个 Skill 使用一致的术语
* [ ] 示例具体而非抽象
* [ ] 文件引用只有一级深度
* [ ] 适当使用渐进式披露
* [ ] 工作流有清晰的步骤

### 代码和脚本

* [ ] 脚本解决问题而不是推卸给 Claude
* [ ] 错误处理显式且有帮助
* [ ] 没有"巫毒常量"（所有值都有正当理由）
* [ ] 所需包在指令中列出并验证为可用
* [ ] 脚本有清晰的文档
* [ ] 没有 Windows 风格路径（全部使用正斜杠）
* [ ] 关键操作有验证/验证步骤
* [ ] 质量关键任务包含反馈循环

### 测试

* [ ] 至少创建了三个评估
* [ ] 已在 Haiku、Sonnet 和 Opus 上测试
* [ ] 已在真实使用场景中测试
* [ ] 整合了团队反馈（如适用）

## 下一步

<CardGroup cols={2}>
  <Card title="Get started with Agent Skills" icon="rocket" href="/en/docs/agents-and-tools/agent-skills/quickstart">
    Create your first Skill
  </Card>

  <Card title="Use Skills in Claude Code" icon="terminal" href="/en/docs/claude-code/skills">
    Create and manage Skills in Claude Code
  </Card>

  <Card title="Use Skills with the API" icon="code" href="/en/api/skills-guide">
    Upload and use Skills programmatically
  </Card>
</CardGroup>
