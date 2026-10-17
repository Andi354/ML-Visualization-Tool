import { describe, expect, it } from "vitest";
import { MAX_BYTES, MAX_IMAGES, attachmentUrl, checkImages, imagesOf } from "../src/agent/attachments";

const img = (name = "a.png", type = "image/png", size = 1000) => ({ name, type, size });

describe("which images may be added", () => {
  it("takes pictures of the four kinds", () => {
    const r = checkImages(0, ["image/png", "image/jpeg", "image/gif", "image/webp"].map((t, i) => img(`f${i}`, t)));
    expect(r).toEqual({ accept: [0, 1, 2, 3], problems: [] });
  });
  it("names a file that is no image", () => {
    const r = checkImages(0, [img("notiz.txt", "text/plain"), img("b.png")]);
    expect(r.accept).toEqual([1]);
    expect(r.problems).toEqual(["notiz.txt: kein Bild (PNG, JPEG, WebP oder GIF)"]);
  });
  it("refuses an image over the size limit and says so in megabytes", () => {
    const r = checkImages(0, [img("gross.png", "image/png", MAX_BYTES + 1), img("ok.png", "image/png", MAX_BYTES)]);
    expect(r.accept).toEqual([1]);
    expect(r.problems).toEqual(["gross.png: größer als 5 MB"]);
  });
  it("counts the images that wait already against the limit of four", () => {
    expect(MAX_IMAGES).toBe(4);
    const r = checkImages(3, [img("a.png"), img("b.png")]);
    expect(r.accept).toEqual([0]);
    expect(r.problems).toEqual(["b.png: höchstens 4 Bilder je Nachricht"]);
    expect(checkImages(4, [img()]).accept).toEqual([]);
  });
  it("copes with a pasted image that has no name", () => {
    expect(checkImages(0, [{ name: "", type: "text/plain", size: 1 }]).problems[0]).toMatch(/^Datei: /);
  });
});

describe("what was pasted or dropped", () => {
  const file = (name: string, type: string) => new File(["x"], name, { type });
  it("keeps the images and leaves the rest", () => {
    const got = imagesOf([file("a.png", "image/png"), file("t.txt", "text/plain"), file("b.JPG", "")]);
    expect(got.map((f) => f.name)).toEqual(["a.png", "b.JPG"]);
  });
  it("copes with nothing", () => {
    expect(imagesOf(null)).toEqual([]);
    expect(imagesOf(undefined)).toEqual([]);
  });
});

it("builds the address of a kept image", () => {
  expect(attachmentUrl("0123456789abcdef.png")).toBe("/api/agent/attachments/0123456789abcdef.png");
});
