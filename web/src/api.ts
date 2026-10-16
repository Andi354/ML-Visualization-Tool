export interface Metric {
  key: string;
  label: string;
  direction: "min" | "max";
  family: "real" | "scaled" | string;
  /** Display: stored value times `scale`, followed by `unit`. */
  unit: string;
  scale: number;
}

export interface ProjectInfo {
  name: string;
  short: string;
  now: string;
  primary_metric: string | null;
  metrics: Metric[];
  epochs: { name: string; since?: string; description?: string }[];
  own_model: { axis: string; value: string } | null;
  paths: Record<string, string>;
  /** Project file content that is present but in no known form (shown at the top of the frame). */
  warnings: string[];
  linear: boolean;
}

export interface RunInfo {
  id: string;
  name: string;
  issue: string | null;
  started: string | null;
  ended: string | null;
  /** `finished`, `running` or `stalled` (not finished and nothing written for a while). */
  state: "finished" | "running" | "stalled" | "unsupported";
  /** Why the run cannot be shown (`unsupported`: written by a newer ds-store), else null. */
  problem: string | null;
  running: boolean;
  migrated: boolean;
  epoch: string | null;
  axes: string[];
  replicates: string[];
  has_curves: boolean;
  has_predictions: boolean;
  commit: string | null;
}

export interface RunRow extends RunInfo {
  cells: number;
  planned: number;
  errors: number;
  best: { metric: string; label: string; unit: string; scale: number; value: number } | null;
  merkmal: { key: string; label: string; value: string } | null;
  config_values: Record<string, string>;
}

export interface IssueInfo {
  title?: string;
  url?: string;
  status?: string;
  status_type?: string;
  analysis?: string | null;
  deliverable?: string | null;
}

export class NotFound extends Error {}
/** The run store (ds-store) could not read the runs; the message is meant to be shown. */
export class StoreProblem extends Error {}

export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (r.status === 404) throw new NotFound(url);
  if (r.status === 409) {
    const body = await r.json().catch(() => null);
    if (body?.store_error) throw new StoreProblem(String(body.detail));
  }
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export const getProject = () => getJson<ProjectInfo>("/api/project");
export const getRuns = () => getJson<RunRow[]>("/api/runs");
export const getIssues = () => getJson<Record<string, IssueInfo>>("/api/issues");
export const getRun = (id: string) => getJson<RunInfo>(`/api/runs/${encodeURIComponent(id)}`);

// --- experiment view (feature D) -------------------------------------------------------------
export interface DimValue {
  value: string;
  n: number;
}
export interface Dim {
  key: string;
  kind: "axis" | "replicate" | "channel";
  section: string;
  values: DimValue[];
}
export interface DimsInfo {
  dims: Dim[];
  sections: string[];
  constants: { block: string; rows: { key: string; value: string }[] }[];
  cells: number;
  errors: number;
  primary_metric: string | null;
}

export interface DimQuery {
  mode: "split" | "agg";
  sel: string[];
}
export interface TableQuery {
  dims: Record<string, DimQuery>;
  sort: { metric: string | null; stat: "mean" | "min" | "max" | "n"; dir: "asc" | "desc" | null };
  limit?: number;
  overview?: boolean;
}
export interface MetricStats {
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
}
export interface TableRow {
  key: string;
  params: Record<string, string>;
  n: number;
  errors: number;
  metrics: Record<string, MetricStats>;
}
export interface OverviewCard {
  key: string;
  kind: "axis" | "channel";
  spread: number | null;
  best_value: string | null;
  values: { value: string; mean: number | null; std: number | null; n: number }[];
}
export interface TableResult {
  params: string[];
  metrics: string[];
  sort: { metric: string | null; stat: string; dir: "asc" | "desc" };
  groups: number;
  cells: number;
  shown: number;
  best: { key: string | null; value: number | null; metric: string | null };
  rows: TableRow[];
  histogram: { counts: number[]; lo: number | null; hi: number | null; best_bin: number | null };
  overview?: { cards: OverviewCard[]; metric?: string };
}

export const getDims = (id: string) => getJson<DimsInfo>(`/api/runs/${encodeURIComponent(id)}/dims`);

