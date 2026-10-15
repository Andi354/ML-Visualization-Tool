import { beforeEach, describe, expect, it } from "vitest";
import { frameReducer, initialFrame, loadFrame, saveFrame, type FrameState } from "../src/state/frame";
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
  it("is the run folder name without the timestamp", () => {
    expect(tabLabel("TIM-45_g6_combined_20260925-164000")).toBe("TIM-45_g6_combined");
  });
});
