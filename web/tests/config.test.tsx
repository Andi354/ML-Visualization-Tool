import { act } from "preact/test-utils";
import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigInfo } from "../src/api";
import { ConfigBlocks, ConfigView, ConfigYaml, Legend, loadMode } from "../src/config/ConfigView";

const data: ConfigInfo = {
  base_known: true,
  grid: {
    axes: [
      {
        key: "lr_epochs",
        paired: true,
        members: ["learning_rate", "max_epochs"],
        values: [
          { label: "learning_rate=0.0005, max_epochs=20", display: "5e-4 · 20" },
          { label: "learning_rate=0.001, max_epochs=20", display: "1e-3 · 20" },
        ],
        current: "learning_rate=0.001, max_epochs=20",
      },
      {
        key: "forecaster",
        paired: false,
        members: [],
        values: [
          { label: "rep-net", display: "rep-net" },
          { label: "ets", display: "ets" },
        ],
        current: "ets",
      },
    ],
    replicates: [{ key: "shuffle_seed", values: ["1", "2"] }],
  },
  blocks: [
    {
      name: "data",
      differs: 0,
      entries: [{ key: "pred_len", value: "30", swept: false, values: [], base: null, differs: false }],
    },
    {
      name: "model",
      differs: 1,
      entries: [
        { key: "forecaster", value: "ets", swept: true, values: ["rep-net", "ets"], base: "rep-net", differs: true },
        { key: "encoding_size", value: "64", swept: false, values: [], base: null, differs: false },
      ],
    },
  ],
  lines: [
    { n: 1, indent: 0, text: "data:", block: "data", kind: "block" },
    { n: 2, indent: 1, text: "pred_len: 30", block: "data", kind: "entry", swept: false, replicate: false, differs: false, note: null, base: null },
    { n: 3, indent: 0, text: "model:", block: "model", kind: "block" },
    { n: 4, indent: 1, text: "forecaster: ets", block: "model", kind: "entry", swept: true, replicate: false, differs: true, note: "weitere: rep-net", base: "rep-net" },
    { n: 5, indent: 0, text: "replicates:", block: "replicates", kind: "block" },
    { n: 6, indent: 1, text: "shuffle_seed: [1, 2]", block: "replicates", kind: "entry", swept: false, replicate: true, differs: false, note: null, base: null },
  ],
  yaml: "data:\n  pred_len: 30\n",
};

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  localStorage.clear();
});
afterEach(() => {
  render(null, host);
  host.remove();
  vi.unstubAllGlobals();
});
const mount = (vnode: preact.VNode) => act(() => render(vnode, host));
const q = (sel: string) => host.querySelector(sel) as HTMLElement;
const qa = (sel: string) => [...host.querySelectorAll(sel)] as HTMLElement[];
const click = (el: Element) => act(() => (el as HTMLElement).click());

describe("legend", () => {
  it("names the three marks; the base entry only when a base is known", () => {
    mount(<Legend baseKnown />);
    expect(host.textContent).toContain("im Grid variiert");
    expect(host.textContent).toContain("weicht von base.yaml ab");
    expect(host.textContent).toContain("Wiederholungen");
    mount(<Legend baseKnown={false} />);
    expect(host.textContent).not.toContain("base.yaml");
  });
});

describe("view Blöcke", () => {
  it("grid box: one row per axis with all values, the combination's value highlighted", () => {
    mount(<ConfigBlocks data={data} embedded={false} />);
    expect(q('[data-testid="cfg-grid"]').textContent).toContain("Im Grid variiert · 2 Achsen");
    const rows = qa('[data-testid="cfg-axis"]');
    expect(rows.map((r) => r.dataset.axis)).toEqual(["lr_epochs", "forecaster"]);
    const chips = qa('[data-axis="lr_epochs"] [data-testid="cfg-chip"]');
    expect(chips.map((c) => c.textContent)).toEqual(["5e-4 · 20", "1e-3 · 20"]); // paired axis as one row
    expect(chips.map((c) => c.classList.contains("current"))).toEqual([false, true]);
    expect(qa('[data-axis="forecaster"] .current').map((c) => c.textContent)).toEqual(["ets"]);
  });

  it("replicate keys with their value lists below a dashed rule", () => {
    mount(<ConfigBlocks data={data} embedded={false} />);
    const rep = q('[data-testid="cfg-reps"] [data-rep="shuffle_seed"]');
    expect(rep.textContent).toContain("1");
    expect(rep.querySelectorAll(".dashed")).toHaveLength(2);
  });

  it("one box per block with entry count and the number of differences from base", () => {
    mount(<ConfigBlocks data={data} embedded={false} />);
    const blocks = qa('[data-testid="cfg-block"]');
    expect(blocks.map((b) => b.dataset.block)).toEqual(["data", "model"]);
    expect(blocks[1].textContent).toContain("2 Einträge");
    expect(blocks[1].querySelector('[data-testid="cfg-differs"]')!.textContent).toBe("1 abweichend von base");
    expect(blocks[0].querySelector('[data-testid="cfg-differs"]')!.textContent).toBe("0 abweichend von base");
  });

  it("swept values are accent bold, differences amber with the base value as hint", () => {
    mount(<ConfigBlocks data={data} embedded={false} />);
    const f = q('[data-testid="cfg-entry"][data-key="forecaster"]');
    expect(f.classList.contains("swept")).toBe(true);
    expect(f.classList.contains("differs")).toBe(true);
    expect(f.title).toBe("base: rep-net");
    expect(f.querySelector(".cfg-dot")).not.toBeNull();
    const plain = q('[data-testid="cfg-entry"][data-key="encoding_size"]');
    expect(plain.className).toBe("cfg-value");
  });

  it("blocks are collapsible; open by default, but folded in the detail panel", () => {
    mount(<ConfigBlocks data={data} embedded={false} />);
    expect(qa('[data-testid="cfg-entry"]')).toHaveLength(3);
    click(qa(".cfg-block-head")[0]);
    expect(qa('[data-testid="cfg-entry"]')).toHaveLength(2);
    mount(<ConfigBlocks data={data} embedded />);
    expect(qa('[data-testid="cfg-entry"]')).toHaveLength(0);
    expect(q('[data-testid="cfg-grid"]')).not.toBeNull(); // the grid box stays visible
    click(qa(".cfg-block-head")[1]);
    expect(qa('[data-testid="cfg-entry"]').map((e) => e.dataset.key)).toEqual(["forecaster", "encoding_size"]);
  });

  it("without a base the block heads have no difference count", () => {
    mount(<ConfigBlocks data={{ ...data, base_known: false }} embedded={false} />);
    expect(qa('[data-testid="cfg-differs"]')).toHaveLength(0);
  });
});

