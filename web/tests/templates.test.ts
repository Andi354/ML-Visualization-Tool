import { describe, expect, it } from "vitest";
import type { Board } from "../src/widgets/board";
import { isDirty, lastUsed, signature, standardWidgets, templateScope, toTemplateWidgets, widgetsFromTemplate, type StoredTemplate } from "../src/widgets/templates";

const w = (type: string, settings: Record<string, string | null> = {}, width: "half" | "full" = "half") => ({ type, settings, width });
const board = (widgets: ReturnType<typeof w>[]): Board => ({ scope: "run", widgets: widgets.map((x, i) => ({ id: `id${i}`, ...x })) });

describe("templates", () => {
  it("maps board scopes to template scopes", () => {
    expect(["run", "two-runs", "project"].map(templateScope)).toEqual(["one", "two", "project"]);
  });
  it("Standard is the non-optional catalog with default widths", () => {
    const cat = [{ key: "a", optional: false, width: "full" as const }, { key: "b", optional: true, width: "half" as const }, { key: "c", optional: false, width: "half" as const }];
    expect(standardWidgets(cat)).toEqual([w("a", {}, "full"), w("c")]);
  });
  it("a board turns into template widgets and back with new ids", () => {
    const b = board([w("a", { k: "v" }, "full"), w("gone")]);
    const t = toTemplateWidgets(b.widgets);
    expect(t).toEqual([w("a", { k: "v" }, "full"), w("gone")]);
    const back = widgetsFromTemplate(t, ["a"]);
    expect(back.map((x) => x.type)).toEqual(["a"]);
    expect(back[0].id).not.toBe("id0");
    expect(back[0].settings).toEqual({ k: "v" });
  });
  it("keeps own widgets even though they are not in the catalog", () => {
    expect(widgetsFromTemplate([w("own:x")], ["a"]).map((x) => x.type)).toEqual(["own:x"]);
  });
  it("dirty reacts to order, width and settings but not to empty settings or ids", () => {
    const t = [w("a"), w("b", { k: "v" })];
    expect(isDirty(board([w("a"), w("b", { k: "v", z: null })]), t)).toBe(false);
    expect(isDirty(board([w("b", { k: "v" }), w("a")]), t)).toBe(true);
    expect(isDirty(board([w("a", {}, "full"), w("b", { k: "v" })]), t)).toBe(true);
    expect(isDirty(board([w("a"), w("b", { k: "x" })]), t)).toBe(true);
    expect(signature([w("a")])).toBe(signature([w("a", { q: "" })]));
  });
  it("last used picks the newest use, none when never used", () => {
    const t = (name: string, at: string | null): StoredTemplate => ({ name, scope: "one", widgets: [], last_used: at ? { runs: ["r"], at } : null });
    expect(lastUsed([t("a", null)])).toBeNull();
    expect(lastUsed([t("a", "2026-01-01T00:00"), t("b", "2026-02-01T00:00"), t("c", null)])?.name).toBe("b");
  });
});
