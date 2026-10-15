# Prototype v0.1.0 · Basis

Clickable prototype from the design canvas (https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f,
page "v0.1 · Basis"). The files are canvas components (`.dc.html`); they run on the canvas, which
provides `support.js`. Start: `Prototyp.dc.html`. All numbers are made up; the spec wins where the
prototype differs (see "Prototype notes" in `../spec.md`).

| File | Feature | Role |
|---|---|---|
| `Prototyp.dc.html` + `frame.js` | B | frame: icon bar (Läufe, Analyse), tabs per run |
| `F-Runs.dc.html`, `F-Issues.dc.html` | C | runs list, view Issues |
| `P-Run.dc.html` → `F-Exp.dc.html` | D, F | run tab: experiment table + detail panel |
| `P-Analyse.dc.html` → `G1-Board.dc.html`, `E4-Analyse.dc.html` | G, E | analysis: one run, two runs, project history |
| `E1-Duell`, `E2-Abgleich`, `E3-Verlauf` (`.dc.html`) | E | widgets embedded by E4 |
| `W-Widget.dc.html` | E, F, G | widget component (table, channel, config, effect, stability, curves, forecast, replicates) |
| `J1-Bloecke.dc.html`, `J4-YAML.dc.html` | J | config view (Blöcke, YAML) |
| `I1-Liste.dc.html`, `I-Preview.dc.html` | I | save dialog with combining (separate artboard) |
| `runs-data.js`, `exp-data.js`, `cmp-data.js`, `one-data.js`, `f-data.js`, `cfg-data.js` | – | sample data |
| `g-shared.js`, `i-shared.js` | G, I | widget catalog and controls, combining model |
