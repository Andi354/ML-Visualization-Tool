// How the commands of the agent reach the views (feature C): a view that can carry out a tool provides a
// handler while it is mounted; the agent layer looks the handler up by the tool's name. No view imports the
// agent, and the agent imports no view.

/** What a handler reports: the line for the chat, optionally data for the agent, and how to take it back. */
export interface Outcome {
  summary?: string;
  data?: unknown;
  /** Reverts the action; returns the text of the "↶" line. Without it the line has no "Rückgängig". */
  undo?: () => Promise<string | void> | string | void;
  /** Does it again after an undo; returns the text of the action line. */
  redo?: () => Promise<string | void> | string | void;
}

export type Handler = (args: Record<string, any>) => Promise<Outcome | void> | Outcome | void;

const handlers = new Map<string, Handler>();

/** Provides a handler until the returned function is called (a newer provider of the same name replaces it). */
export function provide(name: string, handler: Handler): () => void {
  handlers.set(name, handler);
  return () => {
    if (handlers.get(name) === handler) handlers.delete(name);
  };
}

export const handlerFor = (name: string) => handlers.get(name);

/** Waits until some view provides `name` (a tab or a board that is just being opened). */
export async function waitForHandler(name: string, ms = 4000): Promise<Handler> {
  const until = Date.now() + ms;
  for (;;) {
    const h = handlers.get(name);
    if (h) return h;
    if (Date.now() > until) throw new Error("Die Ansicht dafür ist nicht bereit");
    await new Promise((r) => setTimeout(r, 40));
  }
}

// --- the state of the view, for get_view ---------------------------------------------------------------
const parts = new Map<string, () => unknown>();

/** A view adds its part to what `get_view` returns (until the returned function is called). */
export function provideView(name: string, part: () => unknown): () => void {
  parts.set(name, part);
  return () => {
    if (parts.get(name) === part) parts.delete(name);
  };
}

export const collectView = (): Record<string, unknown> => Object.fromEntries([...parts].map(([k, f]) => [k, f()]));

// --- what the frame offers the other tools -----------------------------------------------------------------
export interface Frame {
  /** Shows the analysis area (a board is mounted there afterwards). */
  showAnalysis(): Promise<void>;
}
let frame: Frame | null = null;
export const setFrame = (f: Frame | null) => {
  frame = f;
};
export const getFrame = () => frame;

// --- undo of the current tool session ----------------------------------------------------------------------
export interface UndoEntry {
  undo: NonNullable<Outcome["undo"]>;
  redo?: Outcome["redo"];
}
const undos = new Map<string, UndoEntry>();
export const rememberUndo = (id: string, e: UndoEntry) => undos.set(id, e);
export const undoFor = (id: string) => undos.get(id);
