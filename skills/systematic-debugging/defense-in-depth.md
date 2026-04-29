# 纵深防御验证

## 概述

当你修复由无效数据引起的 bug 时，在单处添加验证似乎就足够了。但不同代码路径、重构或 mock 都可能绕过这个单一检查。

**核心原则：** 在数据经过的**每一层**都进行验证。让 bug 在结构上不可能发生。

## 为什么需要多层验证

单一验证：“我们修复了 bug”
多层验证：“我们让 bug 不可能发生”

不同层次捕获不同情况：
- 入口验证捕获大多数 bug
- 业务逻辑捕获边缘情况
- 环境防护防止特定上下文下的危险
- 调试日志在其他层次失效时提供帮助

## 四层防御

### 第一层：入口点验证
**目的：** 在 API 边界拒绝明显无效的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... proceed
}
```

### 第二层：业务逻辑验证
**目的：** 确保数据对该操作有意义

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### 第三层：环境防护
**目的：** 防止在特定上下文中执行危险操作

```typescript
async function gitInit(directory: string) {
  // In tests, refuse git init outside temp directories
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // ... proceed
}
```

### 第四层：调试插桩
**目的：** 为故障排查捕获上下文

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... proceed
}
```

## 应用该模式

当你发现 bug 时：

1. **追踪数据流** — 坏值从哪来？在哪使用？
2. **列出所有检查点** — 数据经过的每个点都列出来
3. **在每一层添加验证** — 入口、业务、环境、调试
4. **测试每一层** — 尝试绕过第一层，验证第二层是否能捕获

## 会话中的示例

Bug：空的 `projectDir` 导致在源代码目录执行 `git init`

**数据流：**
1. 测试设置 → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 中运行

**添加的四层防御：**
- 第一层：`Project.create()` 验证非空/存在/可写
- 第二层：`WorkspaceManager` 验证 projectDir 非空
- 第三层：`WorktreeManager` 在测试期间拒绝在 tmpdir 外执行 git init
- 第四层：在 git init 前记录堆栈跟踪日志

**结果：** 全部 1847 个测试通过，bug 不可复现

## 关键洞察

四层防御都是必需的。在测试过程中，每一层都捕获了其他层遗漏的 bug：
- 不同的代码路径绕过了入口验证
- Mock 绕过了业务逻辑检查
- 不同平台上的边缘情况需要环境防护
- 调试日志识别出结构性误用

**不要止步于单一验证点。** 在每一层都添加检查。