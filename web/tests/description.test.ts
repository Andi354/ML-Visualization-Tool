import { beforeEach, describe, expect, it } from "vitest";
import type { Description } from "../src/api";
import { foldLabel, gridColumns, loadFolds, paragraphs, problemText, saveFolds, sections } from "../src/experiment/description";

const full: Description = {
  short: "Kurz",
  purpose: "Erster Absatz.\nZweiter Absatz.",
  shows: ["a", "b"],
  expectation: "Erwartet",
  notes: ["n1"],
  compare_to: [],
  problems: [],
};

describe("sections", () => {
  it("come in a fixed order with the labels of the screen", () => {
    expect(sections(full).map((s) => [s.key, s.label])).toEqual([
      ["purpose", "Zweck"],
      ["shows", "Soll zeigen"],
      ["expectation", "Erwartung"],
      ["notes", "Notizen"],
    ]);
  });
  it("leave out empty fields", () => {
    const d = { ...full, notes: [], expectation: null, purpose: "  " };
    expect(sections(d).map((s) => s.key)).toEqual(["shows"]);
  });
  it("split text at line breaks and keep lists as items", () => {
    const [purpose, shows] = sections(full);
    expect(purpose.paragraphs).toEqual(["Erster Absatz.", "Zweiter Absatz."]);
    expect(shows.items).toEqual(["a", "b"]);
  });
  it("do not interpret Markdown", () => {
    expect(paragraphs("**x**\n# y")).toEqual(["**x**", "# y"]);
  });
});

describe("layout", () => {
  it("gives Zweck 1.5 parts and every other field 1 part", () => {
    expect(gridColumns(sections(full))).toBe("minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)");
    expect(gridColumns(sections({ ...full, purpose: null }))).toBe("minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)");
  });
  it("labels the fold toggle", () => {
    expect(foldLabel(true)).toBe("zuklappen ▴");
    expect(foldLabel(false)).toBe("aufklappen ▾");
  });
});

describe("problems", () => {
  it("are none for a complete description", () => {
    expect(problemText(full)).toBeNull();
  });
  it("are joined with a middle dot", () => {
    expect(problemText({ ...full, problems: ["shows fehlt", "x"] })).toBe("Beschreibung unvollständig: shows fehlt · x");
  });
});

describe("folds per run", () => {
  beforeEach(() => localStorage.clear());
  it("are kept per project and survive a reload", () => {
    saveFolds("p", { r1: true, r2: false });
    expect(loadFolds("p")).toEqual({ r1: true, r2: false });
    expect(loadFolds("other")).toEqual({});
  });
  it("ignore junk in the storage", () => {
    localStorage.setItem("mlviz:v1:p:description-folds", JSON.stringify({ a: "x", b: true }));
    expect(loadFolds("p")).toEqual({ b: true });
    localStorage.setItem("mlviz:v1:p:description-folds", "[1]");
    expect(loadFolds("p")).toEqual({});
  });
});
