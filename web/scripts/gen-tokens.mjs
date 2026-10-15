// Generates src/tokens.css from design/tokens.json (the single source of the design tokens).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function tokensToCss(t) {
  const lines = [];
  for (const [k, v] of Object.entries(t.color)) {
    if (Array.isArray(v)) v.forEach((c, i) => lines.push(`--${k}-${i + 1}: ${c};`));
    else if (typeof v === "object") for (const [n, c] of Object.entries(v)) lines.push(`--${n}: ${c};`);
    else lines.push(`--${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(t["export-light"])) {
    if (Array.isArray(v)) v.forEach((c, i) => lines.push(`--export-${k}-${i + 1}: ${c};`));
    else lines.push(`--export-${k}: ${v};`);
  }
  lines.push(`--font-sans: "${t.font.sans}", system-ui, sans-serif;`);
  lines.push(`--font-mono: "${t.font.mono}", ui-monospace, monospace;`);
  lines.push(`--size-base: ${t.font["size-base"]};`);
  lines.push(`--size-small: ${t.font["size-small"]};`);
  lines.push(`--size-tiny: ${t.font["size-tiny"]};`);
  for (const [k, v] of Object.entries(t.space)) lines.push(`--${k}: ${v};`);
  for (const [k, v] of Object.entries(t.radius)) lines.push(`--radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.size)) lines.push(`--${k}: ${v};`);
  return `/* Generated from design/tokens.json by scripts/gen-tokens.mjs. Do not edit. */\n:root {\n  ${lines.join("\n  ")}\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(readFileSync(resolve(here, "../../design/tokens.json"), "utf8"));
  writeFileSync(resolve(here, "../src/tokens.css"), tokensToCss(tokens));
}
