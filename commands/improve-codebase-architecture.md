---
description: 扫描代码库架构摩擦，生成可视化 HTML 报告并引导后续 grilling。
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

This command is informed by the project's domain model and built on a shared design vocabulary:

- Load and use `/codebase-design` for the architecture vocabulary: **module**, **interface**, **implementation**, **depth**, **deep**, **shallow**, **seam**, **adapter**, **leverage**, **locality**.
- Use those terms exactly in every suggestion. Do not drift into “component,” “service,” “API,” “boundary,” or “wrapper” when the glossary term applies.
- Read `CONTEXT.md` first when it exists. Domain language in `CONTEXT.md` gives names to good seams.
- Read relevant ADRs under `docs/adr/` before suggesting changes they may contradict.

## Input

Arguments after `/improve-codebase-architecture` are optional focus hints, such as a directory, subsystem, or concern. If omitted, review the whole repo at a practical depth.

If the input is ambiguous, ask one targeted question before scanning. Otherwise proceed.

## Process

### 1. Explore

Read the project context first:

- `CONTEXT.md` for domain vocabulary, if present.
- Relevant ADRs in `docs/adr/`, if present.
- Existing tests and module boundaries around the focus area.

Use `@explorer` / the Task tool for broad codebase recon when available. Ask it to map modules, seams, test surfaces, and likely friction points. Do not paste large files into the prompt; reference paths and symbols.

Explore organically and record where understanding becomes expensive:

- Where does one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, while the real bugs hide in how they are called, losing **locality**?
- Where do tightly coupled modules leak across their seams?
- Which parts are untested, or hard to test through the current interface?

Apply the **deletion test** to anything suspected shallow: would deleting it concentrate complexity, or just move it? “Yes, it concentrates complexity” is the useful signal.

### 2. Select candidates

Pick 3–6 candidates. Prefer real friction over theoretical neatness.

Each candidate must include:

- **Files** — concrete files/modules involved.
- **Problem** — why the current architecture creates friction.
- **Solution** — what would change, without proposing final interfaces yet.
- **Benefits** — explained in terms of locality, leverage, and testability.
- **Before / After diagram** — side-by-side, visual, not just prose.
- **Recommendation strength** — exactly one of `Strong`, `Worth exploring`, `Speculative`.

ADR conflicts: if a candidate contradicts an existing ADR, include it only when the friction is strong enough to justify reopening that ADR. Mark it clearly in an amber warning callout.

### 3. Write the HTML report

Write a self-contained HTML file to the OS temp directory, never into the repo.

- Resolve temp dir from `$TMPDIR`, `$TEMP`, or `$TMP`; fall back to `/tmp` on Unix-like systems.
- On Windows, prefer `%TEMP%`/`$env:TEMP`.
- File name: `architecture-review-<timestamp>.html`.
- Open it for the user and report the absolute path.
  - Linux: `xdg-open <path>`
  - macOS: `open <path>`
  - Windows: `cmd.exe /c start "" "<path>"` or `powershell.exe -NoProfile -Command Start-Process -FilePath "<path>"`

The report uses **Tailwind via CDN** and **Mermaid via CDN**. Mermaid is for graph-shaped relationships: dependencies, call graphs, sequences. Hand-built CSS/SVG is for editorial visuals: mass diagrams, cross-sections, collapse diagrams.

Use this scaffold:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>
        <!-- Repo name, date, and compact legend. No intro paragraph. -->
      </header>
      <section id="candidates" class="space-y-10">
        <!-- Candidate cards. -->
      </section>
      <section id="top-recommendation">
        <!-- One larger card with the first candidate to tackle and why. -->
      </section>
    </main>
  </body>
