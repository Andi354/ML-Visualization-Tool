# v0.3.2 · Tabs und Läufe

Issue: TIM-109 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.3 · Einstellungen", section "v0.3.2 · Tabs und Läufe"
Prototype: prototype/ (start `Prototyp-03.dc.html`, see prototype/README.md) · Builds on: v0.3.1.1

## How to read this spec

- **What the prototype binds:** only what this update changes. That is the features M, N, O, P and Q
  in their own components (`M-Lauf`, `N-Tabs`, `O-Projekt`, `L-Liste`, `L-Issues`, `Q1-Widgets`),
  and for R the colours, radii and scrollbar of every screen.
- **Everything else in the prototype is older than the tool.** Where the overall prototype shows a
  layout, control or behaviour that differs from the real tool on `main`, the real tool stays as it
  is and only gets the new colours, radii and scrollbar. Nothing built since v0.3.1 is undone to
  match the prototype. Known cases: the tab row wrapping below its own search row and the slimmer
  tabs and search box (v0.3.1.1), the primary metric in the run tab's column picker and overview
  (v0.3.1.1), the default columns setting (v0.3.1.1), and the status bar with its running runs as
  it is in the tool.
- When comparing with the prototype at 1440 × 860, compare only the parts named in the first point.

## Goal
The tool gets a calmer, more inviting graphite style everywhere, a clearer Läufe screen, paging for large
runs, a tab menu with pinning, an adjustable project symbol, and the widget header designed in v0.2.4.

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

### N · Tab-Menü
**What:** Right-click on a tab opens a small menu to tidy up many open tabs, as in VS Code. Tabs can be
pinned; pinned tabs stay on the left and are not closed by the bulk commands. Tabs keep wrapping below
the search row as built in v0.3.1.1, drawn in the new style.
**Behaviour:**
- Right-click a run tab or the settings tab → menu at the tab: Schließen, Andere schließen, Rechts
  schließen, Alle schließen, separator, Anheften (or Lösen), separator, Laufnamen kopieren, In Läufe
  zeigen (the last two only on run tabs).
- An entry that would do nothing is greyed out (Rechts schließen on the last tab, Andere schließen when
  no other closable tab is open).
- Schließen / Andere / Rechts / Alle → those tabs close; pinned tabs and the fixed "Läufe" tab never
  close through these; if the active tab closes, the fixed tab gets the focus.
- After any of these → toast at the bottom "n Tabs geschlossen · Rückgängig"; Rückgängig restores the
  tabs and the active tab; the toast goes after 6 s or the next action.
- Right-click the fixed "Läufe" tab → menu with only "Alle anderen schließen".
- Anheften → the tab moves to the left end behind the fixed tab (in pin order), shows a pin icon
  instead of ×; Lösen → back to the normal tabs, right of the pinned ones.
- Laufnamen kopieren → full run folder name to the clipboard; In Läufe zeigen → Läufe list view with
  that run's issue open and the run's card highlighted.
- Click anywhere else or Esc → menu closes.
- Pinned tabs are remembered like the open tabs today (frame state).
**In the prototype:** `N-Tabs.dc.html` with `variant` = `pin` (`tabs`, `ctx`, `closeOthers`,
`closeRight`, `closeAll`, `togglePin`, `undo`); `N3-Anheften` on the canvas.
**Rejected:** N2 (extra "n Tabs ▾" list): not needed next to the wrapping tab row.

### O · Projektkopf
**What:** The project's display name, its two letters and the colour of the project symbol (rail, top
left) can be changed: as rows in the settings and in a small popover that opens from the project
symbol. Only the display changes; `project.yaml` stays as it is.
**Behaviour:**
- Einstellungen › Läufe & Experiment › Projekt → preview card (symbol 48 px, name, button "Aus project.yaml"), then rows Anzeigename (text), Kürzel (2 characters, shown
  upper case), Farbe (8 swatches: `#8AA4FF` default, `#5FD4A0`, `#F4A259`, `#E58BD0`, `#B39DFF`,
  `#6CC6E8`, `#D9C36A`, `#B0B0BA`), then the existing rows Lauf-Merkmal and Primäre Metrik.
- Anzeigename empty → name from `project.yaml` (else folder name), shown as placeholder; Kürzel empty →
  `viz.short` or the first two letters/digits of the name, shown as placeholder.
- Any change → symbol in the rail, search box, settings header ("<name> · v0.3.2") and status bar
  update at once; a changed row shows the blue "geändert" dot like other settings.
- "Aus project.yaml" → all three back to their defaults (greyed out when nothing differs).
- Click the project symbol in the rail → popover beside it: symbol, name, project path, Anzeigename,
  Kürzel, Farbe, footer button "Alle Einstellungen" (opens the
  settings at Projekt). Click outside or Esc → closes; values are saved as typed.
- Stored as settings `project.name`, `project.short`, `project.color` in `.mlviz/settings.json`
  (empty / default values are not written, as for every setting); they are part of the settings
  search and of undo / redo in the settings tab.
