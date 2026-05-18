---
description: Create a safe Git commit via the git-commit subagent. Optional argument is the commit scope; if omitted, the primary agent infers a minimal scope.
---

You are handling the `/git-commit` command.

Goal: create one safe Git commit by delegating to the `git-commit` subagent. Do not run `git commit` directly in the primary agent.

User-supplied scope:
$ARGUMENTS

Repository path:
!`git rev-parse --show-toplevel 2>/dev/null || pwd`

Current short status for scope inference only. Do not paste full diffs, logs, or history into the primary context:
!`git status --porcelain 2>/dev/null || true`

Instructions:
1. If `$ARGUMENTS` is non-empty, use it as `task_scope`.
2. If `$ARGUMENTS` is empty, the primary agent must infer a concise `task_scope` from the current conversation/request, the short status above, and any already-staged file set.
3. Keep inferred `task_scope` to one or two sentences. Do not load full diffs or commit history into the primary context just to write the scope; the `git-commit` subagent will inspect staged changes, file contents, and history itself.
4. If unrelated changes make the safe commit scope ambiguous, ask the user to clarify instead of committing.
5. Use the `task` tool to invoke subagent type `git-commit` with only this compact prompt:

```text
user_request: /git-commit $ARGUMENTS
repo_path: <repository path above>
task_scope: <scope from argument or primary-agent inference>
```

6. Return only the compact result from the `git-commit` subagent.
