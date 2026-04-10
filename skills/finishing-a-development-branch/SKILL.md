---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting context-aware options for merge, PR, or discard
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling the chosen workflow.

**Core principle:** Verify tests → Determine branches → Present context-aware options → Execute choice.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Current Branch And Base Branch

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

Rules:
- If branch name is empty, stop and ask the user before continuing.
- If `current_branch` is `main` or `master`, set `base_branch="$current_branch"`.
- Otherwise, if `refs/heads/main` exists, set `base_branch="main"`.
- Otherwise, if `refs/heads/master` exists, set `base_branch="master"`.
- If neither exists, stop and ask the user before continuing.

### Step 3: Present Options

If `current_branch != base_branch`, present:

```
Implementation complete. What would you like to do?

1. Merge back to $base_branch locally
2. Push current branch and create a Pull Request
3. Keep the current branch as-is
4. Discard this work

Which option?
```

If `current_branch == base_branch`, do not present a merge option. Present:

```
Implementation complete on the base branch. No merge is needed.

1. Keep the current branch as-is
2. Discard this work

Which option?
```

### Step 3.5: Archive Active Spec And Plan (After Choosing Merge Or PR)

Run this step only after the user chooses `Merge back to $base_branch locally` or `Push current branch and create a Pull Request`. Do not archive for `Keep the current branch as-is` or `Discard this work`.

Archive only the current work's explicitly identified documents:

- Never bulk-move all files from either `active/` directory
- If the current spec or plan path is not explicit in context, stop and ask before moving anything
- Create destination directories if needed, move the current spec from `docs/specs/active/` to `docs/specs/completed/`, move the current plan from `docs/plans/active/` to `docs/plans/completed/`, then stage those path changes and create the archive commit on the current branch with `git-commit` before continuing

```bash
# Example for explicitly identified files only
mkdir -p docs/specs/completed docs/plans/completed
mv "<current-spec-path>" "docs/specs/completed/<spec-filename>"
mv "<current-plan-path>" "docs/plans/completed/<plan-filename>"
git add "<current-spec-path>" "docs/specs/completed/<spec-filename>" "<current-plan-path>" "docs/plans/completed/<plan-filename>"
# Then create the archive commit with the git-commit skill before continuing
```

### Step 4: Execute Choice

#### Option: Merge back to $base_branch locally

Only available when `current_branch != base_branch`.

Before running merge commands, derive `merge_message` in this order:
1. Current plan title
2. Current task title
3. If neither is available, stop and ask the user for the merge message

After completing Step 3.5 on `current_branch`:

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

If tests fail after merge, stop and fix before proceeding.

#### Option: Push current branch and create a Pull Request

Only available when `current_branch != base_branch`.

After completing Step 3.5 on `current_branch`:

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

#### Option: Keep the current branch as-is

Report: "Keeping branch $current_branch as-is."

#### Option: Discard this work

**Confirm first:**

If `current_branch != base_branch`:

```
This will permanently delete:
- Branch $current_branch
- All commits: <commit-list>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:

```bash
git checkout "$base_branch"
git branch -D "$current_branch"
```

If `current_branch == base_branch`, deleting the branch is not valid. Stop and ask the user exactly how they want to discard work on the base branch (for example, revert commits) before running any destructive command.

## Quick Reference

| Context | Available Options |
|---------|-------------------|
| `current_branch != base_branch` | Merge back to `$base_branch` locally / Push current branch and create a Pull Request / Keep the current branch as-is / Discard this work |
| `current_branch == base_branch` | Keep the current branch as-is / Discard this work |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code or create a failing PR
- **Fix:** Always verify tests before offering options

**Not detecting branch context first**
- **Problem:** Offer wrong options because current/base branches are unknown
- **Fix:** Always compute `current_branch` and `base_branch` before Step 3

**Using unnamed merge commits**
- **Problem:** History loses intent and review context
- **Fix:** Require `merge_message` from current plan title, then current task title

**Offering merge while already on base branch**
- **Problem:** Invalid workflow and confusing user choices
- **Fix:** Show base-branch message and only keep/discard options

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed `discard` confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Continue when `current_branch` or `base_branch` is unknown
- Offer merge options when `current_branch == base_branch`
- Merge locally without an explicit `merge_message`
- Delete work without typed confirmation

**Always:**
- Verify tests before Step 2 and after local merge
- Determine branches with `git branch --show-current` and `git show-ref`
- Present options based on whether current branch equals base branch
- Use a named merge commit for local merge

## Integration

**Called by:**
- **subagent-driven-development** - After all tasks complete
- **executing-plans** - After all batches complete

**Pairs with:**
- **git-commit** - For archive commit in Step 3.5
