import { beforeEach, describe, expect, it } from "vitest";
import type { Dim, Metric } from "../src/api";
import {
  buildQuery,
  chips,
  columnCount,
  constantCount,
  defaultMetrics,
  dimMatches,
  filterConstants,
  formatMetric,
  formatSd,
  loadColumns,
  nextSort,
  resetDim,
  saveColumns,
  setDim,
  stateTag,
  summary,
  toggleValue,
  visibleMetrics,
  defaultColumns,
} from "../src/experiment/model";

const axis = (key: string, values: string[]): Dim => ({
  key,
  kind: "axis",
  section: "model",
  values: values.map((value) => ({ value, n: 3 })),
});
const lstm = axis("lstm_layer", ["0", "1", "2"]);
const seed: Dim = { key: "shuffle_seed", kind: "replicate", section: "Wiederholungen", values: ["1", "2"].map((value) => ({ value, n: 1 })) };
const chan: Dim = { key: "channel", kind: "channel", section: "Kanäle", values: ["us", "eu"].map((value) => ({ value, n: 1 })) };
const metrics: Metric[] = [
  { key: "mse_s", label: "MSE skaliert", direction: "min", family: "scaled", unit: "", scale: 1 },
  { key: "mape", label: "MAPE", direction: "min", family: "real", unit: "%", scale: 100 },
  { key: "mae", label: "MAE", direction: "min", family: "real", unit: "", scale: 1 },
];

describe("sidebar state tags", () => {
  it("axes are split and replicates averaged by default", () => {
    expect(stateTag(lstm, { mode: "split", sel: [] })).toEqual({ text: "geteilt", accent: true });
    expect(stateTag(seed, { mode: "agg", sel: [] })).toEqual({ text: "Ø", accent: false });
    expect(stateTag(chan, { mode: "split", sel: [] }).text).toBe("je Kanal");
  });
  it("selected values: '= value' or 'k von n', combined with Ø", () => {
    expect(stateTag(lstm, { mode: "split", sel: ["1"] }).text).toBe("= 1");
    expect(stateTag(lstm, { mode: "split", sel: ["0", "1"] }).text).toBe("2 von 3");
    expect(stateTag(lstm, { mode: "agg", sel: ["1"] })).toEqual({ text: "Ø · = 1", accent: false });
  });
});

describe("dimension state", () => {
  it("toggles values and resets to the default", () => {
    let s = toggleValue({}, lstm, "1");
    s = toggleValue(s, lstm, "2");
    expect(s.lstm_layer.sel).toEqual(["1", "2"]);
    s = toggleValue(s, lstm, "1");
    expect(s.lstm_layer.sel).toEqual(["2"]);
    s = setDim(s, lstm, { mode: "agg" });
    expect(resetDim(s, lstm)).toEqual({});
  });
});

describe("chips", () => {
  it("none for the defaults", () => expect(chips([lstm, seed, chan], {})).toEqual([]));
  it("averaged axis: 'Ø axis'; value selection: 'axis ∈ values'", () => {
    const s = toggleValue(toggleValue(setDim({}, lstm, { mode: "agg" }), lstm, "0"), lstm, "1");
    expect(chips([lstm], s).map((c) => c.label)).toEqual(["Ø lstm_layer", "lstm_layer ∈ 0, 1"]);
  });
  it("replicates and channels that left their default show up too", () => {
    const s = setDim(setDim({}, seed, { mode: "split" }), chan, { mode: "split" });
    expect(chips([seed, chan], s).map((c) => c.label)).toEqual(["shuffle_seed geteilt", "je Kanal"]);
  });
  it("the cross returns the whole dimension to its default", () => {
    const s = setDim(toggleValue({}, lstm, "0"), lstm, { mode: "agg" });
    const [c] = chips([lstm], s);
    expect(chips([lstm], resetDim(s, c.dim))).toEqual([]);
  });
});

