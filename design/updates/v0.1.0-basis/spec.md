# v0.1.0 · Basis

Issue: TIM-82 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.1 · Basis"
Prototype: prototype.dc.html · Builds on: nothing (first update)

## Goal
A local results tool for ds-init projects that replaces "open CSV, sort, scroll, ask an agent for a
deliverable": runs, experiments, comparisons, details and deliverables, read directly from `runs/`.

## Blocks
- A · Design system — decided (colours, type, density); states follow in the views
- B · Frame — open
- C · Runs — open
- D · Experiment — open
- E · Comparison — open
- F · Detail — open
- G · Deliverables — open
- H · Agent (optional) — open

## Features

### A · Design system
**What:** Dark, calm UI. Colour appears only where it means something: selection, best value, error,
comparability warning, and chart series. Everything else is a cool slate grey.

**Colours (A5 · Schiefer):**

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0D1016` | app background |
| `surface` | `#131720` | panels, sidebars, chart cards |
| `raised` | `#1A2030` | inputs, chips, hover |
| `line` | `#262E3E` | borders, table rules, grid lines |
| `text` | `#E4E8EF` | primary text, values |
| `text-2` | `#A1AABB` | secondary text, labels |
| `text-3` | `#8590A3` | muted text, column heads, units (≥ 4.5:1 on `surface`) |
| `accent` | `#6E9BF5` | selection, focus, active toggles |
| `accent-bg` / `accent-line` | `#192640` / `#2C4572` | fill and border of active controls |
| `selected-row` | `#172238` | selected table row |
| `best` | `#5FD4A0` | best value in a column or table |
| `best-line` | `#245A45` | border of the "Bestwert" tag |
| `error` | `#FF6B6B` | failed cells, error counts |
| `warn` | `#F0B44C` | comparability warnings (mixed epochs, mixed metric families) |
| `warn-bg` / `warn-line` | `#2E2414` / `#5A4420` | warning banner |
| `series-1…6` | `#1FA3A3` `#C47F14` `#5A8DEE` `#D9607E` `#8C7CF0` `#6A9B33` | chart series, fixed order |

**Type:** IBM Plex Sans (UI text, 13 px base) and IBM Plex Mono (config keys, values, numbers, paths).
Numbers use the German decimal comma and a thin space as thousands separator (`412,8`, `222 264`).

**Density:** as in the colour prototypes: everything at a glance, no detail overload. Table rows about
34 px, 8 px cell padding, 24 px page gutter. Radii 4 px (controls), 6 px (panels).

**States** (hover, focus, disabled, loading) are set per view in the blocks where they occur.

**Behaviour:**
- Best value in a sorted metric column → value in `best` plus a text tag "Bestwert" (never colour alone)
- Group with failed cells → status cell in `error` with the count ("1 Fehler")
- Selection mixes epochs or metric families → banner in `warn` with icon and one sentence
- Chart with several series → colours assigned in the fixed order `series-1…6`, by entity, never by rank;
  a series keeps its colour when filters remove others
- More than 6 series → fold into "Other" or small multiples, no generated colours

**In the prototype:** `A5-Schiefer.dc.html` (colour reference), `Main.dc.html`.
**Rejected:**
- A1 · Graphit: neutral grey, liked but too plain alone; its separation of meanings is kept.
- A2 · Tinte: blue-black, liked; its depth is kept, its strong blue cast and gold best value are not.
- A3 · Terminal: accent and best value share one green; green vs. red error is risky.
- A4 · Kohle-Violett: violet reads as product rather than workbench.

## Changes to principles.md / tokens.json
- Create both: colours and their meanings from feature A.

## Out of scope
- Light theme

## Open
- States per view: if a view's block does not define one, then hover = `raised`, focus = 2 px `accent` outline, disabled = `text-3`, loading = muted placeholder rows.
