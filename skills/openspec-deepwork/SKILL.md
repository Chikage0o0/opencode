---
name: openspec-deepwork
description: Run approved, high-cost OpenSpec Apply work through Deepwork with phase-local Oracle review and one local WIP commit per phase. Use for `/deepwork ... OpenSpec change CHANGE_ID`.
---

# OpenSpec × Deepwork

OpenSpec owns **what** must change. Deepwork owns **how** the work is phased,
delegated, reviewed, and evidenced. Never create a second requirements or task
source of truth.

## 1. Bind the change

1. Activate `deepwork` and `openspec-apply-change`.
2. Bind the run to one explicit OpenSpec change ID.
3. Follow the Apply skill to resolve status and instructions, read every
   `contextFiles` path, preserve any `--store`, and validate the change.
4. Stop on `blocked`; verify rather than implement on `all_done`; continue
   only when `ready` and implementation is authorized.

**Complete when:** one valid, authorized OpenSpec change is ready to schedule.

## 2. Schedule phases

1. Derive a small number of coherent phases from pending OpenSpec task IDs,
   dependencies, and integration boundaries.
2. Record each phase's task IDs, owned paths, delegated lanes, checks, Oracle
   gate, and starting Git commit in `.slim/deepwork/<change-id>.md`.
3. Keep OpenSpec artifacts authoritative, the Deepwork file as derived evidence,
   and OpenCode todos as the current-phase mirror.
4. Let only the Orchestrator update coordination state, OpenSpec checkboxes, and
   shared Git history.

Before execution, confirm once that local WIP commits are wanted. Use a task
branch with an empty index; treat existing user changes as protected. Use an
approved isolated worktree or stop when that cannot be guaranteed.

**Complete when:** the user has seen the phase/ownership overview and phase 1 has
an unambiguous base, scope, and evidence target.

## 3. Run one phase

1. Delegate only bounded, non-overlapping ownership with exact task IDs and
   required checks. Specialists do not edit coordination state or commit.
2. Integrate every terminal result and run focused checks.
3. Check an OpenSpec task only after its integrated result passes.
4. Synchronize the OpenSpec task artifact, Deepwork evidence, and OpenCode todos.

**Complete when:** every phase result is reconciled, its planned checks pass, and
no owned change is missing from the phase record.

## 4. Review and checkpoint

1. Compare the worktree with the phase's starting commit. Give Oracle the changed
   path manifest, validation evidence, and only this phase's diff—not the
   cumulative session diff. Use a fresh Oracle session for each phase; let it
   read an ignored patch file in chunks when the patch is large.
2. Resolve material findings in one bounded pass. Re-review only changed,
   risk-relevant hunks when remediation alters the reviewed risk.
3. Confirm `HEAD` still equals the phase base and the index is empty.
4. Stage only the exact phase paths and changed in-repository OpenSpec artifacts.
   Inspect the staged path list and diff.
5. Create one local commit:

   ```text
   wip(<change-id>): phase <number> <short-title>
   ```

6. Record the new commit as `phase_head`; use it as the next phase's base.

Use the repository's required commit convention when necessary. Keep checkpoints
local. Do not use broad staging, bypass hooks, rewrite history, or push as part
of this workflow.

**Complete when:** Oracle findings are reconciled, the phase has exactly one
reviewed checkpoint, and its owned paths are clean.

## 5. Reconcile drift

When implementation or Oracle changes scope, requirements, acceptance, design,
or task meaning:

1. Pause the affected lane.
2. Use `openspec-update-change` to update the durable artifact and obtain its
   required confirmation.
3. Refresh Apply instructions, reread changed context, validate, and remap the
   affected phase.

Keep the phase open until its single reviewed checkpoint; do not hide durable
decisions only in Deepwork state.

**Complete when:** OpenSpec and the execution schedule agree again.

## 6. Close or resume

Close implementation only when all applicable OpenSpec tasks are checked, every
result and Oracle finding is reconciled, project checks pass, strict OpenSpec
validation passes, `openspec-verify-change` passes with no critical finding,
and every phase has a recorded checkpoint.

Archive or sync only when the user requests it. Report the change ID, completed
tasks, checkpoint commits, evidence, exceptions, blockers, and next OpenSpec
action.

On resume, reconstruct from live OpenSpec artifacts,
`.slim/deepwork/<change-id>.md`, and Git history. Reconcile any mismatch before
selecting the next phase base.
