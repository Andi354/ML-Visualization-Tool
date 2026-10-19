# v0.3.1.1 · Kleine Sachen: decided without design

Fast path, no design. The nearest rule was the overall prototype of v0.3.1 and `principles.md`.

- **Tab bar:** when the tabs no longer fit left of the search box, the box moves to its own slim row (22 px)
  and the tabs wrap below it (30 px high, active tab marked at the bottom); otherwise the single row of
  v0.3.1 stays. Tabs got 12 px side padding (were 14). The old behaviour (tabs shrink to 120 px and the
  strip scrolls) is gone; its test now checks wrapping.
- **Primary metric:** "★ primär" at the metric in the column picker, and the metric of the overview graphs
  named in the overview line ("★ MAPE (primär)"; without the mark when the table is sorted by another
  metric, because the graphs follow the sorted metric).
- **Column default:** setting `runs.columns` (text, comma separated, by key or label). The own choice in the
  column picker still wins and stays per browser; "Vorgabe" in the picker drops it and returns to the
  setting. Unknown names are ignored; nothing valid means the old default (primary plus first real metric).
