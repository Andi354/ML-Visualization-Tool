// A board is a declarative description: scope, runs and widgets with their settings. The tool only
// renders it; the agent (later update) creates boards the same way.
import { loadJson, saveJson, storageKey } from "../state/storage";

export interface BoardWidget {
  id: string;
  type: string;
  settings: Record<string, string | null>;
}

export interface Board {
  scope: string;
  widgets: BoardWidget[];
}

export type BoardAction =
  | { type: "add"; widget: string; id: string }
  | { type: "remove"; id: string }
  | { type: "settings"; id: string; patch: Record<string, string | null> }
  | { type: "reset"; board: Board };

export function boardReducer(b: Board, a: BoardAction): Board {
  switch (a.type) {
    case "add":
      return { ...b, widgets: [...b.widgets, { id: a.id, type: a.widget, settings: {} }] };
    case "remove":
      return { ...b, widgets: b.widgets.filter((w) => w.id !== a.id) };
    case "settings":
      return { ...b, widgets: b.widgets.map((w) => (w.id === a.id ? { ...w, settings: { ...w.settings, ...a.patch } } : w)) };
    case "reset":
      return a.board;
  }
}

let counter = 0;
export const newId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const makeBoard = (scope: string, types: string[]): Board => ({
  scope,
  widgets: types.map((t, i) => ({ id: `${t}-${i}`, type: t, settings: {} })),
});

function validate(scope: string, known: string[]) {
  return (v: unknown): Board | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (!Array.isArray(o.widgets)) return null;
    const widgets = o.widgets
      .filter((w): w is BoardWidget => !!w && typeof w === "object" && typeof (w as BoardWidget).id === "string" && known.includes((w as BoardWidget).type))
      .map((w) => ({ id: w.id, type: w.type, settings: w.settings && typeof w.settings === "object" ? w.settings : {} }));
    return { scope, widgets };
  };
}

/** The selection of widgets is remembered per project (and scope). */
export const loadBoard = (project: string, scope: string, known: string[], fallback: Board): Board =>
  loadJson(storageKey(project, `board:${scope}`), validate(scope, known)) ?? fallback;
export const saveBoard = (project: string, b: Board) => saveJson(storageKey(project, `board:${b.scope}`), b);
