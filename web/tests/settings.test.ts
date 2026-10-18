import { describe, expect, it } from "vitest";
import expected from "../../tests/settings_defaults.json";
import { DEFAULTS, ROWS } from "../src/settings/catalog";
import { applyStep, changedCount, fillPattern, makeStep, request, search } from "../src/settings/model";

describe("catalog", () => {
  it("has the defaults of the server, except settings that arrive with later updates", () => {
    const own = Object.fromEntries(Object.entries(DEFAULTS));
    const later = ["ana.hints", "ana.chips", "exp.hints"];
    expect(Object.keys(own).sort()).toEqual(Object.keys(expected).filter((k) => !later.includes(k)).sort());
    for (const [k, v] of Object.entries(own)) expect(v, k).toEqual((expected as Record<string, unknown>)[k]);
  });

  it("gives every row a label, a description and a known category", () => {
    for (const r of ROWS) expect(r.label && r.desc, r.key).toBeTruthy();
  });
});

describe("steps", () => {
  it("records only what changes and stores nothing for a default", () => {
    expect(makeStep({}, { "look.scale": 100 })).toBeNull();
    const step = makeStep({}, { "look.scale": 110, "look.density": "comfortable" })!;
    expect(step.after).toEqual({ "look.scale": 110 });
    expect(step.before).toEqual({ "look.scale": undefined });
  });

  it("sets back to the default as a reset and undoes it", () => {
    const values = { "look.scale": 110 };
    const step = makeStep(values, { "look.scale": 100 })!;
    expect(request(step.after)).toEqual({ set: {}, unset: ["look.scale"] });
    expect(applyStep(values, step.after)).toEqual({});
    expect(applyStep({}, step.before)).toEqual(values);
  });

  it("resets several keys in one step", () => {
    const values = { "look.scale": 110, "agent.mode": "direct" };
    const step = makeStep(values, {}, ["look.scale", "agent.mode", "agent.debug"])!;
    expect(Object.keys(step.after).sort()).toEqual(["agent.mode", "look.scale"]);
    expect(applyStep(values, step.after)).toEqual({});
  });
});

describe("search and counts", () => {
  const title = (id: string) => id;
  it("finds by label, description and key", () => {
    expect(search(ROWS, "größe", title).map((r) => r.key)).toContain("look.scale");
    expect(search(ROWS, "MLVIZ_CLAUDE", title).map((r) => r.key)).toContain("agent.claude");
    expect(search(ROWS, "zzzz", title)).toEqual([]);
  });
  it("counts changed values per category", () => {
    const values = { "look.scale": 110, "look.motion": false, "agent.mode": "direct" };
    expect(changedCount(values)).toBe(3);
    expect(changedCount(values, "look")).toBe(2);
  });
});

describe("patterns", () => {
  it("fills known placeholders and leaves the others", () => {
    expect(fillPattern("{nr}_{widget}.png", { nr: "01", widget: "curves" })).toBe("01_curves.png");
    expect(fillPattern("{x}/{nr}", { nr: "01" })).toBe("{x}/01");
  });
});
