import { setting } from "../settings/store";
// Pure logic of the agent window (feature A): chats, the display of context and cache, texts.
import type { FrameState } from "../state/frame";

export type AgentMode = "direct" | "mixed" | "confirm";
export type WindowState = "open" | "min" | "closed";

export interface AgentMessage {
  /** user and agent speak; action is a line about something the agent did; info is a note in the history. */
  k: "user" | "agent" | "action" | "info" | "confirm" | "choice";
  t: string;
  at?: string;
  /** Set on action lines that can be undone (feature C). */
  undo_id?: string;
  /** An info line that reports an error of Claude Code (offers "Erneut senden"). */
  error?: boolean;
  /** The error line is about a tool call of the agent (not about Claude Code): no "Erneut senden". */
  tool?: string;
  /** Id of a card or action (confirmation, run choice); the tool answers it by this id. */
  cid?: string;
  /** Confirmation card: further lines (target path, settings) and whether the button says "Speichern". */
  details?: string[];
  save?: boolean;
  /** Run card: the runs to choose from. */
  runs?: { id: string; name: string; started: string | null; state: string; axes: string[]; issue: string | null }[];
  /** Action line: done or reverted; rejected is set when the user said no; auto when no card was needed. */
  state?: "done" | "reverted";
  rejected?: boolean;
  auto?: boolean;
  /** Images that went along with a message of the user (kept in the project, see `attachments.ts`). */
  images?: { file: string; name: string }[];
  /** The words as the recogniser heard them (a spoken message, v0.3.0). */
  spoken?: string;
  /** Action line of the debug display (a look-up of the agent): only shown while the debug button is on. */
  debug?: boolean;
}

/** A chat as the list shows it (no messages). One chat is one Claude Code session. */
export interface ChatInfo {
  id: string;
  title: string;
  updated_at: string;
  session_id: string | null;
  /** Input tokens of the last turn (input + cache creation + cache read). */
  tokens: number;
  last_turn_at: string | null;
  cache_ttl_s: number;
  /** Context window of the model as Claude Code reported it (else CONTEXT_WINDOW). */
  context_window?: number;
  messages_n?: number;
}

export interface Chat extends ChatInfo {
  messages: AgentMessage[];
}

/** Window of the model the context bar is measured against, if Claude Code does not report one. */
export const CONTEXT_WINDOW = 200_000;
export const MODES: { key: AgentMode; label: string; icon: string; desc: string; hint: string }[] = [
  { key: "direct", label: "Direkt", icon: "⏵⏵", desc: "Handelt sofort. Jede Aktion lässt sich rückgängig machen.", hint: "handelt ohne Rückfrage" },
  {
    key: "mixed",
    label: "Gemischt",
    icon: "⏵",
    desc: "Suchen, Navigieren und Ansicht sofort. Analyse ändern und Speichern erst nach Bestätigung.",
    hint: "fragt bei Änderungen und Speichern",
  },
  { key: "confirm", label: "Bestätigen", icon: "⏸", desc: "Fragt vor jeder Aktion. Auch danach rückgängig machbar.", hint: "fragt vor jeder Aktion" },
];

export const modeOf = (key: AgentMode) => MODES.find((m) => m.key === key) ?? MODES[1];

/** Shift+Tab in the input: Direkt → Gemischt → Bestätigen → Direkt. */
export function nextMode(m: AgentMode): AgentMode {
  const i = MODES.findIndex((x) => x.key === m);
  return MODES[(i + 1) % MODES.length].key;
}

/** What the agent sees, shown in the chip under the header. */
export function contextLabel(f: Pick<FrameState, "area" | "active" | "runsView">): string {
  if (f.active === "@settings") return "Einstellungen";
  if (f.active) return "Lauf · " + f.active.replace(/^\d{4}-\d{2}-\d{2}_\d{4,6}_/, "");
  if (f.area === "analysis") return "Analyse";
  return f.runsView === "issues" ? "Läufe · Issues" : "Läufe · Liste";
}

const k = (n: number) => `${Math.round(n / 1000)}k`;

/** Context fill in percent, and the tooltip behind the bar. */
export function contextUse(tokens: number, window: number = CONTEXT_WINDOW) {
  const share = Math.max(0, tokens) / window;
  return {
    pct: Math.round(share * 100),
    level: share > 0.9 ? "error" : share > 0.7 ? "warn" : "best",
    tip: `Kontext: ${k(tokens)} von ${k(window)} Tokens`,
  } as const;
}

