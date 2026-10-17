# v0.3.0 · Einstellungen

Issue: TIM-96 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen"
Prototype: prototype/ · Builds on: v0.2.4

## State

| Block | Status |
|---|---|
| A · Settings screen (content and frame) | running: S1 on the canvas, waiting for Tim |

Running block: A. Tim: look like the Agent-Dashboard settings (VS Code-like); include the agent debug
toggle (TIM-95) and appearance. On the canvas: A1 (`S1-Einstellungen.dc.html`, data `settings-data.js`):
category rail (Darstellung, Läufe & Experiment, Analyse & Widgets, Export, Agent, Daten & Erweitert, Über),
search `/`, "Geändert n" filter, presets, undo/redo, reset per row, only changed values stored in
`.mlviz/settings.json`. Waiting for Tim's feedback on contents and look.

## Goal
One place in the tool to see and change how it behaves for a project.

## Today (from the code on main, v0.2.2)
- Environment only: `MLVIZ_PROJECT_PATH`/`MLVIZ_PROJECT`, `MLVIZ_HOST`, `MLVIZ_PORT`, `MLVIZ_CLAUDE` (path to `claude`), `ANTHROPIC_API_KEY` (agent bills the API when set).
- Stored per project in the browser (`storageKey`): frame, agent window, columns, config view mode, description folds, analysis view, colour-by (Lauf-Merkmal), boards and templates.
- Fixed in code: agent cache TTL (1 h / 5 min), pre-send threshold 50 000 tokens, default agent mode Gemischt, export palette light.
- Deferred since v0.1: where the default Lauf-Merkmal is configured.

## Features

## Changes to principles.md / tokens.json

## Out of scope

## Open
