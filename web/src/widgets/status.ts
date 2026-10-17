// The state of every widget tile that is drawn (v0.2.3, feature K): loading, drawn, failed, not available or gone.
// The tiles report it, `get_view` and the tools of the agent that change a board read it, so the agent learns about a
// failed widget from the result of its own action and does not have to ask.

export type WidgetState = "loading" | "ok" | "error" | "unavailable" | "gone";

export interface WidgetStatus {
  state: WidgetState;
  /** The error, or the note a widget gives when it cannot be drawn ("Dieser Lauf hat keine Achsen"). */
  reason?: string;
  type: string;
  label: string;
}

/** One widget as the agent reads it. */
export interface WidgetReport extends WidgetStatus {
  id: string;
}

const tiles = new Map<string, WidgetStatus>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function setStatus(id: string, status: WidgetStatus): void {
  tiles.set(id, status);
  changed();
}

export function clearStatus(id: string): void {
  if (tiles.delete(id)) changed();
}

export const statusOf = (id: string): WidgetStatus | undefined => tiles.get(id);

/** The widgets with these ids (`ids` order); one that is not drawn yet counts as loading. */
export function reportFor(widgets: { id: string; type: string }[], labelFor: (type: string) => string = (t) => t): WidgetReport[] {
  return widgets.map((w) => ({ id: w.id, ...(tiles.get(w.id) ?? { state: "loading" as const, type: w.type, label: labelFor(w.type) }) }));
}

/**
 * Resolves when none of the widgets is loading any more, or after `ms` (then the rest is reported as loading).
 * `grace` waits first, for tiles that are only just being mounted.
 */
export async function whenLoaded(ids: () => string[], ms = 5000, grace = 0): Promise<void> {
  if (grace) await new Promise((r) => setTimeout(r, grace));
  const pending = () => ids().some((id) => (tiles.get(id)?.state ?? "loading") === "loading");
  if (!pending()) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      listeners.delete(check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (!pending()) done();
    };
    const timer = setTimeout(done, ms);
    listeners.add(check);
  });
}

/** What the action line adds when something is wrong: "1 Widget mit Fehler · 1 nicht verfügbar · 2 laden noch". Empty if all is well. */
export function problemSummary(items: { state: WidgetState }[]): string {
  const count = (s: WidgetState) => items.filter((i) => i.state === s).length;
  const errors = count("error") + count("gone");
  const unavailable = count("unavailable");
  const loading = count("loading");
  const parts = [
    errors ? `${errors} Widget${errors === 1 ? "" : "s"} mit Fehler` : "",
    unavailable ? `${unavailable} nicht verfügbar` : "",
    loading ? `${loading} ${loading === 1 ? "lädt" : "laden"} noch` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
