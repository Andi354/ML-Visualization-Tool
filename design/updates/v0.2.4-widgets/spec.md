# v0.2.4 · Widgets

Issue: TIM-97 · Canvas: https://claude.ai/artifact/5XSVMrDJk2PpQS9sGqWd8f, page "v0.2 · Agent", section "v0.2.4 · Widgets"
Prototype: prototype/ · Builds on: v0.2.3

## State

| Block | Status |
|---|---|
| I · Widget subtitle | running |
| J · Config widget title | decided (J1) |

Running block: I. Tim chose J1 (short title "Beste Kombination", metric + value + run, grid values as
chips). Asked to see I1, I2, I3 each combined with J1: on the canvas I4 · I1 + J1, I5 · I2 + J1, I6 · I3 + J1.
Waiting for Tim's word on I.

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
