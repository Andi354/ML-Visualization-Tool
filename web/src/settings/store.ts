// Client side of the settings: the values from the server, changes with undo/redo (session only), and their effect on the page.
import { useEffect, useState } from "preact/hooks";
import type { Value, Values } from "./catalog";
import { DEFAULTS } from "./catalog";
import { applyStep, makeStep, request, type Step } from "./model";
import { setDecimal } from "../format";

export interface Payload {
  values: Values;
  defaults: Values;
  warning: string | null;
  file: string;
  project_path: string;
  version: string;
  env: Record<string, string>;
}

let payload: Payload | null = null;
let undo: Step[] = [];
let redo: Step[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const json = { "content-type": "application/json" };

/** Writes the effect of the values to the page (density, scale, motion, number format). */
export function applyEffects(values: Values) {
  const get = (k: string) => (k in values ? values[k] : DEFAULTS[k]);
  const root = document.documentElement;
  root.dataset.density = String(get("look.density"));
  root.dataset.motion = get("look.motion") ? "on" : "off";
  root.style.zoom = String(Number(get("look.scale")) / 100);
  setDecimal(get("look.decimal") === "en" ? "." : ",");
}

function take(p: Payload) {
  payload = p;
  applyEffects(p.values);
  emit();
}

export async function load(): Promise<Payload> {
  const r = await fetch("/api/settings");
  take((await r.json()) as Payload);
  return payload!;
}

async function send(body: { set: Values; unset: string[] }) {
  const r = await fetch("/api/settings", { method: "PUT", headers: json, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  take((await r.json()) as Payload);
}

export const current = (): Payload | null => payload;
export const values = (): Values => payload?.values ?? {};
export const setting = <T extends Value>(key: string): T => (key in values() ? values()[key] : DEFAULTS[key]) as T;

// Changes run one after the other: a click right after another sees the values the first one produced.
let chain: Promise<unknown> = Promise.resolve();
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

/** Sets and resets values in one write (one undo step). `unset` may be a function, called when the change runs. */
const apply = async (set: Values, unset: string[] | (() => string[]) = []) => {
  const step = makeStep(values(), set, typeof unset === "function" ? unset() : unset);
  if (!step) return;
  await send(request(step.after));
  undo.push(step);
  redo = [];
  emit();
};
export const change = (set: Values, unset: string[] | (() => string[]) = []) => enqueue(() => apply(set, unset));

/** Ctrl++ / Ctrl+-: the size changes by one step from what it is when this runs (keys can repeat quickly). */
export const nudgeScale = (steps: number) => enqueue(() => apply({ "look.scale": Math.min(125, Math.max(85, setting<number>("look.scale") + steps * 5)) }));

export const resetAll = () => change({}, () => Object.keys(values()));

export const undoLast = () =>
  enqueue(async () => {
    const step = undo.pop();
    if (!step) return;
    await send(request(step.before));
    redo.push(step);
    emit();
  });

export const redoLast = () =>
  enqueue(async () => {
    const step = redo.pop();
    if (!step) return;
    await send(request(step.after));
    undo.push(step);
    emit();
  });

export const canUndo = () => undo.length > 0;
export const canRedo = () => redo.length > 0;

// The palette opens the settings tab at a row.
let focusKey: string | null = null;
export const requestFocus = (key: string | null) => {
  focusKey = key;
  emit();
};
export const takeFocus = (): string | null => {
  const k = focusKey;
  focusKey = null;
  return k;
};

/** For tests: forget the session history. */
export function resetHistory() {
  undo = [];
  redo = [];
}

export { applyStep };

/** Re-renders the component when the settings change; the payload is null until `load` is done. */
export function useSettings(): Payload | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return payload;
}
