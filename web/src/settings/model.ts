// Logic of the settings screen without a screen: values, changes with undo, search.
import { DEFAULTS, ROWS, type Row, type Value, type Values } from "./catalog";

/** What an undo step restores: the values of the keys it touched, before and after. */
export interface Step {
  before: Partial<Record<string, Value | undefined>>;
  after: Partial<Record<string, Value | undefined>>;
}

export const isChanged = (values: Values, key: string) => key in values;
export const valueOf = (values: Values, key: string): Value => (key in values ? values[key] : DEFAULTS[key]);

/** A step that sets `set` and resets `unset`; null when it changes nothing. */
export function makeStep(values: Values, set: Values, unset: string[] = []): Step | null {
  const before: Step["before"] = {};
  const after: Step["after"] = {};
  for (const [k, v] of Object.entries(set)) {
    const now = valueOf(values, k);
    if (v === now) continue;
    before[k] = k in values ? values[k] : undefined;
    after[k] = v === DEFAULTS[k] ? undefined : v;
  }
  for (const k of unset) {
    if (!(k in values)) continue;
    before[k] = values[k];
    after[k] = undefined;
  }
  return Object.keys(after).length ? { before, after } : null;
}

/** The request body for the API that applies `side` of a step. */
export function request(side: Step["before"]): { set: Values; unset: string[] } {
  const set: Values = {};
  const unset: string[] = [];
  for (const [k, v] of Object.entries(side)) {
    if (v === undefined) unset.push(k);
    else set[k] = v;
  }
  return { set, unset };
}

export function applyStep(values: Values, side: Step["before"]): Values {
  const out = { ...values };
  for (const [k, v] of Object.entries(side)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

const norm = (s: string) => s.toLowerCase();

/** Rows matching a search text (label, description, category or key). */
export function search(rows: Row[], query: string, catTitle: (id: string) => string): Row[] {
  const q = norm(query.trim());
  if (!q) return rows;
  return rows.filter((r) => [r.label, r.desc, r.key, catTitle(r.cat)].some((t) => norm(t).includes(q)));
}

export function changedCount(values: Values, cat?: string): number {
  return ROWS.filter((r) => r.type !== "action" && (!cat || r.cat === cat) && isChanged(values, r.key)).length;
}

/** Placeholders of the export name/folder patterns with an example, for the hint under the field. */
export function fillPattern(pattern: string, vars: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
