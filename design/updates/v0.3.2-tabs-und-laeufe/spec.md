# v0.3.2 · Tabs und Läufe

Issue: TIM-109 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen", section "v0.3.2 · Tabs und Läufe"
Prototype: follows · Builds on: v0.3.1.1

## State

| Block | Status |
|---|---|
| P · Läufe-Bildschirm | decided (P5 list, P6 issues) |
| M · Große Läufe im Lauf-Tab: "x von y", mehr laden | running |
| N · Tab-Menü | open |
| O · Projektkopf in den Einstellungen | open |
| Q · Widget-Kopf und Config-Titel (design from v0.2.4) | open |

Running block M: M1 · Knopf am Tabellenende ("Weitere 200 laden", "Bis 1 000 laden"), M2 · automatisch
beim Scrollen, M3 · Seiten (200 pro Seite); all three in the run tab drawn in the new style
(`M-Lauf`, a component with prop `mode`). Counter "x von y Kombinationen geladen" in the toolbar in all
three. Default proposed: the server limit stays 1 000 rows; beyond that the tab asks to filter or group.

Style: the P5/P6 style (graphite, periwinkle accent, rounded shapes) is tried in the remaining blocks;
whether it becomes the style of the whole tool is decided after them. In the overall prototype only the
two Läufe views use it so far (`L-Liste`, `L-Issues`).

## Goal
To be written.

## Features

### P · Läufe-Bildschirm
**What:** Both views of Läufe get a new, calmer look. The list view shows three overview tiles on top
(running run, best value for each horizon) and, per issue, a grid of experiment cards; the issues view
keeps an issue list on the left and shows the chosen issue with the same experiment cards on the right.
Own scrollbar, own selection control and a floating compare bar replace the browser defaults.
**Look (new style, see "Style" below):** ground `#131315`, rail and top bar `#18181B`, cards `#1C1C20`
with border `#2A2A31` and radius 12, raised `#222227`, lines `#26262C` / `#2E2E35`, text `#EEEEF1`,
`#B0B0BA`, `#7C7C87`; accent `#8AA4FF` (selection, active controls, running); best value `#5FD4A0`;
error `#FF6B6B`. Pills (radius 16–18) for filter chips, the view switch and buttons.
**Behaviour:**
- Open Läufe → header "Läufe" with "n Läufe in n Issues · zuletzt …", switch "Liste | Issues", filter
  chips Alle / Läuft / Mit Fehlern / Diese Woche, search; below three tiles: running run (progress
  ring, name, issue, cells, "Öffnen"), best value pred_len 30, best value pred_len 90 (value in `best`
  green, run, issue, when; "vorläufig" while running).
- No run running → the first tile shows the newest finished run instead (name, issue, when, "Öffnen").
- List view → one section per issue, newest activity first, runs without issue last; head: key,
  title, status pill, "n Läufe · when"; body: experiment cards, three per row.
- Click an issue head → the section folds to its head line (meta then also says "n Experimente");
  click again → open. Default: open when the issue had a run in the last 7 days; with a filter set,
  all matching sections are open.
- Experiment card → name (mono), when ("läuft · …" while running), short description (2 lines, or
  "Keine Kurzbeschreibung" in italic grey), axes as chips (first 3, then "+n"), cell bar (done grey,
  errors red, running accent), "n Zellen · n Fehler", best MAPE with horizon; "+ n · ältere Läufe"
  when the experiment has older runs. Click the name → opens the run tab.
- Click the round check on a card → card selected (accent border and fill); bar at the bottom
  "n Läufe ausgewählt · Aufheben · Vergleichen" (Vergleichen active from 2).
- Issues view → left: issue list (status dot, key, when, "● läuft", title in two lines, run count),
  chosen issue highlighted; right: key, status pill, links Bericht / Deliverables, title, "n
  Experimente · n Läufe · zuletzt …", then the same cards, two per row.
- Long lists scroll with the own thin scrollbar (thumb `#34343C`, hover `#45454F`, no track).
**In the prototype:** `L-Liste.dc.html`, `L-Issues.dc.html` (imported by `Prototyp-03.dc.html`);
alternatives `P5-Liste`, `P6-Issues` on the canvas.
**Rejected:** P1 (only polish, still feels crowded); P3 colours (lavender) and its run rows, its layout
lives on in P6; P4 issue tiles and per-issue colours (the three overview tiles live on in P5).
