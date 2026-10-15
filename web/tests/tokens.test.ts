import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ES module without types
import { tokensToCss } from "../scripts/gen-tokens.mjs";

const tokens = JSON.parse(readFileSync(resolve(__dirname, "../../design/tokens.json"), "utf8"));
const css = readFileSync(resolve(__dirname, "../src/tokens.css"), "utf8");

describe("design tokens (feature A)", () => {
  it("tokens.css is up to date with design/tokens.json", () => {
    expect(css).toBe(tokensToCss(tokens));
  });

  it("carries the A5 Schiefer colours", () => {
    for (const [name, hex] of Object.entries({
      bg: "#0D1016",
      surface: "#131720",
      accent: "#6E9BF5",
      best: "#5FD4A0",
      error: "#FF6B6B",
      warn: "#F0B44C",
    }))
      expect(css).toContain(`--${name}: ${hex};`);
  });

  it("has the six chart series in fixed order", () => {
    const series = [1, 2, 3, 4, 5, 6].map((i) => css.match(new RegExp(`--series-${i}: (#[0-9A-F]{6});`))![1]);
    expect(series).toEqual(tokens.color.series);
  });

  it("has diverging pair, density and sizes", () => {
    expect(css).toContain("--better: #1FA3A3;");
    expect(css).toContain("--worse: #C47F14;");
    expect(css).toContain("--row-height: 34px;");
    expect(css).toContain("--icon-bar: 52px;");
    expect(css).toContain("--tab-strip: 36px;");
    expect(css).toContain("--radius-panel: 6px;");
  });

  it("is dark only: no light-theme override of the page colours", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });
});
