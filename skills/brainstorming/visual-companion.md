# 视觉辅助指南

基于浏览器的可视化头脑风暴辅助工具，用于展示原型、图表和选项。

## 何时使用

按问题而非按会话决定。判断标准：**用户是通过看比通过读更容易理解这个内容吗？**

**在内容本身是可视化时使用浏览器：**

- **UI 原型** — 线框图、布局、导航结构、组件设计
- **架构图** — 系统组件、数据流、关系图
- **并排视觉对比** — 比较两种布局、两种配色方案、两个设计方向
- **设计精修** — 当问题涉及外观和感觉、间距、视觉层级时
- **空间关系** — 状态机、流程图、实体关系图

**在内容为文本或表格时使用终端：**

- **需求和范围问题** — "X 是什么意思？"、"哪些功能在范围内？"
- **概念性 A/B/C 选择** — 在文字描述的方案之间做选择
- **权衡列表** — 优缺点、对比表
- **技术决策** — API 设计、数据建模、架构方法选择
- **澄清问题** — 任何答案是文字而非视觉偏好的问题

关于 UI 主题的问题不一定就是视觉问题。"你想要什么样的向导？"是概念性的 — 使用终端。"这些向导布局中哪个感觉更对？"是视觉性的 — 使用浏览器。

## 工作原理

服务器监视一个目录中的 HTML 文件，并将最新的文件提供给浏览器。你将 HTML 内容写入 `screen_dir`，用户在浏览器中看到它并可以点击选择选项。选择结果会记录到 `state_dir/events` 中，你在下一轮读取。

**内容片段与完整文档：** 如果你的 HTML 文件以 `<!DOCTYPE` 或 `<html` 开头，服务器会原样提供（仅注入辅助脚本）。否则，服务器会自动将你的内容包装在框架模板中 — 添加页头、CSS 主题、选择指示器和所有交互基础设施。**默认写内容片段。** 只有在你需要完全控制页面时才写完整文档。

## 启动会话

```bash
# 使用持久化启动服务器（原型保存到项目中）
scripts/start-server.sh --project-dir /path/to/project

# 返回: {"type":"server-started","port":52341,"url":"http://localhost:52341",
#           "screen_dir":"/path/to/project/.superpowers/brainstorm/12345-1706000000/content",
#           "state_dir":"/path/to/project/.superpowers/brainstorm/12345-1706000000/state"}
```

保存响应中的 `screen_dir` 和 `state_dir`。告知用户打开 URL。

**查找连接信息：** 服务器将其启动 JSON 写入 `$STATE_DIR/server-info`。如果你在后台启动了服务器且没有捕获 stdout，读取该文件以获取 URL 和端口。使用 `--project-dir` 时，在 `<project>/.superpowers/brainstorm/` 中检查会话目录。

**注意：** 将项目根目录作为 `--project-dir` 传递，以便原型持久化保存在 `.superpowers/brainstorm/` 中，并在服务器重启后仍然保留。如果不这样做，文件会进入 `/tmp` 并被清理。提醒用户将 `.superpowers/` 添加到 `.gitignore` 中（如果还没有的话）。

**按平台启动服务器：**

**Claude Code (macOS / Linux):**
```bash
# 默认模式即可工作 — 脚本会自动将服务器置于后台
scripts/start-server.sh --project-dir /path/to/project
```

**Claude Code (Windows):**
```bash
# Windows 自动检测并使用前台模式，这会阻塞工具调用。
# 在 Bash 工具调用上使用 run_in_background: true，以便服务器在
# 跨会话轮次中保持运行。
scripts/start-server.sh --project-dir /path/to/project
```
通过 Bash 工具调用时，设置 `run_in_background: true`。然后在下一轮读取 `$STATE_DIR/server-info` 以获取 URL 和端口。

**Codex:**
```bash
# Codex 会回收后台进程。脚本自动检测 CODEX_CI 并
# 切换到前台模式。正常运行即可 — 无需额外标志。
scripts/start-server.sh --project-dir /path/to/project
```

**Gemini CLI:**
```bash
# 使用 --foreground 并在 shell 工具调用上设置 is_background: true
# 以便进程在跨轮次中保持运行
scripts/start-server.sh --project-dir /path/to/project --foreground
```

**其他环境：** 服务器必须在后台持续运行，跨会话轮次保持活动。如果你的环境会回收分离的进程，请使用 `--foreground` 并通过你平台的后台执行机制启动命令。

如果你的浏览器无法访问该 URL（在远程/容器化设置中很常见），请绑定非回环主机：

```bash
scripts/start-server.sh \
  --project-dir /path/to/project \
  --host 0.0.0.0 \
  --url-host localhost
```

使用 `--url-host` 控制返回的 URL JSON 中打印的主机名。

## 循环流程

1. **检查服务器是否存活**，然后**将 HTML 写入** `screen_dir` 中的新文件：
   - 每次写入前，检查 `$STATE_DIR/server-info` 是否存在。如果不存在（或 `$STATE_DIR/server-stopped` 存在），说明服务器已关闭 — 在继续之前用 `start-server.sh` 重新启动它。服务器在 30 分钟无活动后会自动退出。
   - 使用语义化文件名：`platform.html`、`visual-style.html`、`layout.html`
   - **永远不要重复使用文件名** — 每个屏幕都使用新文件
   - 使用 Write 工具 — **不要使用 cat/heredoc**（会将噪音转储到终端）
   - 服务器自动提供最新的文件

