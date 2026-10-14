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
- D · Experiment — decided (D5 · Kombination)
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

### D · Experiment
**What:** The view of one run that replaces opening `summary.csv`. A sidebar on the left lists every
dimension of the run by role; the main area shows a toolbar, an optional overview strip with small
charts, and the group table. Everything project-specific comes from the run folder: axes and
replicates from `meta.json`, parameter blocks from the resolved `config.yaml`, metrics (direction,
family) from `project.yaml`, channels from `channels.parquet`.

**Terms:** *axis* = `sweep:` key; *replicates* ("Wiederholungen") = `replicates:` keys (`shuffle_seed`,
`cv_fold`); *channel* = output dimension (regions in repnet-bench); *group* = cells that differ only in
the dimensions currently averaged.

**Sidebar:**
- Sections in this order: one per config block that holds swept axes (`data`, `model`, `train`, … in
  config order), then "Wiederholungen", then "Kanäle" (only if the run has a `channels` table with
  more than one channel).
- Each dimension is one collapsed row: name and a state tag on the right — `geteilt` (accent),
  `Ø` (neutral), `= <value>` or `<k> von <n>` when values are selected, `Ø · = <value>` when both.
- Click on a row → it expands: a two-way switch "Teilen | Ø mitteln" (for channels "je Kanal |
  gesamt") and the list of values as checkboxes with their cell count.
- "Konstante Werte" sits apart at the bottom of the sidebar (pushed down, own bordered panel on a
  darker ground, count badge), collapsed by default. Expanded, it lists the non-swept parameters of
  the resolved `config.yaml` (and axes with a single value), grouped by block, as `key   value` rows.
  Read-only.
- Search field on top → filters dimensions, values and constants by substring; matching rows and the
  "Konstante Werte" panel expand automatically.

**Defaults:** axes split, replicates averaged, channels "gesamt" (metrics from `cells`), sort by
`primary_metric` ascending for `min` metrics, overview shown.

**Behaviour:**
- Axis switched to Ø → the table groups over the remaining split dimensions; its column disappears;
  a chip "Ø <axis>" appears in the toolbar.
- Value checkboxes ticked → only cells with those values are used (filter); none ticked = all values;
  a chip "<axis> ∈ <values>" appears.
- Replicates switched to "Teilen" → `shuffle_seed` and `cv_fold` become columns, one row per cell.
- Channels switched to "je Kanal" → a `channel` column appears and every group gets one row per
  channel, values from `channels`; channel checkboxes then filter the channels.
- Click × on a chip → that dimension returns to its default.
- Click on a metric column head → sort by it ascending; second click → descending. Sorting is global
  over all groups, never only over the rendered rows.
- More than 200 rows → the first 200 are rendered; the toolbar says "<N> Gruppen · <M> Zellen ·
  sortiert über alle".
- Best value of the sort metric → `best` colour and a "Bestwert" tag in that cell.
- Group with failed cells → `n` counts only successful cells; status column shows "<k> Fehler" in
  `error`.

**Toolbar:** "Überblick" toggle, "Spalten <visible>/<total>" dropdown, the chips, and the summary on
the right.

**Columns dropdown** (MLflow-like): groups "Metriken" (each catalogue metric with its family tag
`real`/`scaled`) and "Statistik" (`n`, `min`, `max` of the sort metric, `Status`), plus a three-way
switch "± sd: unter Wert | eigene Spalte | aus" (default "unter Wert": sd in small muted text below
the mean). Defaults: the primary metric plus the first `real` metric of the catalogue (if the primary
metric is itself `real` or no `real` metric exists, only the primary metric); `n` and `Status` on;
`min`, `max` off. Choices are remembered per project in browser storage.

**Table head:** two rows — a group row "Parameter (<split count>)" | "Metriken (<visible>/<total>)",
then the column names. No menus in the head; all dimension control lives in the sidebar.

**Overview strip** (toggle "Überblick", shown by default): one small card per axis and one for the
channel, sorted by spread (largest first). Each card lists the axis values with the mean of the sort
metric (dot, best in `best`, others `series-1`) and ± sd (bar), averaged over all other dimensions
under the current filters, on one shared scale; header shows "Spanne <max − min>". Last card: a
histogram of all group means (best bin in `best`). Click on a value in a card → the same as ticking
that value in the sidebar.

**Edge cases:**
- Run without `channels` or with one channel → no "Kanäle" section, no channel card.
- Paired axis (list of dicts in `sweep:`) → one dimension with the label as value, e.g.
  `learning_rate=0.0005, max_epochs=20`.
- Migrated run (`meta.json: migrated: true`) → works the same; `config.yaml` may lack keys, then
  "Konstante Werte" shows what exists.
- Group whose cells all failed → metric cells show "–", sorted last.

**In the prototype:** `D5-Kombination.dc.html` (copied as `Main.dc.html`), sample data and
aggregation in `exp-data.js` (`aggregate`, `sortRows`).
**Rejected:**
- D1 · header menus: clean, but the state of hidden dimensions is easy to lose; its sidebar idea is kept.
- D2 · checkboxes "Gruppieren nach": value selection kept, flat lists get long with many axes.
- D3 · Pivot zones: least natural; only "sd under the value" is kept.
- D4 · charts first: the charts are kept as the overview strip, not as the main layout.

## Changes to principles.md / tokens.json
- Create both: colours and their meanings from feature A.

## Out of scope
- Light theme
- Creating configs and starting runs from the tool (idea for a later update, synced with the folders)
- Overview as a separate view mode (only the toggleable strip in this update)

## Open
- States per view: if a view's block does not define one, then hover = `raised`, focus = 2 px `accent` outline, disabled = `text-3`, loading = muted placeholder rows.
