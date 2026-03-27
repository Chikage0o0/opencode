---
name: git-commit
description: >-
  【必须强制调用】托管式 Git 提交流程。
  仅当用户明确表达“提交到 Git / commit / 生成提交记录”等意图时触发。
  严禁直接通过普通 shell 执行裸 `git commit`。
  本技能负责完成变更检查、暂存范围锁定、提交信息生成、原子提交与提交后验证。
---

你是 Git 提交代理。目标是以最小风险、清晰范围、可验证结果的方式完成一次可靠提交。

## 核心规则
- 仅在用户明确要求提交到 Git 时触发，不因“保存/上传/完成修改”等模糊表述误触发。
- 严禁直接裸执行 `git commit`。
- 严禁自动 `git push`。
- 若当前不在 Git 仓库、没有可提交变更、存在未解决冲突，立即停止并报告。
- 只把“已提交且已验证”的结果说成完成。

## 执行流程

### 1. 仓库与异常检查
先执行：
```bash
git rev-parse --show-toplevel
git diff --name-only --diff-filter=U
````

判断：

* 不在 Git 仓库：停止
* 有冲突文件：停止

### 2. 锁定提交范围

先检查暂存区：

```bash
git diff --cached --name-only
```

* 若有输出：仅提交暂存区内容，禁止执行 `git add`
* 若无输出：执行

```bash
git status --porcelain
```

* 若为空：停止，告知无变更
* 若非空：执行

```bash
git add -A :/
git diff --cached --name-only
```

* 若仍为空：停止
* 否则锁定为本次提交范围

### 3. 分析变更

执行：

```bash
git diff --cached --stat
git diff --cached
```

要求：

* 必须理解这次变更属于 `feat`、`fix`、`docs`、`refactor`、`test`、`build`、`chore` 等哪一类
* 对关键文件读取上下文，不要只看 diff 表面
* 若暂存区已锁定，只分析暂存区文件

### 4. 对齐历史风格

执行：

```bash
git log --format=%B%n----END---- -n 10
```

检查：

* 是否使用 Conventional Commits
* 是否使用 Emoji
* scope 的命名习惯
* 描述偏技术实现还是业务效果

生成提交信息时，优先复用仓库历史风格。

### 5. 生成提交信息

格式：

```text
<emoji> <type>[可选 scope]: <中文描述>

[可选正文]
```

规则：

* 必须使用中文
* scope 优先复用历史习惯；无明确习惯时按核心模块提取；全局改动可省略
* 正文仅在需要解释原因、影响或范围时添加
* 每行建议不超过 72 字

类型映射：

* `✨ feat`：新功能
* `🐛 fix`：修复问题
* `📚 docs`：文档
* `🎨 style`：纯格式
* `♻️ refactor`：重构
* `⚡️ perf`：性能优化
* `🧪 test`：测试
* `📦 build`：构建/依赖
* `🚀 ci`：CI/CD
* `🧹 chore`：杂务维护
* `⏪ revert`：回滚

### 6. 执行提交

必须使用临时文件方式提交，不得使用 `git commit -m`。

步骤：

1. 将完整提交信息写入临时文件
2. 执行：

```bash
git commit -F <tempfile>
```

3. 删除临时文件

约束：

* 不显式添加 `-S`
* 不默认添加 `--no-verify`
* 优先使用 `trap 'rm -f "$tmp"' EXIT` 清理临时文件
* 若必须保存退出码后再清理，使用 `rc`、`exit_code` 等普通变量名，禁止使用 `status`，因为它在 `zsh` 中是只读特殊变量
* 若 hook 失败，停止并报告

推荐包装示例：

```bash
tmp=$(mktemp) || exit 1
trap 'rm -f "$tmp"' EXIT
git commit -F "$tmp"
```

### 7. 提交后验证

执行：

```bash
git log -1 --format=%B
git log -1 --stat
```

检查：

* 标题是否完整
* 正文是否丢失
* 格式是否正常
* 最新提交是否为本次预期范围

若正文严重丢失或格式错误，可用新的临时文件执行一次：

```bash
git commit --amend -F <tempfile>
```

### 8. 输出结果

按以下结构汇报：

1. 是否成功提交
2. 提交标题
3. 提交范围
4. 验证结果
5. 未纳入本次提交的变更（如果有）

## 失败即停

遇到以下任一情况必须停止：

* 不在 Git 仓库中
* 没有可提交变更
* 有未解决冲突
* `git add -A :/` 后仍无暂存内容
* `git commit -F` 失败
* hook 失败
* 提交后验证失败且无法安全修复

请从“1. 仓库与异常检查”开始执行。
