# Prototype v0.3.0 · Einstellungen

Clickable prototype from the design canvas (https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f,
page "v0.3 · Einstellungen"). Canvas components (`.dc.html`) that need the canvas runtime
(`support.js`). Start: `Prototyp-03.dc.html` (whole product after v0.3.0). Numbers and texts are made
up; the spec wins where the prototype differs.

| File | Feature | Role |
|---|---|---|
| `Prototyp-03.dc.html` | all | overall prototype: gear and settings tab (A), voice input in the agent window (B), command palette and search box (C), status bar with bell (D), run tab with notes (E) |
| `S1-Einstellungen.dc.html`, `settings-data.js` | A | settings screen (embedded in the settings tab), all settings and presets |
| `voice-data.js` | B | the simulated recognition result (segments with terms, heard words, alternatives) |
| `palette-data.js` | C | commands, second steps, prefixes |
| `notify-data.js` | D | running runs and run events (numbers do not add up across events) |
| `P-Run-03.dc.html`, `notes-data.js` | E | run tab with the notes column and notes in the detail panel; `notes-data.js` also holds a tiny Markdown reader for the prototype only |
| `E2-Rand.dc.html` | E | the chosen variant on its own: section and row markers, agent suggestion, description with Markdown (not in the overall prototype) |
| all other files | v0.1, v0.2.x | unchanged, see the prototypes of those updates |
