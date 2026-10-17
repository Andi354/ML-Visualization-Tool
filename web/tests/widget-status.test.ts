import { afterEach, describe, expect, it } from "vitest";
import { clearStatus, problemSummary, reportFor, setStatus, statusOf, whenLoaded } from "../src/widgets/status";

const ids = ["a", "b"];
afterEach(() => ids.forEach(clearStatus));
const tile = (id: string, state: "loading" | "ok" | "error" | "unavailable" | "gone", reason?: string) => setStatus(id, { state, reason, type: "t-" + id, label: "L" + id });

describe("report", () => {
  it("reads the state each tile reported, and calls a tile that has not reported yet loading", () => {
    tile("a", "ok");
    const [a, b] = reportFor([{ id: "a", type: "t-a" }, { id: "b", type: "t-b" }], (t) => "Label " + t);
    expect(a).toMatchObject({ id: "a", state: "ok", label: "La" });
    expect(b).toMatchObject({ id: "b", state: "loading", type: "t-b", label: "Label t-b" });
  });
  it("forgets a tile that went away", () => {
    tile("a", "error", "kaputt");
    expect(statusOf("a")?.reason).toBe("kaputt");
    clearStatus("a");
    expect(statusOf("a")).toBeUndefined();
  });
});

describe("waiting for the widgets", () => {
  it("returns at once when nothing is loading", async () => {
    tile("a", "ok");
    tile("b", "error", "x");
    const t0 = Date.now();
    await whenLoaded(() => ids, 2000);
    expect(Date.now() - t0).toBeLessThan(200);
  });
  it("returns as soon as the last tile has reported", async () => {
    tile("a", "ok");
    tile("b", "loading");
    setTimeout(() => tile("b", "ok"), 40);
    const t0 = Date.now();
    await whenLoaded(() => ids, 2000);
    const took = Date.now() - t0;
    expect(took).toBeGreaterThanOrEqual(30);
    expect(took).toBeLessThan(500);
    expect(statusOf("b")?.state).toBe("ok");
  });
  it("gives up after the limit and leaves the slow ones loading", async () => {
    tile("a", "loading");
    const t0 = Date.now();
    await whenLoaded(() => ["a"], 80);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(70);
    expect(statusOf("a")?.state).toBe("loading");
  });
  it("counts a tile that is not there yet as loading, and waits for it with a grace time", async () => {
    setTimeout(() => tile("a", "ok"), 30);
    await whenLoaded(() => ["a"], 2000, 60);
    expect(statusOf("a")?.state).toBe("ok");
  });
});

describe("problemSummary", () => {
  const s = (...states: ("loading" | "ok" | "error" | "unavailable" | "gone")[]) => problemSummary(states.map((state) => ({ state })));
  it("is empty when all is well", () => {
    expect(s("ok", "ok")).toBe("");
    expect(s()).toBe("");
  });
  it("names errors, unavailable ones and those that still load", () => {
    expect(s("ok", "error")).toBe("1 Widget mit Fehler");
    expect(s("error", "error", "gone")).toBe("3 Widgets mit Fehler");
    expect(s("unavailable")).toBe("1 nicht verfügbar");
    expect(s("loading")).toBe("1 lädt noch");
    expect(s("loading", "loading")).toBe("2 laden noch");
    expect(s("error", "unavailable", "loading", "ok")).toBe("1 Widget mit Fehler · 1 nicht verfügbar · 1 lädt noch");
  });
});
