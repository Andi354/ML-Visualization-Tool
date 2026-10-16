import { describe, expect, it } from "vitest";
import { readThemeVars, themeConfig, type ThemeVars } from "../src/widgets/own-theme";

const VARS: ThemeVars = {
  text: "#E4E8EF",
  text2: "#A1AABB",
  text3: "#8590A3",
  line: "#262E3E",
  surface: "#131720",
  accent: "#6E9BF5",
  accentBg: "#192640",
  series: ["#1FA3A3", "#C47F14", "#5A8DEE", "#D9607E", "#8C7CF0", "#6A9B33"],
  fontSans: '"IBM Plex Sans", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
};

describe("theme of own widgets", () => {
  it("draws with the series colours in their fixed order and the grid and text of the tokens", () => {
    const c = themeConfig(VARS);
    expect(c.range.category).toEqual(VARS.series);
    expect(c.axis).toMatchObject({ gridColor: "#262E3E", labelColor: "#A1AABB", titleColor: "#A1AABB" });
    expect(c.bar.fill).toBe("#1FA3A3");
    expect(c.line.stroke).toBe("#1FA3A3");
    expect(c.background).toBeNull(); // the tile or the export card is the background
  });
  it("uses IBM Plex: Sans for text, Mono for tick labels and numbers", () => {
    const c = themeConfig(VARS);
    expect(c.font).toBe("IBM Plex Sans");
    expect(c.axis.labelFont).toBe("IBM Plex Mono");
    expect(c.text.font).toBe("IBM Plex Mono");
  });
  it("falls back to the accent when no series colour is defined", () => {
    expect(themeConfig({ ...VARS, series: [] }).bar.fill).toBe("#6E9BF5");
  });
  it("reads the tokens as they resolve at an element, so the export card gets the light palette", () => {
    const dark = document.createElement("div");
    dark.style.cssText = "--text:#111;--text-2:#222;--text-3:#333;--line:#444;--surface:#555;--accent:#666;--accent-bg:#777;--font-sans:Foo, sans-serif;--font-mono:Bar, monospace;--series-1:#a;--series-2:#b";
    document.body.append(dark);
    const v = readThemeVars(dark);
    expect(v).toMatchObject({ text: "#111", line: "#444", accent: "#666", fontSans: "Foo, sans-serif" });
    expect(v.series).toEqual(["#a", "#b"]);
    dark.remove();
  });
});
