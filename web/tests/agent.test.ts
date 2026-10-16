import { describe, expect, it } from "vitest";
import { CORNER_GAP, DEFAULT_SIZE, defaultRect, EDGE_GAP, fit, MIN_SIZE, moved, resized, type Bounds } from "../src/agent/geometry";
import {
  cacheState,
  capsuleText,
  chatMeta,
  contextLabel,
  contextUse,
  modeOf,
  nextMode,
  whenText,
  type Chat,
} from "../src/agent/model";
import { initialAgent, loadAgent, saveAgent, toggleFromIcon } from "../src/agent/state";

// The tool: 1440 × 860, icon bar 52 px, tab strip 36 px.
const B: Bounds = { left: 52, top: 36, right: 1440, bottom: 860 };

describe("window geometry", () => {
  it("opens the first time at 400 × 520, 24 px from the bottom right corner", () => {
    expect(defaultRect(B)).toEqual({ x: 1440 - 400 - CORNER_GAP, y: 860 - 520 - CORNER_GAP, ...DEFAULT_SIZE });
  });
  it("moves with the pointer and never leaves the area right of the icon bar and below the tab strip", () => {
    const r = defaultRect(B);
    expect(moved(r, -100, -50, B)).toMatchObject({ x: r.x - 100, y: r.y - 50 });
    expect(moved(r, -5000, -5000, B)).toMatchObject({ x: B.left + EDGE_GAP, y: B.top + EDGE_GAP });
    expect(moved(r, 5000, 5000, B)).toMatchObject({ x: B.right - r.w - EDGE_GAP, y: B.bottom - r.h - EDGE_GAP });
  });
  it("resizes from the bottom right corner, at least 320 × 280 and not beyond the tool", () => {
    const r = { x: 600, y: 200, w: 400, h: 400 };
    expect(resized(r, 50, 30, B)).toMatchObject({ x: 600, y: 200, w: 450, h: 430 });
    expect(resized(r, -500, -500, B)).toMatchObject({ w: MIN_SIZE.w, h: MIN_SIZE.h });
    expect(resized(r, 5000, 5000, B)).toMatchObject({ w: B.right - 600 - EDGE_GAP, h: B.bottom - 200 - EDGE_GAP });
  });
  it("is pushed and shrunk when the tool gets smaller", () => {
    const small: Bounds = { left: 52, top: 36, right: 700, bottom: 500 };
    const r = fit({ x: 1000, y: 700, w: 400, h: 520 }, small);
    expect(r.x + r.w).toBeLessThanOrEqual(small.right - EDGE_GAP);
    expect(r.y + r.h).toBeLessThanOrEqual(small.bottom - EDGE_GAP);
    expect(r.x).toBeGreaterThanOrEqual(small.left + EDGE_GAP);
    expect(r.y).toBeGreaterThanOrEqual(small.top + EDGE_GAP);
    expect(r.h).toBe(500 - 36 - 2 * EDGE_GAP);
  });
  it("lets the minimum size give way when the tool is smaller than it", () => {
    const tiny: Bounds = { left: 52, top: 36, right: 300, bottom: 250 };
    const r = fit({ x: 0, y: 0, w: 400, h: 520 }, tiny);
    expect(r.w).toBe(300 - 52 - 2 * EDGE_GAP);
    expect(r.h).toBe(250 - 36 - 2 * EDGE_GAP);
  });
});

describe("modes", () => {
  it("Shift+Tab cycles Direkt → Gemischt → Bestätigen → Direkt", () => {
    expect(nextMode("direct")).toBe("mixed");
    expect(nextMode("mixed")).toBe("confirm");
    expect(nextMode("confirm")).toBe("direct");
  });
  it("describes each mode in one sentence", () => {
    expect(modeOf("mixed").label).toBe("Gemischt");
    expect(modeOf("confirm").hint).toBe("fragt vor jeder Aktion");
  });
});

describe("context chip", () => {
  it("names what the agent sees", () => {
    expect(contextLabel({ area: "runs", active: null, runsView: "list" })).toBe("Läufe · Liste");
    expect(contextLabel({ area: "runs", active: null, runsView: "issues" })).toBe("Läufe · Issues");
    expect(contextLabel({ area: "analysis", active: null, runsView: "list" })).toBe("Analyse");
    expect(contextLabel({ area: "runs", active: "2026-10-06_1000_TIM-52_best_30", runsView: "list" })).toBe("Lauf · TIM-52_best_30");
    expect(contextLabel({ area: "runs", active: "2026-09-28_195436_x", runsView: "list" })).toBe("Lauf · x");
  });
});

