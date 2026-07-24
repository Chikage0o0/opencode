---
name: prototype
description: Build a bounded, disposable prototype that answers one design question. Use when the user wants to test a state model or business rule interactively, compare substantially different UI directions, or validate an idea before production implementation.
---

# Prototype

A prototype is **throwaway code that answers a question**. The question decides the shape.

## Pick a branch

Identify which question is being answered — from the user's prompt, the surrounding code, or by asking if the user is around:

- **"Does this logic / state model feel right?"** → [LOGIC.md](LOGIC.md). Build a tiny interactive terminal app that pushes the state machine through cases that are hard to reason about on paper.
- **"What should this look like?"** → [UI.md](UI.md). Generate several radically different UI variations on a single route, switchable via a URL search param and a floating bottom bar.

The two branches produce very different artifacts — getting this wrong wastes the whole prototype. If the question is genuinely ambiguous and the user isn't reachable, default to whichever branch better matches the surrounding code (a backend module → logic; a page or component → UI) and state the assumption at the top of the prototype.

## Rules that apply to both

1. **Throwaway from day one, and clearly marked as such.** Prefer an existing project scratch/prototype location. When integration context requires tracked application files, keep the scope explicit and make every prototype-only path or switch visibly temporary. Do not create a branch or worktree unless the user requests one.
2. **One command to run.** Whatever the project's existing task runner supports — `pnpm <name>`, `python <path>`, `bun <path>`, etc. The user must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. If the question explicitly involves persistence, use an isolated local store with an obvious prototype name. Never write to a remote, shared, or production service without explicit approval.
4. **Skip the polish.** No tests, no error handling beyond what makes the prototype _runnable_, no abstractions. The point is to learn something fast.
5. **Surface the state.** After every action (logic) or on every variant switch (UI), print or render the full relevant state so the user can see what changed.
6. **Capture the answer, not hidden Git state.** Report the question, verdict, run command, and changed files. Keep the prototype uncommitted by default. Delete it, promote a decision into production code, create a branch, update an issue, or commit only when the user explicitly requests that next step. Production promotion is a normal implementation task and must regain tests, error handling, and repository standards.
