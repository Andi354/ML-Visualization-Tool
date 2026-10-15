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

/** Resolves after the browser had a chance to lay out and paint what was just rendered. */
export const settle = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
