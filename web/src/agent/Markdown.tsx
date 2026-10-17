import type { ComponentChildren } from "preact";
import { parseMarkdown, type Block, type Inline } from "./markdown";

function inline(nodes: Inline[]): ComponentChildren {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v;
      case "br":
        return <br key={i} />;
      case "code":
        return (
          <code key={i} class="md-code">
            {n.v}
          </code>
        );
      case "strong":
        return <strong key={i}>{inline(n.c)}</strong>;
      case "em":
        return <em key={i}>{inline(n.c)}</em>;
      case "link":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" class="md-link">
            {inline(n.c)}
          </a>
        );
    }
  });
}

function blocks(list: Block[], tight = false): ComponentChildren {
  return list.map((b, i) => {
    switch (b.t) {
      case "p":
        return tight ? <span key={i}>{inline(b.c)}</span> : <p key={i}>{inline(b.c)}</p>;
      case "h":
        return (
          <div key={i} class={"md-h md-h" + Math.min(b.level, 3)} role="heading" aria-level={b.level}>
            {inline(b.c)}
          </div>
        );
      case "code":
        return (
          <pre key={i} class="md-pre">
            <code>{b.v}</code>
          </pre>
        );
      case "hr":
        return <hr key={i} class="md-hr" />;
      case "quote":
        return (
          <blockquote key={i} class="md-quote">
            {blocks(b.c)}
          </blockquote>
        );
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return (
          <Tag key={i} class="md-list" start={b.ordered && b.start !== 1 ? b.start : undefined}>
            {b.items.map((item, k) => (
              <li key={k}>{blocks(item, item.length > 0 && item.every((x, n) => x.t === "list" || (x.t === "p" && n === 0)))}</li>
            ))}
          </Tag>
        );
      }
      case "table":
        return (
          <div key={i} class="md-table-wrap">
            <table class="md-table">
              <thead>
                <tr>
                  {b.head.map((c, k) => (
                    <th key={k} style={b.align[k] ? { textAlign: b.align[k]! } : undefined}>
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, k) => (
                      <td key={k} style={b.align[k] ? { textAlign: b.align[k]! } : undefined}>
                        {inline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

/** An answer of the agent as formatted text. Everything is drawn from a tree, nothing of the text becomes HTML. */
export function Markdown({ text }: { text: string }) {
  return <div class="md">{blocks(parseMarkdown(text))}</div>;
}