export async function postTable(id: string, query: Partial<TableQuery>, signal?: AbortSignal): Promise<TableResult> {
  const r = await fetch(`/api/runs/${encodeURIComponent(id)}/table`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(query),
    signal,
  });
  if (r.status === 404) throw new NotFound(id);
  if (!r.ok) throw new Error(`table: ${r.status}`);
  return r.json();
}

// --- config view (feature J) ----------------------------------------------------------------
export interface ConfigAxis {
  key: string;
  paired: boolean;
  members: string[];
  values: { label: string; display: string }[];
  current: string | null;
}
export interface ConfigEntry {
  key: string;
  value: string;
  swept: boolean;
  values: string[];
  base: string | null;
  differs: boolean;
}
export interface ConfigLine {
  n: number;
  indent: number;
  text: string;
  block: string;
  kind: "block" | "entry";
  swept?: boolean;
  replicate?: boolean;
  differs?: boolean;
  note?: string | null;
  base?: string | null;
}
export interface ConfigInfo {
  base_known: boolean;
  grid: { axes: ConfigAxis[]; replicates: { key: string; values: string[] }[] };
  blocks: { name: string; entries: ConfigEntry[]; differs: number }[];
  lines: ConfigLine[];
  yaml: string;
}

export const getConfig = (runId: string, combo?: Record<string, string>) =>
  getJson<ConfigInfo>(
    `/api/runs/${encodeURIComponent(runId)}/config` + (combo ? `?combo=${encodeURIComponent(JSON.stringify(combo))}` : ""),
  );

// --- widgets (features F, E, G) ----------------------------------------------------------------
export interface SettingDef {
  key: string;
  label: string;
  type: "seg" | "select";
  options?: { value: string; label: string }[];
  default: string | null;
}
export interface CatalogEntry {
  key: string;
  label: string;
  question: string;
  scopes: string[];
  settings: SettingDef[];
  requires: string | null;
  exportable: boolean;
  optional: boolean;
  /** Width of a new tile: half of the row or full. */
  width: "half" | "full";
  /** An own widget (a description kept in the project); `definition` is the description. */
  own?: boolean;
  definition?: import("./widgets/board").OwnDefinition;
}
export interface WidgetRequest {
  run?: string;
  runs?: string[];
  combo?: Record<string, string>;
  /** Scope of the board: "combination" (detail), "run", "two-runs", "project". */
  scope?: string;
  /** Scope parameters set in the board header (project: `color_by`). */
  params?: Record<string, string>;
  settings?: Record<string, string | null>;
}
export interface WidgetResult {
  key: string;
  exportable: boolean;
  title?: string;
  subtitle?: string | null;
  note?: string | null;
  unavailable?: string;
  options?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

const catalogs = new Map<string, Promise<CatalogEntry[]>>();
/** The widget catalog of a scope, in the order of its board. */
export const getCatalog = (scope = "") =>
  catalogs.get(scope) ?? catalogs.set(scope, getJson<CatalogEntry[]>("/api/widgets/catalog" + (scope ? `?scope=${scope}` : ""))).get(scope)!;

export async function postWidget(key: string, req: WidgetRequest, signal?: AbortSignal): Promise<WidgetResult> {
  const r = await fetch(`/api/widgets/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (r.status === 404) throw new NotFound(key);
  if (!r.ok) throw new Error(`widget ${key}: ${r.status}`);
  return r.json();
}

// --- own widgets (feature E) ----------------------------------------------------------------------
export class OwnWidgetRefused extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join("; "));
  }
}

export const getOwnWidgets = (scope: string) => getJson<CatalogEntry[]>(`/api/own-widgets?scope=${encodeURIComponent(scope)}`);

/** Keeps a draft as an own widget under its name; the reasons come back when the description is not valid. */
export async function keepOwnWidget(definition: unknown): Promise<CatalogEntry> {
  const r = await fetch("/api/own-widgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ definition }) });
  if (r.status === 400) {
    const body = await r.json().catch(() => null);
    throw new OwnWidgetRefused(body?.detail?.errors ?? ["ungültige Beschreibung"]);
  }
  if (!r.ok) throw new Error(`/api/own-widgets: ${r.status}`);
  return r.json();
}

export async function deleteOwnWidget(key: string): Promise<void> {
  const r = await fetch(`/api/own-widgets/${encodeURIComponent(key.replace(/^own:/, ""))}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`delete ${key}: ${r.status}`);
}
