import { render } from "preact";
import { describe, expect, it } from "vitest";
import { Markdown } from "../src/agent/Markdown";
import { parseInline, parseMarkdown, type Block, type Inline } from "../src/agent/markdown";

const text = (nodes: Inline[]): string =>
  nodes.map((n) => (n.t === "text" ? n.v : n.t === "code" ? n.v : n.t === "br" ? "\n" : text(n.c))).join("");
const html = (md: string) => {
  const box = document.createElement("div");
  render(<Markdown text={md} />, box);
  return box;
};

describe("inline", () => {
  it("reads bold, italic and code", () => {
    expect(parseInline("a **b** *c* `d`")).toEqual([
      { t: "text", v: "a " },
      { t: "strong", c: [{ t: "text", v: "b" }] },
      { t: "text", v: " " },
      { t: "em", c: [{ t: "text", v: "c" }] },
      { t: "text", v: " " },
      { t: "code", v: "d" },
    ]);
  });
  it("does not read snake_case or a lone star as emphasis", () => {
    expect(text(parseInline("find_runs und read_run"))).toBe("find_runs und read_run");
    expect(parseInline("find_runs und read_run").every((n) => n.t === "text")).toBe(true);
    expect(parseInline("2 * 3 * 4").every((n) => n.t === "text")).toBe(true);
  });
  it("leaves marks that are not closed as typed", () => {
    expect(parseInline("**offen").map((n) => n.t)).toEqual(["text"]);
    expect(text(parseInline("**offen und `code"))).toBe("**offen und `code");
  });
  it("keeps marks inside code as they are", () => {
    expect(parseInline("`**nicht fett**`")).toEqual([{ t: "code", v: "**nicht fett**" }]);
  });
  it("reads nested marks and escapes", () => {
    expect(parseInline("**a *b* c**")[0]).toMatchObject({ t: "strong" });
    expect(text(parseInline("\\*kein\\* Stern"))).toBe("*kein* Stern");
  });
  it("reads links and bare http(s) addresses, nothing else", () => {
    expect(parseInline("[Doku](https://example.org/a)")).toEqual([{ t: "link", href: "https://example.org/a", c: [{ t: "text", v: "Doku" }] }]);
    const bare = parseInline("siehe https://example.org/x.");
    expect(bare[1]).toMatchObject({ t: "link", href: "https://example.org/x" });
    expect(bare[2]).toEqual({ t: "text", v: "." });
    expect(parseInline("[x](javascript:alert(1))").some((n) => n.t === "link")).toBe(false);
    expect(parseInline("[x](data:text/html,hi)").some((n) => n.t === "link")).toBe(false);
  });
  it("turns a line break into a break", () => {
    expect(parseInline("a\nb").map((n) => n.t)).toEqual(["text", "br", "text"]);
  });
});

describe("blocks", () => {
  const kinds = (md: string) => parseMarkdown(md).map((b) => b.t);
  it("splits paragraphs at blank lines and keeps single line breaks", () => {
    expect(kinds("eins\nzwei\n\ndrei")).toEqual(["p", "p"]);
  });
  it("reads headings", () => {
    expect(parseMarkdown("## Titel **fett**")[0]).toMatchObject({ t: "h", level: 2 });
  });
  it("reads fenced code verbatim, also without a closing fence", () => {
    expect(parseMarkdown("```py\nx = **1**\n\ny\n```")[0]).toEqual({ t: "code", lang: "py", v: "x = **1**\n\ny" });
    expect(parseMarkdown("```\noffen")[0]).toEqual({ t: "code", lang: "", v: "offen" });
  });
  it("reads bullet and numbered lists", () => {
    const [list] = parseMarkdown("- a\n- b\n- c") as Extract<Block, { t: "list" }>[];
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
    const [num] = parseMarkdown("3. x\n4. y") as Extract<Block, { t: "list" }>[];
    expect(num).toMatchObject({ ordered: true, start: 3 });
    expect(num.items).toHaveLength(2);
  });
  it("reads nested lists and an item that continues on the next line", () => {
    const [list] = parseMarkdown("- a\n  - a1\n  - a2\n- b\n  weiter") as Extract<Block, { t: "list" }>[];
    expect(list.items).toHaveLength(2);
    expect(list.items[0].map((b) => b.t)).toEqual(["p", "list"]);
    expect(text((list.items[1][0] as Extract<Block, { t: "p" }>).c)).toBe("b\nweiter");
  });
  it("starts a list right after a paragraph line", () => {
    expect(kinds("Ich kann:\n- a\n- b")).toEqual(["p", "list"]);
  });
  it("reads quotes and rules", () => {
    expect(kinds("> zitat\n> mehr\n\n---")).toEqual(["quote", "hr"]);
  });
  it("reads pipe tables with alignment, missing cells and escaped pipes", () => {
    const [t] = parseMarkdown("| Name | Wert |\n|:--|--:|\n| a | 1 |\n| b `x|y` |\n| c \\| d | 3 |") as Extract<Block, { t: "table" }>[];
    expect(t.t).toBe("table");
    expect(t.align).toEqual(["left", "right"]);
    expect(t.head.map(text)).toEqual(["Name", "Wert"]);
    expect(t.rows.map((r) => r.map(text))).toEqual([["a", "1"], ["b x|y", ""], ["c | d", "3"]]);
  });
  it("does not take a line with a pipe for a table without the separator row", () => {
    expect(kinds("a | b\nc | d")).toEqual(["p"]);
  });
  it("copes with Windows line breaks and empty text", () => {
    expect(kinds("a\r\n\r\nb")).toEqual(["p", "p"]);
    expect(parseMarkdown("")).toEqual([]);
  });
});

describe("drawing", () => {
  it("draws bold, lists, code and a table as elements", () => {
    const box = html("**Fett** und `code`\n\n- eins\n- zwei\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(box.querySelector("strong")?.textContent).toBe("Fett");
    expect(box.querySelector(".md-code")?.textContent).toBe("code");
    expect(box.querySelectorAll("ul > li")).toHaveLength(2);
    expect(box.querySelectorAll("table th")).toHaveLength(2);
    expect(box.querySelectorAll("tbody td")).toHaveLength(2);
  });
  it("never turns the text into HTML", () => {
    const box = html('<script>alert(1)</script> <img src=x onerror=alert(1)> **ok**');
    expect(box.querySelector("script")).toBeNull();
    expect(box.querySelector("img")).toBeNull();
    expect(box.textContent).toContain("<script>alert(1)</script>");
    expect(box.querySelector("strong")?.textContent).toBe("ok");
  });
  it("opens links in a new tab without handing over the opener, and only for http(s)", () => {
    const box = html("[a](https://example.org) [b](javascript:alert(1))");
    const links = box.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(box.textContent).toContain("[b](javascript:alert(1))");
  });
  it("keeps the line breaks of plain text", () => {
    const box = html("eins\nzwei");
    expect(box.querySelectorAll("br")).toHaveLength(1);
  });
});
