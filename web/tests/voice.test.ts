import { describe, expect, it } from "vitest";
import { clock, combine, options, pick, termCount, textOf, type Segment, type TermSeg } from "../src/voice/model";

const segs = (): Segment[] => [
  { text: "nimm " },
  { term: "best_90", heard: "best 90", kind: "Lauf", alts: ["best_30", "best_60"] },
  { text: " bitte" },
];

describe("review box model", () => {
  it("joins the segments to the text and counts the terms", () => {
    expect(textOf(segs())).toBe("nimm best_90 bitte");
    expect(termCount(segs())).toBe(1);
  });
  it("replaces a term and marks it as changed; choosing the recognised one clears the mark", () => {
    const changed = pick(segs(), 1, "best_30");
    expect(textOf(changed)).toBe("nimm best_30 bitte");
    expect((changed[1] as TermSeg).changed).toBe(true);
    const back = pick(changed, 1, "best_90");
    expect((back[1] as TermSeg).changed).toBe(false);
  });
  it("offers the recognised term, the alternatives and the heard words", () => {
    const o = options(segs()[1] as TermSeg);
    expect(o.map((x) => x.value)).toEqual(["best_90", "best_30", "best_60", "best 90"]);
    expect(o[0].label).toBe("erkannt");
    expect(o[3].label).toBe("wie gehört");
    const after = pick(segs(), 1, "best_30")[1] as TermSeg;
    expect(options(after)[0]).toEqual({ value: "best_90", label: "erkannt" });
  });
  it("formats time and combines typed and spoken text", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(75.4)).toBe("1:15");
    expect(combine("Bitte ", "zeig das")).toBe("Bitte zeig das");
    expect(combine("", "nur gesprochen")).toBe("nur gesprochen");
  });
});
