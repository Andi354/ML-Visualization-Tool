// Progress and events of running runs in the browser (v0.3.0, D): polls the backend, keeps the events of the session.
import { useEffect, useState } from "preact/hooks";
import { setting } from "../settings/store";
import { describe, name, type RunEvent, type RunProgress } from "./model";

export interface Note extends RunEvent {
  read: boolean;
  summary?: string;
  summarising?: boolean;
  summaryError?: string;
}

export interface Toast {
  id: number;
  note: Note;
}

let runs: RunProgress[] = [];
let notes: Note[] = [];
let toasts: Toast[] = [];
let started: string | null = null;
let since: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const pollMs = () => Number((window as unknown as { __mlvizPollMs?: number }).__mlvizPollMs) || 10_000;

function notify(n: Note) {
  if (!setting<boolean>("runs.notifyMac") || !document.hidden || typeof Notification === "undefined") return;
  const show = () => {
    const d = describe(n);
    const note = new Notification(d.title, { body: d.text, tag: `mlviz-${n.id}` });
    note.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent("mlviz:open-run", { detail: n.run }));
    };
  };
  if (Notification.permission === "granted") show();
  else if (Notification.permission === "default") void Notification.requestPermission().then((p) => p === "granted" && show());
}

export async function poll(): Promise<void> {
  const r = await fetch(`/api/progress?since=${since ?? 0}`);
  if (!r.ok) return;
  const snap = (await r.json()) as { runs: RunProgress[]; events: RunEvent[]; last_event: number };
  runs = snap.runs;
  if (since === null) {
    since = snap.last_event; // after a reload the bell starts empty
  } else {
    for (const e of snap.events) {
      since = Math.max(since, e.id);
      if (e.kind === "started") {
        started = name(e);
        setTimeout(() => {
          if (started === name(e)) {
            started = null;
            emit();
          }
        }, 5000);
        continue;
      }
      const n: Note = { ...e, read: false };
      notes = [n, ...notes];
      toasts = [...toasts, { id: e.id, note: n }];
      notify(n);
      setTimeout(() => closeToast(e.id, true), 9000);
    }
  }
  emit();
}

export function closeToast(id: number, auto = false) {
  const t = toasts.find((x) => x.id === id);
  if (!t || (auto && t.note.summarising)) return; // a running summary keeps the notification
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

export const markRead = (id?: number) => {
  notes = notes.map((n) => (id === undefined || n.id === id ? { ...n, read: true } : n));
  emit();
};
export const clearNotes = () => {
  notes = [];
  toasts = [];
  emit();
};

export async function summarise(id: number) {
  const patch = (p: Partial<Note>) => {
    notes = notes.map((n) => (n.id === id ? { ...n, ...p } : n));
    toasts = toasts.map((t) => (t.id === id ? { ...t, note: { ...t.note, ...p } } : t));
    emit();
  };
  const n = notes.find((x) => x.id === id);
  if (!n || n.summarising) return;
  patch({ summarising: true, summaryError: undefined });
  try {
    const r = await fetch("/api/progress/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ run: n.run }) });
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? `Fehler ${r.status}`);
    patch({ summarising: false, summary: body.text });
  } catch (e) {
    patch({ summarising: false, summaryError: (e as Error).message });
  }
}

export function startPolling() {
  if (timer) return;
  void poll().catch(() => undefined);
  timer = setInterval(() => void poll().catch(() => undefined), pollMs());
}

export const useProgress = () => {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((x) => x + 1);
    listeners.add(l);
    startPolling();
    return () => void listeners.delete(l);
  }, []);
  return { runs, notes, toasts, started, unread: notes.filter((n) => !n.read).length };
};
