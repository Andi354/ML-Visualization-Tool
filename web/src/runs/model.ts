// Pure logic of the Läufe area (feature C): filtering, grouping into issue blocks, texts, timeline.
import type { IssueInfo, ProjectInfo, RunRow } from "../api";
import { formatInt, formatNumber } from "../format";

export type StatusFilter = "all" | "running" | "errors";
export interface Filters {
  q: string;
  status: StatusFilter;
  epoch: string; // "all" or an epoch name
}

export const noFilters: Filters = { q: "", status: "all", epoch: "all" };

const DAY = 86_400_000;
export const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);

/** Epoch of the newest runs; older epochs are flagged. Null when the project has no epochs.yaml. */
export const currentEpoch = (p: ProjectInfo): string | null =>
  p.epochs.length ? p.epochs[p.epochs.length - 1].name : null;

export function matchRun(run: RunRow, issues: Record<string, IssueInfo>, f: Filters): boolean {
  if (f.status === "running" && !run.running) return false;
  if (f.status === "errors" && run.errors === 0) return false;
  if (f.epoch !== "all" && run.epoch !== f.epoch) return false;
  const q = f.q.trim().toLowerCase();
  if (!q) return true;
  const hay = [run.name, run.id, run.issue ?? "", run.issue ? (issues[run.issue]?.title ?? "") : "", ...run.axes];
  return hay.join(" ").toLowerCase().includes(q);
}

/** One experiment = one config; its runs, newest first. */
export interface Experiment {
  name: string;
  runs: RunRow[];
}

export type Block =
  | { kind: "issue"; key: string; last: number; runs: RunRow[]; experiments: Experiment[] }
  | { kind: "standalone"; key: string; last: number; run: RunRow };

/** Issue blocks and standalone runs, sorted by their newest run. Input order is irrelevant. */
export function buildBlocks(runs: RunRow[]): Block[] {
  const sorted = [...runs].sort((a, b) => time(b.started) - time(a.started));
  const byIssue = new Map<string, Block & { kind: "issue" }>();
  const blocks: Block[] = [];
  for (const r of sorted) {
    if (!r.issue) {
      blocks.push({ kind: "standalone", key: r.id, last: time(r.started), run: r });
      continue;
    }
    let b = byIssue.get(r.issue);
    if (!b) {
      b = { kind: "issue", key: r.issue, last: time(r.started), runs: [], experiments: [] };
      byIssue.set(r.issue, b);
      blocks.push(b);
    }
    b.runs.push(r);
    let e = b.experiments.find((x) => x.name === r.name);
    if (!e) b.experiments.push((e = { name: r.name, runs: [] }));
    e.runs.push(r);
  }
  return blocks;
}

/** Issue blocks expanded by default: a run in the last 7 days, or a search / status filter is active. */
export function isOpen(b: Block & { kind: "issue" }, now: number, f: Filters, override?: boolean): boolean {
  if (override !== undefined) return override;
  return b.last >= now - 7 * DAY || f.q.trim() !== "" || f.status !== "all";
}

