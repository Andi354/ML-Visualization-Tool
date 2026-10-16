# v0.2.1 · Beschreibung

Issue: TIM-93 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent", section "v0.2.1 · Beschreibung"
Prototype: prototype/ · Builds on: v0.2.0

## State

| Block | Status |
|---|---|
| G · Short description in Läufe | open |
| H · Description in the run tab | open |

Running block: none. Tim's last word: short description in the runs screen so the reason for a run is
clear at a glance; a longer description with several fields in the run tab. Format: comment
"Entscheidung: Format der Beschreibung pro Lauf" on TIM-93.

## Goal
Each run says why it was made: in one line in Läufe, in full in its tab.

## Features

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
