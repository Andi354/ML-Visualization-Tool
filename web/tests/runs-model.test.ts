import { describe, expect, it } from "vitest";
import type { ProjectInfo, RunRow } from "../src/api";
import {
  bestText,
  buildBlocks,
  buildTimeline,
  cellBar,
  cellText,
  flags,
  isOpen,
  matchRun,
  noFilters,
  relTime,
  secondLine,
  shortName,
} from "../src/runs/model";

const NOW = "2026-10-15T12:00:00";
let n = 0;
function run(over: Partial<RunRow> = {}): RunRow {
  n += 1;
  return {
    id: `2026-10-01_10000${n}_x${n}`,
    name: `x${n}`,
    issue: null,
    started: "2026-10-01T10:00:00",
    ended: "2026-10-01T11:00:00",
    state: over.state ?? (over.running ? "running" : "finished"),
    problem: null,
    running: false,
    migrated: false,
    epoch: "eval-all-windows",
    axes: ["forecaster"],
    replicates: [],
    has_curves: false,
    has_predictions: false,
    commit: null,
    cells: 10,
    planned: 10,
    errors: 0,
    best: { metric: "test_mape", label: "MAPE", unit: "%", scale: 100, value: 0.0397 },
    merkmal: { key: "data.pred_len", label: "pred_len", value: "30" },
    config_values: {},
    ...over,
  };
}
const project = {
  epochs: [
    { name: "tsrm6", since: "2026-09-01" },
    { name: "eval-all-windows", since: "2026-10-05" },
  ],
} as ProjectInfo;
const issues = { "TIM-52": { title: "Beste Config zusammenführen" } };

describe("filters", () => {
  const a = run({ issue: "TIM-52", name: "TIM-52_best_30", axes: ["lstm_layer"] });
  it("search matches run name, issue id, issue title and axis names", () => {
    for (const q of ["best_30", "tim-52", "zusammenführen", "LSTM_layer"])
      expect(matchRun(a, issues, { ...noFilters, q })).toBe(true);
    expect(matchRun(a, issues, { ...noFilters, q: "nothing" })).toBe(false);
  });
  it("status filter keeps running runs or runs with errors", () => {
    expect(matchRun(run({ running: true }), issues, { ...noFilters, status: "running" })).toBe(true);
    expect(matchRun(run(), issues, { ...noFilters, status: "running" })).toBe(false);
    expect(matchRun(run({ errors: 2 }), issues, { ...noFilters, status: "errors" })).toBe(true);
    expect(matchRun(run(), issues, { ...noFilters, status: "errors" })).toBe(false);
  });
  it("epoch filter", () => {
    expect(matchRun(run({ epoch: "tsrm6" }), issues, { ...noFilters, epoch: "tsrm6" })).toBe(true);
    expect(matchRun(run({ epoch: "tsrm6" }), issues, { ...noFilters, epoch: "eval-all-windows" })).toBe(false);
  });
});

describe("blocks", () => {
  const rs = [
    run({ issue: "A-1", name: "A-1_e", started: "2026-10-10T10:00:00" }),
    run({ issue: "A-1", name: "A-1_e", started: "2026-10-12T10:00:00" }),
    run({ issue: "B-2", name: "B-2_f", started: "2026-10-14T10:00:00" }),
    run({ issue: null, name: "alone", started: "2026-10-13T10:00:00" }),
    run({ issue: "A-1", name: "A-1_g", started: "2026-10-11T10:00:00" }),
  ];
  const blocks = buildBlocks(rs);
  it("sorts issue blocks and standalone rows by their newest run", () => {
    expect(blocks.map((b) => b.key)).toEqual(["B-2", rs[3].id, "A-1"]);
  });
  it("groups runs of one config into an experiment, newest first", () => {
    const a = blocks.find((b) => b.key === "A-1")!;
    if (a.kind !== "issue") throw new Error();
    expect(a.experiments.map((e) => [e.name, e.runs.length])).toEqual([
      ["A-1_e", 2],
      ["A-1_g", 1],
    ]);
    expect(a.experiments[0].runs[0].started).toBe("2026-10-12T10:00:00");
  });
  it("issues with a run in the last 7 days start expanded, others collapsed", () => {
    const now = new Date(NOW).getTime();
    const old = buildBlocks([run({ issue: "C-3", started: "2026-09-01T10:00:00" })])[0];
    const fresh = blocks[0];
    if (old.kind !== "issue" || fresh.kind !== "issue") throw new Error();
    expect(isOpen(fresh, now, noFilters)).toBe(true);
    expect(isOpen(old, now, noFilters)).toBe(false);
    expect(isOpen(old, now, { ...noFilters, q: "x" })).toBe(true);
    expect(isOpen(old, now, { ...noFilters, status: "running" })).toBe(true);
    expect(isOpen(old, now, noFilters, true)).toBe(true);
    expect(isOpen(fresh, now, noFilters, false)).toBe(false);
  });
});

