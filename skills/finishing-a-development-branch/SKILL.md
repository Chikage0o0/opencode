---
name: finishing-a-development-branch
description: "开发工作完成后的收尾流程，提供合并/PR/丢弃三种上下文感知选项。触发：所有测试通过、需要决定如何集成工作成果。由 subagent-driven-development 或 executing-plans 在最后阶段自动调用。测试未通过时不得继续；分支名未知时暂停询问。"
---

# 开发分支收尾

## 概述

通过呈现清晰的选项并处理所选的工作流，指导完成开发工作。

**核心原则：** 验证测试 → 确定分支 → 提供上下文感知选项 → 执行选择。

**开始时声明：** "我正在使用 finishing-a-development-branch 技能来完成这项工作。"

## 流程

### 步骤 1：验证测试

**在提供选项之前，验证测试是否通过：**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**如果测试失败：**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

停止。不要继续到步骤 2。

**如果测试通过：** 继续到步骤 2。

### 步骤 2：确定当前分支和基础分支

```bash
current_branch=$(git branch --show-current)

if [ -z "$current_branch" ]; then
  # Detached HEAD or unknown current branch
  # Stop and ask the user which branch should be treated as current
fi

if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
  base_branch="$current_branch"
elif git show-ref --verify --quiet refs/heads/main; then
  base_branch="main"
elif git show-ref --verify --quiet refs/heads/master; then
  base_branch="master"
else
  # Neither main nor master exists
  # Stop and ask the user which branch should be treated as base
fi
```

规则：
- 如果分支名称为空，停止并询问用户后再继续。
- 如果 `current_branch` 是 `main` 或 `master`，设置 `base_branch="$current_branch"`。
- 否则，如果 `refs/heads/main` 存在，设置 `base_branch="main"`。
- 否则，如果 `refs/heads/master` 存在，设置 `base_branch="master"`。
- 如果都不存在，停止并询问用户后再继续。

### 步骤 3：提供选项

如果 `current_branch != base_branch`，提供：

```
Implementation complete. What would you like to do?

1. Merge back to $base_branch locally
2. Push current branch and create a Pull Request
3. Keep the current branch as-is
4. Discard this work

Which option?
```

如果 `current_branch == base_branch`，不提供合并选项。提供：

```
Implementation complete on the base branch. No merge is needed.

1. Keep the current branch as-is
2. Discard this work

Which option?
```

### 步骤 3.5：归档活跃规格和计划（选择合并或 PR 后）

仅在用户选择 `Merge back to $base_branch locally` 或 `Push current branch and create a Pull Request` 后运行此步骤。对于 `Keep the current branch as-is` 或 `Discard this work` 不要归档。

仅归档当前工作明确标识的文档：

- 永远不要批量移动任一 `active/` 目录中的所有文件
- 如果当前规格或计划路径在上下文中不明确，在移动任何内容之前停止并询问
- 如果需要，创建目标目录，将当前规格从 `docs/specs/active/` 移动到 `docs/specs/completed/`，将当前计划从 `docs/plans/active/` 移动到 `docs/plans/completed/`，然后暂存这些路径变更，并使用 `git-commit` 在当前分支上创建归档提交，再继续

```bash
# Example for explicitly identified files only
mkdir -p docs/specs/completed docs/plans/completed
mv "<current-spec-path>" "docs/specs/completed/<spec-filename>"
mv "<current-plan-path>" "docs/plans/completed/<plan-filename>"
git add "<current-spec-path>" "docs/specs/completed/<spec-filename>" "<current-plan-path>" "docs/plans/completed/<plan-filename>"
# Then create the archive commit with the git-commit skill before continuing
```

### 步骤 4：执行选择

#### 选项：在本地合并回 $base_branch

仅在 `current_branch != base_branch` 时可用。

在运行合并命令之前，按此顺序推导 `merge_message`：
1. 当前计划标题
2. 当前任务标题
3. 如果都不可用，停止并询问用户合并消息

在 `current_branch` 上完成步骤 3.5 后：

```bash
# Switch to base branch
git checkout "$base_branch"

# Pull latest
git pull

# Merge current branch with an explicit merge commit message
git merge --no-ff -m "$merge_message" "$current_branch"

# Verify tests on merged result
npm test / cargo test / pytest / go test ./...

# If tests pass
git branch -d "$current_branch"
```

如果合并后测试失败，停止并修复后再继续。

#### 选项：推送当前分支并创建 Pull Request

仅在 `current_branch != base_branch` 时可用。

在 `current_branch` 上完成步骤 3.5 后：

```bash
# Push branch
git push -u origin "$current_branch"

# Create PR
gh pr create --title "<title>" --base "$base_branch" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

#### 选项：保持当前分支不变

报告："保持分支 $current_branch 不变。"

#### 选项：丢弃此工作

**先确认：**

如果 `current_branch != base_branch`：

```
This will permanently delete:
- Branch $current_branch
- All commits: <commit-list>

Type 'discard' to confirm.
```

等待确切确认。

如果确认：

```bash
git checkout "$base_branch"
git branch -D "$current_branch"
```

如果 `current_branch == base_branch`，删除分支无效。在运行任何破坏性命令之前，停止并准确询问用户他们希望如何丢弃基础分支上的工作（例如，还原提交）。

## 快速参考

| 上下文 | 可用选项 |
|---------|-------------------|
| `current_branch != base_branch` | 在本地合并回 `$base_branch` / 推送当前分支并创建 Pull Request / 保持当前分支不变 / 丢弃此工作 |
| `current_branch == base_branch` | 保持当前分支不变 / 丢弃此工作 |

## 常见错误

**跳过测试验证**
- **问题：** 合并损坏的代码或创建失败的 PR
- **修复：** 在提供选项之前始终验证测试

**未先检测分支上下文**
- **问题：** 因为当前/基础分支未知而提供错误选项
- **修复：** 始终在步骤 3 之前计算 `current_branch` 和 `base_branch`

**使用未命名的合并提交**
- **问题：** 历史记录丢失意图和审查上下文
- **修复：** 要求从当前计划标题获取 `merge_message`，然后才是当前任务标题

**已在基础分支上时提供合并**
- **问题：** 无效的工作流和令人困惑的用户选择
- **修复：** 显示基础分支消息，且仅提供保持/丢弃选项

**丢弃时没有确认**
- **问题：** 意外删除工作
- **修复：** 要求输入 `discard` 确认

## 危险信号

**绝不：**
- 在测试失败时继续
- 当 `current_branch` 或 `base_branch` 未知时继续
- 当 `current_branch == base_branch` 时提供合并选项
- 在本地合并且没有明确的 `merge_message`
- 没有输入确认就删除工作

**始终：**
- 在步骤 2 之前以及本地合并后验证测试
- 使用 `git branch --show-current` 和 `git show-ref` 确定分支
- 根据当前分支是否等于基础分支来提供选项
- 在本地合并时使用带名称的合并提交

## 集成

**被以下技能调用：**
- **subagent-driven-development** - 所有任务完成后
- **executing-plans** - 所有批次完成后

**与以下技能配对：**
- **git-commit** - 用于步骤 3.5 中的归档提交