/** State of the prompt cache of a chat, computed from the time of the last turn (never by asking the agent). */
export function cacheState(c: Pick<ChatInfo, "tokens" | "last_turn_at" | "cache_ttl_s">, nowMs: number) {
  if (!c.tokens) return { kind: "new" as const, minutes: 0, label: "neu", tip: "Leerer Chat" };
  const last = c.last_turn_at ? Date.parse(c.last_turn_at) : NaN;
  const left = Number.isFinite(last) ? c.cache_ttl_s - (nowMs - last) / 1000 : 0;
  if (left > 0) {
    const minutes = Math.max(1, Math.ceil(left / 60));
    return {
      kind: "warm" as const,
      minutes,
      label: `Cache warm · ${minutes} min`,
      tip: "Nächste Nachricht liest den Verlauf aus dem Cache (günstig)",
    };
  }
  return {
    kind: "cold" as const,
    minutes: 0,
    label: "Cache abgelaufen",
    tip: `Nächste Nachricht liest ~${k(c.tokens)} Tokens neu ein`,
  };
}

/** "heute", "gestern" or the date, relative to the clock of the tool. */
export function whenText(iso: string, nowIso: string): string {
  const d = new Date(iso);
  const n = new Date(nowIso);
  if (isNaN(d.getTime()) || isNaN(n.getTime())) return "";
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((day(n) - day(d)) / 86_400_000);
  if (diff <= 0) return "heute";
  if (diff === 1) return "gestern";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

/** Line in the chat list: "heute · 38k · warm" (or "leer"). */
export function chatMeta(c: ChatInfo, nowIso: string, nowMs: number): string {
  const when = whenText(c.updated_at, nowIso);
  if (!c.tokens) return `${when} · leer`;
  return `${when} · ${k(c.tokens)} · ${cacheState(c, nowMs).kind === "warm" ? "warm" : "kalt"}`;
}

/** A message into a cold chat of this size or more is held back (setting `agent.cacheWarn`, 50k by default): nothing is sent yet. */
export const needsColdHint = (c: Pick<ChatInfo, "tokens" | "last_turn_at" | "cache_ttl_s">, nowMs: number) =>
  c.tokens > setting<number>("agent.cacheWarn") * 1000 && cacheState(c, nowMs).kind === "cold";

/** /compact needs a warm cache (it reads the chat once itself) and a chat worth compacting. */
export const COMPACT_MIN_TOKENS = 10_000;
export function compactState(c: Pick<ChatInfo, "tokens" | "last_turn_at" | "cache_ttl_s">, nowMs: number): { enabled: boolean; tip: string } {
  if (c.tokens < COMPACT_MIN_TOKENS) return { enabled: false, tip: "Der Chat ist noch klein (unter 10k Tokens)" };
  if (cacheState(c, nowMs).kind !== "warm") return { enabled: false, tip: "Komprimieren liest den Chat einmal selbst: nur bei warmem Cache sinnvoll" };
  return { enabled: true, tip: "Komprimieren liest den Chat einmal selbst" };
}

/** "Abo · 5 h: 24 % · Woche: 65 %", or null if Claude Code reports no usage. */
export function limitsLine(l: { five_hour?: number; seven_day?: number } | null | undefined): string | null {
  if (!l || (l.five_hour === undefined && l.seven_day === undefined)) return null;
  const parts = [];
  if (l.five_hour !== undefined) parts.push(`5 h: ${l.five_hour} %`);
  if (l.seven_day !== undefined) parts.push(`Woche: ${l.seven_day} %`);
  return `Abo · ${parts.join(" · ")}`;
}

export type CapsuleState = "ready" | "busy" | "unset" | "error";

/** Text and state of the capsule: not set up, busy, failed, the last action, or ready. */
export function capsuleView(chat: Chat | null, busy: boolean, ready: boolean): { text: string; state: CapsuleState } {
  if (!ready) return { text: "Agent · nicht eingerichtet", state: "unset" };
  if (busy) return { text: "Agent · arbeitet …", state: "busy" };
  if (chat?.messages.length && chat.messages[chat.messages.length - 1].error) return { text: "Agent · Fehler", state: "error" };
  return { text: capsuleText(chat, false), state: "ready" };
}

/** Text of the capsule: busy, the last action, or ready. */
export function capsuleText(chat: Chat | null, busy: boolean): string {
  if (busy) return "Agent · arbeitet …";
  const last = chat?.messages.filter((m) => m.k === "action").slice(-1)[0];
  return last ? `Agent · ${last.t}` : "Agent · bereit";
}
