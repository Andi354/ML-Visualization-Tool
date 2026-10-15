export interface Metric {
  key: string;
  label: string;
  direction: "min" | "max";
  family: "real" | "scaled" | string;
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
}

export interface RunInfo {
  id: string;
  name: string;
  issue: string | null;
  started: string | null;
  ended: string | null;
  running: boolean;
  migrated: boolean;
  epoch: string | null;
  axes: string[];
  replicates: string[];
  has_curves: boolean;
  has_predictions: boolean;
  commit: string | null;
}

export class NotFound extends Error {}

export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (r.status === 404) throw new NotFound(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export const getProject = () => getJson<ProjectInfo>("/api/project");
export const getRuns = () => getJson<RunInfo[]>("/api/runs");
export const getRun = (id: string) => getJson<RunInfo>(`/api/runs/${encodeURIComponent(id)}`);
