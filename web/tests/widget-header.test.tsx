import { act } from "preact/test-utils";
import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WidgetHeader } from "../src/api";
import { isNull, WidgetHead } from "../src/widgets/header";

const items = (n: number): [string, string | null][] => Array.from({ length: n }, (_, i) => [`axis_${i}`, i === 1 ? null : `v${i}`]);
const header = (n: number, style: "chips" | "list" = "chips"): WidgetHeader => ({
  what: [{ text: "test_mse_missing", mono: true }, { text: " je Region × " }, { text: "time_embedding", mono: true }],
  agg: "Replikate gemittelt",
  values: { label: "FEST", style, items: items(n) },
});

let root: HTMLElement;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  render(null, root);
  root.remove();
});

const show = (el: preact.VNode) => act(() => render(el, root));
const chips = () => [...root.querySelectorAll("[data-testid=widget-chip]")];

describe("widget header (v0.3.2, Q.I)", () => {
  it("what line: mono parts, then the aggregation note", () => {
    show(<WidgetHead header={header(2)} hints />);
    expect(root.querySelector("[data-testid=widget-what]")!.textContent).toBe("test_mse_missing je Region × time_embedding · ≡ Replikate gemittelt");
    expect([...root.querySelectorAll(".w-what-mono")].map((e) => e.textContent)).toEqual(["test_mse_missing", "time_embedding"]);
  });

  it("shows the first four fixed values as chips and a link for the rest; the link opens and closes them", () => {
    show(<WidgetHead header={header(9)} hints />);
    expect(chips()).toHaveLength(4);
    const more = root.querySelector("[data-testid=widget-more]") as HTMLButtonElement;
    expect(more.textContent).toBe("+5 weitere");
    act(() => more.click());
    expect(chips()).toHaveLength(9);
    expect(more.textContent).toBe("weniger");
    act(() => more.click());
    expect(chips()).toHaveLength(4);
  });

  it("no link when the values fit; the chip tooltip is name = value", () => {
    show(<WidgetHead header={header(3)} hints />);
    expect(root.querySelector("[data-testid=widget-more]")).toBeNull();
    expect(chips()[0].getAttribute("title")).toBe("axis_0 = v0");
  });

  it("None shows as null in grey italics, in chips and in the list", () => {
    show(<WidgetHead header={header(3)} hints />);
    expect(chips()[1].querySelector(".null-value")!.textContent).toBe("null");
    show(<WidgetHead header={header(3, "list")} hints />);
    expect(root.querySelectorAll(".w-list-row")).toHaveLength(3);
    expect(root.querySelectorAll(".w-list-row .null-value")).toHaveLength(1);
    expect(isNull("None")).toBe(true);
    expect(isNull("none")).toBe(false);
  });

  it("the export shows every value and no link", () => {
    show(<WidgetHead header={header(9)} hints exporting />);
    expect(chips()).toHaveLength(9);
    expect(root.querySelector("[data-testid=widget-more]")).toBeNull();
  });

  it("hints off leaves the what line and the chips out; the list is content and stays", () => {
    show(<WidgetHead header={header(5)} hints={false} />);
    expect(root.querySelector("[data-testid=widget-what]")).toBeNull();
    expect(chips()).toHaveLength(0);
    show(<WidgetHead header={header(5, "list")} hints={false} />);
    expect(root.querySelectorAll(".w-list-row")).toHaveLength(5);
  });

  it("a plain subtitle is the what line; a widget without fixed axes has no values line", () => {
    show(<WidgetHead header={null} subtitle="Mittel über Seeds" hints />);
    expect(root.querySelector("[data-testid=widget-what]")!.textContent).toBe("Mittel über Seeds");
    expect(root.querySelector("[data-testid=widget-values]")).toBeNull();
  });
});
