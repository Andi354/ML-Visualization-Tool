# v0.2.1 · Beschreibung

Issue: TIM-93 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent", section "v0.2.1 · Beschreibung"
Prototype: prototype/Prototyp-02.dc.html (see prototype/README.md) · Builds on: v0.2.0

## Goal
Each run says why it was made: in one line in Läufe, in full in its tab.

## Features

### G · Short description in Läufe
**What:** A run with a description shows its `short` as its own line in the runs screen, between the
run name and the axes line, in normal sans text and brighter than the axes. Runs without a description
look exactly as in v0.1. The same line appears in the view "Issues".
**Behaviour:**
- Läufe · Liste, run with description → row has three lines: name + flags (mono 13 px), `short` (IBM Plex Sans 13 px, colour between `text` and `text-2`, e.g. `#C9D3E3`), axes · extras (mono 11 px `text-3`) as before.
- Läufe · Liste, run without description (`has["description"]` false or `short` empty) → row as in v0.1 (name, axes).
- `short` longer than the column → one line, cut with "…"; hover → tooltip with the full text.
- `short` longer than 100 characters in the file → the tool cuts it to 100 characters + "…" (as the TIM-93 comment says); the tooltip shows the cut text.
- Läufe · Issues, run row inside an experiment card → `short` as the first line of the middle column, the tags (Kurven, Vorhersagen, migriert …) below it.
- Older runs folded under "▸ n ältere Läufe" → each shows its own `short` when opened.
- Search field in Läufe → also matches the text of `short`.
- Agent (v0.2, C): the search tool also matches `short`, `purpose` and `shows`.
**In the prototype:** `G2-EigeneZeile.dc.html` (list, used by the overall prototype), `F-Issues-021.dc.html` (view Issues); sample texts in `short-data.js`.
**Rejected:** G1 (short instead of the axes line): loses the axes at a glance. G3 (short in the name line): too little room, competes with the flags. G4 (short as the main line): not built; the name stays the identity of a run.

### H · Description in the run tab
**What:** In a run tab, the area right of the sidebar becomes one scroll column: first the run's
description, then the overview graphs, then the toolbar and the table. Description and overview can
each be folded to one line. While scrolling, the toolbar and the table header stick to the top, so
filters and column names stay visible deep in long tables. The detail panel (640 px) stays beside the
scroll column as in v0.1.
**Fields** (fixed order, labels in the UI; empty optional fields are left out):

| Field | Label | Shown as |
|---|---|---|
| `short` | – | the folded line next to "BESCHREIBUNG" |
| `purpose` | Zweck | paragraphs (one per line break), widest column |
| `shows` | Soll zeigen | bullet list |
| `expectation` | Erwartung | paragraph |
| `notes` | Notizen | bullet list |
| `compare_to` | Vergleichen mit | run chips below the columns |

**Behaviour:**
- Open a run with a description for the first time → description unfolded: a line "BESCHREIBUNG · <short> · zuklappen ▴", below it the fields side by side (Zweck 1.5 parts, every other field 1 part), below that the "Vergleichen mit" chips.
- Click the description line → it folds to that one line ("aufklappen ▾") or unfolds again; the state is stored per run (like the frame state) and used the next time the run is opened.
- Run without description (`read_description` returns `None`) → no description block; the column starts with the overview.
- `problems` not empty → a `warn` box "Beschreibung unvollständig: <problems joined by ' · '>" above the fields; all readable fields are still shown.
- Click a "Vergleichen mit" chip → that run opens as a tab (or gets the focus if already open). A name `list_runs` does not know → chip struck through in `text-3`, not clickable, tooltip "<name> · nicht gefunden".
- Overview: own line "ÜBERBLICK · zuklappen ▴" above the graphs; click → folds / unfolds; the toolbar button "Überblick" toggles the same state (as in v0.1, remembered as in v0.1).
- Scroll the column → description and overview scroll away; the toolbar (filter chips, Überblick, Spalten, summary) sticks at the top of the column, the table header (both header rows) sticks right below it. Horizontal scrolling of wide tables happens in the same column.
- Text is plain: no Markdown is rendered (e.g. `**x**` shows as typed).
**Edge cases:** Very long `purpose` → the description block grows; it scrolls with the column, no inner scroll. `short` missing but other fields present (a problem case) → the folded line shows "Beschreibung" without text.
**In the prototype:** `P-Run-021.dc.html` → `F-Exp-H4.dc.html` (`DescData.view`, `descOpen`, `toggleDesc`, `ovToggle`, sticky toolbar and `thead`); artboard `H4-Scroll.dc.html`. The demo switch "mit Beschreibung | mit Problemen | ohne" (dashed, top right) exists only in the prototype.
**Rejected:** H2 (section in the sidebar): 270 px too narrow for paragraphs. H3 (header button + 520 px panel): easy to overlook, an extra click. H4 as separate sub-tab: description and results never visible together. H1 as a fixed strip above an independently scrolling table: unfolded it took table height; replaced by the shared scroll column.

## Changes to principles.md / tokens.json
- none (the sticky toolbar and table header follow the existing rule "secondary information folds away")

## External data
- `description.yaml` in the run folder, optional; a run without it stays valid (the 35 migrated
  repnet-bench runs have none). Read only through `ds-store`, never the file directly.
- Fields: `short` (required, one line, ≤ 100 characters), `purpose` (required, text, line breaks =
  paragraphs), `shows` (required, list of short entries), `notes` (optional, list), `expectation`
  (optional, text), `compare_to` (optional, list of run names as returned by `list_runs`). Plain text,
  no Markdown, no results; language = the project's report language.
- `list_runs(runs_root)` returns per run `short` and `has["description"]`; `read_description(run_dir)`
  returns `None` without a file, else the fields and a list `problems`.
- `ds-store` provides these functions only after TIM-71 (migration) is done. `store_version` stays 1.

## Out of scope
- Editing descriptions in the tool (read only; descriptions are written by the project's agents/ds-init).
- Descriptions for the 35 migrated repnet-bench runs (none exist; nothing is added).
- Markdown in description texts.
- A description in the analysis area or in exports.

## Prototype notes
- The prototypes load the sample data in the host page (`Prototyp-02`, `H4-Scroll`) because embedded canvas components do not load their own scripts; the real tool reads through `ds-store`.
- The overall prototype shows descriptions for the run tab of `TIM-52_best_combined_90` only; every other run uses the same sample.
- The prototype toolbar has a fixed height (49 px) for the sticky offset; the tool should measure it.

## Open
- `ds-store` functions (`list_runs` with `short`, `read_description`) arrive with TIM-71: if they are not available yet when implementing, then build against the documented shapes with fixtures and treat a missing function as "no description" at runtime.
