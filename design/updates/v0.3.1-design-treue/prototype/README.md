# Prototype v0.3.1 · Design-Treue

The overall prototype after v0.3.0, frozen from the design canvas
(https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen"). It is the target look
of the whole product. Numbers and texts are made up and are never taken over.

## Run it

```
cd design/updates/v0.3.1-design-treue/prototype
python3 -m http.server 8801
```

Open `http://localhost:8801/Prototyp-03.dc.html` at **1440 × 860** and wait about 2 seconds until it has
rendered. `file://` does not work (the browser blocks loading the components). `support.js` is the canvas
runtime (`dc-runtime.js`, includes React); the `.dc.html` files are HTML, CSS and a small logic class each.

Start file: `Prototyp-03.dc.html`. `E2-Rand.dc.html` is opened on its own (see H).

## Where each feature is

| Feature | How to get there | Files |
|---|---|---|
| F · Frame | start state: icon rail (rail icons Läufe, Analyse, gear, ✦ Agent), tabs, search box on top, status bar at the bottom | `Prototyp-03.dc.html`, `frame.js`, `notify-data.js` |
| F · Status bar states | gear first (the Läufe list covers the status bar, see below), then: left part → running runs; bell → notifications; the dashed switch "Prototyp: Ereignis" shows each event (done, many errors, stalled) | `Prototyp-03.dc.html`, `notify-data.js` |
| G · Läufe list | start state; "Liste" | `G2-EigeneZeile.dc.html`, `runs-data.js`, `short-data.js` |
| G · Issue view | "Issues" in the Läufe header | `F-Issues-021.dc.html` |
| H · Run tab | "Öffnen" on the newest run (or any run) → tab with config rail, description, overview, groups table, notes column on the right | `P-Run-03.dc.html`, `desc-data.js`, `exp-data.js`, `notes-data.js` |
| H · Config as blocks / YAML | run tab → config in the left rail | `J1-Bloecke.dc.html`, `J4-YAML.dc.html`, `cfg-data.js` |
| H · Notes at sections and rows | open `E2-Rand.dc.html` on its own: ✎ markers and "+ Notiz" at description sections and group rows, agent proposal with Speichern / Bearbeiten / Verwerfen | `E2-Rand.dc.html`, `notes-data.js` |
| I · Analysis | rail icon Analyse → scope "Ein Lauf", "Zwei Läufe", "Projektverlauf"; "Vorlage …", "+ Widget", "Einstellen" on a widget | `P-Analyse-02.dc.html`, `G-Vorlagen.dc.html`, `W-Widget.dc.html`, `E1`–`E4`, `cmp-data.js`, `one-data.js`, `f-data.js`, `g-shared.js` |
| J · Agent window | open in the start state; ✦ in the rail toggles it; mode switch at the bottom (Shift+Tab); + new chat, − minimise | `Prototyp-03.dc.html` |
| J · Voice input | mic in the agent input (or Ctrl+M) → recording bar "Hört zu"; stop → review box with recognised terms | `Prototyp-03.dc.html`, `voice-data.js` |
| K · Settings | gear in the rail (or Ctrl+,) → settings tab: categories, search (`/`), "Geändert n", "★ Voreinstellungen", undo / redo, rows with controls | `S1-Einstellungen.dc.html`, `settings-data.js` |
| L · Command palette | search box on top, or Ctrl+P (runs and issues), Ctrl+Shift+P or `>` (commands) | `Prototyp-03.dc.html`, `palette-data.js` |

## Known quirks of the prototype

- In the Läufe view the list runs under the status bar, so the status bar is only partly visible. The real
  tool keeps the status bar always visible (v0.3.0 spec, D); look at it in the settings tab.
- One console error about an icon placeholder (`{{c.icon}}`) in the settings rail; no visible effect.
- Widget header and config title of v0.2.4 (TIM-97) show here already; they are not part of v0.3.1.
