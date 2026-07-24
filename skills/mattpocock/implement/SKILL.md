---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

# Implement

Implement one spec or agent-ready ticket through the OMO specialist lanes.

## Process

1. Read the full spec or ticket, its acceptance criteria, blockers, domain
   glossary, and relevant ADRs. Stop if a blocker is unresolved.
2. Confirm the behavior and pre-agreed test seams. Use `/tdd` for behavior
   changes; keep each red-green slice bounded.
3. Delegate implementation:
   - `fixer` owns headless logic, tests, wiring, and mechanical changes;
   - `designer` owns visual structure, interaction, responsive behavior, motion,
     and component feel.
   Give each writer a non-overlapping file scope. Preserve Designer intent in
   later Fixer work.
4. Reconcile terminal results and run the narrowest meaningful tests and
   typechecks. Run broader integration or full-suite checks when the change's
   scope and risk justify them.
5. Run `/code-review` against the fixed point from before implementation.
   Batch material findings into one bounded remediation pass, then re-run the
   affected evidence path. Request another Oracle review only when remediation
   changes the reviewed risk or decision.
6. Commit only when the user explicitly requested a commit. Delegate that step
   to `git-commit`; otherwise leave the verified working tree uncommitted and
   report its state.
