// State of the agent window that lives in the browser, per project like the frame state:
// open / minimised / closed, position and size, the chat that is current.
import type { Rect } from "./geometry";
import type { WindowState } from "./model";
import { loadJson, saveJson, storageKey } from "../state/storage";

export interface AgentWindowState {
  mode: WindowState;
  /** Null until the window was opened once: then the default position applies. */
  rect: Rect | null;
  chat: string | null;
}

export const initialAgent: AgentWindowState = { mode: "closed", rect: null, chat: null };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function validate(v: unknown): AgentWindowState | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const mode: WindowState = o.mode === "open" || o.mode === "min" ? o.mode : "closed";
  const r = o.rect as Record<string, unknown> | null | undefined;
  const rect =
    r && num(r.x) !== null && num(r.y) !== null && num(r.w) !== null && num(r.h) !== null
      ? { x: r.x as number, y: r.y as number, w: r.w as number, h: r.h as number }
      : null;
  return { mode, rect, chat: typeof o.chat === "string" ? o.chat : null };
}

export const loadAgent = (project: string): AgentWindowState =>
  loadJson(storageKey(project, "agent"), validate) ?? initialAgent;

export const saveAgent = (project: string, s: AgentWindowState) => saveJson(storageKey(project, "agent"), s);

/** Click on the agent icon: closed or minimised opens the window, open minimises it. */
export const toggleFromIcon = (m: WindowState): WindowState => (m === "open" ? "min" : "open");
