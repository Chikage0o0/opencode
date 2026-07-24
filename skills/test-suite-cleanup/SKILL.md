---
name: test-suite-cleanup
description: Coordinate a safe, repository-wide cleanup of existing tests through Explorer inventory, Oracle anti-pattern audit, bounded Fixer remediation, and evidence-based verification. Use when the user asks to clean, modernize, stabilize, de-flake, simplify, or systematically improve an entire project's test suite. This is an Orchestrator-only workflow; do not use it for one failing test or for writing tests for a single feature.
---

# Test Suite Cleanup

Clean an existing suite without turning the effort into an unbounded rewrite.
The Orchestrator owns scope, delegation, reconciliation, and final evidence. It
does not audit every test itself and does not edit test files.

## 1. Establish the contract

Read repository instructions, contribution docs, manifests, CI workflows, test
configuration, and existing test commands. Record:

- workspaces or packages and their test owners;
- unit, integration, E2E, performance, and generated-test boundaries;
- commands for a single test, package, and full suite;
- existing working-tree changes that must be preserved;
- explicit exclusions and acceptable runtime.

The cleanup request authorizes test-focused edits inside the agreed scope. It
does not authorize production behavior changes, public API changes, dependency
installation, runner or CI migration, data deletion, commits, or pushes.

## 2. Inventory and baseline

Delegate repository and test-layout discovery to `explorer`. Ask for a compact
map grouped by package and executable test command, not a prose tour.

Run the cheapest representative baseline first, then broader commands when
feasible. Capture command, exit status, duration, failing tests, skipped tests,
and test count when the runner exposes it. Treat pre-existing failures as
baseline evidence; do not silently fold them into cleanup regressions.

If the repository is too large for one full baseline, define explicit lanes and
state which lanes remain unmeasured.

## 3. Audit through Oracle

Partition the suite by package, framework, or ownership boundary. Dispatch
read-only `oracle` lanes with `test-anti-patterns` and
`test-analysis-extensions`. Parallel lanes must have non-overlapping test
ownership and complete independent briefs.

Require each finding to contain:

- stable finding id and severity;
- exact file, line, and test name;
- concrete evidence and the observable behavior at risk;
- minimal remediation class;
- narrow verification command;
- uncertainty or production-code dependency.

Zero findings is valid. Reject generic advice, unsupported severity, and lists
that merely restate lint rules. Ask Oracle to inspect production code when
needed to distinguish behavior tests from implementation coupling.

## 4. Reconcile and choose batches

Deduplicate findings and suppress framework-idiomatic false positives. Rank:

1. false confidence and silently passing tests;
2. flaky, order-dependent, or environment-dependent tests;
3. broad assertions, over-mocking, and brittle implementation coupling;
4. maintainability and hygiene findings with material recurring cost.

Do not bulk-fix low-severity style findings merely because they are easy.
Group approved findings into small batches with non-overlapping file ownership.
One batch must fit one Fixer context and have a clear validation command.

Pause for user direction when a finding requires production-code changes,
changes the intended behavior, deletes meaningful coverage, adds a dependency,
or changes test infrastructure.

## 5. Remediate through Fixer

Dispatch each approved batch to `fixer` with
`testing-preferred-patterns`. Include:

- owned files and forbidden files;
- finding ids and evidence;
- behavior that must remain protected;
- baseline status;
- narrow and package-level verification commands.

Fixer may make only the smallest coherent test-focused changes. Serialize
batches whose files, fixtures, snapshots, or shared test infrastructure
overlap. Never let parallel writers modify the same support code.

After every batch, reconcile the diff and fresh test output before dispatching
dependent work. Do not stage, commit, continue a Git operation, or push.

## 6. Verify the suite

Verify proportionally:

1. changed tests;
2. their package or test project;
3. affected integration path;
4. full suite when its cost is reasonable or the risk justifies it.

For a flakiness fix, repeat the focused test at least three times or use the
framework's stronger native stress/repeat mode. Compare baseline and final
failures, skips, test count, and duration where available. A changed test count
is acceptable only when intentional and explained.

Request a second read-only Oracle pass only for unresolved Critical/High
findings or remediation that materially changed the reviewed risk.

## 7. Report

Return:

- audited and unaudited scope;
- findings fixed, deferred, rejected, and newly discovered;
- files changed by batch;
- every verification command and result;
- baseline versus final failures, skips, count, and duration;
- remaining risk and the smallest next action.

Never claim the whole project is clean when any lane or full-suite evidence is
missing.

## Guardrails

- Do not make a failing suite green by skipping tests, weakening assertions, or
  increasing sleeps and timeouts.
- Do not assume a refactoring-induced failure proves buggy production behavior;
  investigate the expectation, implementation, fixture, and environment.
- Do not contact production services or mutate shared data from tests.
- Do not add dependencies, reformat unrelated files, or redesign production
  architecture as incidental cleanup.
- Preserve user changes and repository conventions.
