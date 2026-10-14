# v0.1.0 · Basis

Issue: TIM-82 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.1 · Basis"
Prototype: prototype.dc.html · Builds on: nothing (first update)

## Goal
A local results tool for ds-init projects that replaces "open CSV, sort, scroll, ask an agent for a
deliverable": runs, experiments, comparisons, details and deliverables, read directly from `runs/`.

## State
_Working record for the design session; removed at handover._

| Block | Status | Canvas (page "v0.1 · Basis") |
|---|---|---|
| A · Design system | decided | row "Feature A", A5 · Schiefer ✓ |
| B · Frame | decided | row "Feature B", B2 ✓; overall prototype row "Gesamtprototyp" |
| C · Runs | decided | row "Feature C", C4 ✓ default, C3 ✓ view "Issues" |
| D · Experiment | decided | row "Feature D", D5 ✓ |
| E · Analysis: two runs + project history | running | row "Feature E", E1–E3, E4 = combination (no choice yet) |
| F · Detail | open | – |
| G · Analysis: one run + saving deliverables | open (next after E) | – |
| H · Agent (optional) | open | – |

**Running block E · Comparison**
- Tim's last word: so far he only picked "the best config" inside one run; he wants context across
  runs: e.g. pred_len 30 vs 90 — which config entries matter and how much, where an effect flips
  (lstm_layer good at 30, bad at 90); and how the project developed. Asked for E1–E3, "be creative".
- Alternatives on the canvas (shared sample data `cmp-data.js`, effects designed to flip with pred_len):
  - E1 · two runs: config diff strip + horizon warning; "who wins where" per metric (best / median,
    diverging bars); best config of each run and its rank in the other; strip plot of all combos;
    regions per channel; size and errors.
  - E2 · matched comparison: "effect per parameter value" dumbbell (relative to run mean, so
    horizons compare), flips flagged, auto headline; rank-vs-rank scatter with Spearman, top-5
    overlap, rank of A's best in B; biggest rank jumps.
  - E3 · project history: best value per run over time (series per pred_len, best-so-far line, other
    epoch hollow, click toggles a run) + parameter map: axis value × selected runs, diverging cells,
    consistency per horizon, auto insight.
- Tim's feedback: E1 good ("auf einen Blick alles sichtbar"); E2 hard to read, at most optional
  widgets; E3 timeline good, parameter map "also a good widget". Direction (his): area Vergleich with
  two views, "Zwei Läufe" (E1 widgets + optional E2 widgets) and "Projektverlauf" (timeline + map);
  3+ runs later. Widgets should be extensible; agent-configurable widgets later (block H / later).
  Open concept to formalise: what splits the timeline when a project has no pred_len.
- "Lauf-Merkmal" accepted as name; where it is configured (project.yaml vs. in the tool) deferred.
- Tim's last word: comparison and deliverables look like the same thing — widgets on runs; asks
  whether to build one "analysis tool" (one run, two runs, project history) so work is not doubled.
- Decided: E and G merge into one area "Analyse": one widget system, widgets declare their scope
  (1 run / 2 runs / all runs); a board = widgets on a scope, live; "Als Deliverable speichern" freezes
  a board into `deliverables/<date> <title>/` (export + numbers + runs/commit); existing deliverable
  folders listed read-only; D stays the table view of one run; icon bar: one entry "Analyse".
- Tim's last word: wants later to tell the agent e.g. "bau eine Analyse aus den heutigen Läufen,
  Laufvergleich 30 vs 90" and have it pick the widgets; agent part deferred to H, but the design
  must allow it. Consequence (proposed): a board is a declarative file (scope, runs, widgets with
  params), widgets come from a documented registry; the tool only renders boards.
- Deliverables today: images plus the configs they were built from; agents used to produce ~10 files,
  Tim wants one image that says exactly what is needed (for supervisor meetings). Saving can be less
  restrictive since Tim sees the widget first; default format image; several widgets may be combined
  into one image.
- Block split (Tim): E = analysis for two runs + project history (E4); G = one-run widgets and the
  deliverable saving, same analysis tool; only then into the overall prototype.
