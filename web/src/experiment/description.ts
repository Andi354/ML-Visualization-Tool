// Pure logic of the description block in the run tab (v0.2.1, feature H).
import type { Description } from "../api";
import { loadJson, saveJson, storageKey } from "../state/storage";

export interface DescSection {
  key: "purpose" | "shows" | "expectation" | "notes";
  label: string;
  /** Paragraphs for a text field, items for a list field. */
  kind: "text" | "list";
  paragraphs: string[];
  items: string[];
}

/** Text to paragraphs: one per line break, empty lines dropped. Plain text, nothing is interpreted. */
export const paragraphs = (text: string | null): string[] =>
  (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** The fields of the screen in their fixed order; an empty field is left out. */
export function sections(d: Description): DescSection[] {
  const out: DescSection[] = [];
  const text = (key: "purpose" | "expectation", label: string) => {
    const paragraphsOf = paragraphs(d[key]);
    if (paragraphsOf.length) out.push({ key, label, kind: "text", paragraphs: paragraphsOf, items: [] });
  };
  const list = (key: "shows" | "notes", label: string) => {
    if (d[key].length) out.push({ key, label, kind: "list", paragraphs: [], items: d[key] });
  };
  text("purpose", "Zweck");
  list("shows", "Soll zeigen");
  text("expectation", "Erwartung");
  list("notes", "Notizen");
  return out;
}

/** Zweck takes 1.5 parts, every other field 1 part. */
export const gridColumns = (secs: DescSection[]): string =>
  secs.map((s) => (s.key === "purpose" ? "minmax(0, 1.5fr)" : "minmax(0, 1fr)")).join(" ");

/** The warning above the fields, null when the description is complete. */
export const problemText = (d: Description): string | null =>
  d.problems.length ? "Beschreibung unvollständig: " + d.problems.join(" · ") : null;

export const foldLabel = (open: boolean): string => (open ? "zuklappen ▴" : "aufklappen ▾");

// --- folded state per run (kept like the frame state, used the next time the run is opened) ---------
export type Folds = Record<string, boolean>; // run id -> folded

const validFolds = (v: unknown): Folds | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "boolean")) as Folds;
};
export const loadFolds = (project: string): Folds => loadJson(storageKey(project, "description-folds"), validFolds) ?? {};
export const saveFolds = (project: string, folds: Folds) => saveJson(storageKey(project, "description-folds"), folds);
