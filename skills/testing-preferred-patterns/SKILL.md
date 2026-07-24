---
name: testing-preferred-patterns
description: Apply bounded, evidence-backed fixes to existing flaky, brittle, weak, over-mocked, order-dependent, slow, or misleading tests while preserving observable behavior. Use for a Fixer batch that already has concrete findings, owned files, and verification commands. Do not use to audit an entire repository, choose cleanup scope, or write a new feature's tests from scratch.
---

# Fix Test Quality Findings

Implement a pre-triaged batch of test-quality fixes. The parent workflow owns
repository-wide discovery, severity, scope, and batch ordering.

## Required brief

Do not start edits until the brief identifies:

- owned test and support files;
- concrete findings with file and line evidence;
- observable behavior that must remain protected;
- forbidden production or shared-infrastructure files;
- baseline failures;
- focused and package-level test commands.

If intent or ownership is ambiguous, return the missing decision. Do not expand
the batch by scanning unrelated tests.

## Prepare

Read all applicable `AGENTS.md`, repository testing guidance, framework config,
the target tests, and enough production code to understand observable behavior.
Run the narrowest target test before editing and record whether it passes,
fails, or cannot run.

Load references only when useful:

- `references/preferred-pattern-catalog.md` for before/after examples;
- `references/fix-strategies.md` for Go, Python, and JS/TS techniques;
- `references/error-handling.md` when behavior or intent is ambiguous.

Examples in references are guidance, not authorization to install tools or
dependencies.

## Fix one coherent finding at a time

For each assigned finding:

1. State the behavior the test is meant to protect.
2. Confirm the evidence still exists in current code.
3. Apply the smallest framework-idiomatic fix.
4. Run the focused test.
5. Review the diff before moving to the next finding.

Prefer:

- observable outcomes over private state or exact collaborator wiring;
- specific meaningful assertions over truthiness or broad exceptions;
- explicit synchronization and controllable clocks over sleeps;
- isolated fixtures over shared mutable state;
- semantic UI selectors over DOM structure;
- mocks at external boundaries over mocks of owned internal logic;
- deliberate parametrization only when scenarios have the same behavior.

Do not consolidate distinct boundary cases merely because their bodies look
similar. Do not replace a meaningful exact assertion with a weaker matcher to
make a test pass.

## Handle changed behavior safely

A test failure after editing does not prove the production code was buggy.
Investigate separately:

- whether the new expectation changed the contract;
- whether the test exposed an existing production defect;
- whether setup, environment, timing, or shared state changed;
- whether the original test was obsolete or misleading.

Stop and report evidence before changing production code, public behavior,
dependencies, test runner configuration, CI, snapshots with unclear intent, or
meaningful test coverage. Delete or disable a test only when the parent brief
explicitly authorizes it and the lost coverage is accounted for.

## Verify the batch

Run, in order:

1. every changed test;
2. the containing file, package, or test project;
3. any additional command supplied by the parent workflow.

Repeat a repaired flaky test at least three times, or use the framework's
stronger native repeat/stress mode. Check that the batch introduced no new
skip, focus-only marker, swallowed error, sleep, or unexplained test-count
change.

Do not run an expensive repository-wide suite unless the parent brief requests
it. Do not stage, commit, push, continue or abort a Git operation.

## Return evidence

Report:

- finding ids fixed and deferred;
- files changed;
- behavior preserved;
- commands and exact outcomes;
- test-count or skip changes;
- remaining uncertainty and required next decision.

Never report a finding fixed without fresh focused test evidence.
