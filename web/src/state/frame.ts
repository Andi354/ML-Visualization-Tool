// State of the frame (feature B): area of the pinned tab, open run tabs, active tab.
import { loadJson, saveJson, storageKey } from "./storage";

export type Area = "runs" | "analysis";
export type RunsView = "list" | "issues";

export interface FrameState {
  area: Area;
  /** Run folder names, in tab order. */
  tabs: string[];
  /** Run folder name of the focused run tab, or null when the pinned tab is focused. */
  active: string | null;
  runsView: RunsView;
  /** Runs ticked in Läufe for "Vergleichen" (at most two are compared in v0.1). */
  compare: string[];
}

export type FrameAction =
  | { type: "select-area"; area: Area }
  | { type: "open-run"; run: string }
  | { type: "focus-run"; run: string }
  | { type: "focus-pinned" }
  | { type: "close-run"; run: string }
  | { type: "set-runs-view"; view: RunsView }
  | { type: "open-compare"; runs: string[] };

export const initialFrame: FrameState = { area: "runs", tabs: [], active: null, runsView: "list", compare: [] };

export function frameReducer(s: FrameState, a: FrameAction): FrameState {
  switch (a.type) {
    case "select-area":
      // The pinned tab switches to the area and gets the focus; run tabs stay open.
      return { ...s, area: a.area, active: null };
    case "open-run":
      return { ...s, tabs: s.tabs.includes(a.run) ? s.tabs : [...s.tabs, a.run], active: a.run };
    case "focus-run":
      return s.tabs.includes(a.run) ? { ...s, active: a.run } : s;
    case "focus-pinned":
      return { ...s, active: null };
    case "close-run": {
      const i = s.tabs.indexOf(a.run);
      if (i < 0) return s;
      const tabs = s.tabs.filter((t) => t !== a.run);
      if (s.active !== a.run) return { ...s, tabs };
      return { ...s, tabs, active: i > 0 ? s.tabs[i - 1] : null };
    }
    case "set-runs-view":
      return { ...s, runsView: a.view };
    case "open-compare":
      return { ...s, area: "analysis", active: null, compare: a.runs };
  }
}

function validate(v: unknown): FrameState | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const tabs = Array.isArray(o.tabs) ? o.tabs.filter((t): t is string => typeof t === "string") : [];
  const area: Area = o.area === "analysis" ? "analysis" : "runs";
  const runsView: RunsView = o.runsView === "issues" ? "issues" : "list";
  const active = typeof o.active === "string" && tabs.includes(o.active) ? o.active : null;
  const compare = Array.isArray(o.compare) ? o.compare.filter((t): t is string => typeof t === "string") : [];
  return { area, tabs: [...new Set(tabs)], active, runsView, compare };
}

export const loadFrame = (project: string): FrameState =>
  loadJson(storageKey(project, "frame"), validate) ?? initialFrame;

export const saveFrame = (project: string, s: FrameState) => saveJson(storageKey(project, "frame"), s);