describe("texts", () => {
  it("relative time like the prototype", () => {
    expect(relTime(NOW, "2026-10-15T09:05:00")).toBe("heute 09:05");
    expect(relTime(NOW, "2026-10-14T09:05:00")).toBe("gestern");
    expect(relTime(NOW, "2026-10-12T09:05:00")).toBe("vor 3 Tagen");
    expect(relTime(NOW, "2026-09-28T09:05:00")).toBe("28.9.");
  });
  it("name without the issue prefix", () => {
    expect(shortName({ name: "TIM-52_best_30", issue: "TIM-52" })).toBe("best_30");
    expect(shortName({ name: "alone", issue: null })).toBe("alone");
  });
  it("cell text for finished, failed and running runs", () => {
    expect(cellText(run({ cells: 222264, planned: 222264, errors: 31752 }))).toBe("222 264 Zellen · 31 752 Fehler");
    expect(cellText(run({ cells: 12, planned: 12 }))).toBe("12 Zellen");
    expect(cellText(run({ running: true, cells: 9, planned: 24 }))).toBe("9 / 24");
  });
  it("cell bar: ok grey part and error part, progress against planned while running", () => {
    expect(cellBar(run({ cells: 100, planned: 100, errors: 25 }))).toEqual({ ok: 75, err: 25 });
    expect(cellBar(run({ running: true, cells: 5, planned: 20, errors: 0 }))).toEqual({ ok: 25, err: 0 });
  });
  it("best value with unit, metric and Lauf-Merkmal, provisional while running", () => {
    expect(bestText(run())).toEqual({ value: "3,97 %", note: "MAPE · pred_len 30" });
    expect(bestText(run({ running: true })).note).toBe("MAPE · pred_len 30 · vorläufig");
    expect(bestText(run({ best: null }))).toEqual({ value: "–", note: "" });
  });
  it("a stalled run is unfinished: progress against planned, provisional, flagged", () => {
    const stalled = run({ state: "stalled", cells: 5, planned: 20 });
    expect(cellText(stalled)).toBe("5 / 20");
    expect(cellBar(stalled)).toEqual({ ok: 25, err: 0 });
    expect(bestText(stalled).note).toContain("vorläufig");
    expect(flags(stalled, "eval-all-windows").map((f) => f.text)).toEqual(["◐ steht still"]);
  });
  it("a run ds-store cannot read is flagged with the reason and has no progress", () => {
    const bad = run({ state: "unsupported", problem: "store_version 99 is newer", cells: 0, planned: 0 });
    expect(flags(bad, "eval-all-windows")).toEqual([{ text: "⚠ nicht lesbar", kind: "warn", title: "store_version 99 is newer" }]);
    expect(cellText(bad)).toBe("0 Zellen");
  });
  it("flags only deviations: running and an older epoch", () => {
    expect(flags(run(), "eval-all-windows")).toEqual([]);
    expect(flags(run({ running: true, epoch: "tsrm6" }), "eval-all-windows").map((f) => f.text)).toEqual([
      "● läuft",
      "Epoche tsrm6",
    ]);
    expect(flags(run({ epoch: "tsrm6" }), null)).toEqual([]);
  });
  it("second line: axes, extras, and 'ohne Issue' for standalone rows", () => {
    const r = run({ axes: ["a", "b"], has_curves: true, migrated: true });
    expect(secondLine(r, false)).toBe("a · b   —   Kurven · migriert");
    expect(secondLine(run({ axes: ["a"] }), true)).toBe("ohne Issue · a");
  });
});

describe("timeline", () => {
  const rs = [
    run({ id: "r1", started: "2026-10-06T10:00:00", best: { ...run().best!, value: 0.04 } }),
    run({ id: "r2", started: "2026-10-08T10:00:00", best: { ...run().best!, value: 0.035 } }),
    run({ id: "r3", started: "2026-10-09T10:00:00", best: { ...run().best!, value: 0.05 }, merkmal: { key: "data.pred_len", label: "pred_len", value: "90" } }),
    run({ id: "old", started: "2026-09-12T10:00:00", epoch: "tsrm6", best: { ...run().best!, value: 0.03 } }),
  ];
  const tl = buildTimeline(rs, project)!;
  it("one colour per Lauf-Merkmal value in fixed order", () => {
    expect(tl.series).toEqual([
      { value: "30", index: 0 },
      { value: "90", index: 1 },
    ]);
    expect(tl.points.find((p) => p.id === "r3")!.series).toBe(1);
  });
  it("runs of older epochs are dimmed and excluded from the line", () => {
    expect(tl.points.find((p) => p.id === "old")!.older).toBe(true);
    const line30 = tl.lines.find((l) => l.index === 0)!.points.split(" ");
    // two current-epoch runs: step up to r2 -> 2 + 1 points + closing point
    expect(line30.length).toBe(4);
  });
  it("line is the best so far: the value never rises, so y (top = high) never decreases", () => {
    const ys = tl.lines.find((l) => l.index === 0)!.points.split(" ").map((p) => Number(p.split(",")[1]));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
  it("marks the start of the current epoch when inside the range", () => {
    expect(tl.epochX).not.toBeNull();
  });
  it("is null without runs that have a best value", () => {
    expect(buildTimeline([run({ best: null })], project)).toBeNull();
  });
  it("more than six Lauf-Merkmal values fold into 'Other' (no generated colours)", () => {
    const many = ["1", "2", "3", "4", "5", "6", "7"].map((v, i) =>
      run({ id: `m${i}`, merkmal: { key: "k", label: "k", value: v } }),
    );
    const t = buildTimeline(many, project)!;
    expect(t.points.find((p) => p.id === "m6")!.series).toBe(-1);
    expect(t.series.filter((s) => s.index >= 0)).toHaveLength(6);
  });
});
