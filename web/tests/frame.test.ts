import { beforeEach, describe, expect, it } from "vitest";
import { SETTINGS_TAB, frameReducer, initialFrame, loadFrame, saveFrame, tabOrder, type FrameState } from "../src/state/frame";
import { closeSets } from "../src/frame/TabMenu";
import { tabLabel } from "../src/frame/TabStrip";

const open = (s: FrameState, run: string) => frameReducer(s, { type: "open-run", run });

describe("frame reducer (feature B)", () => {
  it("opening a run adds a tab and focuses it", () => {
    const s = open(initialFrame, "a_1");
    expect(s.tabs).toEqual(["a_1"]);
    expect(s.active).toBe("a_1");
  });

  it("opening an already open run focuses it instead of adding a second tab", () => {
    let s = open(open(initialFrame, "a_1"), "b_1");
    s = open(s, "a_1");
    expect(s.tabs).toEqual(["a_1", "b_1"]);
    expect(s.active).toBe("a_1");
  });

  it("closing the active tab focuses the tab to its left", () => {
    let s = open(open(open(initialFrame, "a"), "b"), "c");
    s = frameReducer(s, { type: "close-run", run: "c" });
    expect(s.active).toBe("b");
    s = frameReducer(s, { type: "close-run", run: "b" });
    expect(s.active).toBe("a");
  });

  it("closing the first active tab focuses the pinned tab", () => {
    const s = frameReducer(open(open(initialFrame, "a"), "b"), { type: "focus-run", run: "a" });
    expect(frameReducer(s, { type: "close-run", run: "a" })).toMatchObject({ tabs: ["b"], active: null });
  });

  it("closing an inactive tab keeps the focus", () => {
    const s = open(open(initialFrame, "a"), "b");
    expect(frameReducer(s, { type: "close-run", run: "a" })).toMatchObject({ tabs: ["b"], active: "b" });
  });

  it("clicking an area switches the pinned tab, focuses it and keeps the run tabs", () => {
    const s = frameReducer(open(initialFrame, "a"), { type: "select-area", area: "analysis" });
    expect(s).toMatchObject({ area: "analysis", active: null, tabs: ["a"] });
  });

  it("the Läufe area remembers its view across area switches", () => {
    let s = frameReducer(initialFrame, { type: "set-runs-view", view: "issues" });
    s = frameReducer(frameReducer(s, { type: "select-area", area: "analysis" }), {
      type: "select-area",
      area: "runs",
    });
    expect(s.runsView).toBe("issues");
  });

  it("Vergleichen opens the analysis area with the ticked runs and keeps the tabs", () => {
    const s = frameReducer(open(initialFrame, "a"), { type: "open-compare", runs: ["x", "y"] });
    expect(s).toMatchObject({ area: "analysis", active: null, compare: ["x", "y"], tabs: ["a"] });
  });

  it("'Als Analyse öffnen' opens the analysis area with one run and its combination", () => {
    const s = frameReducer(open(initialFrame, "a"), { type: "open-analysis", run: "a", combo: { x: "1" } });
    expect(s).toMatchObject({ area: "analysis", active: null, compare: [], analysis: { run: "a", combo: { x: "1" } } });
    const c = frameReducer(s, { type: "open-compare", runs: ["a", "b"] });
    expect(c.analysis).toBeNull();
  });

  it("focusing or closing an unknown run changes nothing", () => {
    const s = open(initialFrame, "a");
    expect(frameReducer(s, { type: "focus-run", run: "x" })).toBe(s);
    expect(frameReducer(s, { type: "close-run", run: "x" })).toBe(s);
  });
});

describe("frame persistence (per project, browser storage)", () => {
  beforeEach(() => localStorage.clear());

  it("open tabs and the active tab survive a reload", () => {
    const s = open(open(initialFrame, "a"), "b");
    saveFrame("P", s);
    expect(loadFrame("P")).toEqual(s);
  });

  it("is stored per project", () => {
    saveFrame("P", open(initialFrame, "a"));
    expect(loadFrame("Q")).toEqual(initialFrame);
  });

  it("junk or blocked storage falls back to the initial state", () => {
    localStorage.setItem("mlviz:v1:P:frame", "{not json");
    expect(loadFrame("P")).toEqual(initialFrame);
    localStorage.setItem("mlviz:v1:P:frame", JSON.stringify({ tabs: [1, "a", "a"], active: "zzz", area: "x" }));
    expect(loadFrame("P")).toEqual({ ...initialFrame, tabs: ["a"] });
  });
});

