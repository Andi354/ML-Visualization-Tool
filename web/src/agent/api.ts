import { getJson } from "../api";
import type { Command } from "./commands";
import type { AgentMode, Chat, ChatInfo } from "./model";

export interface AgentOverview {
  chats: ChatInfo[];
  mode: AgentMode;
  /** Debug display on: the chat also shows the look-ups of the agent. */
  debug?: boolean;
  /** The clock of the tool (ISO), so the cache display does not depend on the browser's clock. */
  now: string;
  /** Subscription usage (percent) if Claude Code reported it. */
  limits: Limits | null;
}

export interface Limits {
  five_hour?: number;
  seven_day?: number;
}

export interface AgentSetup {
  ready: boolean;
  problem: string | null;
  step: string | null;
  /** An API key is set: calls are billed to the API, not the subscription. */
  api_key: boolean;
}

/** One state of a request: the chat as stored so far and whether the agent is still working on it. */
export interface RunSnapshot {
  chat: Chat;
  busy: boolean;
  limits: Limits | null;
  /** Instead of a chat state: the agent asks the open tool to do something (see commands.ts). */
  command?: Command;
}

const send = async <T,>(method: string, url: string, body?: unknown): Promise<T> => {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
};

export const getAgent = () => getJson<AgentOverview>("/api/agent");
export const getChat = (id: string) => getJson<Chat>(`/api/agent/chats/${id}`);
export const newChat = (title = "") => send<Chat>("POST", "/api/agent/chats", { title });
export const sendMessage = (id: string, text: string) => send<Chat>("POST", `/api/agent/chats/${id}/messages`, { text });
export const setMode = (mode: AgentMode) => send<{ mode: AgentMode }>("PUT", "/api/agent/mode", { mode });
export const setDebug = (on: boolean) => send<{ debug: boolean }>("PUT", "/api/agent/debug", { on });
export const getSetup = () => getJson<AgentSetup>("/api/agent/setup");
export const stopChat = (id: string) => send<{ stopped: boolean }>("POST", `/api/agent/chats/${id}/stop`);

/** Reads a stream of server-sent `data:` lines and hands each snapshot out. */
async function stream(url: string, body: unknown, onSnapshot: (s: RunSnapshot) => void): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok || !r.body) throw new Error(`${url}: ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 2);
      if (line.startsWith("data:")) onSnapshot(JSON.parse(line.slice(5)) as RunSnapshot);
    }
  }
}

/** Sends a message (`resend`: ask again after an error, without a second question in the chat). */
export const runMessage = (id: string, body: { text: string; context: string; resend?: boolean; images?: { file: string; name: string }[] }, onSnapshot: (s: RunSnapshot) => void) =>
  stream(`/api/agent/chats/${id}/run`, body, onSnapshot);
export const compactChat = (id: string, onSnapshot: (s: RunSnapshot) => void) => stream(`/api/agent/chats/${id}/compact`, {}, onSnapshot);

/** A click on a confirmation card (`approve`) or a run card (`choice`). */
export const decide = (cid: string, body: { approve?: boolean; choice?: string }) => send<{ accepted: boolean }>("POST", `/api/agent/commands/${cid}/decision`, body);
/** After Rückgängig / Wiederholen: the action line shows its new state. */
export const markAction = (chatId: string, cid: string, state: "done" | "reverted", text: string) =>
  send<Chat>("POST", `/api/agent/chats/${chatId}/actions/${cid}`, { state, text });

/** Keeps an image for the agent; resolves to `{file, name, size, url}` or rejects with the reason (a text for the user). */
export async function uploadImage(file: File): Promise<{ file: string; name: string; size: number; url: string }> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(new Error("Das Bild ließ sich nicht lesen."));
    reader.readAsDataURL(file);
  });
  const r = await fetch("/api/agent/attachments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: file.name || "Bild", data }) });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `Das Bild ließ sich nicht senden (${r.status}).`);
  return r.json();
}
