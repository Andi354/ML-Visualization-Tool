import { describe, expect, it } from "vitest";
import type { Note } from "../src/notes/api";
import { anchorLabel, countBy, groupKey, orderNotes } from "../src/notes/model";

const note = (id: string, kind: Note["anchor"]["kind"], key = "", created = "2026-10-15T10:00:00"): Note => ({ id, text: id, created, updated: created, anchor: { kind, key }, by: "user" });

describe("group key", () => {
  it("sorts the axes so the key does not depend on the order of the columns", () => {
    expect(groupKey({ lstm_layer: "2", lr_epochs: "40" })).toBe("lr_epochs=40 · lstm_layer=2");
    expect(groupKey({})).toBe("");
  });
});

describe("labels", () => {
  it("tells where a note hangs", () => {
    expect(anchorLabel({ kind: "run", key: "" })).toBe("am Lauf");
    expect(anchorLabel({ kind: "section", key: "expectation" })).toBe("an der Beschreibung · Erwartung");
    expect(anchorLabel({ kind: "group", key: "lr_epochs=40 · lstm_layer=2" })).toBe("an lr_epochs 40 · lstm_layer 2");
  });
});

describe("order", () => {
  it("puts the run first, then the sections in the order of the description, then groups in table order, unknown groups last", () => {
    const list = [
      note("g-unknown", "group", "x=9"),
      note("g2", "group", "x=2"),
      note("s-notes", "section", "notes"),
      note("run-late", "run", "", "2026-10-15T11:00:00"),
      note("s-purpose", "section", "purpose"),
      note("g1", "group", "x=1"),
      note("run-early", "run"),
    ];
    expect(orderNotes(list, ["x=1", "x=2"]).map((n) => n.id)).toEqual(["run-early", "run-late", "s-purpose", "s-notes", "g1", "g2", "g-unknown"]);
  });
  it("counts by an anchor", () => {
    const list = [note("a", "section", "purpose"), note("b", "section", "purpose"), note("c", "run")];
    expect(countBy(list, (n) => (n.anchor.kind === "section" ? n.anchor.key : null))).toEqual({ purpose: 2 });
  });
});
