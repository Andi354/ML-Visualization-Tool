import { describe, expect, it } from "vitest";
import { boardReducer, loadBoard, makeBoard, saveBoard, type Board } from "../src/widgets/board";

const board = (): Board => makeBoard("run", ["a", "b", "c"], { b: "full" });
const order = (b: Board) => b.widgets.map((w) => w.id);

describe("board: width", () => {
  it("a new board takes the default width of each type (half if unknown)", () => {
    expect(board().widgets.map((w) => w.width)).toEqual(["half", "full", "half"]);
  });
  it("adding a widget takes the given width, half by default", () => {
    const b = boardReducer(board(), { type: "add", widget: "d", id: "d-1", width: "full" });
    expect(b.widgets.at(-1)).toMatchObject({ type: "d", width: "full", settings: {} });
    expect(boardReducer(board(), { type: "add", widget: "d", id: "d-2" }).widgets.at(-1)?.width).toBe("half");
  });
  it("changes the width of one tile only", () => {
    const b = boardReducer(board(), { type: "width", id: "a-0", width: "full" });
    expect(b.widgets.map((w) => w.width)).toEqual(["full", "full", "half"]);
  });
});

describe("board: order", () => {
  it("moves a tile one position earlier or later", () => {
    expect(order(boardReducer(board(), { type: "move", id: "b-1", dir: -1 }))).toEqual(["b-1", "a-0", "c-2"]);
    expect(order(boardReducer(board(), { type: "move", id: "b-1", dir: 1 }))).toEqual(["a-0", "c-2", "b-1"]);
  });
  it("does nothing at the ends or for an unknown tile", () => {
    const b = board();
    expect(boardReducer(b, { type: "move", id: "a-0", dir: -1 })).toBe(b);
    expect(boardReducer(b, { type: "move", id: "c-2", dir: 1 })).toBe(b);
    expect(boardReducer(b, { type: "move", id: "nope", dir: 1 })).toBe(b);
  });
  it("keeps settings and width when a tile moves", () => {
    let b = boardReducer(board(), { type: "settings", id: "b-1", patch: { rows: "x" } });
    b = boardReducer(b, { type: "move", id: "b-1", dir: -1 });
    expect(b.widgets[0]).toMatchObject({ id: "b-1", width: "full", settings: { rows: "x" } });
  });
});

describe("board: stored per project and scope", () => {
  it("stores width and order and reads them back", () => {
    let b = boardReducer(board(), { type: "move", id: "c-2", dir: -1 });
    b = boardReducer(b, { type: "width", id: "a-0", width: "full" });
    saveBoard("proj", b);
    expect(loadBoard("proj", "run", ["a", "b", "c"], board())).toEqual(b);
  });
  it("a board stored before widths existed gets the default width of each type", () => {
    localStorage.setItem(
      "mlviz:v1:old:board:run",
      JSON.stringify({ scope: "run", widgets: [{ id: "a-0", type: "a", settings: {} }, { id: "b-1", type: "b", settings: {} }] }),
    );
    const b = loadBoard("old", "run", ["a", "b"], board(), { a: "half", b: "full" });
    expect(b.widgets.map((w) => w.width)).toEqual(["half", "full"]);
  });
  it("junk widths fall back to the default and unknown types are dropped", () => {
    localStorage.setItem(
      "mlviz:v1:junk:board:run",
      JSON.stringify({ scope: "run", widgets: [{ id: "a-0", type: "a", settings: {}, width: "wide" }, { id: "z", type: "gone", settings: {} }] }),
    );
    const b = loadBoard("junk", "run", ["a"], board());
    expect(b.widgets).toEqual([{ id: "a-0", type: "a", settings: {}, width: "half" }]);
  });
});