describe("context and cache display", () => {
  it("colours the context bar green below 70 %, amber to 90 %, red above", () => {
    expect(contextUse(38_000)).toMatchObject({ pct: 19, level: "best", tip: "Kontext: 38k von 200k Tokens" });
    expect(contextUse(150_000).level).toBe("warn");
    expect(contextUse(190_000)).toMatchObject({ pct: 95, level: "error" });
    expect(contextUse(0).pct).toBe(0);
  });
  const chat = (over = {}) => ({ tokens: 40_000, last_turn_at: "2026-10-15T11:00:00", cache_ttl_s: 3600, ...over });
  const at = (iso: string) => Date.parse(iso);
  it("an empty chat is new", () => {
    expect(cacheState(chat({ tokens: 0, last_turn_at: null }), at("2026-10-15T12:00:00"))).toMatchObject({ kind: "new", label: "neu" });
  });
  it("is warm for the lifetime of the cache after the last turn, with the minutes left", () => {
    expect(cacheState(chat(), at("2026-10-15T11:23:00"))).toMatchObject({ kind: "warm", minutes: 37, label: "Cache warm · 37 min" });
  });
  it("is cold after the lifetime, with the tokens a message would read again", () => {
    expect(cacheState(chat(), at("2026-10-15T12:00:01"))).toMatchObject({ kind: "cold", label: "Cache abgelaufen" });
    expect(cacheState(chat(), at("2026-10-15T12:30:00")).tip).toContain("~40k Tokens");
  });
  it("uses the lifetime of the chat (5 minutes with an API key)", () => {
    expect(cacheState(chat({ cache_ttl_s: 300 }), at("2026-10-15T11:06:00")).kind).toBe("cold");
  });
  it("a chat without a time of the last turn is cold", () => {
    expect(cacheState(chat({ last_turn_at: null }), at("2026-10-15T12:00:00")).kind).toBe("cold");
  });
});

describe("chat list", () => {
  const NOW = "2026-10-15T12:00:00";
  it("says heute, gestern or the date", () => {
    expect(whenText("2026-10-15T08:00:00", NOW)).toBe("heute");
    expect(whenText("2026-10-14T23:59:00", NOW)).toBe("gestern");
    expect(whenText("2026-10-09T10:00:00", NOW)).toBe("09.10.");
    expect(whenText("junk", NOW)).toBe("");
  });
  it("shows time, size and cache state of a chat, or that it is empty", () => {
    const base = { id: "a", title: "t", updated_at: "2026-10-15T09:00:00", session_id: null, cache_ttl_s: 3600 };
    const nowMs = Date.parse("2026-10-15T09:30:00");
    expect(chatMeta({ ...base, tokens: 0, last_turn_at: null }, NOW, nowMs)).toBe("heute · leer");
    expect(chatMeta({ ...base, tokens: 38_000, last_turn_at: "2026-10-15T09:00:00" }, NOW, nowMs)).toBe("heute · 38k · warm");
    expect(chatMeta({ ...base, tokens: 84_000, last_turn_at: "2026-10-09T09:00:00", updated_at: "2026-10-09T09:00:00" }, NOW, nowMs)).toBe("09.10. · 84k · kalt");
  });
});

describe("capsule", () => {
  const chat = (messages: Chat["messages"]) => ({ messages }) as Chat;
  it("shows ready, the last action or that the agent works", () => {
    expect(capsuleText(null, false)).toBe("Agent · bereit");
    expect(capsuleText(chat([{ k: "user", t: "hi" }]), false)).toBe("Agent · bereit");
    expect(capsuleText(chat([{ k: "action", t: "Tab geöffnet · A" }, { k: "agent", t: "ok" }, { k: "action", t: "Filter gesetzt" }]), false)).toBe("Agent · Filter gesetzt");
    expect(capsuleText(chat([]), true)).toBe("Agent · arbeitet …");
  });
});

describe("window state in the browser", () => {
  it("starts closed, with no position yet", () => {
    expect(initialAgent).toEqual({ mode: "closed", rect: null, chat: null });
  });
  it("the icon opens a closed or minimised window and minimises an open one", () => {
    expect(toggleFromIcon("closed")).toBe("open");
    expect(toggleFromIcon("min")).toBe("open");
    expect(toggleFromIcon("open")).toBe("min");
  });
  it("stores and reads mode, position, size and chat per project; junk falls back", () => {
    const s = { mode: "min" as const, rect: { x: 10, y: 20, w: 330, h: 300 }, chat: "0123456789ab" };
    saveAgent("p1", s);
    expect(loadAgent("p1")).toEqual(s);
    expect(loadAgent("p2")).toEqual(initialAgent);
    localStorage.setItem("mlviz:v1:p3:agent", JSON.stringify({ mode: "weird", rect: { x: "a" }, chat: 5 }));
    expect(loadAgent("p3")).toEqual({ mode: "closed", rect: null, chat: null });
    localStorage.setItem("mlviz:v1:p4:agent", "{not json");
    expect(loadAgent("p4")).toEqual(initialAgent);
  });
});
