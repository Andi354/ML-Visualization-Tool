# v0.2.1 · Beschreibung

Issue: TIM-93 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent", section "v0.2.1 · Beschreibung"
Prototype: prototype/ · Builds on: v0.2.0

## State

| Block | Status |
|---|---|
| G · Short description in Läufe | decided |
| H · Description in the run tab | open |

Running block: none.

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

## Changes to principles.md / tokens.json

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

## Open
