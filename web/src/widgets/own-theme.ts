// The theme the tool applies to own widgets (Vega-Lite): fonts, series colours, grid and text come from the
// design tokens, so an own widget looks like a built-in one, dark on the board and light in the export.
// A description sets none of these (own_widgets.py refuses colours and fonts).

export interface ThemeVars {
  text: string;
  text2: string;
  text3: string;
  line: string;
  surface: string;
  accent: string;
  accentBg: string;
  series: string[];
  fontSans: string;
  fontMono: string;
}

const TOKENS: [keyof Omit<ThemeVars, "series">, string][] = [
  ["text", "--text"],
  ["text2", "--text-2"],
  ["text3", "--text-3"],
  ["line", "--line"],
  ["surface", "--surface"],
  ["accent", "--accent"],
  ["accentBg", "--accent-bg"],
  ["fontSans", "--font-sans"],
  ["fontMono", "--font-mono"],
];

/** Token values as they resolve at an element (the export card carries `.theme-light`). */
export function readThemeVars(el: Element): ThemeVars {
  const css = getComputedStyle(el);
  const get = (name: string) => css.getPropertyValue(name).trim();
  const vars = Object.fromEntries(TOKENS.map(([k, n]) => [k, get(n)])) as Omit<ThemeVars, "series">;
  return { ...vars, series: [1, 2, 3, 4, 5, 6].map((i) => get(`--series-${i}`)).filter(Boolean) };
}

/** Vega-Lite `config` for the tokens. */
export function themeConfig(v: ThemeVars) {
  const font = v.fontSans.split(",")[0].replace(/["']/g, "").trim();
  const mono = v.fontMono.split(",")[0].replace(/["']/g, "").trim();
  const main = v.series[0] ?? v.accent;
  return {
    background: null,
    font,
    view: { stroke: "transparent" },
    axis: {
      domainColor: v.line,
      gridColor: v.line,
      tickColor: v.line,
      labelColor: v.text2,
      titleColor: v.text2,
      labelFont: mono,
      titleFont: font,
      labelFontSize: 11,
      titleFontSize: 12,
      titleFontWeight: 400,
      titlePadding: 10,
      labelPadding: 4,
    },
    legend: { labelColor: v.text2, titleColor: v.text2, labelFont: font, titleFont: font, labelFontSize: 12, titleFontSize: 12, titleFontWeight: 400 },
    title: { color: v.text, font, fontSize: 13, fontWeight: 600 },
    header: { labelColor: v.text2, titleColor: v.text2, labelFont: font, titleFont: font },
    range: {
      category: v.series,
      ordinal: v.series,
      ramp: [v.accentBg, v.accent],
      heatmap: [v.accentBg, v.accent],
    },
    mark: { color: main },
    bar: { fill: main, cornerRadiusEnd: 2 },
    line: { stroke: main, strokeWidth: 2 },
    point: { fill: main, filled: true, size: 50 },
    area: { fill: main, opacity: 0.5 },
    tick: { stroke: main },
    rect: { fill: main },
    text: { color: v.text, font: mono, fontSize: 10 },
  };
}
