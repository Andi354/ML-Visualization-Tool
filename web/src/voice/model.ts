// The result of a recognition as the review box shows it (v0.3.0, B): plain text and project terms.
export interface Plain {
  text: string;
}
export interface TermSeg {
  term: string;
  heard: string;
  kind: string;
  alts: string[];
  /** The user picked another value than the recognised one. */
  changed?: boolean;
  /** What was recognised first (to offer it again as "erkannt"). */
  original?: string;
}
export type Segment = Plain | TermSeg;
export const isTerm = (s: Segment): s is TermSeg => "term" in s;

export interface Recognised {
  text: string;
  heard: string;
  segments: Segment[];
  engine: "whisper" | "browser";
}

export const textOf = (segs: Segment[]): string => segs.map((s) => (isTerm(s) ? s.term : s.text)).join("");
export const termCount = (segs: Segment[]) => segs.filter(isTerm).length;

/** The term at `index` becomes `value` (an alternative, the recognised term or the words as heard); the chip is marked as changed. */
export function pick(segs: Segment[], index: number, value: string): Segment[] {
  return segs.map((s, i) => {
    if (i !== index || !isTerm(s)) return s;
    const original = s.original ?? s.term;
    return { ...s, term: value, original, changed: value !== original };
  });
}

/** What a chip offers: the recognised term, up to three alternatives, and the words as heard. */
export function options(s: TermSeg): { value: string; label: string }[] {
  const original = s.original ?? s.term;
  const list = [{ value: original, label: "erkannt" }, ...s.alts.filter((a) => a !== original).slice(0, 3).map((a) => ({ value: a, label: "" }))];
  if (s.heard && s.heard !== original) list.push({ value: s.heard, label: "wie gehört" });
  return list;
}

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Text typed before and the spoken text go out as one message. */
export const combine = (typed: string, spoken: string) => [typed.trim(), spoken.trim()].filter(Boolean).join(" ");

export const MAX_SECONDS = 120;
