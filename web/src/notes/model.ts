// Order, labels and keys of the notes of a run (v0.3.0, E).
import type { Anchor, Note } from "./api";

export const SECTION_LABEL: Record<string, string> = { purpose: "Zweck", shows: "Zeigt", expectation: "Erwartung", notes: "Notizen" };
const SECTION_ORDER = ["purpose", "shows", "expectation", "notes"];

/** The key of a group of the table: its values of the grid axes, sorted by axis ("lr_epochs=40 · lstm_layer=2"). */
export const groupKey = (params: Record<string, string>): string =>
  Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(" · ");

/** "an lstm_layer 2 · lr_epochs 40" for the card: where the note hangs. */
export function anchorLabel(a: Anchor): string {
  if (a.kind === "run") return "am Lauf";
  if (a.kind === "section") return `an der Beschreibung · ${SECTION_LABEL[a.key] ?? a.key}`;
  return "an " + a.key.replaceAll("=", " ");
}

/** Run, then description sections in the order of the description, then groups in table order (unknown groups last). */
export function orderNotes(notes: Note[], tableKeys: string[]): Note[] {
  const rank = (n: Note): [number, number] => {
    if (n.anchor.kind === "run") return [0, 0];
    if (n.anchor.kind === "section") return [1, SECTION_ORDER.indexOf(n.anchor.key)];
    const i = tableKeys.indexOf(n.anchor.key);
    return [2, i < 0 ? 1e6 : i];
  };
  return [...notes].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || a.created.localeCompare(b.created);
  });
}

export const countBy = (notes: Note[], pick: (n: Note) => string | null): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const n of notes) {
    const k = pick(n);
    if (k !== null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

export const sameAnchor = (a: Anchor, b: Anchor) => a.kind === b.kind && a.key === b.key;

export const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
