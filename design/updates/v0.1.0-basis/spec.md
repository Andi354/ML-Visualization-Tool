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
| E · Analysis: two runs + project history | decided | row "Feature E", E4 ✓ |
| F · Detail | open | – |
| G · Analysis: one run + saving deliverables | running | row "Feature G", G1–G3 (no choice yet) |
| H · Agent (optional) | open | – |

**Running block G · Analysis for one run + saving deliverables**
- From E (Tim): a deliverable is a widget, not the whole board. "Als Deliverable speichern" needs a
  preview and a choice of which widgets are saved. Default format image; several widgets may be
  combined into one image. Deliverables today: images + the configs they were built from; Tim wants
  one image that shows exactly what is needed (supervisor meetings).
- Tim on widget tech: most widgets are not Plotly charts (tables, verdicts, chips) → widget format
  decided in H.
- Tim's examples (14.10.): (1) model comparison table: forecasters (REP-Net, SARIMA, ETS, ETS damped,
  Prophet, sNaive) × pred_len 30/90 × MAPE/Commitment Cost, best per column green, plus the winner's
  config with per-pred_len differences; forecasters are trained inside one run (axis). (2) forecast
  plot for one region and window with holidays + error panel — project-specific, later as an
  agent-built project widget. (3) per-region table multivariate vs univariate + best combo per scope.
  (4) per-region grouped bars. (5) dataset CV folds — dataset analysis, later. Look may be simpler and
  nicer than the examples; one format per kind of graphic.
- Derived generic widgets for one run: comparison table (rows = one dimension, column groups = another
  dimension or Lauf-Merkmal, columns = metrics, best per column); per channel (table | bars, series =
  values of one dimension); best config card (with differences); effect per axis; stability over
  replicates; forecast plot only where predictions exist (F). Each widget = one deliverable image with
  editable key-statement title, automatic subtitle (run, metric, pred_len, replicates) and footer.
- Later concepts: project-specific widgets (e.g. holiday plot) living in the project; dataset analysis.
- Alternatives on the canvas (Tim: "Ja, bitte bauen"); shared widget component `W-Widget` (types
  table, channel, config, effect, stability; dark/light), catalog + controls in `g-shared.js`, sample
  run in `one-data.js` (TIM-52 model comparison: forecaster × pred_len × features, 4 regions):
  - G1 · board: tiles in two columns, per tile "Einstellen" (rows/column groups, series, table|bars)
    and remove; "+ Widget" from the catalog.
  - G2 · builder: left type → settings → key statement; right live preview; "Zum Board hinzufügen".
  - G3 · deliverable first: widgets stacked as export-ready cards on the chosen background, editable
    title, "Bild speichern" per card, select several → "Ausgewählte speichern".
  - Save dialog (all): widget checklist (one widget = one image, file names), background light
    (for slides) or dark, configs yes/no, path + linked issue, large preview of the focused widget.

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