**In the prototype:** `O-Projekt.dc.html` with `variant` = `popover` (`togglePop`, `onName`,
`onShort`, `swatches`, `reset`); `O2-Popover` on the canvas.
**Rejected:** O1 alone (only in the settings, one step further away); O3 own image (not needed now).

### P · Läufe-Bildschirm
**What:** Both views of Läufe get a new, calmer look. The list view shows three overview tiles on top
(running run, best value for each horizon) and, per issue, a grid of experiment cards; the issues view
keeps an issue list on the left and shows the chosen issue with the same experiment cards on the right.
Own scrollbar, own selection control and a floating compare bar replace the browser defaults.
**Look (new style, see R):** ground `#131315`, rail and top bar `#18181B`, cards `#1C1C20`
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

### Q · Widget-Kopf und Config-Titel
**What:** The widget header and the config widget title as designed and chosen in v0.2.4 (TIM-97,
never built), taken over unchanged in content and drawn in the new style. The two parts below are the
v0.2.4 spec; where it names old colours, the new style values apply: card `#1C1C20` with border
`#2A2A31`, radius 12; chips `#24242A` with border `#2E2E35`, radius 6; tables in a box with radius 10,
header row `#18181B`; best value `#5FD4A0` on `#16261F`; `null` `#6A6A74` italic; "+n weitere" in
`#A9BBFF`; header buttons as 30 px icon buttons, "Einstellen" as pill, save in accent.

#### Q.I · Widget header (all widgets)
**What:** Every widget header has the same three parts instead of one grey run-on sentence: the title
(the key statement from the data, unchanged), a "what" line, and — only where the widget holds axes at
a value — a line of fixed values. The pattern applies to every built-in widget and to own widgets.
**Parts:**
- *Title:* as today (e.g. "timeF ist in 3 von 4 Regionen am besten").
- *What line* (13 px, `text-2`): the metric and the grouping, metric and axis names in mono `#C9D3E3`, e.g. `test_mse_missing` je Region × `time_embedding`; followed by " · " and the aggregation note with a small ≡ icon, e.g. "≡ Replikate gemittelt" (`text-3`).
- *Values line:* a label (11 px caps `text-3`) and the values as chips `name value` (mono 12 px, name `text-2`, value `text`, chip `raised` with `line` border, radius 4). Label "FEST" for axes held at their best value.
**Behaviour:**
- Widget with fixed axes (Vergleichstabelle, Je Region, Stabilität, …) → values line with the first 4 fixed values as chips and a link "+n weitere"; click → all chips, link "weniger".
- Widget without fixed axes → no values line.
- Hover a chip → tooltip `name = value` (long values are cut with "…" inside the chip).
- A value `null` (Python `None`) → shown as "null" in `text-3` italic, everywhere in widgets, tables and chips (today it renders as an empty cell).
- Saved image (export) → the values line shows all fixed values (no "+n weitere"); "Hinweise einblenden" off → what line and values line are left out, as the grey hints today.
**Data:** the backend returns the header in parts instead of one `subtitle` string:
`header: { what: [{text, mono?}], agg?: string, values?: { label: string, style: "chips" | "list", items: [[name, value]] } }`.
`subtitle` stays for own widgets that only give a string; the tool renders it as the what line.
Own widgets (v0.2, E) may give `header` in their description; the agent help (`src/mlviz/agent_guide.md`) describes both styles.
**In the prototype:** `Q1-Widgets.dc.html` left card (`shown`, `toggleMore`, `cols`); the v0.2.4 original is `I7-Gewaehlt` on page "v0.2 · Agent".
**Rejected:** I2 ("n fest" button with a fold-out list): one click more for information that is often needed. I3 (conditions below the table): separates the condition from what it qualifies.

#### Q.J · Config widget title
**What:** The config widget (scope "Ein Lauf") no longer puts the combination into a four-line bold
title. The title is short, the combination is a two-column list.
**Behaviour:**
- Title "Beste Kombination" (17 px, 600), on the same line in `text-3`: the metric that decided it with its value in `best` (e.g. `test_mape_real 3,863 %`) and " · <run name>".
- Below: a two-column grid of rows `name | value` (mono 12 px, name `text-3` 170 px, value `text`), rows separated by `line`; long values cut with "…", full value in the tooltip; `null` as in I.
- Below that the config view (Blöcke | YAML) as today.
- Scope "Kombination" (detail panel) keeps its title "Config: n Achsen im Grid, …".
- This is the `values` part with `style: "list"` (label left out); own widgets can use the same style (Tim: both styles available to the agent).
**In the prototype:** `Q1-Widgets.dc.html` right card (`combo`).
**Rejected:** J1 (combination as chips): Tim prefers the list for the config, where the combination is the content, not a side condition.

