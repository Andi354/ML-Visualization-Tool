import { describe, expect, it } from "vitest";
import { describe as text, detailLine, percent, remainingLabel, statusLine, type RunEvent, type RunProgress } from "../src/progress/model";

const run = (over: Partial<RunProgress> = {}): RunProgress => ({
  id: "2026-10-15_1100_TIM-83_sweep", name: "TIM-83_sweep", issue: "TIM-83", short: null, state: "running", cells_done: 9, cells_planned: 24, cells_failed: 0,
  rate_per_hour: 90, remaining_s: 600, eta: "2026-10-15T11:17", last_cell_at: "2026-10-15T11:06:00", stalled_since: null, started: "2026-10-15T11:00:00", ...over,
});

describe("remainingLabel", () => {
  it("rounds to minutes below an hour and shows hours above", () => {
    expect(remainingLabel(600)).toBe("10 min");
    expect(remainingLabel(20)).toBe("1 min");
    expect(remainingLabel(3600)).toBe("1 h");
    expect(remainingLabel(4800)).toBe("1 h 20 min");
    expect(remainingLabel(null)).toBeNull();
  });
});

describe("status line", () => {
  it("says nothing is running", () => {
    expect(statusLine([])).toEqual({ text: "Keine Läufe aktiv", stalled: 0, active: 0 });
  });
  it("names the newest running run with percent and remaining time", () => {
    const line = statusLine([run(), run({ id: "b", name: "TIM-84_new", issue: "TIM-84", started: "2026-10-15T11:30:00", cells_done: 12 })]);
    expect(line.text).toBe("2 laufen · new · 50 % · noch ~10 min");
    expect(line.active).toBe(2);
  });
  it("asks for patience without a remaining time", () => {
    expect(statusLine([run({ remaining_s: null })]).text).toBe("1 läuft · sweep · 38 % · Restzeit nach den ersten Zellen");
  });
  it("counts stalled runs apart and skips them as the named run", () => {
    const line = statusLine([run({ state: "stalled", stalled_since: "2026-10-15T11:36:00" }), run({ id: "b", name: "other", issue: null, started: "2026-10-14T10:00:00" })]);
    expect(line.stalled).toBe(1);
    expect(line.text.startsWith("1 läuft · other")).toBe(true);
    expect(statusLine([run({ state: "stalled", stalled_since: "x" })])).toEqual({ text: "", stalled: 1, active: 0 });
  });
});

describe("texts", () => {
  it("builds the detail line", () => {
    expect(detailLine(run())).toBe("9 von 24 Zellen · 0 Fehler · 90 Zellen/h · noch ~10 min (fertig ca. 11:17)");
    expect(detailLine(run({ state: "stalled", stalled_since: "2026-10-15T11:36:00" }))).toBe("hängt seit 11:36 · letzte Zelle 11:06");
    expect(percent(run({ cells_planned: null }))).toBeNull();
  });
  it("describes the events", () => {
    const base: RunEvent = { id: 1, kind: "finished", at: "2026-10-15T12:00:00", run: "r", name: "TIM-83_sweep", short: null, issue: "TIM-83" };
    expect(text({ ...base, cells: 24, failed: 1, duration_s: 1500, best: { label: "MAPE", unit: "%", scale: 100, value: 0.0283 } })).toEqual({
      title: "Lauf fertig", text: "sweep · 25 min · 24 Zellen · bester MAPE 2,83 % · 1 Fehler",
    });
    expect(text({ ...base, kind: "errors", share: 8.3, message: "CUDA out of memory" }).text).toBe("sweep: 8 % der Zellen fehlgeschlagen · CUDA out of memory");
    expect(text({ ...base, kind: "stalled", minutes: 30 })).toEqual({ title: "Lauf hängt", text: "sweep: seit 30 min keine neue Zelle" });
  });
});
