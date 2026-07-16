# DCP Git 源配置设计

> 状态：已于 2026-07-16 被 `opencode-acp@1.12.6` 取代。本文仅保留历史决策，不再描述当前运行配置。

## 目标

将 OpenCode 的 DCP 插件从本地 clonedeps 路径切换到用户 fork 的远程 Git 源，同时保证安装可复现、无需在安装阶段执行构建脚本。

## 方案

1. 在 `Chikage0o0/opencode-dynamic-context-pruning` fork 中生成并提交 `dist/` 构建产物。
2. 调整 fork 的 `.gitignore`，使 `dist/` 可被 Git 跟踪；不改动现有 `main` 与 `exports`。
3. 运行类型检查、测试、构建和 package 验证，确认源码与产物一致。
4. 提交并推送 fork，取得包含构建产物的新 commit SHA。
5. 将父仓库 `opencode.json` 中的本地插件路径替换为：

   ```text
   @tarquinen/opencode-dcp@git+https://github.com/Chikage0o0/opencode-dynamic-context-pruning.git
   ```

   实施时在该 URL 末尾追加 `#` 和步骤 4 产生的完整 commit SHA。

6. 校验 `opencode.json`，并实际验证 OpenCode/Bun 能从 Git commit 安装和解析插件入口。

## 边界与错误处理

- 固定 commit SHA，不跟随可变分支。
- 不使用 `prepare`；Bun 可能阻止非 npm 依赖的 lifecycle script。
- 不 force-push。若远端发生分叉，停止并检查历史。
- 构建或测试失败时，不提交产物、不修改父仓库插件源。
- 父仓库仅修改 DCP 插件条目，不改其他插件配置。

## 验收标准

- fork 的目标 commit 包含 `dist/index.js` 及相关声明文件。
- fork 工作区干净，远端 commit 与本地一致。
- `opencode.json` 使用 fork Git URL 和不可变 commit SHA。
- JSON 配置有效；远程依赖可安装；插件入口可解析。
- 重启 OpenCode 后不再依赖 `.slim/clonedeps/repos/` 中的本地 DCP 源码。