</html>
```

#### Header

Show repo name, date, focus area if any, and a compact legend:

- solid box = module
- dashed line = seam
- red arrow = leakage
- thick dark box = deep module

No introduction paragraph. Go straight into the candidates.

#### Candidate card

The diagrams carry the weight. Prose is sparse, plain, and uses the `/codebase-design` glossary without ceremony.

Each candidate is one `<article>` with:

- **Title** — short, names the deepening, e.g. “Collapse the Order intake pipeline”.
- **Badge row** — recommendation strength (`Strong` = emerald, `Worth exploring` = amber, `Speculative` = slate), plus a tag for dependency category (`in-process`, `local-substitutable`, `ports & adapters`, `mock`).
- **Files** — monospaced list, `font-mono text-sm`.
- **Before / After diagram** — centrepiece, two columns side by side.
- **Problem** — one sentence.
- **Solution** — one sentence.
- **Wins** — bullets, ≤6 words each, phrased in glossary terms.
- **ADR callout** — only if applicable, one line in an amber-tinted box.

Do not use paragraphs of explanation. If the diagram needs a paragraph to be understood, redraw the diagram.

#### Diagram patterns

Use varied visuals. Do not make every card look the same.

1. **Mermaid graph** — for dependency or call flow.

   ```html
   <div class="rounded-lg border border-slate-200 bg-white p-4">
     <pre class="mermaid">
       flowchart LR
         A[OrderHandler] --> B[OrderValidator]
         B --> C[OrderRepo]
         C -.leak.-> D[PricingClient]
         classDef leak stroke:#dc2626,stroke-width:2px;
         class C,D leak
     </pre>
   </div>
   ```

2. **Hand-built boxes-and-arrows** — use `<div>` modules plus inline SVG arrows when Mermaid layout fights the point.

3. **Cross-section** — stacked horizontal bands to show too many shallow layers. Before: many thin bands. After: one thick band with internals faded.

4. **Mass diagram** — two rectangles per module: interface surface area vs implementation mass. Before: interface nearly as tall as implementation. After: small interface, large implementation.

5. **Call-graph collapse** — before: a tree of function calls. After: one deep module with the old calls faded inside.

#### Style guidance

- Lean editorial, not corporate dashboard.
- Generous whitespace.
- Colour sparingly: one accent plus red for leakage and amber for warnings.
- Keep diagrams around 320px tall so before/after fits side by side.
- Use `text-xs uppercase tracking-wider` for module labels.
- The only scripts are Tailwind CDN and Mermaid ESM import. No app code.

#### Top recommendation section

End with one larger card:

- Candidate name.
- One sentence explaining why it should be tackled first.
- Anchor link to its card.

### 4. Stop and ask

Do **not** propose final interfaces yet.

After opening the report, ask exactly:

> Which of these would you like to explore?

### 5. Grilling loop after the user picks

Once the user picks a candidate, run `/grilling` to walk the design tree with them:

- constraints
- dependencies
- shape of the deepened module
- what sits behind the seam
- which tests survive

Use `/domain-modeling` as decisions crystallize:

- Naming a deepened module after a concept not in `CONTEXT.md`? Add the term to `CONTEXT.md`. Create the file lazily if needed.
- Sharpening a fuzzy term during the conversation? Update `CONTEXT.md` right there.
- User rejects the candidate with a load-bearing reason? Offer an ADR: “Want me to record this as an ADR so future architecture reviews don't re-suggest it?” Only offer this when the reason matters for future architecture reviews.
- Want to explore alternative interfaces for the deepened module? Run `/codebase-design` and use its design-it-twice parallel sub-agent pattern.

## Tone

Plain English, concise, with exact glossary terms.

Use exactly: module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

Avoid: component, service, unit for module; API/signature for interface; boundary for seam; layer/wrapper when you mean module.

Good phrasing:

- “Order intake module is shallow — interface nearly matches the implementation.”
- “Pricing leaks across the seam.”
- “Deepen: one interface, one place to test.”
- “Two adapters justify the seam: HTTP in prod, in-memory in tests.”

Wins bullets should name the gain:

- “locality: bugs concentrate”
- “leverage: one interface”
- “interface shrinks”
- “implementation absorbs wrappers”

No hedging, no throat-clearing, no vague “cleaner code”.
