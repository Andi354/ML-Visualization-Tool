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
  /** "Als Analyse öffnen" in the detail panel: one run with one combination as filter. */
  analysis: { run: string; combo: Record<string, string> } | null;
  /** The agent asks the analysis for a view (`n` makes the same request count again). */
  analysisView: { view: "run" | "two" | "project"; n: number } | null;
}

export type FrameAction =
  | { type: "select-area"; area: Area }
  | { type: "open-run"; run: string }
  | { type: "focus-run"; run: string }
  | { type: "focus-pinned" }
  | { type: "close-run"; run: string }
  | { type: "set-runs-view"; view: RunsView }
  | { type: "open-compare"; runs: string[] }
  | { type: "open-analysis"; run: string; combo: Record<string, string> }
  /** The agent shows the analysis in a view; `compare` fills "Zwei Läufe", `run` "Ein Lauf". */
  | { type: "show-analysis-view"; view: "run" | "two" | "project"; runs?: string[] }
  /** Undo and redo of the agent: back to an earlier state of the frame. */
  | { type: "restore"; state: FrameState };

export const initialFrame: FrameState = { area: "runs", tabs: [], active: null, runsView: "list", compare: [], analysis: null, analysisView: null };

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
      return { ...s, area: "analysis", active: null, compare: a.runs, analysis: null };
    case "open-analysis":
      return { ...s, area: "analysis", active: null, compare: [], analysis: { run: a.run, combo: a.combo } };
    case "show-analysis-view": {
      const base = { ...s, area: "analysis" as const, active: null, analysisView: { view: a.view, n: (s.analysisView?.n ?? 0) + 1 } };
      if (a.view === "two" && a.runs && a.runs.length >= 2) return { ...base, compare: a.runs.slice(0, 2), analysis: null };
      if (a.view === "run" && a.runs && a.runs.length >= 1) return { ...base, compare: [], analysis: { run: a.runs[0], combo: {} } };
      return base;
    }
    case "restore":
      return a.state;
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
  const an = o.analysis as { run?: unknown; combo?: unknown } | null | undefined;
  const analysis =
    an && typeof an.run === "string" && an.combo && typeof an.combo === "object"
      ? { run: an.run, combo: an.combo as Record<string, string> }
      : null;
  return { area, tabs: [...new Set(tabs)], active, runsView, compare, analysis, analysisView: null };
}

export const loadFrame = (project: string): FrameState =>
  loadJson(storageKey(project, "frame"), validate) ?? initialFrame;

export const saveFrame = (project: string, s: FrameState) => saveJson(storageKey(project, "frame"), s);
