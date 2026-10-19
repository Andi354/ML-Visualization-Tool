// State of the frame (feature B): area of the pinned tab, open run tabs, active tab.
import { loadJson, saveJson, storageKey } from "./storage";

export type Area = "runs" | "analysis";
export type RunsView = "list" | "issues";

/** `active` of the settings tab (it is no run). */
export const SETTINGS_TAB = "@settings";

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
  /** The settings tab is open (v0.3.0). */
  settings: boolean;
  /** Pinned tabs in pin order (run folder names, or SETTINGS_TAB); they stay left and survive the bulk closes (v0.3.2). */
  pinned: string[];
  /** "In Läufe zeigen": the list view opens this run's issue and marks its card (`n` makes the same run count again). */
  reveal: { run: string; n: number } | null;
}

export type FrameAction =
  | { type: "select-area"; area: Area }
  | { type: "open-run"; run: string }
  | { type: "focus-run"; run: string }
  | { type: "focus-pinned" }
  | { type: "open-settings" }
  | { type: "close-settings" }
  | { type: "close-run"; run: string }
  /** Tab menu: closes tabs (run folder names, SETTINGS_TAB); pinned ones are skipped unless `force`. */
  | { type: "close-tabs"; items: string[]; force?: boolean }
  | { type: "pin-tab"; item: string }
  | { type: "unpin-tab"; item: string }
  | { type: "show-in-runs"; run: string }
  /** Undo of "close-tabs": the tabs, pins and the active tab as they were. */
  | { type: "restore-tabs"; before: Pick<FrameState, "tabs" | "pinned" | "settings" | "active"> }
  | { type: "set-runs-view"; view: RunsView }
  | { type: "open-compare"; runs: string[] }
  | { type: "open-analysis"; run: string; combo: Record<string, string> }
  /** The agent shows the analysis in a view; `compare` fills "Zwei Läufe", `run` "Ein Lauf". */
  | { type: "show-analysis-view"; view: "run" | "two" | "project"; runs?: string[] }
  /** Undo and redo of the agent: back to an earlier state of the frame. */
  | { type: "restore"; state: FrameState };

export const initialFrame: FrameState = { area: "runs", tabs: [], active: null, runsView: "list", compare: [], analysis: null, analysisView: null, settings: false, pinned: [], reveal: null };

/** Run tabs with the pinned ones first (in pin order), the others keep their order. */
function arrange(tabs: string[], pinned: string[]): string[] {
  const front = pinned.filter((t) => tabs.includes(t));
  return [...front, ...tabs.filter((t) => !front.includes(t))];
}

/** The tabs as they stand in the strip behind the fixed one: pinned (pin order), then settings, then the other runs. */
export function tabOrder(s: Pick<FrameState, "tabs" | "pinned" | "settings">): string[] {
  const pinned = s.pinned.filter((t) => (t === SETTINGS_TAB ? s.settings : s.tabs.includes(t)));
  return [...pinned, ...(s.settings && !pinned.includes(SETTINGS_TAB) ? [SETTINGS_TAB] : []), ...s.tabs.filter((t) => !pinned.includes(t))];
}

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
    case "open-settings":
      return { ...s, settings: true, active: SETTINGS_TAB };
    case "close-settings":
      return { ...s, settings: false, pinned: s.pinned.filter((t) => t !== SETTINGS_TAB), active: s.active === SETTINGS_TAB ? null : s.active };
    case "close-run": {
      const i = s.tabs.indexOf(a.run);
      if (i < 0) return s;
      const tabs = s.tabs.filter((t) => t !== a.run);
      const pinned = s.pinned.filter((t) => t !== a.run);
      if (s.active !== a.run) return { ...s, tabs, pinned };
      return { ...s, tabs, pinned, active: i > 0 ? s.tabs[i - 1] : null };
    }
    case "close-tabs": {
      const items = a.items.filter((t) => (a.force || !s.pinned.includes(t)) && (t === SETTINGS_TAB ? s.settings : s.tabs.includes(t)));
      if (!items.length) return s;
      const tabs = s.tabs.filter((t) => !items.includes(t));
      const settings = s.settings && !items.includes(SETTINGS_TAB);
      const pinned = s.pinned.filter((t) => !items.includes(t));
      return { ...s, tabs, settings, pinned, active: s.active !== null && items.includes(s.active) ? null : s.active };
    }
    case "pin-tab": {
      if (s.pinned.includes(a.item) || !(a.item === SETTINGS_TAB ? s.settings : s.tabs.includes(a.item))) return s;
      return { ...s, pinned: [...s.pinned, a.item], tabs: arrange(s.tabs, [...s.pinned, a.item]) };
    }
    case "unpin-tab": {
      if (!s.pinned.includes(a.item)) return s;
      const pinned = s.pinned.filter((t) => t !== a.item);
      // right of the pinned ones: first of the normal tabs
      return { ...s, pinned, tabs: arrange(s.tabs, pinned) };
    }
    case "show-in-runs":
      return { ...s, area: "runs", active: null, runsView: "list", reveal: { run: a.run, n: (s.reveal?.n ?? 0) + 1 } };
    case "restore-tabs":
      return { ...s, ...a.before };
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
  const settings = o.settings === true;
  const active = typeof o.active === "string" && (tabs.includes(o.active) || (settings && o.active === SETTINGS_TAB)) ? o.active : null;
  const compare = Array.isArray(o.compare) ? o.compare.filter((t): t is string => typeof t === "string") : [];
  const an = o.analysis as { run?: unknown; combo?: unknown } | null | undefined;
  const analysis =
    an && typeof an.run === "string" && an.combo && typeof an.combo === "object"
      ? { run: an.run, combo: an.combo as Record<string, string> }
      : null;
  const pinned = Array.isArray(o.pinned) ? [...new Set(o.pinned.filter((t): t is string => typeof t === "string" && (tabs.includes(t) || (settings && t === SETTINGS_TAB))))] : [];
  return { area, tabs: arrange([...new Set(tabs)], pinned), active, runsView, compare, analysis, analysisView: null, settings, pinned, reveal: null };
}

export const loadFrame = (project: string): FrameState =>
  loadJson(storageKey(project, "frame"), validate) ?? initialFrame;

export const saveFrame = (project: string, s: FrameState) => saveJson(storageKey(project, "frame"), s);