### E · Analysis (two runs, project history)
**What:** One analysis area ("Analyse", one icon in the frame's icon bar) built from widgets. A widget
answers one question and declares its scope: one run (block G), two runs, or all runs of the project.
A *board* is a set of widgets on one scope; this block covers the views "Zwei Läufe" and
"Projektverlauf". Saving widgets as deliverables is specified in G.

**Board as data (requirement for H):** a board is a declarative description — scope, runs, widgets
with their settings — that the tool only renders; widgets come from a documented catalog (key,
scope, settings, the question it answers). The tool and, later, the agent create boards the same way.
In v0.1 boards are created in the UI only; the catalog is fixed, every widget can be shown/hidden and
the selection is remembered per project.

**Terms:** *Lauf-Merkmal* = a config entry that is constant inside a run but differs between runs
(repnet-bench: `data.pred_len`; elsewhere e.g. dataset, forecaster). The tool proposes candidates by
comparing the resolved configs of all runs (entries with few distinct values across runs). Where the
default is configured (project.yaml or in the tool) is deferred. Epoch is not a Lauf-Merkmal: it is a
comparability guard.

**Header:** "Analyse /" + view switch "Zwei Läufe | Projektverlauf"; scope controls (two runs: A and B
with colour dots, A = series 1 `#1FA3A3`, B = series 5 `#8C7CF0`; project: "Färben nach
Lauf-Merkmal" with the detected candidates plus "keins"); right: "Widgets · n von m" menu and
"Als Deliverable speichern" (see G).

**Entry points:** two runs ticked in Läufe → "Vergleichen"; in a run tab "Vergleichen mit …";
"Projektverlauf" from the Analyse icon. Comparing 3+ runs is out of scope for v0.1.

**Widgets "Zwei Läufe"** (default on unless marked optional):
- *Config-Unterschiede:* chips for every config entry that differs (`data.pred_len 30 → 90`, code
  commit). If a Lauf-Merkmal differs, a `warn` note: absolute values are not fairly comparable, rank
  and effect are.
- *Wer gewinnt wo?* one row per metric of the catalog: value A, value B (better one in `best`), and a
  diverging bar from the centre towards the better run, length = relative gap; switch "Bester Wert |
  Median" (best combination vs. median over all combinations); verdict sentence ("B ist bei 3 von 4
  Metriken besser. Nicht eindeutig: A gewinnt bei 1."). Scaled metrics are marked; they are hidden
  when the runs have different forecasters.
- *Beste Config je Lauf:* for A and B the best combination (mean over replicates) as `axis = value`
  chips, its value, and its value and rank in the other run; rank ≤ 3 `best`, rank > 10 `warn`.
- *Alle Kombinationen:* strip plot per run on a shared axis, one dot per combination, best enlarged
  with ring, median tick.
- *Regionen:* per channel two bars (A, B) for the best combination and the relative difference.
- *Umfang und Fehler:* cells, errors (`error` when > 50), duration, pred_len and epoch per run.
- optional *Wirkung je Parameter:* per axis value its effect in A and B (mean MAPE of combinations
  with this value vs. the run mean, in %) as a dumbbell on −8 … +8 %; "kippt" (`warn`) when the
  sign flips and both |effect| > 1.5 %; sort by axis or by difference; headline sentence.
- optional *Hält die Rangfolge?* scatter rank in A vs. rank in B with diagonal; Spearman, top-5
  overlap, rank of A's best in B.
- optional *Größte Rangsprünge:* the 7 combinations with the largest rank change.
- Combinations are matched by their axis values; only combinations present in both runs count; the
  header shows "n von m Kombinationen in beiden Läufen".

**Widgets "Projektverlauf":**
- *Bester Wert je Lauf:* x = run date, y = best value of the primary real metric; one series per value
  of the chosen Lauf-Merkmal (series colours), line = best so far per series; runs of another epoch
  hollow and excluded from the line; label = issue key; click toggles the run for the map.
- optional *Parameter-Landkarte:* rows = axis values, columns = selected runs grouped by Lauf-Merkmal;
  cell = effect relative to that run's mean (diverging: lower error `#1FA3A3`, higher `#C47F14`,
  opacity by size, cap ±6 %); dashed empty cell when the axis is not varied in that run;
  "Konsistenz" column per Lauf-Merkmal value ("immer besser", "2× besser, 1× schlechter"),
  `warn` when the direction flips between values; headline sentence.

**Edge cases:** runs without shared axes → effect/rank widgets show "Keine gemeinsamen
Kombinationen"; different epochs → `warn` in Config-Unterschiede and comparisons stay possible but
flagged; a run still running → values marked "vorläufig"; project without a Lauf-Merkmal → one series.

**Rejected:** E1 alone (no project context), E2 as its own view (hard to read; its widgets stay
optional), E3 alone; widgets laid out as two full experiment screens side by side.

## Changes to principles.md / tokens.json
- Create both: colours and their meanings from feature A.

## Out of scope
- Light theme
- Creating configs and starting runs from the tool (idea for a later update, synced with the folders)
- Overview as a separate view mode (only the toggleable strip in this update)

## Open
- States per view: if a view's block does not define one, then hover = `raised`, focus = 2 px `accent` outline, disabled = `text-3`, loading = muted placeholder rows.
