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
    expect(loadBoard("proj", "run", ["a", "b", "c"], board())).toEqual({ ...b, draft: null });
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

describe("board: draft of an own widget", () => {
  const def = { name: "MAPE je Region", question: "?", scope: "one" as const, data: { source: "cells" }, spec: { mark: "bar" } };
  it("a draft appears with the width its description asks for, half by default", () => {
    expect(boardReducer(board(), { type: "set-draft", definition: def }).draft).toEqual({ definition: def, width: "half" });
    expect(boardReducer(board(), { type: "set-draft", definition: { ...def, width: "full" } }).draft?.width).toBe("full");
  });
  it("a new draft replaces the open one", () => {
    const first = boardReducer(board(), { type: "set-draft", definition: def });
    const second = boardReducer(first, { type: "set-draft", definition: { ...def, name: "Zweiter" } });
    expect(second.draft?.definition.name).toBe("Zweiter");
  });
  it("changes the width of the draft, and does nothing without one", () => {
    const b = boardReducer(boardReducer(board(), { type: "set-draft", definition: def }), { type: "draft-width", width: "full" });
    expect(b.draft?.width).toBe("full");
    const plain = board();
    expect(boardReducer(plain, { type: "draft-width", width: "full" })).toBe(plain);
  });
  it("discarding removes the draft and leaves the tiles", () => {
    const b = boardReducer(boardReducer(board(), { type: "set-draft", definition: def }), { type: "discard-draft" });
    expect(b.draft).toBeNull();
    expect(order(b)).toEqual(["a-0", "b-1", "c-2"]);
  });
  it("keeping makes a tile of the own widget in the first position with the width of the draft", () => {
    let b = boardReducer(board(), { type: "set-draft", definition: def });
    b = boardReducer(b, { type: "draft-width", width: "full" });
    b = boardReducer(b, { type: "keep-draft", key: "own:mape-je-region", id: "own-1" });
    expect(b.draft).toBeNull();
    expect(b.widgets[0]).toEqual({ id: "own-1", type: "own:mape-je-region", settings: {}, width: "full" });
    expect(order(b)).toEqual(["own-1", "a-0", "b-1", "c-2"]);
    const plain = board();
    expect(boardReducer(plain, { type: "keep-draft", key: "own:x", id: "x" })).toBe(plain);
  });
  it("the draft and own tiles survive a reload, junk drafts do not", () => {
    const b = boardReducer(boardReducer(board(), { type: "set-draft", definition: def }), { type: "add", widget: "own:x", id: "own:x-1" });
    saveBoard("owns", b);
    const back = loadBoard("owns", "run", ["a", "b", "c"], board());
    expect(back.draft?.definition.name).toBe("MAPE je Region");
    expect(back.widgets.some((w) => w.type === "own:x")).toBe(true); // not in the built-in catalog, still kept
    localStorage.setItem("mlviz:v1:junk2:board:run", JSON.stringify({ scope: "run", widgets: [], draft: { definition: { name: 5 } } }));
    expect(loadBoard("junk2", "run", [], board()).draft).toBeNull();
  });
});
