---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Dispatch a **background `librarian` task** to do the reading while the
Orchestrator continues non-overlapping work.

## Process

1. Choose the destination Markdown path before dispatch. Match the repo's
   existing research-note convention; if none exists, choose a narrow,
   descriptive path and state it.
2. Ask Librarian to investigate the question against **primary sources**:
   official docs, source code, specifications, and first-party APIs. Require a
   Markdown-ready report with a source beside every material claim. Librarian
   is read-only and must return the report instead of writing files.
3. Reconcile the returned claims and sources. Reject unsupported claims,
   secondary-source substitutions, and citations that do not support the
   associated statement.
4. Have the Orchestrator write one Markdown file at the chosen path. If the
   current agent is read-only, return the validated Markdown and destination
   path to its caller for writing.
5. Report the absolute or repo-relative path and any remaining uncertainty.
