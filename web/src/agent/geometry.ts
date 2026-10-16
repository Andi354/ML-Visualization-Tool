// Geometry of the agent window (feature A): where it may be, how it moves and resizes.
// Pure, so the rules are tested without a browser.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The area the window may use: right of the icon bar, below the tab strip, inside the tool. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const DEFAULT_SIZE = { w: 400, h: 520 };
export const MIN_SIZE = { w: 320, h: 280 };
/** Distance of the window from the bottom right corner the first time it opens. */
export const CORNER_GAP = 24;
/** The window never touches the edge of its area. */
export const EDGE_GAP = 4;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Largest width and height available at all (the minimum size gives way when the tool is smaller). */
function room(b: Bounds) {
  return { w: Math.max(0, b.right - b.left - 2 * EDGE_GAP), h: Math.max(0, b.bottom - b.top - 2 * EDGE_GAP) };
}

/** Pushes and shrinks a window until it lies fully inside the bounds. */
export function fit(r: Rect, b: Bounds): Rect {
  const max = room(b);
  const w = Math.min(Math.max(r.w, Math.min(MIN_SIZE.w, max.w)), max.w);
  const h = Math.min(Math.max(r.h, Math.min(MIN_SIZE.h, max.h)), max.h);
  return {
    w,
    h,
    x: clamp(r.x, b.left + EDGE_GAP, b.right - w - EDGE_GAP),
    y: clamp(r.y, b.top + EDGE_GAP, b.bottom - h - EDGE_GAP),
  };
}

/** First opening: 400 × 520 px, 24 px from the bottom right corner of the tool. */
export function defaultRect(b: Bounds): Rect {
  return fit(
    { ...DEFAULT_SIZE, x: b.right - DEFAULT_SIZE.w - CORNER_GAP, y: b.bottom - DEFAULT_SIZE.h - CORNER_GAP },
    b,
  );
}

/** Drag of the header: the window moves, always fully inside the bounds. */
export function moved(start: Rect, dx: number, dy: number, b: Bounds): Rect {
  return fit({ ...start, x: start.x + dx, y: start.y + dy }, b);
}

/** Drag of the bottom right corner: minimum 320 × 280 px, never beyond the bounds. */
export function resized(start: Rect, dx: number, dy: number, b: Bounds): Rect {
  // the top left corner stays where it is: growing stops at the edge instead of pushing the window
  const w = clamp(start.w + dx, MIN_SIZE.w, Math.max(MIN_SIZE.w, b.right - start.x - EDGE_GAP));
  const h = clamp(start.h + dy, MIN_SIZE.h, Math.max(MIN_SIZE.h, b.bottom - start.y - EDGE_GAP));
  return fit({ ...start, w, h }, b);
}
