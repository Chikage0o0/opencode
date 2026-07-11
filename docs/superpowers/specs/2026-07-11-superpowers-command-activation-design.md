# Superpowers 命令激活设计

## 目标

停止通过 Git plugin 自动加载 Superpowers。将当前 Superpowers `6.1.1` 固定为本地 skills，并且只在用户对当前 session 执行 `/use-superpowers` 后启用其工作流。

## 当前行为

`opencode.json` 将 `superpowers@git+https://github.com/obra/superpowers.git` 注册为 plugin。该 plugin 在启动时注册上游 skills 路径，并向每个 session 的首条用户消息自动注入 `using-superpowers` bootstrap。因此，Superpowers 默认生效，用户无法按 session 选择是否启用。

## 方案

1. 从 `opencode.json` 的 `plugin` 数组删除 Superpowers Git plugin 条目。
2. 从当前已安装的 Superpowers `6.1.1` 固定复制除 `using-superpowers` 外的 skills 到本地 `skills/superpowers/`。
3. 保留 skill 正文、参考文件和脚本；只修改各 `SKILL.md` 的 frontmatter `description`，明确该 skill 仅在当前 session 已执行 `/use-superpowers` 后适用。
4. 新建 `commands/use-superpowers.md`。命令正文直接内联 `using-superpowers` bootstrap 规则及 OpenCode tool mapping，不再把 `using-superpowers` 注册为独立 skill。
5. 命令产生的用户消息作为当前 session 的激活标记。后续步骤可根据 conversation history 判断 Superpowers 已启用；新 session 因不存在该消息而保持未启用。
6. 修改后退出并重启 OpenCode。配置、commands 和 skills 不会在当前运行实例中热重载。

## 组件与数据流

### 本地 skills

- 来源固定为 Superpowers `6.1.1`。
- OpenCode 通过全局配置目录下的 `skills/**/SKILL.md` 自动发现。
- 未激活 session 中，门控后的 `description` 不匹配普通开发任务，因而不应自动加载。
- 激活后，内联 bootstrap 要求代理在任何响应或操作前检查并调用适用 skill。

### `/use-superpowers` command

- 无需参数。
- 正文声明当前 session 已启用 Superpowers。
- 正文内联原 `using-superpowers` 的 skill 选择规则、优先级、反合理化约束和 OpenCode 工具映射。
- 激活只依赖当前 conversation history，不写全局状态、项目状态或外部状态文件。

## 更新策略

采用固定版本、手动更新。升级时重新从目标上游版本同步 skills，继续排除 `using-superpowers`，并重新应用 description 门控。升级必须检查上游 bootstrap 和 tool mapping 的变化，再同步到 command 正文。

## 错误处理与边界

- 不保留 Superpowers plugin；否则自动 bootstrap 仍会发生。
- 不把 `using-superpowers` 复制为本地 skill，避免 command 与 skill 两份入口发生漂移。
- 不使用 symlink、Git submodule 或运行时 Git 源，保证配置不依赖外部仓库状态。
- 不修改其他 plugin、已有本地 skills、agents 或 commands。
- 若 OpenCode 对 skill description 的匹配仍导致未激活加载，应视为门控失败，继续收紧 description；不得恢复自动注入作为 workaround。

## 验证

1. 校验 `opencode.json` 语法，并确认仅删除目标 plugin 条目。
2. 检查本地 Superpowers skill 数量、目录结构及 frontmatter。
3. 确认本地不存在 `skills/superpowers/using-superpowers/SKILL.md`。
4. 检查 `/use-superpowers` command 已包含完整 bootstrap 和 OpenCode tool mapping。
5. 重启 OpenCode，新建 session：确认首条用户消息不包含自动注入的 `<EXTREMELY_IMPORTANT>`，普通任务不加载 Superpowers skills。
6. 在另一新 session 执行 `/use-superpowers`：确认后续任务会按内联规则调用适用的本地 Superpowers skills。
7. 再新建 session：确认激活状态没有跨 session 保留。

## 验收标准

- Superpowers Git plugin 已从 `opencode.json` 删除。
- 本地 skills 固定来自 `6.1.1`，且不含独立的 `using-superpowers` skill。
- 未执行 `/use-superpowers` 的 session 不自动注入 bootstrap，也不自动触发 Superpowers skills。
- 执行命令后，Superpowers 规则持续作用于当前 session。
- 新 session 默认恢复未激活状态。
- 现有其他 OpenCode 配置保持不变。
