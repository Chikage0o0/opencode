---
name: grilling
description: 'Use when stress-testing a plan or design before building. Triggers on "grill me", "interview me", "pressure-test this", "poke holes", or "stress-test the plan". Batches independent high-leverage questions through the question tool, recommends defaults, and explores the codebase instead of asking when code can answer.'
---

Stress-test the plan before building. Attack assumptions, risks, interfaces, scope, rollout, and verification until the plan is actionable.

## Grilling flow

1. Ground yourself in the prompt. If the codebase can answer a question, inspect it instead of asking.
2. Filter questions. Ask only high-leverage unknowns that change scope, architecture, data contracts, risk, rollout, or validation. Do not ask fine-grained preference questions; choose those detail-level defaults yourself and later tell the user what you chose and why. Do not ask questions with an established best-practice answer; apply the best practice and state it only when it affects scope, risk, or validation.
3. Group decisions by dependency:
   - batch independent questions in one `question` tool call;
   - ask a follow-up round only for questions whose wording or options depend on prior answers;
   - do not ask one question at a time unless dependency or risk makes batching unsafe.
4. Use the `question` tool for user input. For each question, keep options short, put the recommended option first, explain why, and use `multiple: true` only when selections can validly combine.
5. After answers, state the recommended path, resolved assumptions, skipped detail-level choices with what was chosen and brief rationale, remaining risks, and next build/validation step.