// --- texts -----------------------------------------------------------------------------------
export function relTime(nowIso: string, iso: string | number | null): string {
  if (iso === null || iso === "") return "";
  const now = new Date(nowIso);
  const d = new Date(iso);
  const days = Math.floor((now.getTime() - d.getTime()) / DAY);
  if (days <= 0) return `heute ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** Run name without the issue prefix ("TIM-52_best_30" -> "best_30"). */
export const shortName = (r: { name: string; issue: string | null }): string =>
  r.issue && r.name.startsWith(r.issue + "_") ? r.name.slice(r.issue.length + 1) : r.name;

/** Timestamp part of a run, as shown for older runs ("2026-10-08 11:20"). */
export function stamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Not finished: running, or stalled (nothing written for a while, a crash or one very long cell). */
const unfinished = (r: RunRow) => r.state === "running" || r.state === "stalled";

export function cellText(r: RunRow): string {
  if (unfinished(r)) return `${formatInt(r.cells)} / ${formatInt(r.planned)}`;
  return `${formatInt(r.cells)} Zellen` + (r.errors ? ` · ${formatInt(r.errors)} Fehler` : "");
}

/** Widths in percent of the cell bar: successful and failed cells (against planned while running). */
export function cellBar(r: RunRow): { ok: number; err: number } {
  const den = Math.max(unfinished(r) ? r.planned : r.cells, 1);
  return { ok: ((r.cells - r.errors) / den) * 100, err: (r.errors / den) * 100 };
}

export function bestText(r: RunRow): { value: string; note: string } {
  if (!r.best) return { value: "–", note: "" };
  const v = formatNumber(r.best.value * r.best.scale, 2) + (r.best.unit ? " " + r.best.unit : "");
  const parts = [r.best.label];
  if (r.merkmal) parts.push(`${r.merkmal.label} ${r.merkmal.value}`);
  if (unfinished(r)) parts.push("vorläufig");
  return { value: v, note: parts.join(" · ") };
}

export function flags(r: RunRow, current: string | null): { text: string; kind: "running" | "warn"; title?: string }[] {
  const out: { text: string; kind: "running" | "warn"; title?: string }[] = [];
  if (r.problem) out.push({ text: "⚠ nicht lesbar", kind: "warn", title: r.problem });
  if (r.running) out.push({ text: "● läuft", kind: "running" });
  if (r.state === "stalled") out.push({ text: "◐ steht still", kind: "warn" });
  if (current && r.epoch && r.epoch !== current) out.push({ text: `Epoche ${r.epoch}`, kind: "warn" });
  return out;
}

export function extras(r: RunRow): string[] {
  const out: string[] = [];
  if (r.has_curves) out.push("Kurven");
  if (r.has_predictions) out.push("Vorhersagen");
  if (r.migrated) out.push("migriert");
  return out;
}

export function secondLine(r: RunRow, standalone: boolean): string {
  const ex = extras(r);
  return (standalone ? "ohne Issue · " : "") + r.axes.join(" · ") + (ex.length ? "   —   " + ex.join(" · ") : "");
}

export function statusColor(i: IssueInfo | undefined): string {
  if (!i?.status) return "var(--text-3)";
  const named: Record<string, string> = { "In Review": "var(--warn)" };
  if (named[i.status]) return named[i.status];
  switch (i.status_type) {
    case "started":
      return "var(--accent)";
    case "completed":
      return "var(--best)";
    case "canceled":
      return "var(--text-3)";
    default:
      return "var(--text-2)";
  }
}

export const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// --- timeline "Verlauf" --------------------------------------------------------------------
export interface TlPoint {
  id: string;
  x: number; // 0..100 percent of the time axis
  y: number; // 0..100 percent from the top
  value: number; // displayed value
  older: boolean; // run of an older epoch
  series: number; // index into the series colours, or -1 for "Other"
}
export interface Timeline {
  points: TlPoint[];
  series: { value: string; index: number }[];
  /** Best-so-far step lines per series (current epoch only), as `x,y` pairs in a 1000 x 100 box. */
  lines: { index: number; points: string }[];
  epochX: number | null;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  label: string;
}

const numericFirst = (a: string, b: string) => {
  const na = Number(a);
  const nb = Number(b);
  return Number.isNaN(na) || Number.isNaN(nb) ? a.localeCompare(b) : na - nb;
};

export function buildTimeline(runs: RunRow[], p: ProjectInfo): Timeline | null {
  const pts = runs.filter((r) => r.best && r.started);
  if (!pts.length) return null;
  const cur = currentEpoch(p);
  const values = [...new Set(pts.map((r) => r.merkmal?.value ?? ""))].sort(numericFirst);
  const seriesIndex = (v: string) => (values.indexOf(v) < 6 ? values.indexOf(v) : -1);
  const scaled = (r: RunRow) => r.best!.value * r.best!.scale;

  const epochSince = cur ? p.epochs[p.epochs.length - 1].since : undefined;
  const t = pts.map((r) => time(r.started));
  const epochT = epochSince ? new Date(epochSince).getTime() : null;
  let t0 = Math.min(...t);
  let t1 = Math.max(...t);
  if (epochT !== null && epochT > t0 && epochT < t1) {
    /* epoch start lies inside the range */
  }
  if (t1 === t0) t1 = t0 + DAY;
  const span = t1 - t0;
  t0 -= span * 0.03;
  t1 += span * 0.03;
  const vals = pts.map(scaled);
  let v0 = Math.min(...vals);
  let v1 = Math.max(...vals);
  if (v1 === v0) v1 = v0 + 1;
  const pad = (v1 - v0) * 0.1;
  v0 -= pad;
  v1 += pad;
  const x = (ms: number) => ((ms - t0) / (t1 - t0)) * 100;
  const y = (v: number) => (1 - (v - v0) / (v1 - v0)) * 100;

  const asc = [...pts].sort((a, b) => time(a.started) - time(b.started));
  const points: TlPoint[] = asc.map((r) => ({
    id: r.id,
    x: x(time(r.started)),
    y: y(scaled(r)),
    value: scaled(r),
    older: !!cur && !!r.epoch && r.epoch !== cur,
    series: seriesIndex(r.merkmal?.value ?? ""),
  }));

  const lines = values
    .map((v, i) => ({ v, i }))
    .filter(({ i }) => i < 6)
    .map(({ v, i }) => {
      let best: number | null = null;
      const out: string[] = [];
      for (const r of asc.filter((r) => (r.merkmal?.value ?? "") === v && !(cur && r.epoch && r.epoch !== cur))) {
        const xx = (x(time(r.started)) * 10).toFixed(1);
        if (best !== null) out.push(`${xx},${(y(best)).toFixed(1)}`);
        if (best === null || scaled(r) < best) best = scaled(r);
        out.push(`${xx},${y(best).toFixed(1)}`);
      }
      if (best !== null) out.push(`1000,${y(best).toFixed(1)}`);
      return { index: i, points: out.join(" ") };
    })
    .filter((l) => l.points);

  const first = pts[0].best!;
  const yTicks = [0, 1, 2, 3].map((k) => {
    const v = v1 - ((v1 - v0) * (k + 0.5)) / 4;
    return { y: y(v), label: formatNumber(v, 1) + (first.unit ? " " + first.unit : "") };
  });
  const xTicks = [0, 1, 2, 3].map((k) => {
    const ms = t0 + ((t1 - t0) * (k + 0.5)) / 4;
    const d = new Date(ms);
    return { x: x(ms), label: `${d.getDate()}.${d.getMonth() + 1}.` };
  });
  return {
    points,
    series: values.map((value, index) => ({ value, index: seriesIndex(value) })),
    lines,
    epochX: epochT !== null && epochT > t0 && epochT < t1 ? x(epochT) : null,
    yTicks,
    xTicks,
    label: `bester ${first.label} je Lauf · Linie = bester bisher in der aktuellen Epoche · Klick auf Punkt markiert den Lauf`,
  };
}
