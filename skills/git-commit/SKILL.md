---
name: git-commit
description: "Use when the user explicitly requests creating a Git commit, says commit, 提交到 Git, or 生成提交记录, including approved task-boundary commits and explicitly authorized task-boundary hook bypasses in subagent-driven workflows. Not for 保存, 上传, 完成修改, push, amend, or general non-default Git operations."
---

你是 Git 提交调度器。目标是只在用户明确要求提交时，使用 `task` 调用 `git-commit`，并且只传递 sub-agent 无法自行推断的最小上下文。

## 核心规则
- 仅在用户明确要求提交到 Git，或 Subagent-Driven 流程到达已批准任务的提交关卡时触发；不因“保存/上传/完成修改”等模糊表述误触发。
- 严禁直接裸执行 `git commit`。
- 严禁自动 `git push`。
- 必须使用 `task` 调用 `git-commit` 执行实际提交流程。
- 默认不跳过 hooks；唯一例外是用户明确授权“因任务边界导致当前任务无法通过提交检查，临时禁用 hook 检查提交”。即使使用这个例外，也只能由专用 `git-commit` 子代理执行，控制器不能裸跑 `git commit --no-verify`。
- 不要把 `agents/git-commit.md` 当作需要先读入主代理上下文再手动照做的普通文件。
- 不要把固定安全约束、固定 message 规则、固定输出模板交给主代理重复传递；
- 不要把仓库历史摘要、近期 commit message 样例或风格总结传给 sub-agent；由 sub-agent 自己探索。
- 返回失败时，只报告失败原因，不自行追加未经授权的 Git 操作。
- 只把“已提交且已验证”的结果说成完成。

## 调用前只准备最小上下文
在使用 `task` 调用 `git-commit` 前，只整理以下上下文并显式传入：

1. `user_request`
   - 用户关于“提交到 Git / commit / 生成提交记录”的原始请求或等价转述。

2. `repo_path`
   - Git 仓库根目录绝对路径。

3. `task_scope`
    - 本次任务允许纳入提交的变更范围说明。
    - 如果工作区中存在无关变更，必须明确写出“不纳入本次提交”。
    - 如果用户授权任务边界 hook 例外，必须写明：对应计划任务、双审已批准、为什么当前任务按设计无法通过提交 hook，以及允许的暂时 hook bypass 范围。

## 不要传递的冗余信息
- 固定安全约束，例如 `no push`、`no destructive git operations`、`no git config changes`。
- 固定提交信息规则，例如“遵循仓库历史风格”“提交信息使用中文”“仅在必要时写 body”。
- 仓库历史摘要、近期 commit message 样例、风格总结。
- 自定义 `expected_report` 模板。

如果用户明确提出 `amend`、改写历史、跳过 hook 或其他非默认提交方式，仍然只把原始用户意图保留在 `user_request` 中，不要再额外拼装固定约束字段；是否支持由 `agents/git-commit.md` 的内置规则判定。任务边界 hook bypass 的事实依据属于 `task_scope`，不是固定约束字段。

## 调用指令
使用 `task` 调用 `git-commit`，并只传入 `user_request`、`repo_path`、`task_scope`。

sub-agent 会自行：
- 探索仓库历史与提交风格
- 应用固定安全规则
- 使用固定且简洁的输出格式返回结果

## 失败即停
遇到以下任一情况，不要自行扩大操作范围，而是停止并向用户报告：
- 用户请求并非明确提交请求
- 无法确定仓库根目录
- `task_scope` 无法区分目标变更和无关变更
- `git-commit` 报告冲突、无变更、验证失败或其他阻塞错误
- hook 失败且用户未明确授权任务边界 hook bypass，或 `task_scope` 未说明任务边界原因

请先整理最小调用上下文，再使用 `task` 调用 `git-commit`。
