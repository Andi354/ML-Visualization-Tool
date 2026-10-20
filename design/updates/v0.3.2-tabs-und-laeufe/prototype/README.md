# Prototype v0.3.2 · Tabs und Läufe

Frozen from the design canvas (https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen",
section "v0.3.2 · Tabs und Läufe"). Numbers and texts are made up and are never taken over. What the
prototype binds and where the real tool wins is in the spec, section "How to read this spec".

## Run it

```
cd design/updates/v0.3.2-tabs-und-laeufe/prototype
python3 -m http.server 8802
```

Open a file below as `http://localhost:8802/<file>` at **1440 × 860** and wait about 2 seconds.
`file://` does not work. `support.js` is the canvas runtime (`dc-runtime.js`, includes React).

## Where each feature is

| Feature | Open | How to get there |
|---|---|---|
| M · Paged groups table | `M3-Seiten.dc.html` (component `M-Lauf.dc.html`) | pill "Zeilen 1–200 von 2 592" in the toolbar; pager under the table (scroll down): page numbers, ‹ ›, "200 pro Seite" |
| N · Tab menu and pinning | `N3-Anheften.dc.html` (component `N-Tabs.dc.html`) | menu is open on start; right-click any tab; Anheften / Lösen; close entries → toast with Rückgängig; right-click "Läufe" |
| O · Project symbol | `O2-Popover.dc.html` (component `O-Projekt.dc.html`) | popover is open on start; click the symbol top left to toggle; rows under Einstellungen › Läufe & Experiment › Projekt; "Aus project.yaml" |
| P · Läufe list | `Prototyp-03.dc.html` start state (component `L-Liste.dc.html`) | overview tiles, filter chips, issue heads fold on click, round check on a card → compare bar |
| P · Läufe issues | `Prototyp-03.dc.html`, "Issues" in the Läufe head (component `L-Issues.dc.html`) | issue list left, cards right |
| Q · Widget header, config title | `Q1-Widgets.dc.html` | "+5 weitere" in the FEST line; `null` column and value |
| R · New style everywhere | `Prototyp-03.dc.html` | every area: Läufe, a run ("Öffnen"), Analyse in the rail, gear for settings, ✦ agent, Ctrl+P palette, status bar and bell |

The `R-…` files are the earlier components (run tab, table, widgets, analysis, templates, settings) with
only colours, radii and the scrollbar changed; their `R-…js` data files likewise.

## Known quirks of the prototype

- The overall prototype's frame (tab row, search box, status bar) and the run tab are older than the
  tool on `main` (v0.3.1.1); the tool wins there, see the spec.
- The overall prototype has neither the tab menu (N), the project popover (O) nor the pager (M); they
  are in their own files above.