- E4 on the canvas: area "Analyse" with views "Zwei Läufe" (E1 widgets default, E2 widgets optional)
  and "Projektverlauf" (timeline default, parameter map optional); "Färben nach Lauf-Merkmal"
  (pred_len / keins); widget menu with the question each widget answers; "Als Deliverable speichern"
  dialog (title, one image or one per widget, board file + configs, path, linked issue).
- Tim's idea for later (H or later): agent writes new widgets inside the tool. Feasible if widgets are
  declarative chart specs (e.g. Vega-Lite / Plotly JSON) over a documented data API; code widgets
  would need the agent outside the tool.

**Working notes**
- Overall prototype: one artboard `Prototyp` (= B2 frame, logic in `frame.js`) embedding the content
  pages `F-Runs` (C4), `F-Issues` (C3), `F-Exp` (D5); sample data in `exp-data.js`, `runs-data.js`
  (issues real from Linear, numbers made up). New views get their own `F-*` page.
  Content pages are mounted with `dc-import` (the canvas does not render iframes); `exp-data.js`
  seeds its sample numbers by run id so open run tabs differ. Known prototype gap: filters/grouping
  are shared across run tabs (the spec requires per-tab state).
- Tim wants token-saving prototypes: shared data files, derive variants instead of rewriting.
- Later-update idea: create configs and start runs from the tool.

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

### B · Frame
**What:** The app shell around all views, like VS Code: a narrow icon bar on the left for the areas,
a tab strip on top for open runs, the agent as a right-hand panel. One tool instance per project;
the project's short name sits at the top of the icon bar, there is no project switcher.

**Layout:**
- Icon bar, 52 px, `surface`, right border `line`. Top: project badge (two letters, mono, tooltip =
  project name). Then areas Läufe, Vergleich, Deliverables (18 px line icons, 36 px buttons). Bottom:
  Agent toggle. Active area: `accent` icon on `accent-bg` with `accent-line` border; others `text-3`.
- Tab strip, 36 px, `surface`, bottom border `line`. First tab is pinned and shows the current area
  (Läufe / Vergleich / Deliverables), no close button. Then one tab per opened run, label = run folder
  name without the timestamp (full name as tooltip), mono 12 px, close `×`. Active tab: `bg` fill,
  2 px `accent` top border, `text`; inactive `text-3`.
- Content fills the rest. Each view keeps its own header row (breadcrumb, view switches, actions)
  as designed in C and D.
- Agent panel, 340 px, right, `surface`, left border `line`; header "Agent" + close. Content: block H.

**Behaviour:**
- Clicking a run (name or "Öffnen") in Läufe opens it in a new tab and focuses it; if a tab for that
  run is already open, it is focused instead. Several runs can be open at once; switching tabs keeps
  each run's state (filters, grouping, sort, scroll).
- Closing the active tab focuses the tab to its left (or the pinned tab).
- Clicking an area icon switches the pinned tab to that area and focuses it; open run tabs stay.
- The Läufe area remembers its view (Liste or Issues).
- Agent toggle opens/closes the panel; content keeps its width minus 340 px. The panel stays open
  across tab switches.
- Open tabs and the active tab survive a reload (stored per project in the browser).
- Middle click on a run tab closes it. No custom tab shortcuts: the tool runs in a browser, where `Ctrl+W` / `Ctrl+Tab` belong to the browser.

**Edge cases:**
- Many tabs: tabs shrink to min 120 px with ellipsis, then the strip scrolls horizontally.
- A run folder deleted while its tab is open: tab stays, content shows "Lauf nicht mehr vorhanden"
  with a close button.
- Areas not built yet in an update are not shown in the icon bar.

**Rejected:** B1 path only (no way to keep several runs open), B3 top tabs + command palette
(palette adds little with a short run list; tabs for areas instead of runs).

### C · Runs
**What:** The start page of the tool. It replaces clicking through `runs/` in VS Code: every run of
the project, structured by Linear issue and experiment, newest first, with the key facts of each run
visible without opening it. Two views of the same data, switched in the header next to "Läufe":
"Liste" (default) and "Issues".

**Terms and sources:** *issue* = prefix of the config name (`configs/experiments/<ISSUE>/<ISSUE>_<slug>.yaml`,
also in `meta.json`); *experiment* = one config = run folder name without the timestamp; *run* = one
folder in `runs/`. Issue title and status come from Linear through an optional API key in the
environment; without a key only the issue ID is shown. Analyses (`analysis/<ISSUE>_*/`) and
deliverables (`deliverables/`) are linked to an issue by its ID; paths come from `project.yaml`.