describe("tab label", () => {
  it("is the run folder name without the timestamp, prefix or suffix", () => {
    expect(tabLabel("2026-09-25_164000_TIM-45_g6_combined")).toBe("TIM-45_g6_combined");
    expect(tabLabel("2026-09-25_1640_TIM-45_g6_combined")).toBe("TIM-45_g6_combined");
    expect(tabLabel("TIM-45_g6_combined_20260925-164000")).toBe("TIM-45_g6_combined");
    expect(tabLabel("plain")).toBe("plain");
  });
});

describe("tab menu (v0.3.2, N)", () => {
  const four = () => ["a", "b", "c", "d"].reduce(open, initialFrame);

  it("pinning moves the tab behind the fixed one in pin order; unpinning puts it right of the pinned ones", () => {
    let s = frameReducer(four(), { type: "pin-tab", item: "c" });
    expect(s.tabs).toEqual(["c", "a", "b", "d"]);
    s = frameReducer(s, { type: "pin-tab", item: "d" });
    expect(s.tabs).toEqual(["c", "d", "a", "b"]);
    expect(s.pinned).toEqual(["c", "d"]);
    s = frameReducer(s, { type: "unpin-tab", item: "c" });
    expect(s.tabs).toEqual(["d", "c", "a", "b"]);
    expect(s.pinned).toEqual(["d"]);
  });

  it("the bulk closes skip pinned tabs; an explicit close takes them", () => {
    let s = frameReducer(four(), { type: "pin-tab", item: "a" });
    s = frameReducer(s, { type: "close-tabs", items: ["a", "b", "c"] });
    expect(s.tabs).toEqual(["a", "d"]);
    s = frameReducer(s, { type: "close-tabs", items: ["a"], force: true });
    expect(s.tabs).toEqual(["d"]);
    expect(s.pinned).toEqual([]);
  });

  it("closing the active tab focuses the fixed tab", () => {
    const s = frameReducer(four(), { type: "close-tabs", items: ["d", "c"] });
    expect(s.active).toBeNull();
    expect(frameReducer(four(), { type: "close-tabs", items: ["a"] }).active).toBe("d");
  });

  it("the settings tab can be pinned and closed like a run tab", () => {
    let s = frameReducer(open(initialFrame, "a"), { type: "open-settings" });
    expect(tabOrder(s)).toEqual([SETTINGS_TAB, "a"]);
    s = frameReducer(s, { type: "pin-tab", item: SETTINGS_TAB });
    expect(closeSets(s, "a").all).toEqual(["a"]); // the pinned settings tab stays
    s = frameReducer(s, { type: "close-tabs", items: [SETTINGS_TAB], force: true });
    expect(s.settings).toBe(false);
    expect(s.active).toBeNull();
  });

  it("which entries would do nothing: right of the last tab, others when alone", () => {
    const s = four();
    expect(closeSets(s, "d").right).toEqual([]);
    expect(closeSets(s, "b").right).toEqual(["c", "d"]);
    expect(closeSets(s, "b").others).toEqual(["a", "c", "d"]);
    expect(closeSets(open(initialFrame, "a"), "a").others).toEqual([]);
    expect(closeSets(s, null).all).toEqual(["a", "b", "c", "d"]);
  });

  it("restore-tabs brings tabs, pins and the active tab back", () => {
    const before = frameReducer(four(), { type: "pin-tab", item: "b" });
    const after = frameReducer(before, { type: "close-tabs", items: ["a", "c", "d"] });
    const back = frameReducer(after, { type: "restore-tabs", before: { tabs: before.tabs, pinned: before.pinned, settings: before.settings, active: before.active } });
    expect(back.tabs).toEqual(before.tabs);
    expect(back.active).toBe(before.active);
  });

  it("pins are remembered with the frame", () => {
    const s = frameReducer(four(), { type: "pin-tab", item: "c" });
    saveFrame("p", s);
    const back = loadFrame("p");
    expect(back.pinned).toEqual(["c"]);
    expect(back.tabs[0]).toBe("c");
  });

  it("show-in-runs opens the list view of Läufe with the run revealed", () => {
    const s = frameReducer({ ...four(), runsView: "issues", area: "analysis" }, { type: "show-in-runs", run: "b" });
    expect(s).toMatchObject({ area: "runs", active: null, runsView: "list", reveal: { run: "b", n: 1 } });
  });
});
