# v0.2.4 · Widgets

Issue: TIM-97 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent", section "v0.2.4 · Widgets"
Prototype: prototype/ · Builds on: v0.2.3

## State

| Block | Status |
|---|---|
| I · Widget subtitle | running |
| J · Config widget title | running |

Running blocks: I and J (small iteration, both built at once). On the canvas: I0 (today), I1 · Was +
feste Werte als Chips, I2 · Was + "n fest" zum Aufklappen, I3 · Bedingungen unter der Tabelle; J0
(today), J1 · Kombination als Chips, J2 · zweispaltige Liste. Waiting for Tim's word.

## Goal
Widget headers read at a glance: what is shown, under which fixed conditions, without long run-on text.

## Features

## Changes to principles.md / tokens.json

## Today (from the code on main, v0.2.2)
- The backend builds `subtitle` as one string, e.g. `runscope.py`: `f"{metric.label} je Region × {axis}" + fixed_text(fixed) + " · Replikate gemittelt"`, with `fixed_text` = `" · fest: " + "k = v, …"`. Same pattern in `compare_table` and `stability`.
- The config widget (`combination.py`, scope "run") sets `title = "Beste Config: " + "k = v, …"` over all grid axes; `subtitle = run.name`. A value `None` renders as empty text.
- `WidgetFigure` (`web/src/widgets/WidgetTile.tsx`) shows title, subtitle (grey, when hints are on), graphic, note, footer.

## Out of scope

## Open