**Header and toolbar (both views):** breadcrumb `<project> / Läufe`, view switch "Liste | Issues".
Toolbar of the list view: search, status filter "Alle | Läuft | Mit Fehlern", epoch filter
"Alle Epochen | <epochs from epochs.yaml>", toggle "Verlauf" (collapsed by default), count
"<shown> von <total> Läufen", button "Vergleichen".

**List view (default):**
- On top, a card "Neuester Lauf · <relative time>": full run name, issue line, cell progress bar,
  best value of the first `real` metric ("bester MAPE bisher · pred_len 30"), button "Öffnen".
  Hidden while a search or status filter is active.
- Below, blocks sorted by their newest run: an issue block per issue, and runs without an issue as
  standalone rows at their own date (no "ohne Issue" group at the bottom).
- Issue block head: caret, issue ID, title (15 px), status dot + Linear status, links "Bericht" /
  "Deliverables" when they exist, "<n> Läufe · <relative time>". No box around the block; a rule
  under the head.
- One row per experiment, showing its newest run, two lines: name (config slug without issue
  prefix) with flags only for deviations ("● läuft" accent, "Epoche <old>" warn); second line muted:
  swept axes, then available extras (Kurven, Vorhersagen, migriert); standalone rows start with
  "ohne Issue". Columns: checkbox, name, relative date, cell bar (ok grey, errors `error`, running
  `accent`) with "<cells> Zellen · <errors> Fehler" or "<done> / <total>", best value with "MAPE ·
  pred_len <h>" (muted and "vorläufig" while running).
- Experiment with several runs → "▸ <n> ältere Läufe" under the name; click → older runs appear
  below, indented and dimmed, named by their timestamp.

**Issues view:** two columns. Left: search and the list of issues (status dot, ID, relative time,
title on up to two lines, "<n> Läufe · <status>", "● läuft" when a run is running), same order as
the list view; runs without issue as an entry "Ohne Issue". Right: the selected issue — ID, status,
links ("In Linear ↗", "Bericht", "Deliverables"), title (20 px), four figures (runs, cells with
errors, best MAPE for pred_len 30 and 90), then one card per experiment with all its runs (date,
timestamp, flags, cell bar, best value, "Öffnen"). Initial selection: the issue of the newest run.

**Behaviour:**
- Open the tool → list view, issues with a run in the last 7 days expanded, others collapsed.
- Click on an issue head → expands / collapses it.
- Search → matches run name, issue ID, issue title and axis names; all matching issues expand.
- Status filter "Läuft" / "Mit Fehlern" → only matching runs; their issues expand.
- Click on a run name, a row or "Öffnen" → the experiment view (feature D) of that run.
- Tick two or more checkboxes → "Vergleichen (<n>)" becomes active and opens feature E with them.
- Click "Verlauf" → a strip opens above the list: best value of the first `real` metric per run over
  time, one colour per `pred_len` (`series-1`, `series-2`), step line = best so far within the
  current epoch, dashed line at the epoch start, runs of older epochs at 40 % opacity; click on a
  point → its issue expands and the run row is highlighted.
- Switch "Issues" / "Liste" → the other view; search text is kept.
- A run without an end time in `meta.json` counts as running; its progress is cells written / planned.

**Edge cases:**
- Project without Linear key → issue head shows only the ID; status dot and title are left out.
- Config name without issue prefix → standalone row.
- Migrated run → "migriert" in the second line; values as stored.

**In the prototype:** `C4-Kombination.dc.html` and `C3-Zweispaltig.dc.html` (as `Main.dc.html` and
`Main-Issues.dc.html`), sample data in `runs-data.js` (`groups`, `rel`).
**Rejected:**
- C1 · Issue list: style kept; boxes per issue and seven columns were too busy.
- C2 · timeline always open: kept only as the collapsible "Verlauf".
- C3 alone as default: kept as the second view.

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

**In the prototype:** `D5-Kombination.dc.html` (copied as `Main-Experiment.dc.html`), sample data and
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
