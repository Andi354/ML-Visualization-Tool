import { describe, expect, it } from "vitest";
import { shortcutFor } from "../src/palette/commands";
import { match, parseInput, parts, rank } from "../src/palette/match";

describe("match", () => {
  it("finds a substring and reports where", () => {
    expect(match("läufe", "Zwei Läufe vergleichen")?.at).toEqual([5, 6, 7, 8, 9]);
  });
  it("finds letters that start words", () => {
    expect(match("zl", "Zwei Läufe vergleichen")?.at).toEqual([0, 5]);
    expect(match("zw", "Zwei Läufe")?.kind).toBe(0);
  });
  it("does not skip letters inside a word", () => {
    expect(match("zf", "Zwei Läufe")).toBeNull();
    expect(match("xyz", "Zwei Läufe")).toBeNull();
  });
  it("matches everything when nothing is typed", () => {
    expect(match("", "x")).toEqual({ kind: 0, score: 0, at: [] });
  });
});

describe("rank", () => {
  const texts = (s: string) => [s];
  it("puts substring matches before letter matches, earlier before later", () => {
    const out = rank(["Zwei Läufe", "Lauf öffnen", "Als Liste zeigen"], "lauf", texts).map((r) => r.item);
    expect(out).toEqual(["Lauf öffnen"]);
    const two = rank(["Alles zeigen", "Zeigen", "Zwei Läufe"], "ze", texts).map((r) => r.item);
    expect(two[0]).toBe("Zeigen");
    expect(rank(["a Zw", "Zwei"], "zw", texts).map((r) => r.item)).toEqual(["Zwei", "a Zw"]);
  });
  it("keeps the order when nothing is typed", () => {
    expect(rank(["b", "a"], " ", texts).map((r) => r.item)).toEqual(["b", "a"]);
  });
});

describe("parts and parseInput", () => {
  it("splits a text at the highlight", () => {
    expect(parts("abcd", [1, 2])).toEqual([{ t: "a", hit: false }, { t: "bc", hit: true }, { t: "d", hit: false }]);
  });
  it("reads the prefix", () => {
    expect(parseInput(">neu")).toEqual({ mode: "commands", query: "neu" });
    expect(parseInput("@dichte")).toEqual({ mode: "settings", query: "dichte" });
    expect(parseInput("?")).toEqual({ mode: "prefixes", query: "" });
    expect(parseInput("best")).toEqual({ mode: "runs", query: "best" });
  });
});

describe("shortcuts", () => {
  const key = (init: KeyboardEventInit) => shortcutFor(new KeyboardEvent("keydown", init));
  it("maps the keys of the palette", () => {
    expect(key({ key: "P", ctrlKey: true, shiftKey: true })).toBe("commands");
    expect(key({ key: "F1" })).toBe("commands");
    expect(key({ key: "p", ctrlKey: true })).toBe("runs");
    expect(key({ key: "j", metaKey: true })).toBe("agent");
    expect(key({ key: "s", ctrlKey: true })).toBe("save");
    expect(key({ key: "+", ctrlKey: true })).toBe("bigger");
    expect(key({ key: "-", ctrlKey: true })).toBe("smaller");
    expect(key({ key: "p" })).toBeNull();
  });
});
