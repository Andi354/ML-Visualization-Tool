import { afterEach, describe, expect, it, vi } from "vitest";
import { collectView, provide, provideView, rememberUndo, setFrame, undoFor, waitForHandler } from "../src/agent/bus";
import { carryOut, runTool } from "../src/agent/commands";
import { frameReducer, initialFrame } from "../src/state/frame";

describe("frame actions of the agent", () => {
  it("show-analysis-view opens the analysis in a view and asks the analysis for it each time", () => {
    const a = frameReducer(initialFrame, { type: "show-analysis-view", view: "project" });
    expect(a).toMatchObject({ area: "analysis", active: null, analysisView: { view: "project", n: 1 } });
    expect(frameReducer(a, { type: "show-analysis-view", view: "project" }).analysisView?.n).toBe(2);
  });
  it("two runs fill the comparison, one run the single analysis", () => {
    expect(frameReducer(initialFrame, { type: "show-analysis-view", view: "two", runs: ["a", "b", "c"] }).compare).toEqual(["a", "b"]);
    expect(frameReducer(initialFrame, { type: "show-analysis-view", view: "run", runs: ["a"] }).analysis).toEqual({ run: "a", combo: {} });
  });
  it("restore goes back to an earlier state", () => {
    const before = frameReducer(initialFrame, { type: "open-run", run: "r1" });
    const after = frameReducer(before, { type: "close-run", run: "r1" });
    expect(frameReducer(after, { type: "restore", state: before })).toEqual(before);
  });
});

describe("the bus", () => {
  afterEach(() => setFrame(null));
  it("a handler is provided until it is withdrawn, and a newer one of the same name wins", async () => {
    const off1 = provide("t", () => ({ summary: "eins" }));
    const off2 = provide("t", () => ({ summary: "zwei" }));
    expect((await runTool("t", {})).summary).toBe("zwei");
    off1(); // the old one must not remove the new one
    expect((await runTool("t", {})).summary).toBe("zwei");
    off2();
    await expect(runTool("t", {})).rejects.toThrow("gibt es in dieser Ansicht nicht");
  });
  it("waits for a view that is just opening", async () => {
    setTimeout(() => provide("later", () => ({})), 100);
    expect(await waitForHandler("later", 2000)).toBeTypeOf("function");
    await expect(waitForHandler("never", 120)).rejects.toThrow("nicht bereit");
  });
  it("get_view merges the parts the views provide", async () => {
    const a = provideView("x", () => ({ n: 1 }));
    const b = provideView("y", () => ({ m: 2 }));
    expect((await runTool("get_view", {})).data).toEqual({ x: { n: 1 }, y: { m: 2 } });
    a();
    b();
    expect(collectView()).toEqual({});
  });
  it("board tools show the analysis first", async () => {
    const shown = vi.fn(async () => {});
    setFrame({ showAnalysis: shown });
    const off = provide("add_widget", () => ({ summary: "ok" }));
    await runTool("add_widget", {});
    expect(shown).toHaveBeenCalledOnce();
    off();
  });
  it("a command reports its result and remembers how to undo", async () => {
    const posted: { url: string; body: any }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      posted.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}");
    });
    const off = provide("open_run", () => ({ summary: "Tab geöffnet", undo: () => "Tab geschlossen" }));
    await carryOut({ id: "c1", tool: "open_run", args: {} });
    expect(posted[0]).toEqual({ url: "/api/agent/commands/c1/result", body: { ok: true, summary: "Tab geöffnet", undoable: true } });
    expect(await undoFor("c1")?.undo()).toBe("Tab geschlossen");
    off();
    await carryOut({ id: "c2", tool: "open_run", args: {} }); // nobody provides it any more
    expect(posted[1].body).toMatchObject({ ok: false });
    expect(posted[1].body.error).toContain("open_run");
    expect(undoFor("c2")).toBeUndefined();
    rememberUndo("c3", { undo: () => "" });
    expect(undoFor("c3")).toBeDefined();
    vi.unstubAllGlobals();
  });
});
