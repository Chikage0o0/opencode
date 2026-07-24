---
name: resolving-merge-conflicts
description: Resolve an in-progress Git merge, rebase, or cherry-pick conflict while preserving both changes' intent. Use when Git reports unmerged paths or conflict markers and the user wants the conflicts analyzed or resolved.
---

# Resolve Merge Conflicts

## 1. Establish the operation

Inspect `git status`, unmerged paths, the current merge/rebase/cherry-pick
metadata, and the commits on both sides. Do not abort, continue, stage, or commit
yet. Stop if the repository state does not match the user's request.

Completion criterion: every conflicted path and the active Git operation are
identified.

## 2. Recover both intents

For each conflict, inspect the base, ours, theirs, surrounding code, relevant
commits, tests, specifications, and issue or PR context when available. Classify
the resolution:

- combine compatible behavior;
- select one side because the other is obsolete;
- rewrite the hunk because both sides changed the same contract;
- regenerate a generated file from its source.

Never choose by branch label alone. Treat delete/modify conflicts and changes to
public behavior as ambiguous until the intended result is supported by primary
sources or confirmed by the user.

Completion criterion: every conflict has a stated intended result and evidence.

## 3. Confirm material choices

Present a compact per-file plan before editing when any resolution changes
behavior, drops one side's intent, alters a public contract, or remains
ambiguous. Ask the user to choose when primary sources cannot settle it.
Mechanical combinations with one evidenced result may proceed without an extra
round trip.

## 4. Resolve the files

Apply the smallest coherent resolution. Preserve both intents when compatible;
when they conflict, implement the confirmed contract rather than stacking both
implementations. Regenerate generated files with the repository's existing
command. Do not add unrelated cleanup or new behavior.

Check that no unmerged entries or conflict markers remain. Review the resulting
diff as a whole, not only the marked hunks.

## 5. Verify

Run `git diff --check`, then the narrowest relevant typecheck, tests, build, or
format checks discovered from the repository. Report any checks that cannot run
and distinguish merge-caused failures from pre-existing failures.

Completion criterion: the working-tree resolution is coherent and supported by
fresh verification evidence.

## 6. Finish only within the requested scope

Resolving files does not implicitly authorize history changes.

- Stage resolved paths only when the user asked to mark the conflict resolved or
  continue the Git operation.
- Run `git merge --continue`, `git rebase --continue`, or
  `git cherry-pick --continue` only when the user requested continuation.
- Never create an extra commit, push, abort, reset, clean, or rewrite history
  without explicit authorization.

Report the remaining Git state and the exact next command when continuation was
not authorized.
