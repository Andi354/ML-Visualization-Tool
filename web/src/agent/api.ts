import { getJson } from "../api";
import type { AgentMode, Chat, ChatInfo } from "./model";

export interface AgentOverview {
  chats: ChatInfo[];
  mode: AgentMode;
  /** The clock of the tool (ISO), so the cache display does not depend on the browser's clock. */
  now: string;
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
