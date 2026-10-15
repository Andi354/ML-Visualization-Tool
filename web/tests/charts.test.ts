import { describe, expect, it } from "vitest";
import { bandPath, centredStart, linear, linePath, niceTicks, pad, shortDate, spread } from "../src/widgets/charts";
import { boardReducer, loadBoard, makeBoard, saveBoard } from "../src/widgets/board";

describe("charts", () => {
  it("linear scale maps the domain onto the range and tolerates a flat domain", () => {
    const s = linear([0, 10], [100, 200]);
    expect([s(0), s(5), s(10)]).toEqual([100, 150, 200]);
    expect(linear([3, 3], [0, 10])(3)).toBe(5);
    expect(linear([0, 1], [50, 0])(1)).toBe(0); // inverted range for y axes
  });
  it("round ticks", () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0.1, 0.9, 4)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(niceTicks(5, 5)).toEqual([5]);
  });
  it("padding keeps a flat series visible", () => {
    expect(pad(0, 10, 0.1)).toEqual([-1, 11]);
    const [lo, hi] = pad(2, 2);
    expect(hi).toBeGreaterThan(lo);
  });
  it("paths", () => {
    expect(linePath([0, 10], [5, 6])).toBe("M0.0,5.0L10.0,6.0");
    expect(bandPath([0, 10], [8, 9], [2, 3])).toBe("M0.0,2.0L10.0,3.0L10.0,9.0L0.0,8.0Z");
    expect(bandPath([], [], [])).toBe("");
  });
  it("label positions spread over the axis", () => {
    expect(spread(3, 5)).toEqual([0, 1, 2]);
    expect(spread(10, 4)).toEqual([0, 3, 6, 9]);
  });
  it("short German dates", () => expect(shortDate("2026-03-02")).toBe("2.3."));
  it("a clicked point centres the window and stays inside the period", () => {
    expect(centredStart(45, 30, 90)).toBe(30);
    expect(centredStart(2, 30, 90)).toBe(0);
    expect(centredStart(89, 30, 90)).toBe(60);
  });
});

describe("board", () => {
  const b = makeBoard("combination", ["curves", "config"]);
  it("is a description of widgets with settings", () => {
    expect(b.widgets.map((w) => w.type)).toEqual(["curves", "config"]);
    expect(b.widgets[0].settings).toEqual({});
  });
  it("adds, changes and removes widgets; the same type can appear twice", () => {
    let s = boardReducer(b, { type: "add", widget: "curves", id: "c2" });
    expect(s.widgets.map((w) => w.type)).toEqual(["curves", "config", "curves"]);
    s = boardReducer(s, { type: "settings", id: "c2", patch: { mode: "mean" } });
    s = boardReducer(s, { type: "settings", id: "c2", patch: { x: "1" } });
    expect(s.widgets[2].settings).toEqual({ mode: "mean", x: "1" });
    expect(s.widgets[0].settings).toEqual({});
    s = boardReducer(s, { type: "remove", id: "curves-0" });
    expect(s.widgets.map((w) => w.id)).toEqual(["config-1", "c2"]);
  });
  it("is remembered per project and scope; unknown widget types are dropped", () => {
    localStorage.clear();
    const known = ["curves", "config"];
    saveBoard("P", boardReducer(b, { type: "remove", id: "config-1" }));
    expect(loadBoard("P", "combination", known, b).widgets.map((w) => w.type)).toEqual(["curves"]);
    expect(loadBoard("Q", "combination", known, b)).toBe(b);
    expect(loadBoard("P", "run", known, b)).toBe(b);
    localStorage.setItem("mlviz:v1:P:board:combination", JSON.stringify({ widgets: [{ id: "x", type: "gone" }, { id: "y", type: "curves" }] }));
    expect(loadBoard("P", "combination", known, b).widgets.map((w) => w.type)).toEqual(["curves"]);
    localStorage.setItem("mlviz:v1:P:board:combination", "nope");
    expect(loadBoard("P", "combination", known, b)).toBe(b);
  });
});
