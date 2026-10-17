# v0.2.4 · Widgets

Issue: TIM-97 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent", section "v0.2.4 · Widgets"
Prototype: prototype/I7-Gewaehlt.dc.html (see prototype/README.md) · Builds on: v0.2.3

## Goal
Widget headers read at a glance: what is shown, under which fixed conditions, without long run-on text.

## Features

### I · Widget header (all widgets)
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
**In the prototype:** `I7-Gewaehlt.dc.html` left tile (`WHAT`, `FIX_CHIPS`, `shown`, `toggleMore`).
**Rejected:** I2 ("n fest" button with a fold-out list): one click more for information that is often needed. I3 (conditions below the table): separates the condition from what it qualifies.

### J · Config widget title
**What:** The config widget (scope "Ein Lauf") no longer puts the combination into a four-line bold
title. The title is short, the combination is a two-column list.
**Behaviour:**
- Title "Beste Kombination" (17 px, 600), on the same line in `text-3`: the metric that decided it with its value in `best` (e.g. `test_mape_real 3,863 %`) and " · <run name>".
- Below: a two-column grid of rows `name | value` (mono 12 px, name `text-3` 170 px, value `text`), rows separated by `line`; long values cut with "…", full value in the tooltip; `null` as in I.
- Below that the config view (Blöcke | YAML) as today.
- Scope "Kombination" (detail panel) keeps its title "Config: n Achsen im Grid, …".
- This is the `values` part with `style: "list"` (label left out); own widgets can use the same style (Tim: both styles available to the agent).
**In the prototype:** `I7-Gewaehlt.dc.html` right tile.
**Rejected:** J1 (combination as chips): Tim prefers the list for the config, where the combination is the content, not a side condition.

## Changes to principles.md / tokens.json
- none

## Today (from the code on main, v0.2.2)
- The backend builds `subtitle` as one string, e.g. `runscope.py`: `f"{metric.label} je Region × {axis}" + fixed_text(fixed) + " · Replikate gemittelt"`, with `fixed_text` = `" · fest: " + "k = v, …"`. Same pattern in `compare_table` and `stability`.
- The config widget (`combination.py`, scope "run") sets `title = "Beste Config: " + "k = v, …"` over all grid axes; `subtitle = run.name`. A value `None` renders as empty text.
- `WidgetFigure` (`web/src/widgets/WidgetTile.tsx`) shows title, subtitle (grey, when hints are on), graphic, note, footer.

## Out of scope
- Other widget layout changes (charts, tables) beyond the header.
- Error state of the widget "Je Region" seen in Tim's screenshot (load error); not part of this update.

## Prototype notes
- Only the two widgets of Tim's screenshot are prototyped; the pattern applies to all widgets.
- The overall prototype is not updated for this patch.

## Open
- none
