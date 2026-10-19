// Pure logic of the experiment view (feature D): dimension state, chips, columns, formatting.
import type { Dim, DimQuery, Metric, TableQuery } from "../api";
import { formatInt, formatNumber } from "../format";
import { loadJson, saveJson, storageKey } from "../state/storage";

export type DimState = Record<string, DimQuery>;

export const defaultMode = (d: Dim): DimQuery["mode"] => (d.kind === "axis" ? "split" : "agg");

export const dimState = (state: DimState, d: Dim): DimQuery =>
  state[d.key] ?? { mode: defaultMode(d), sel: [] };

export function setDim(state: DimState, d: Dim, patch: Partial<DimQuery>): DimState {
  return { ...state, [d.key]: { ...dimState(state, d), ...patch } };
}

export function toggleValue(state: DimState, d: Dim, value: string): DimState {
  const cur = dimState(state, d);
  const sel = cur.sel.includes(value) ? cur.sel.filter((v) => v !== value) : [...cur.sel, value];
  return setDim(state, d, { sel });
}

export function resetDim(state: DimState, d: Dim): DimState {
  const next = { ...state };
  delete next[d.key];
  return next;
}

/** State tag of a collapsed sidebar row. */
export function stateTag(d: Dim, s: DimQuery): { text: string; accent: boolean } {
  const split = s.mode === "split";
  const sel =
    s.sel.length === 0 ? "" : s.sel.length === 1 ? `= ${s.sel[0]}` : `${s.sel.length} von ${d.values.length}`;
  if (split) return { text: sel || (d.kind === "channel" ? "je Kanal" : "geteilt"), accent: true };
  return { text: "Ø" + (sel ? ` · ${sel}` : ""), accent: false };
}

export interface Chip {
  dim: Dim;
  label: string;
}

/** One chip per deviation from the defaults; its × returns the dimension to its default. */
export function chips(dims: Dim[], state: DimState): Chip[] {
  const out: Chip[] = [];
  for (const d of dims) {
    const s = dimState(state, d);
    if (s.mode !== defaultMode(d)) {
      out.push({
        dim: d,
        label: d.kind === "axis" ? `Ø ${d.key}` : d.kind === "channel" ? "je Kanal" : `${d.key} geteilt`,
      });
    }
    if (s.sel.length) out.push({ dim: d, label: `${d.key} ∈ ${s.sel.join(", ")}` });
  }
  return out;
}

export function buildQuery(
  state: DimState,
  sort: { metric: string | null; stat: "mean" | "min" | "max" | "n"; dir: "asc" | "desc" | null },
  overview: boolean,
): Partial<TableQuery> {
  return { dims: state, sort, overview };
}

/** Value formatting of metrics: stored value times `scale`, German number format, optional unit. */
export function metricDigits(v: number): number {
  const a = Math.abs(v);
  if (a >= 1000) return 0;
  if (a >= 100) return 1;
  if (a >= 10) return 2;
  if (a >= 1) return 3;
  return 4;
}

export function formatMetric(m: Metric | undefined, v: number | null | undefined, withUnit = true): string {
  if (v === null || v === undefined) return "–";
  const x = v * (m?.scale ?? 1);
  return formatNumber(x, metricDigits(x)) + (withUnit && m?.unit ? " " + m.unit : "");
}

export const formatSd = (m: Metric | undefined, v: number | null | undefined): string =>
  v === null || v === undefined ? "" : "± " + formatMetric(m, v, false);

// --- columns (remembered per project) -----------------------------------------------------------
export type SdMode = "under" | "column" | "off";
export interface Columns {
  /** Visible metric keys; null = default. */
  metrics: string[] | null;
  n: boolean;
  min: boolean;
  max: boolean;
  status: boolean;
  sd: SdMode;
}

export const defaultColumns: Columns = { metrics: null, n: true, min: false, max: false, status: true, sd: "under" };

/** The metrics named in the setting `runs.columns` ("mape, mae"): by key or label, unknown names are ignored. */
export function presetMetrics(metrics: Metric[], preset: string): string[] {
  const names = preset.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return metrics.filter((m) => names.includes(m.key.toLowerCase()) || names.includes(m.label.toLowerCase())).map((m) => m.key);
}

/** The metrics of the setting if it names any, else the primary metric plus the first real metric (only the primary if it is real itself). */
export function defaultMetrics(metrics: Metric[], primary: string | null, preset = ""): string[] {
  const named = presetMetrics(metrics, preset);
  if (named.length) return named;
  const keys = metrics.map((m) => m.key);
  const first = (primary && keys.includes(primary) ? primary : keys[0]) ?? null;
  if (!first) return [];
  const p = metrics.find((m) => m.key === first)!;
  const real = metrics.find((m) => m.family === "real");
  return p.family === "real" || !real ? [first] : [first, real.key];
}

export function visibleMetrics(c: Columns, metrics: Metric[], primary: string | null, preset = ""): string[] {
  const chosen = c.metrics ?? defaultMetrics(metrics, primary, preset);
  return metrics.map((m) => m.key).filter((k) => chosen.includes(k)); // catalogue order
}

export function columnCount(c: Columns, metrics: Metric[], primary: string | null, preset = "") {
  const visible = visibleMetrics(c, metrics, primary, preset).length + [c.n, c.min, c.max, c.status].filter(Boolean).length;
  return { visible, total: metrics.length + 4 };
}

function validColumns(v: unknown): Columns | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const sd = o.sd === "column" || o.sd === "off" ? o.sd : "under";
  return {
    metrics: Array.isArray(o.metrics) ? o.metrics.filter((x): x is string => typeof x === "string") : null,
    n: o.n !== false,
    min: o.min === true,
    max: o.max === true,
    status: o.status !== false,
    sd,
  };
}
export const loadColumns = (project: string): Columns =>
  loadJson(storageKey(project, "columns"), validColumns) ?? defaultColumns;
export const saveColumns = (project: string, c: Columns) => saveJson(storageKey(project, "columns"), c);

// --- sort ---------------------------------------------------------------------------------------
export interface Sort {
  metric: string | null;
  stat: "mean" | "min" | "max" | "n";
  dir: "asc" | "desc" | null; // null: backend default (primary, best first)
}

/** First click on a metric head sorts ascending, the second descending, then back and forth. */
export function nextSort(cur: Sort, metric: string): Sort {
  if (cur.metric === metric && cur.stat === "mean" && cur.dir === "asc") return { metric, stat: "mean", dir: "desc" };
  return { metric, stat: "mean", dir: "asc" };
}

// --- sidebar search -----------------------------------------------------------------------------
const has = (s: string, q: string) => s.toLowerCase().includes(q);

export function dimMatches(d: Dim, q: string): { row: boolean; values: boolean } {
  if (!q) return { row: true, values: false };
  const values = d.values.some((v) => has(v.value, q));
  return { row: has(d.key, q) || values, values };
}

export function filterConstants(
  blocks: { block: string; rows: { key: string; value: string }[] }[],
  q: string,
) {
  if (!q) return blocks;
  return blocks
    .map((b) => ({ ...b, rows: b.rows.filter((r) => has(r.key, q) || has(r.value, q) || has(b.block, q)) }))
    .filter((b) => b.rows.length);
}

export const constantCount = (blocks: { rows: unknown[] }[]) => blocks.reduce((a, b) => a + b.rows.length, 0);

// --- summary ------------------------------------------------------------------------------------
export function summary(groups: number, cells: number, shown: number): string {
  const base = `${formatInt(groups)} Gruppen · ${formatInt(cells)} Zellen`;
  return groups > shown ? `${base} · sortiert über alle` : base;
}
