# Prototype v0.2.0 · Agent

Clickable prototype from the design canvas (https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f,
page "v0.2 · Agent"). The files are canvas components (`.dc.html`); they run on the canvas, which
provides `support.js`. Start: `Prototyp-02.dc.html` (the whole product after v0.2). All numbers and
agent answers are made up; the spec wins where the prototype differs (see "Prototype notes" in
`../spec.md`).

| File | Feature | Role |
|---|---|---|
| `Prototyp-02.dc.html` + `frame.js` | A, C, F (+ v0.1 B) | frame with the agent window: chats, context and cache, modes, undo, pre-send hint, stop |
| `P-Analyse-02.dc.html` → `G-Vorlagen.dc.html` | D, E | analysis "Ein Lauf" with templates, widget width and order |
| `C1-Direkt`, `C2-Gemischt`, `C3-Bestaetigen` (`.dc.html`) | C | the same example chat in each mode (separate artboards) |
| `D1-Vorlagen.dc.html` | D | templates driven by the agent (separate artboard) |
| `E1-Eigene.dc.html` | E | own widgets: draft from the agent, keep, catalog "Eigene" (separate artboard) |
| `F-Runs`, `F-Issues`, `P-Run` → `F-Exp`, `E4-Analyse` + `E1-Duell`/`E2-Abgleich`/`E3-Verlauf`, `J1-Bloecke`, `J4-YAML`, `W-Widget` | v0.1 | unchanged from v0.1 |
| `runs-data.js`, `exp-data.js`, `cmp-data.js`, `one-data.js`, `f-data.js`, `cfg-data.js`, `g-shared.js` | – | sample data, widget catalog |
