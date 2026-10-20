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

  it("carries the graphite colours", () => {
    for (const [name, hex] of Object.entries({
      bg: "#131315",
      surface: "#1C1C20",
      accent: "#8AA4FF",
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
    expect(css).toContain("--icon-bar: 56px;");
    expect(css).toContain("--tab-strip: 38px;");
    expect(css).toContain("--radius-panel: 12px;");
  });

  it("is dark only: no light-theme override of the page colours", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });

  it("has the light export palette as an opt-in class for exported images", () => {
    const light = css.slice(css.indexOf(".theme-light"));
    for (const [name, hex] of Object.entries({
      bg: "#FFFFFF",
      raised: "#F1F3F6",
      line: "#E3E6EB",
      text: "#1A1F29",
      best: "#0F7A52",
      "best-bg": "#E3F4EC",
      "series-1": "#1A8C8C",
      "series-5": "#7262D9",
    }))
      expect(light).toContain(`--${name}: ${hex};`);
    expect(css.slice(0, css.indexOf(".theme-light"))).toContain("--bg: #131315;"); // the app stays dark
  });
});
