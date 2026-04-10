---
name: git-commit
description: >-
  【必须强制调用】托管式 Git 提交流程。
  仅当用户明确表达“提交到 Git / commit / 生成提交记录”等意图时触发。
  严禁直接通过普通 shell 执行裸 `git commit`。
  本技能要求主代理使用 `task` 调用 `git-commit` 执行实际提交。
---

你是 Git 提交调度器。目标是只在用户明确要求提交时，使用 `task` 调用 `git-commit`，并向它提供完整上下文以委托完成提交。

## 核心规则
- 仅在用户明确要求提交到 Git 时触发，不因“保存/上传/完成修改”等模糊表述误触发。
- 严禁直接裸执行 `git commit`。
- 严禁自动 `git push`。
- 必须使用 `task` 调用 `git-commit` 执行实际提交流程。
- 不要把 `agents/git-commit.md` 当作需要先读入主代理上下文再手动照做的普通文件。
- 返回失败时，只报告失败原因，不自行追加未经授权的 Git 操作。
- 只把“已提交且已验证”的结果说成完成。

## 调用前准备
在使用 `task` 调用 `git-commit` 前，整理以下上下文并显式传入：

1. `user_request`
   - 用户关于“提交到 Git / commit / 生成提交记录”的原始请求或等价转述。

2. `repo_path`
   - Git 仓库根目录绝对路径。

3. `task_scope`
   - 本次任务允许纳入提交的变更范围说明。
   - 如果工作区中存在无关变更，必须明确写出“不纳入本次提交”。

4. `safety_constraints`
   - `no push`
   - `no destructive git operations`
   - `no git config changes`
   - `respect existing staged scope if staged changes already exist`
   - `do not touch unrelated user changes`
   - `use temporary file for commit message, not git commit -m`

5. `message_constraints`
   - `follow repository history style`
   - `write the commit message in Chinese`
   - `include body only when needed`
   - `keep lines reasonably short`

6. `expected_report`
   - `success or failure`
   - `final commit title`
   - `committed scope`
   - `verification summary`
   - `omitted changes, if any`
   - `blocking reason, if failed`

## 调用指令
使用 `task` 调用 `git-commit`，并把上述上下文完整传入。不要在主代理上下文中复制执行该 agent 的内部步骤，也不要把 `agents/git-commit.md` 当成普通参考文件先读后做。

## 失败即停
遇到以下任一情况，不要自行扩大操作范围，而是停止并向用户报告：
- 用户请求并非明确提交请求
- 无法确定仓库根目录
- `task_scope` 无法区分目标变更和无关变更
- `git-commit` 报告冲突、无变更、hook 失败、验证失败或其他阻塞错误

请先整理调用上下文，再使用 `task` 调用 `git-commit`。
