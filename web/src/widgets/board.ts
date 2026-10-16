// A board is a declarative description: scope, runs and widgets with their settings, width and order. The
// tool only renders it; the agent creates and changes boards the same way (as do templates, see templates.ts).
import { loadJson, saveJson, storageKey } from "../state/storage";

/** Half of the row, or the whole row (a full tile always starts a new row). */
export type Width = "half" | "full";

export interface BoardWidget {
  id: string;
  type: string;
  settings: Record<string, string | null>;
  width: Width;
}

export interface Board {
  scope: string;
  widgets: BoardWidget[];
}

export type BoardAction =
  | { type: "add"; widget: string; id: string; width?: Width }
  | { type: "remove"; id: string }
  | { type: "settings"; id: string; patch: Record<string, string | null> }
  | { type: "width"; id: string; width: Width }
  /** One position earlier (-1) or later (+1) in the order of the board. */
  | { type: "move"; id: string; dir: -1 | 1 }
  | { type: "reset"; board: Board };

export function boardReducer(b: Board, a: BoardAction): Board {
  switch (a.type) {
    case "add":
      return { ...b, widgets: [...b.widgets, { id: a.id, type: a.widget, settings: {}, width: a.width ?? "half" }] };
    case "remove":
      return { ...b, widgets: b.widgets.filter((w) => w.id !== a.id) };
    case "settings":
      return { ...b, widgets: b.widgets.map((w) => (w.id === a.id ? { ...w, settings: { ...w.settings, ...a.patch } } : w)) };
    case "width":
      return { ...b, widgets: b.widgets.map((w) => (w.id === a.id ? { ...w, width: a.width } : w)) };
    case "move": {
      const i = b.widgets.findIndex((w) => w.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= b.widgets.length) return b;
      const widgets = [...b.widgets];
      [widgets[i], widgets[j]] = [widgets[j], widgets[i]];
      return { ...b, widgets };
    }
    case "reset":
      return a.board;
  }
}

let counter = 0;
export const newId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** A new board of the given widget types; `widths` holds the default width of a type (half if unknown). */
export const makeBoard = (scope: string, types: string[], widths: Record<string, Width> = {}): Board => ({
  scope,
  widgets: types.map((t, i) => ({ id: `${t}-${i}`, type: t, settings: {}, width: widths[t] ?? "half" })),
});

const isWidth = (v: unknown): v is Width => v === "half" || v === "full";

function validate(scope: string, known: string[], widths: Record<string, Width>) {
  return (v: unknown): Board | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (!Array.isArray(o.widgets)) return null;
    const widgets = o.widgets
      .filter((w): w is BoardWidget => !!w && typeof w === "object" && typeof (w as BoardWidget).id === "string" && known.includes((w as BoardWidget).type))
      .map((w) => ({
        id: w.id,
        type: w.type,
        settings: w.settings && typeof w.settings === "object" ? w.settings : {},
        width: isWidth(w.width) ? w.width : (widths[w.type] ?? "half"),
      }));
    return { scope, widgets };
  };
}

/** The selection of widgets is remembered per project (and scope). */
export const loadBoard = (project: string, scope: string, known: string[], fallback: Board, widths: Record<string, Width> = {}): Board =>
  loadJson(storageKey(project, `board:${scope}`), validate(scope, known, widths)) ?? fallback;
export const saveBoard = (project: string, b: Board) => saveJson(storageKey(project, `board:${b.scope}`), b);
