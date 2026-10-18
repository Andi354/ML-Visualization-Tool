// Texts and numbers of the status bar and the run events (v0.3.0, D), without a screen.
import { formatNumber } from "../format";
import { shortName } from "../runs/model";

export interface RunProgress {
  id: string;
  name: string;
  issue: string | null;
  short: string | null;
  state: "running" | "stalled";
  cells_done: number;
  cells_planned: number | null;
  cells_failed: number;
  rate_per_hour: number | null;
  remaining_s: number | null;
  eta: string | null;
  last_cell_at: string | null;
  stalled_since: string | null;
  started: string | null;
}

export interface RunEvent {
  id: number;
  kind: "finished" | "errors" | "stalled" | "started";
  at: string;
  run: string;
  name: string;
  short: string | null;
  issue: string | null;
  cells?: number;
  failed?: number;
  duration_s?: number | null;
  best?: { label: string; unit: string; scale: number; value: number } | null;
  share?: number;
  message?: string | null;
  minutes?: number;
  last_cell_at?: string | null;
}

export const name = (r: { name: string; issue: string | null }) => shortName(r);

export const percent = (r: RunProgress): number | null => (r.cells_planned ? Math.min(100, Math.round((r.cells_done / r.cells_planned) * 100)) : null);

/** "10 min", "1 h 20 min": minutes below an hour, rounded; null when the time is not known. */
export function remainingLabel(seconds: number | null): string | null {
  if (seconds === null) return null;
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const clock = (iso: string | null): string => (iso ? iso.slice(11, 16) : "");

/** The left part of the status bar. */
export function statusLine(runs: RunProgress[]): { text: string; stalled: number; active: number } {
  const stalled = runs.filter((r) => r.state === "stalled").length;
  const going = runs.filter((r) => r.state === "running");
  if (runs.length === 0) return { text: "Keine Läufe aktiv", stalled: 0, active: 0 };
  if (going.length === 0) return { text: "", stalled, active: 0 };
  const newest = [...going].sort((a, b) => String(b.started ?? "").localeCompare(String(a.started ?? "")))[0];
  const p = percent(newest);
  const rest = remainingLabel(newest.remaining_s);
  const parts = [`${going.length} ${going.length === 1 ? "läuft" : "laufen"}`, name(newest), p === null ? "" : `${p} %`, rest ? `noch ~${rest}` : "Restzeit nach den ersten Zellen"];
  return { text: parts.filter(Boolean).join(" · "), stalled, active: going.length };
}

/** The line under a run in the popover. */
export function detailLine(r: RunProgress): string {
  if (r.state === "stalled" && r.stalled_since) {
    const since = r.last_cell_at ? ` · letzte Zelle ${clock(r.last_cell_at)}` : "";
    return `hängt seit ${clock(r.stalled_since)}${since}`;
  }
  const parts = [`${r.cells_done} von ${r.cells_planned ?? "?"} Zellen`, `${r.cells_failed} Fehler`];
  if (r.rate_per_hour) parts.push(`${formatNumber(r.rate_per_hour, 0)} Zellen/h`);
  const rest = remainingLabel(r.remaining_s);
  if (rest) parts.push(`noch ~${rest}${r.eta ? ` (fertig ca. ${clock(r.eta)})` : ""}`);
  return parts.join(" · ");
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  const min = Math.round(seconds / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** Title and text of an event for the notification and the bell. */
export function describe(e: RunEvent): { title: string; text: string } {
  const who = name(e);
  switch (e.kind) {
    case "finished": {
      const best = e.best ? `bester ${e.best.label} ${formatNumber(e.best.value * e.best.scale, 2)} ${e.best.unit}`.trim() : "";
      return { title: "Lauf fertig", text: [who, duration(e.duration_s), `${e.cells} Zellen`, best, `${e.failed ?? 0} Fehler`].filter(Boolean).join(" · ") };
    }
    case "errors":
      return { title: "Viele Fehler", text: `${who}: ${formatNumber(e.share ?? 0, 0)} % der Zellen fehlgeschlagen${e.message ? ` · ${e.message}` : ""}` };
    case "stalled":
      return { title: "Lauf hängt", text: `${who}: seit ${e.minutes} min keine neue Zelle` };
    default:
      return { title: "Neu gestartet", text: who };
  }
}
