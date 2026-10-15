import { describe, expect, it } from "vitest";
import { combine, defaultName, detach, groupTitle, patchImage, reorder, reselect, setLayout, single, singles, split, sync, type Image } from "../src/analysis/images";

const ids = (imgs: Image[]) => imgs.map((i) => i.id);
const members = (imgs: Image[]) => imgs.map((i) => i.members);
const base = singles(["a", "b", "c", "d", "e"]);

describe("images in the save dialog", () => {
  it("one widget = one image by default, hints and footer on", () => {
    expect(ids(base)).toEqual(["a", "b", "c", "d", "e"]);
    expect(base[0]).toMatchObject({ members: ["a"], layout: "stack", hints: true, footer: true, title: null });
  });

  it("combine merges the selected images in list order into one group placed where the first one was", () => {
    const { images, id } = combine(base, ["d", "b"], "g1");
    expect(id).toBe("g1");
    expect(ids(images)).toEqual(["a", "g1", "c", "e"]);
    expect(images[1].members).toEqual(["b", "d"]); // list order, not selection order
    expect(images[1]).toMatchObject({ layout: "stack", hints: false, footer: true, title: null, nameEdited: false });
  });

  it("combine needs two images", () => {
    expect(combine(base, ["a"]).images).toBe(base);
    expect(combine(base, []).images).toBe(base);
  });

  it("groups can be combined with singles and with each other", () => {
    const g = combine(base, ["a", "b"], "g1").images; // [g1(a,b), c, d, e]
    const h = combine(g, ["g1", "d"], "g2");
    expect(members(h.images)).toEqual([["a", "b", "d"], ["c"], ["e"]]);
  });

  it("Trennen turns every member into a single image at the group's place", () => {
    const g = combine(base, ["b", "c", "d"], "g1").images;
    const s = split(g, "g1");
    expect(ids(s)).toEqual(["a", "b", "c", "d", "e"]);
    expect(s[1].hints).toBe(true); // singles show hints again
    expect(split(base, "a")).toEqual(base); // a single image has nothing to separate
  });

  it("lösen puts the member right after the group", () => {
    const g = combine(base, ["a", "b", "c"], "g1").images; // g1(a,b,c), d, e
    const d = detach(g, "g1", "a");
    expect(members(d)).toEqual([["b", "c"], ["a"], ["d"], ["e"]]);
    expect(d[1]).toMatchObject({ id: "a", hints: true });
  });

  it("a group left with one member is a single image again", () => {
    const g = combine(base, ["a", "b"], "g1").images;
    const d = detach(g, "g1", "b");
    expect(members(d)).toEqual([["a"], ["b"], ["c"], ["d"], ["e"]]);
    expect(ids(d)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("members move up and down inside the group, not beyond its ends", () => {
    const g = combine(base, ["a", "b", "c"], "g1").images;
    expect(reorder(g, "g1", "c", -1)[0].members).toEqual(["a", "c", "b"]);
    expect(reorder(g, "g1", "a", 1)[0].members).toEqual(["b", "a", "c"]);
    expect(reorder(g, "g1", "a", -1)[0].members).toEqual(["a", "b", "c"]);
    expect(reorder(g, "g1", "c", 1)[0].members).toEqual(["a", "b", "c"]);
  });

  it("layout, title and other fields are set per image", () => {
    const g = combine(base, ["a", "b"], "g1").images;
    expect(setLayout(g, "g1", "side")[0].layout).toBe("side");
    expect(patchImage(g, "g1", { title: "Mein Titel", hints: true })[0]).toMatchObject({ title: "Mein Titel", hints: true });
    expect(g[0].layout).toBe("stack"); // immutable
  });

  it("file names: NN_type, groups NN_type+type", () => {
    expect(defaultName(0, ["compare-table"])).toBe("01_compare-table.png");
    expect(defaultName(11, ["a", "b"])).toBe("12_a+b.png");
  });

  it("default group title from the widget names", () => {
    expect(groupTitle(["A"])).toBe("A");
    expect(groupTitle(["A", "B"])).toBe("A und B");
    expect(groupTitle(["A", "B", "C"])).toBe("A, B und C");
  });

  it("selection follows splitting and detaching: an image is selected when all its widgets were", () => {
    const g = combine(base, ["a", "b", "c"], "g1").images;
    expect(reselect(g, ["g1", "d"], split(g, "g1"))).toEqual(["a", "b", "c", "d"]);
    expect(reselect(g, ["d"], split(g, "g1"))).toEqual(["d"]);
    expect(reselect(g, ["g1"], detach(g, "g1", "a"))).toEqual(["g1", "a"]);
    const two = combine(base, ["a", "b"], "g2").images;
    expect(reselect(two, ["g2"], detach(two, "g2", "b"))).toEqual(["a", "b"]); // a is a single again, b detached
  });

  it("images follow the board: removed widgets leave, new ones come as singles", () => {
    const g = combine(base, ["a", "b", "c"], "g1").images;
    expect(members(sync(g, ["a", "b", "c", "d", "e"]))).toEqual([["a", "b", "c"], ["d"], ["e"]]);
    expect(members(sync(g, ["a", "c", "d", "x"]))).toEqual([["a", "c"], ["d"], ["x"]]);
    expect(members(sync(g, ["b", "d"]))).toEqual([["b"], ["d"]]);
    expect(sync(g, ["b", "d"])[0]).toEqual(single("b"));
  });
});
