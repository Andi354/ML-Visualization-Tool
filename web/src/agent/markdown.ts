// A small Markdown reader for the answers of the agent (v0.2.3, feature J). Pure logic: text in, a tree out.
// The tree is drawn with Preact elements (`Markdown.tsx`), so nothing of the text ever becomes HTML.
//
// What it reads: paragraphs (a line break stays a line break), headings, `code`, fenced code, **bold**, *italic*,
// [links](https://…) and bare http(s) links, bullet and numbered lists (nested), quotes, rules and pipe tables.
// What it does not: HTML, images, footnotes. Marks that are not closed stay as typed.

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "br" };

export type Align = "left" | "right" | "center" | null;

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: number; c: Inline[] }
  | { t: "code"; lang: string; v: string }
  | { t: "list"; ordered: boolean; start: number; items: Block[][] }
  | { t: "quote"; c: Block[] }
  | { t: "hr" }
  | { t: "table"; head: Inline[][]; align: Align[]; rows: Inline[][][] };

// --- inline ---------------------------------------------------------------------------------------
const ESCAPABLE = "\\`*_{}[]()#+-.!|~>";
const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;
const BARE = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/;
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

function pushText(out: Inline[], v: string) {
  if (!v) return;
  const last = out[out.length - 1];
  if (last && last.t === "text") last.v += v;
  else out.push({ t: "text", v });
}

/** Index of the closing mark `mark` at or after `from`, or -1. A closing mark has no space before it. */
function findClose(s: string, mark: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "`") {
      const end = s.indexOf("`", i + 1); // a code span hides the marks inside
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (s.startsWith(mark, i) && !isSpace(s[i - 1]) && i > from) {
      if (mark.length === 1 && s[i + 1] === mark) {
        i++; // part of a double mark
        continue;
      }
      if (mark.startsWith("_") && isWord(s[i + mark.length])) continue; // snake_case is no emphasis
      return i;
    }
  }
  return -1;
}

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length && ESCAPABLE.includes(s[i + 1])) {
      pushText(out, s[i + 1]);
      i += 2;
    } else if (ch === "\n") {
      out.push({ t: "br" });
      i++;
    } else if (ch === "`") {
      let n = 1;
      while (s[i + n] === "`") n++;
      const fence = "`".repeat(n);
      const end = s.indexOf(fence, i + n);
      if (end < 0) {
        pushText(out, fence);
        i += n;
      } else {
        const v = s.slice(i + n, end).replace(/\n/g, " ");
        out.push({ t: "code", v: v.length > 2 && v.startsWith(" ") && v.endsWith(" ") ? v.slice(1, -1) : v });
        i = end + n;
      }
    } else if (ch === "[") {
      const m = LINK.exec(s.slice(i));
      if (m) {
        out.push({ t: "link", href: m[2], c: parseInline(m[1]).filter((x) => x.t !== "link") });
        i += m[0].length;
      } else {
        pushText(out, ch);
        i++;
      }
    } else if ((ch === "*" || ch === "_") && s[i + 1] === ch && !isSpace(s[i + 2]) && !(ch === "_" && isWord(s[i - 1]))) {
      const end = findClose(s, ch + ch, i + 2);
      if (end < 0) {
        pushText(out, ch + ch);
        i += 2;
      } else {
        out.push({ t: "strong", c: parseInline(s.slice(i + 2, end)) });
        i = end + 2;
      }
    } else if ((ch === "*" || ch === "_") && !isSpace(s[i + 1]) && s[i + 1] !== ch && !(ch === "_" && isWord(s[i - 1]))) {
      const end = findClose(s, ch, i + 1);
      if (end < 0) {
        pushText(out, ch);
        i++;
      } else {
        out.push({ t: "em", c: parseInline(s.slice(i + 1, end)) });
        i = end + 1;
      }
    } else if (ch === "h" && !isWord(s[i - 1]) && BARE.test(s.slice(i))) {
      const url = BARE.exec(s.slice(i))![0];
      out.push({ t: "link", href: url, c: [{ t: "text", v: url }] });
      i += url.length;
    } else {
      pushText(out, ch);
      i++;
    }
  }
  return out;
}

// --- blocks ---------------------------------------------------------------------------------------
const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const isTableStart = (lines: string[], i: number) => lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("-") && TABLE_SEP.test(lines[i + 1]);
const startsBlock = (lines: string[], i: number) =>
  FENCE.test(lines[i]) || HEADING.test(lines[i]) || RULE.test(lines[i]) || ITEM.test(lines[i]) || QUOTE.test(lines[i]) || isTableStart(lines, i);

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "`") {
      const end = s.indexOf("`", i + 1); // a pipe inside code stays in the cell
      if (end < 0) cur += s[i];
      else {
        cur += s.slice(i, end + 1);
        i = end;
      }
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const indentOf = (line: string) => line.length - line.trimStart().length;

export function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i].trim().startsWith(fence[1]) && lines[i].trim().replace(/[`~]/g, "") === "")) body.push(lines[i++]);
      i++; // the closing fence (a missing one ends at the end of the text)
      out.push({ t: "code", lang: fence[2], v: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ t: "h", level: heading[1].length, c: parseInline(heading[2]) });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }
    if (isTableStart(lines, i)) {
      const head = splitRow(line).map(parseInline);
      const align: Align[] = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : null));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        const cells = splitRow(lines[i++]);
        rows.push(head.map((_, k) => parseInline(cells[k] ?? "")));
      }
      out.push({ t: "table", head, align, rows });
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])![1]);
      out.push({ t: "quote", c: parseBlocks(body) });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      const base = item[1].length;
      const ordered = /\d/.test(item[2]);
      const items: string[][] = [];
      const start = ordered ? parseInt(item[2], 10) : 1;
      while (i < lines.length) {
        const cur = lines[i];
        const m = ITEM.exec(cur);
        if (m && m[1].length === base && /\d/.test(m[2]) === ordered) {
          items.push([m[3]]);
          i++;
        } else if (cur.trim() && indentOf(cur) > base && items.length) {
          items[items.length - 1].push(cur.slice(Math.min(indentOf(cur), base + 2)));
          i++;
        } else if (!cur.trim() && i + 1 < lines.length && items.length && (ITEM.test(lines[i + 1]) ? ITEM.exec(lines[i + 1])![1].length >= base : indentOf(lines[i + 1]) > base)) {
          items[items.length - 1].push("");
          i++;
        } else break;
      }
      out.push({ t: "list", ordered, start, items: items.map((body) => parseBlocks(body)) });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(lines, i))) para.push(lines[i++].trim());
    out.push({ t: "p", c: parseInline(para.join("\n")) });
  }
  return out;
}

export function parseMarkdown(text: string): Block[] {
  return parseBlocks(text.replace(/\r\n?/g, "\n").split("\n"));
}
