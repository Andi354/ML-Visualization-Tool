// The commands of the palette in one list. A command knows its category, label, shortcut, when it can run and what it
// does; "…" commands open a second step. The agent's commands (bus.ts) are the same functions the views provide.
import type { ProjectInfo, RunRow } from "../api";
import { handlerFor } from "../agent/bus";
import type { FrameAction, FrameState } from "../state/frame";
import { SETTINGS_TAB } from "../state/frame";
import { DEFAULTS } from "../settings/catalog";
import { change, nudgeScale, setting } from "../settings/store";
import { clearViewState } from "../settings/viewState";

export type StepKind = "run" | "issue" | "run2" | "template" | "widget" | "mode" | "shortcuts";

export interface Ctx {
  project: ProjectInfo;
  frame: FrameState;
  dispatch: (a: FrameAction) => void;
  runs: RunRow[];
  agentOpen: boolean;
  /** Opens/hides the agent window. */
  toggleAgent: () => void;
  openAgent: () => void;
  /** Sends text to the agent in the current chat (opens the window). */
  ask: (text: string) => void;
  /** The settings tab at a row. */
  openSetting: (key: string | null) => void;
  /** Closes the palette and then does `fn`. */
  later: (fn: () => void) => void;
}

export interface Command {
  id: string;
  cat: string;
  label: string;
  shortcut?: string;
  step?: StepKind;
  /** A note when it cannot run in this view (the command is listed but disabled). */
  blocked?: (c: Ctx) => string | null;
  run?: (c: Ctx) => void | Promise<void>;
}

const inRun = (c: Ctx) => (c.frame.active && c.frame.active !== SETTINGS_TAB ? null : "nur im Lauf-Tab");
const inAnalysis = (c: Ctx) => (c.frame.area === "analysis" && c.frame.active === null ? null : "nur in der Analyse");
const call = (name: string, args: Record<string, unknown> = {}) => async () => {
  await handlerFor(name)?.(args);
};

export const COMMANDS: Command[] = [
  { id: "runs.open", cat: "Läufe", label: "Lauf öffnen …", shortcut: "Ctrl+P", step: "run" },
  { id: "runs.issue", cat: "Läufe", label: "Issue öffnen …", step: "issue" },
  { id: "runs.list", cat: "Läufe", label: "Als Liste zeigen", run: (c) => { c.dispatch({ type: "select-area", area: "runs" }); c.dispatch({ type: "set-runs-view", view: "list" }); } },
  { id: "runs.issues", cat: "Läufe", label: "Nach Issue gruppieren", run: (c) => { c.dispatch({ type: "select-area", area: "runs" }); c.dispatch({ type: "set-runs-view", view: "issues" }); } },
  { id: "run.analyse", cat: "Lauf", label: "Diesen Lauf analysieren", blocked: inRun, run: (c) => c.dispatch({ type: "open-analysis", run: c.frame.active!, combo: {} }) },
  { id: "run.filters", cat: "Lauf", label: "Filter zurücksetzen", blocked: inRun, run: (c) => call(`reset_filters:${c.frame.active}`)() },
  { id: "run.description", cat: "Lauf", label: "Beschreibung auf- oder zuklappen", blocked: inRun, run: (c) => call(`toggle_description:${c.frame.active}`)() },
  { id: "ana.run", cat: "Analyse", label: "Ein Lauf", run: (c) => c.dispatch({ type: "show-analysis-view", view: "run" }) },
  { id: "ana.two", cat: "Analyse", label: "Zwei Läufe vergleichen …", step: "run2" },
  { id: "ana.project", cat: "Analyse", label: "Projektverlauf", run: (c) => c.dispatch({ type: "show-analysis-view", view: "project" }) },
  { id: "ana.template", cat: "Analyse", label: "Vorlage anwenden …", step: "template", blocked: inAnalysis },
  { id: "ana.widget", cat: "Analyse", label: "Widget hinzufügen …", step: "widget", blocked: inAnalysis },
  { id: "ana.save", cat: "Analyse", label: "Als Deliverable speichern …", shortcut: "Ctrl+S", blocked: inAnalysis, run: call("open_save_dialog") },
  { id: "agent.toggle", cat: "Agent", label: "Fenster zeigen oder verbergen", shortcut: "Ctrl+J", run: (c) => c.toggleAgent() },
  { id: "agent.new", cat: "Agent", label: "Neuer Chat", run: async (c) => { c.openAgent(); await handlerFor("ui:new_chat")?.({}); } },
  { id: "agent.mode", cat: "Agent", label: "Modus wechseln …", shortcut: "Shift+Tab", step: "mode" },
  { id: "agent.compact", cat: "Agent", label: "Chat komprimieren (/compact)", run: async (c) => { c.openAgent(); await handlerFor("ui:compact")?.({}); } },
  { id: "set.open", cat: "Einstellungen", label: "Öffnen", shortcut: "Ctrl+,", run: (c) => c.openSetting(null) },
  { id: "set.search", cat: "Einstellungen", label: "Einstellung suchen …" },
  { id: "set.density", cat: "Einstellungen", label: "Dichte umschalten", run: () => change({ "look.density": setting("look.density") === "compact" ? "comfortable" : "compact" }) },
  { id: "set.bigger", cat: "Einstellungen", label: "Größer", shortcut: "Ctrl++", run: () => nudgeScale(1) },
  { id: "set.smaller", cat: "Einstellungen", label: "Kleiner", shortcut: "Ctrl+-", run: () => nudgeScale(-1) },
  { id: "view.reset", cat: "Ansicht", label: "Zurücksetzen", run: () => { clearViewState(); location.reload(); } },
  { id: "help.keys", cat: "Hilfe", label: "Tastenkürzel", step: "shortcuts" },
];

export const SHORTCUTS: [string, string][] = [
  ["Ctrl+Shift+P · F1", "Befehle"],
  ["Ctrl+P", "Lauf oder Issue öffnen"],
  ["Ctrl+J", "Agent-Fenster zeigen oder verbergen"],
  ["Shift+Tab", "Agent-Modus wechseln (im Chat)"],
  ["Ctrl+S", "Als Deliverable speichern (Analyse)"],
  ["Ctrl+,", "Einstellungen"],
  ["Ctrl++ · Ctrl+-", "Oberfläche größer · kleiner"],
  ["/", "Einstellungen durchsuchen (im Einstellungs-Tab)"],
  ["Ctrl+Z · Ctrl+Shift+Z", "Einstellung rückgängig · wiederholen"],
];

/** Shortcut → palette command id (the handler in the frame). */
export function shortcutFor(e: KeyboardEvent): "commands" | "runs" | "agent" | "save" | "bigger" | "smaller" | null {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === "F1" || (mod && e.shiftKey && k === "p")) return "commands";
  if (mod && !e.shiftKey && k === "p") return "runs";
  if (mod && !e.shiftKey && k === "j") return "agent";
  if (mod && !e.shiftKey && k === "s") return "save";
  if (mod && (e.key === "+" || e.key === "=")) return "bigger";
  if (mod && (e.key === "-" || e.key === "_")) return "smaller";
  return null;
}

export const defaultOf = (key: string) => DEFAULTS[key];

const RECENT_KEY = "mlviz:v1:palette-recent";
export function recentCommands(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}
export function rememberCommand(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentCommands().filter((x) => x !== id)].slice(0, 3)));
  } catch {
    /* storage unavailable */
  }
}
