// What the status bar shows about the agent, set by the agent window.
import { useEffect, useState } from "preact/hooks";

export type AgentState = "ready" | "busy" | "off";
let state: AgentState = "ready";
const listeners = new Set<() => void>();

export const setAgentState = (s: AgentState) => {
  if (s === state) return;
  state = s;
  listeners.forEach((l) => l());
};

export const useAgentState = (): AgentState => {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
};
