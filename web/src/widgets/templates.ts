// Templates (Vorlagen): a board without runs. Pure conversion between a board and a stored template; the
// built-in "Standard" of a scope is the default board and is never stored.
import { loadJson, saveJson, storageKey } from "../state/storage";
import { newId, type Board, type BoardWidget, type Width } from "./board";

export const BUILTIN = "Standard";

export type TemplateScope = "one" | "two" | "project";

export interface StoredTemplate {
  name: string;
  scope: TemplateScope;
  widgets: { type: string; settings: Record<string, string | null>; width: Width }[];
  last_used: { runs: string[]; at: string } | null;
}

/** The scope of a board (`run`, `two-runs`, `project`) as templates name it. */
export const templateScope = (boardScope: string): TemplateScope => (boardScope === "run" ? "one" : boardScope === "two-runs" ? "two" : "project");

export const scopeTitle: Record<TemplateScope, string> = { one: "Ein Lauf", two: "Zwei Läufe", project: "Projekt" };

const clean = (s: Record<string, string | null>) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== undefined && v !== "").sort(([a], [b]) => a.localeCompare(b)));

/** What a template keeps of a tile: type, settings, width, in order. */
export const toTemplateWidgets = (widgets: BoardWidget[]): StoredTemplate["widgets"] => widgets.map((w) => ({ type: w.type, settings: { ...w.settings }, width: w.width }));

/** Order, type, width and settings make two boards the same; ids do not. */
export const signature = (widgets: { type: string; settings: Record<string, string | null>; width: Width }[]) =>
  JSON.stringify(widgets.map((w) => [w.type, w.width, clean(w.settings)]));

/** The default board of a scope: the non-optional widgets of the catalog with their default width. */
export const standardWidgets = (catalog: { key: string; optional: boolean; width: Width }[]): StoredTemplate["widgets"] =>
  catalog.filter((c) => !c.optional).map((c) => ({ type: c.key, settings: {}, width: c.width }));

/** A board's widgets from a template: new ids, types that no longer exist are dropped. */
export const widgetsFromTemplate = (t: StoredTemplate["widgets"], known: string[]): BoardWidget[] =>
  t.filter((w) => known.includes(w.type) || w.type.startsWith("own:")).map((w) => ({ id: newId(w.type), type: w.type, settings: { ...w.settings }, width: w.width }));

export const isDirty = (board: Board, template: StoredTemplate["widgets"]) => signature(board.widgets) !== signature(template);

/** The template a scope's board is based on, remembered per project. */
export const loadCurrent = (project: string, scope: string): string | null => loadJson(storageKey(project, `template:${scope}`), (v) => (typeof v === "string" ? v : null));
export const saveCurrent = (project: string, scope: string, name: string) => saveJson(storageKey(project, `template:${scope}`), name);

/** Template to start a scope with when it has no board yet: the one used last (by time), else Standard. */
export function lastUsed(templates: StoredTemplate[]): StoredTemplate | null {
  const used = templates.filter((t) => t.last_used);
  used.sort((a, b) => (b.last_used!.at > a.last_used!.at ? 1 : -1));
  return used[0] ?? null;
}
