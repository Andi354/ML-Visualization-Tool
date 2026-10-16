// Renders a DOM node to a PNG data URL (the exported widget image) with fonts embedded.
import { getFontEmbedCSS, toPng } from "html-to-image";

let fontCss: Promise<string> | null = null;

export async function rasterize(node: HTMLElement, opts: { pixelRatio?: number; background?: string } = {}): Promise<string> {
  await document.fonts?.ready;
  fontCss ??= getFontEmbedCSS(node).catch(() => "");
  const fontEmbedCSS = await fontCss;
  return toPng(node, {
    pixelRatio: opts.pixelRatio ?? 2,
    backgroundColor: opts.background,
    fontEmbedCSS,
    cacheBust: false,
  });
}

const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Resolves after the browser had a chance to lay out and paint what was just rendered; charts that draw
 *  themselves later (own widgets mark themselves with `data-pending`) are waited for, at most `maxMs`. */
export async function settle(node?: Element | null, maxMs = 8000): Promise<void> {
  await frames();
  const until = Date.now() + maxMs;
  while (node && node.querySelector("[data-pending]") && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 40));
  }
  await frames();
}
