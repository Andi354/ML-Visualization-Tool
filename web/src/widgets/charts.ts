// Small chart helpers: scales, ticks and paths (pure, tested).

export interface Scale {
  (v: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const f = ((v: number) => (d1 === d0 ? (range[0] + range[1]) / 2 : range[0] + ((v - d0) / (d1 - d0)) * (range[1] - range[0]))) as Scale;
  f.domain = domain;
  f.range = range;
  return f;
}

/** Round tick values covering [lo, hi], about `count` of them. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

export function pad(lo: number, hi: number, share = 0.08): [number, number] {
  const d = hi - lo || Math.abs(hi) || 1;
  return [lo - d * share, hi + d * share];
}

export function linePath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
}

export function bandPath(xs: number[], lo: number[], hi: number[]): string {
  if (!xs.length) return "";
  const top = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${hi[i].toFixed(1)}`).join("");
  const bottom = xs
    .map((x, i) => `L${x.toFixed(1)},${lo[i].toFixed(1)}`)
    .reverse()
    .join("");
  return top + bottom + "Z";
}

/** Indices of about `n` evenly spread labels out of `len` points. */
export function spread(len: number, n: number): number[] {
  if (len <= n) return [...Array(len).keys()];
  return [...Array(n).keys()].map((i) => Math.round((i * (len - 1)) / (n - 1)));
}

/** "2026-03-02" -> "2.3." */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

/** Window of `days` points centred on index `centre`, kept inside [0, len). Returns the start index. */
export function centredStart(centre: number, days: number, len: number): number {
  return Math.max(0, Math.min(Math.round(centre - days / 2), len - days));
}
