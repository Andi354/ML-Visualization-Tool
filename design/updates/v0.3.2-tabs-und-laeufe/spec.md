# v0.3.2 · Tabs und Läufe

Issue: TIM-109 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen", section "v0.3.2 · Tabs und Läufe"
Prototype: follows · Builds on: v0.3.1.1

## State

| Block | Status |
|---|---|
| P · Läufe-Bildschirm | decided (P5 list, P6 issues) |
| M · Große Läufe im Lauf-Tab: "x von y", mehr laden | decided (M3 · Seiten) |
| N · Tab-Menü | open |
| O · Projektkopf in den Einstellungen | open |
| Q · Widget-Kopf und Config-Titel (design from v0.2.4) | open |

Style: the P5/P6 style (graphite, periwinkle accent, rounded shapes) is tried in the remaining blocks;
Tim likes it in the run tab too (M). Whether it becomes the style of the whole tool is still to decide. In the overall prototype only the
two Läufe views use it so far (`L-Liste`, `L-Issues`).

## Goal
To be written.

## Features

### M · Große Läufe im Lauf-Tab
**What:** The groups table of the run tab is paged. The toolbar always says which rows are shown and
how many combinations there are; a pager under the table moves through all of them. The run tab is
drawn in the new style (see P).
**Behaviour:**
- Open a run → the table shows the first 200 combinations, sorted as today (primary metric); the
  toolbar shows "Zeilen 1–200 von 2 592" as a pill (accent tint while not all rows fit on one page,
  plain when they do).
- Run with ≤ 200 combinations → no pager; the pill says "n Kombinationen".
- Under the table → "Seite 1 von 13" on the left, in the middle ‹ 1 2 3 … 13 › (first, last, current
  and its neighbours, "…" for gaps), on the right "200 pro Seite ▾" with 100 / 200 / 500.
- Click a page number or ‹ / › → the table shows that page and scrolls to its top; the pill updates.
- Change sort, filter, grouping or rows per page → back to page 1.
- The header of the tab also names the size: "2 592 Kombinationen · 31 104 Zellen · n Fehler".
- The best value of the sort metric stays marked on whichever page it is (it is on page 1 when sorted
  by that metric).
**Data:** the groups query takes `offset` next to `limit` (limit 100, 200 or 500); the response keeps
`groups` (total combinations) so the pill and pager can be drawn. No row cap beyond the page size.
**In the prototype:** `M-Lauf.dc.html` with `mode` = `pages` (`pages`, `prev`, `next`, `countText`);
`M3-Seiten` on the canvas. The rest of the run tab (detail panel, overview, notes, deliverable
dialog) behaves as in `P-Run-03`; only its look follows `M-Lauf`.
**Rejected:** M1 (button "Weitere 200 laden", cap 1 000) and M2 (load on scroll, cap 1 000): Tim finds
pages the most flexible, every row stays reachable.

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
