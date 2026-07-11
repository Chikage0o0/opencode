# Superpowers 自动更新脚本设计

## 目标

提供 `scripts/update-superpowers.py <version>`，按指定上游版本更新本地 Superpowers skills 和 `/use-superpowers` command，并自动重放本仓库要求的 session 门控、路径适配和 executable bit 修复。

## 输入与上游

- 命令只接受严格的 `X.Y.Z` 版本号，例如 `6.2.0`。
- 上游固定为 GitHub 仓库 `obra/superpowers`。
- 下载固定 tag `v<version>` 的 tarball，不接受用户提供的 URL、仓库或分支。
- 解压后校验上游 `package.json.version` 与参数完全相同。

## 更新流程

1. 在临时目录下载并安全解压目标 tag tarball。
2. 拒绝归档中的绝对路径、`..` 路径穿越、链接逃逸和异常根目录结构。
3. 收集上游 `skills/`；排除 `using-superpowers`，其余 skill 复制到 staging 目录。
4. 修改每个顶层 `SKILL.md` frontmatter `description`，添加 `/use-superpowers` 当前 session 激活门控。
5. 精确应用两个本地路径适配：
   - `brainstorming/SKILL.md` 中的 visual companion 路径改为 `./visual-companion.md`。
   - `executing-plans/SKILL.md` 中已排除的 `using-superpowers/references/` 路径改为 `../../../commands/use-superpowers.md`。
6. 两个路径补丁都必须各命中一次；零次或多次均中止，防止上游变化被静默忽略。
7. 从上游 `using-superpowers/SKILL.md` 去除 frontmatter，重新生成 `commands/use-superpowers.md`；保留本地 session activation wrapper 和 OpenCode tool mapping。
8. 校验已知的 7 个 executable 文件存在，并恢复 Git index 中的 `100755` mode。
9. 所有内容和结构校验通过后，才替换 `skills/superpowers/` 与 command。任何前置步骤失败时，现有文件保持不变。

## Executable 文件

必须保持 `100755`：

- `skills/superpowers/brainstorming/scripts/start-server.sh`
- `skills/superpowers/brainstorming/scripts/stop-server.sh`
- `skills/superpowers/subagent-driven-development/scripts/review-package`
- `skills/superpowers/subagent-driven-development/scripts/sdd-workspace`
- `skills/superpowers/subagent-driven-development/scripts/task-brief`
- `skills/superpowers/systematic-debugging/find-polluter.sh`
- `skills/superpowers/writing-skills/render-graphs.js`

脚本可调用 `git update-index --chmod=+x` 更新这些已跟踪文件的 index mode，但不得创建 commit 或 push。

## 原子性与失败处理

- 下载、解压、转换和校验都在临时目录完成。
- 替换前保留当前 skills 和 command 的临时备份。
- 替换过程中发生错误时恢复备份。
- 网络错误、404、版本不符、归档不安全、frontmatter 无效、补丁命中数错误、预期 executable 缺失均返回非零状态。
- 错误信息指出失败阶段和具体文件，不吞异常。

## 测试

使用 Python 标准库单元测试和临时构造的 tarball，不访问 GitHub。覆盖：

- 合法版本完成 skills、description gate、两个路径补丁和 command 更新。
- `using-superpowers` 不出现在 vendored skills 中，但其正文进入 command。
- 非法版本在网络请求前失败。
- `package.json.version` 不匹配时失败且目标不变。
- tarball 路径穿越被拒绝。
- 任一路径补丁未精确命中一次时失败且目标不变。
- 任一 executable 文件缺失时失败且目标不变。
- command 或 skills 替换失败时恢复旧内容。

## 验收标准

- `python scripts/update-superpowers.py 6.1.1` 可从官方 `v6.1.1` tag 重建当前 vendored 内容。
- 重建后 7 个脚本均为 Git mode `100755`。
- 两个本地引用有效。
- `/use-superpowers` command 与指定版本的 bootstrap 同步。
- 更新器无第三方 Python 依赖，不自动 commit、push 或修改其他配置。
