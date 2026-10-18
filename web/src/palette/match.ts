// Matching of the command palette: substring first (earlier is better), then letters that continue the previous
// match or start a word ("zl" finds "Zwei Läufe"). Returns the matched positions for the highlight.
const wordStart = (t: string, i: number) => i === 0 || !/[\p{L}\p{N}]/u.test(t[i - 1]);

export interface Hit {
  /** 0 = substring, 1 = letters; lower is better within a kind. */
  kind: 0 | 1;
  score: number;
  at: number[];
}

export function match(query: string, text: string): Hit | null {
  const q = query.trim().toLowerCase();
  if (!q) return { kind: 0, score: 0, at: [] };
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i >= 0) return { kind: 0, score: i, at: Array.from({ length: q.length }, (_, k) => i + k) };
  const compact = q.replace(/\s+/g, "");
  const walk = (qi: number, from: number, prev: number, acc: number[]): number[] | null => {
    if (qi === compact.length) return acc;
    for (let p = from; p < t.length; p++) {
      if (t[p] !== compact[qi]) continue;
      if (qi > 0 && p !== prev + 1 && !wordStart(t, p)) continue;
      const rest = walk(qi + 1, p + 1, p, [...acc, p]);
      if (rest) return rest;
    }
    return null;
  };
  const at = walk(0, 0, -1, []);
  return at ? { kind: 1, score: at[at.length - 1] - at[0], at } : null;
}

/** Splits a text into runs that are or are not highlighted. */
export function parts(text: string, at: number[]): { t: string; hit: boolean }[] {
  const set = new Set(at);
  const out: { t: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    if (out.length && out[out.length - 1].hit === hit) out[out.length - 1].t += text[i];
    else out.push({ t: text[i], hit });
  }
  return out;
}

export interface Ranked<T> {
  item: T;
  at: number[];
}

/** Items that match `query` on one of their texts, best first; `texts` gives the texts, the first one is highlighted. */
export function rank<T>(items: T[], query: string, texts: (i: T) => string[]): Ranked<T>[] {
  if (!query.trim()) return items.map((item) => ({ item, at: [] }));
  const scored: { item: T; at: number[]; kind: number; score: number; n: number }[] = [];
  items.forEach((item, n) => {
    const ts = texts(item);
    let best: { hit: Hit; first: boolean } | null = null;
    ts.forEach((t, k) => {
      const hit = match(query, t);
      if (hit && (!best || hit.kind < best.hit.kind || (hit.kind === best.hit.kind && hit.score < best.hit.score))) best = { hit, first: k === 0 };
    });
    if (best) {
      const b = best as { hit: Hit; first: boolean };
      scored.push({ item, at: b.first ? b.hit.at : [], kind: b.hit.kind, score: b.hit.score, n });
    }
  });
  scored.sort((a, b) => a.kind - b.kind || a.score - b.score || a.n - b.n);
  return scored.map(({ item, at }) => ({ item, at }));
}

export type Mode = "runs" | "commands" | "settings" | "prefixes";

export const PREFIXES: { prefix: string; mode: Mode; label: string; desc: string }[] = [
  { prefix: "", mode: "runs", label: "Läufe und Issues", desc: "ohne Zeichen" },
  { prefix: ">", mode: "commands", label: "Befehle", desc: "> eingeben" },
  { prefix: "@", mode: "settings", label: "Einstellungen", desc: "@ eingeben" },
];

/** The mode and the search text of what was typed. */
export function parseInput(input: string): { mode: Mode; query: string } {
  if (input.startsWith(">")) return { mode: "commands", query: input.slice(1) };
  if (input.startsWith("@")) return { mode: "settings", query: input.slice(1) };
  if (input.startsWith("?")) return { mode: "prefixes", query: input.slice(1) };
  return { mode: "runs", query: input };
}