#### Q.K · No hint lines in widgets
- Built-in widgets no longer show a `note` line under the content (today e.g. "niedriger = besser ·
  grün = bester Wert je Region", "gestrichelt = Epoche mit niedrigstem val_loss", "heller = besser ·
  leer = fehlgeschlagen"); the `note` field is dropped from `src/mlviz/widgets/*.py`.
- Saved images follow the screen: no note line; "Hinweise einblenden" still switches the what line and
  the values line.
- The agent adds no explanatory or legend lines to own widgets or answers unless the user asks for
  them; `src/mlviz/agent_guide.md` says so in its rules for own widgets.
- The best value keeps its tooltip "Bestwert" (meaning not by colour alone).

### R · Neuer Stil im ganzen Tool
**What:** The style chosen in P and M (graphite instead of blue-grey, periwinkle accent, rounder
shapes, own scrollbar) becomes the style of every screen: frame, Läufe, run tab, analysis and widgets,
settings, agent window, command palette, status bar and notifications. The layout of each screen stays
as it is; only colours, radii and the scrollbar change, unless P, M, N, O or Q say more.
**Colour mapping (old → new, also the token change):**

| Token | old | new |
|---|---|---|
| `bg` | `#0D1016` | `#131315` |
| `surface` | `#131720` | `#1C1C20` |
| `raised` | `#1A2030` | `#24242A` |
| `line` | `#262E3E` | `#2E2E35` |
| `line-strong` (new) | `#2C3547` | `#34343C` |
| `line-stronger` (new) | `#3A4458` | `#45454F` |
| `chrome` (new: rail, tab row, status bar) | `#131720` | `#18181B` |
| `text` | `#E4E8EF` | `#EEEEF1` |
| `text-2` | `#A1AABB` | `#B0B0BA` |
| `text-3` | `#8590A3` | `#7C7C87` |
| `accent` | `#6E9BF5` | `#8AA4FF` |
| `accent-bg` | `#192640` | `#262B42` |
| `accent-line` | `#2C4572` | `#3A4166` |
| `selected-row` | `#172238` | `#222330` |
| `accent-fill` (new: button fill under white text) | `#2F5BD3` | `#5B6FD6` |

`best`, `error`, `warn`, `note*`, `series`, `diverging` and `export-light` stay. A running run uses
`accent` (not `warn`).
**Shapes:** radius 4 → 8 (controls), 6 → 12 (panels, cards), 3 → 7 (chips, segment buttons),
5 → 9 (segment groups); filter chips, view switches and primary buttons as pills (radius 16–18).
**Scrollbar:** every scroll area: thin, no track, thumb `#34343C` (hover `#45454F`), radius 6.
**Behaviour:**
- Open any screen at 1440 × 860 → it matches the same screen in `Prototyp-03.dc.html` (whose parts are
  the `R-…` components, `L-Liste`, `L-Issues`) in colours, radii and scrollbar.
- Where a screen has its own new design in this update (P, M, N, O, Q), that design wins.
**In the prototype:** `Prototyp-03.dc.html` and the components `R-P-Run-03`, `R-F-Exp-H4`,
`R-J1-Bloecke`, `R-J4-YAML`, `R-W-Widget`, `R-P-Analyse-02`, `R-E4-Analyse`, `R-E1-Duell`,
`R-E2-Abgleich`, `R-E3-Verlauf`, `R-G-Vorlagen`, `R-S1-Einstellungen` with their `R-…js` data files.

## Changes to principles.md / tokens.json
- `tokens.json`: colours as in the table of R (`line-strong`, `line-stronger`, `chrome`, `accent-fill` new); `radius.control` 8px,
  `radius.panel` 12px, new `radius.chip` 7px and `radius.pill` 18px; `size.icon-bar` 56px,
  `size.tab-strip` 38px, `size.status-bar` 26px.
- `principles.md`, "Colour carries meaning": everything is graphite (instead of slate grey); a running
  run is `accent`.
- `principles.md`, "Density": radii 8 px (controls), 12 px (panels and cards), pills for chips, view
  switches and primary buttons; own thin scrollbar everywhere.
- `principles.md`, new section "No hint lines": no explanatory, legend or "how to read" lines under
  widgets, tables or screens, and none added by the agent, unless Tim asks for them.

## Out of scope
- New screens or behaviour beyond M–R; the layout of analysis, settings, agent window and palette stays.
- Undoing anything built since v0.3.1 to match the overall prototype (see "How to read this spec").
- Per-issue colours (P4) and an own project image (O3).
- The prototype's made-up numbers and texts.

## Open
- If a colour in the code is not in the table of R, then take the nearest new token by role (surface,
  line, text, accent) and note it in `decided.md`.
- If no run is running, then the first overview tile in Läufe shows the newest finished run (name,
  issue, when, "Öffnen").
- If a run has more combinations than fit a page and the user sorts by a column, then the order is the
  server's over all combinations, not only the page.
- If the clipboard is not available ("Laufnamen kopieren"), then the entry is greyed out.
- If `project.color` holds a value not among the eight swatches (edited by hand), then it is used as
  it is and no swatch is marked.
- `tests/browser/` tests that check old colours or radii of v0.3.1 (`test_look.py`) are updated to
  the new values, not removed.