describe("columns", () => {
  it("default: primary plus the first real metric; only the primary if it is real itself", () => {
    expect(defaultMetrics(metrics, "mse_s")).toEqual(["mse_s", "mape"]);
    expect(defaultMetrics(metrics, "mae")).toEqual(["mae"]);
    expect(defaultMetrics(metrics.filter((m) => m.family === "scaled"), "mse_s")).toEqual(["mse_s"]);
    expect(defaultMetrics([], null)).toEqual([]);
  });
  it("visible metrics keep the catalogue order; n and Status on, min and max off by default", () => {
    expect(visibleMetrics({ ...defaultColumns, metrics: ["mae", "mse_s"] }, metrics, "mse_s")).toEqual(["mse_s", "mae"]);
    expect(columnCount(defaultColumns, metrics, "mse_s")).toEqual({ visible: 4, total: 7 });
    expect(defaultColumns).toMatchObject({ n: true, status: true, min: false, max: false, sd: "under" });
  });
  describe("remembered per project", () => {
    beforeEach(() => localStorage.clear());
    it("round trip and per project", () => {
      const c = { ...defaultColumns, metrics: ["mae"], min: true, sd: "column" as const };
      saveColumns("P", c);
      expect(loadColumns("P")).toEqual(c);
      expect(loadColumns("Q")).toEqual(defaultColumns);
    });
    it("junk falls back", () => {
      localStorage.setItem("mlviz:v1:P:columns", "[[");
      expect(loadColumns("P")).toEqual(defaultColumns);
    });
  });
});

describe("sorting", () => {
  it("first click ascending, second descending", () => {
    let s = nextSort({ metric: "a", stat: "mean", dir: null }, "b");
    expect(s).toEqual({ metric: "b", stat: "mean", dir: "asc" });
    s = nextSort(s, "b");
    expect(s.dir).toBe("desc");
    expect(nextSort(s, "b").dir).toBe("asc");
    expect(nextSort(s, "a")).toEqual({ metric: "a", stat: "mean", dir: "asc" });
  });
});

describe("formatting", () => {
  it("applies scale and unit with German format", () => {
    expect(formatMetric(metrics[1], 0.0397)).toBe("3,970 %");
    expect(formatMetric(metrics[2], 412.83)).toBe("412,8");
    expect(formatMetric(metrics[0], 0.7891)).toBe("0,7891");
    expect(formatMetric(metrics[2], 12345.6)).toBe("12 346");
    expect(formatMetric(metrics[2], null)).toBe("–");
  });
  it("sd without unit", () => {
    expect(formatSd(metrics[1], 0.002)).toBe("± 0,2000");
    expect(formatSd(metrics[1], null)).toBe("");
  });
});

describe("search and summary", () => {
  it("matches dimension names and values", () => {
    expect(dimMatches(lstm, "lstm")).toEqual({ row: true, values: false });
    expect(dimMatches(chan, "eu")).toEqual({ row: true, values: true });
    expect(dimMatches(lstm, "zzz").row).toBe(false);
    expect(dimMatches(lstm, "")).toEqual({ row: true, values: false });
  });
  it("filters constants by key, value or block", () => {
    const blocks = [
      { block: "data", rows: [{ key: "pred_len", value: "30" }, { key: "seq_len", value: "90" }] },
      { block: "model", rows: [{ key: "forecaster", value: "rep-net" }] },
    ];
    expect(filterConstants(blocks, "pred")).toEqual([{ block: "data", rows: [{ key: "pred_len", value: "30" }] }]);
    expect(constantCount(filterConstants(blocks, "rep-net"))).toBe(1);
    expect(constantCount(filterConstants(blocks, "model"))).toBe(1);
    expect(filterConstants(blocks, "")).toBe(blocks);
  });
  it("more than the rendered rows: sorted over all", () => {
    expect(summary(294, 294, 200)).toBe("294 Gruppen · 294 Zellen · sortiert über alle");
    expect(summary(5, 30, 5)).toBe("5 Gruppen · 30 Zellen");
  });
  it("query carries dims, sort and overview flag", () => {
    expect(buildQuery({}, { metric: "m", stat: "mean", dir: "asc" }, true)).toEqual({
      dims: {},
      sort: { metric: "m", stat: "mean", dir: "asc" },
      overview: true,
    });
  });
});