describe("view YAML", () => {
  it("chips 'Im Grid' with the combination's values", () => {
    mount(<ConfigYaml data={data} />);
    expect(qa('[data-testid="cfg-grid-chips"] .cfg-chip').map((c) => c.textContent)).toEqual([
      "lr_epochs = 1e-3 · 20",
      "forecaster = ets",
    ]);
  });

  it("numbered lines; swept lines tinted with the other grid values as note; base difference amber", () => {
    mount(<ConfigYaml data={data} />);
    expect(qa('[data-testid="yaml-line"] .cfg-ln').map((e) => e.textContent)).toEqual(["1", "2", "3", "4", "5", "6"]);
    const swept = q('[data-n="4"]');
    expect(swept.classList.contains("swept")).toBe(true);
    expect(swept.classList.contains("differs")).toBe(true);
    expect(swept.textContent).toContain("weitere: rep-net");
    expect(swept.textContent).toContain("base: rep-net");
    expect(q('[data-n="6"]').classList.contains("replicate")).toBe(true);
  });

  it("top-level blocks fold; 'Alles zuklappen' and 'aufklappen'", () => {
    mount(<ConfigYaml data={data} />);
    click(qa(".cfg-fold")[0]);
    expect(qa('[data-testid="yaml-line"]').map((l) => l.dataset.n)).toEqual(["1", "3", "4", "5", "6"]);
    click(q('[data-testid="fold-all"]'));
    expect(qa('[data-testid="yaml-line"]').map((l) => l.dataset.n)).toEqual(["1", "3", "5"]);
    click(q('[data-testid="unfold-all"]'));
    expect(qa('[data-testid="yaml-line"]')).toHaveLength(6);
  });

  it("'YAML kopieren' copies the whole config text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mount(<ConfigYaml data={data} />);
    click(q('[data-testid="copy-yaml"]'));
    expect(writeText).toHaveBeenCalledWith("data:\n  pred_len: 30\n");
    expect(q('[data-testid="copy-yaml"]').textContent).toBe("kopiert");
  });

  it("no grid chips without a combination", () => {
    const noCombo = { ...data, grid: { ...data.grid, axes: data.grid.axes.map((a) => ({ ...a, current: null })) } };
    mount(<ConfigYaml data={noCombo} />);
    expect(q('[data-testid="cfg-grid-chips"]')).toBeNull();
  });
});

describe("ConfigView", () => {
  const fetchOk = () => vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(data) });
  const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

  it("loads the config of the combination and switches between Blöcke and YAML; the choice is remembered", async () => {
    const f = fetchOk();
    vi.stubGlobal("fetch", f);
    mount(<ConfigView runId="r1" projectName="P" combo={{ forecaster: "ets" }} />);
    await settle();
    expect(f.mock.calls[0][0]).toBe("/api/runs/r1/config?combo=" + encodeURIComponent('{"forecaster":"ets"}'));
    expect(q('[data-testid="cfg-blocks"]')).not.toBeNull();
    click(q('[data-testid="cfg-mode-yaml"]'));
    expect(q('[data-testid="cfg-yaml"]')).not.toBeNull();
    expect(loadMode("P")).toBe("yaml");
    expect(loadMode("Q")).toBe("blocks");
    render(null, host);
    mount(<ConfigView runId="r1" projectName="P" />);
    await settle();
    expect(q('[data-testid="cfg-yaml"]')).not.toBeNull(); // remembered per project
  });

  it("the switch can be left to the tile settings", async () => {
    vi.stubGlobal("fetch", fetchOk());
    mount(<ConfigView runId="r1" projectName="P" showSwitch={false} mode="yaml" />);
    await settle();
    expect(q('[data-testid="cfg-mode-yaml"]')).toBeNull();
    expect(q('[data-testid="cfg-yaml"]')).not.toBeNull();
  });

  it("says so when the config cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    mount(<ConfigView runId="r1" projectName="P" />);
    await settle();
    expect(host.textContent).toContain("Die Config konnte nicht geladen werden.");
  });
});