2. **告知用户预期内容并结束你的回合：**
   - 每一步都要提醒他们 URL（不仅仅是第一步）
   - 对屏幕上的内容给出简短的文本摘要（例如，"展示首页的 3 种布局选项"）
   - 请他们在终端中回复："看一下，然后告诉我你的想法。如果想选择某个选项，请点击。"

3. **在你的下一轮** — 用户在终端中回复之后：
   - 如果存在，读取 `$STATE_DIR/events` — 其中包含用户的浏览器交互（点击、选择）作为 JSON 行
   - 将其与用户的终端文本合并以获得完整画面
   - 终端消息是主要反馈；`state_dir/events` 提供结构化的交互数据

4. **迭代或推进** — 如果反馈改变了当前屏幕，请写一个新文件（例如 `layout-v2.html`）。只有在当前步骤得到验证后才进入下一个问题。

5. **返回终端时卸载** — 当下一步不需要浏览器时（例如，一个澄清问题、一个权衡讨论），推送一个等待屏幕以清除过时内容：

   ```html
   <!-- filename: waiting.html (or waiting-2.html, etc.) -->
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

   这可以防止用户在对话已经转移时还盯着一个已解决的选择。当下一个视觉问题出现时，像平常一样推送一个新的内容文件。

6. 重复直到完成。

## 编写内容片段

只写放入页面中的内容。服务器会自动将其包装在框架模板中（页头、主题 CSS、选择指示器和所有交互基础设施）。

**最小示例：**

```html
<h2>Which layout works better?</h2>
<p class="subtitle">Consider readability and visual hierarchy</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Single Column</h3>
      <p>Clean, focused reading experience</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>Two Column</h3>
      <p>Sidebar navigation with main content</p>
    </div>
  </div>
</div>
```

就是这样。不需要 `<html>`、CSS 或 `<script>` 标签。服务器提供所有这些。

## 可用的 CSS 类

框架模板为你的内容提供以下 CSS 类：

### 选项 (A/B/C 选择)

```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

**多选：** 在容器上添加 `data-multiselect` 以允许用户选择多个选项。每次点击切换项目。指示器栏显示计数。

```html
<div class="options" data-multiselect>
  <!-- same option markup — users can select/deselect multiple -->
</div>
```

### 卡片 (视觉设计)

```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup content --></div>
    <div class="card-body">
      <h3>Name</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

### 原型容器

```html
<div class="mockup">
  <div class="mockup-header">Preview: Dashboard Layout</div>
  <div class="mockup-body"><!-- your mockup HTML --></div>
</div>
```

### 分屏视图 (并排)

```html
<div class="split">
  <div class="mockup"><!-- left --></div>
  <div class="mockup"><!-- right --></div>
</div>
```

### 优缺点

```html
<div class="pros-cons">
  <div class="pros"><h4>Pros</h4><ul><li>Benefit</li></ul></div>
  <div class="cons"><h4>Cons</h4><ul><li>Drawback</li></ul></div>
</div>
```

### 模拟元素 (线框构建块)

```html
<div class="mock-nav">Logo | Home | About | Contact</div>
<div style="display: flex;">
  <div class="mock-sidebar">Navigation</div>
  <div class="mock-content">Main content area</div>
</div>
<button class="mock-button">Action Button</button>
<input class="mock-input" placeholder="Input field">
<div class="placeholder">Placeholder area</div>
```

### 排版和段落

- `h2` — 页面标题
- `h3` — 段落标题
- `.subtitle` — 标题下方的次要文本
- `.section` — 带有底部边距的内容块
- `.label` — 小型大写标签文本

## 浏览器事件格式

当用户在浏览器中点击选项时，他们的交互会记录到 `$STATE_DIR/events` 中（每行一个 JSON 对象）。当你推送新屏幕时，文件会自动清除。

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
{"type":"click","choice":"b","text":"Option B - Hybrid","timestamp":1706000115}
```

完整的事件流展示了用户的探索路径 — 他们可能在确定之前点击了多个选项。最后一个 `choice` 事件通常是最终选择，但点击模式可以揭示值得询问的犹豫或偏好。

如果 `$STATE_DIR/events` 不存在，说明用户没有与浏览器交互 — 仅使用他们的终端文本。

## 设计技巧

- **根据问题调整保真度** — 布局用线框图，精修问题用精修图
- **在每一页上解释问题** — "哪种布局感觉更专业？" 而不只是 "选一个"
- **在推进之前迭代** — 如果反馈改变了当前屏幕，请写一个新版本
- **每屏最多 2-4 个选项**
- **在重要时使用真实内容** — 对于摄影作品集，使用实际图片（Unsplash）。占位内容会掩盖设计问题。
- **保持原型简单** — 关注布局和结构，而不是像素级完美的设计

## 文件命名

- 使用语义化名称：`platform.html`、`visual-style.html`、`layout.html`
- 永远不要重复使用文件名 — 每个屏幕必须是新文件
- 迭代时：附加版本后缀，如 `layout-v2.html`、`layout-v3.html`
- 服务器按修改时间提供最新的文件

## 清理

```bash
scripts/stop-server.sh $SESSION_DIR
```

如果会话使用了 `--project-dir`，原型文件会持久化保存在 `.superpowers/brainstorm/` 中供以后参考。只有 `/tmp` 会话在停止时会被删除。

## 参考

- 框架模板 (CSS 参考): `scripts/frame-template.html`
- 辅助脚本 (客户端): `scripts/helper.js`
