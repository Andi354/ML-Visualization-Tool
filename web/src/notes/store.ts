// The notes of one run tab and the agent's proposals (v0.3.0, E).
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { addNote, deleteNote, listNotes, updateNote, type Anchor, type Note } from "./api";

export interface Proposal {
  id: string;
  text: string;
  anchor: Anchor;
}

// Proposals of the agent wait here until the user saves or discards them (per run, until the page is left).
const proposals = new Map<string, Proposal[]>();
const listeners = new Set<() => void>();
export const propose = (run: string, text: string, anchor: Anchor): string => {
  const id = Math.random().toString(16).slice(2, 10);
  proposals.set(run, [{ id, text, anchor }, ...(proposals.get(run) ?? [])]);
  listeners.forEach((l) => l());
  return id;
};
const drop = (run: string, id: string) => {
  proposals.set(run, (proposals.get(run) ?? []).filter((p) => p.id !== id));
  listeners.forEach((l) => l());
};
export const proposalsOf = (run: string) => proposals.get(run) ?? [];

export interface Draft {
  /** A new note that is not saved yet. */
  anchor: Anchor;
}

export function useNotes(run: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Note | null>(null);
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const changed = () => window.dispatchEvent(new Event("mlviz:notes-changed"));
  const reload = useCallback(() => listNotes(run).then(setNotes).catch(() => undefined), [run]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const create = async (text: string, anchor: Anchor, by: "user" | "agent" = "user") => {
    setDraft(null);
    if (!text.trim()) return null; // an empty new note is discarded
    const n = await addNote(run, { text, anchor, by });
    setNotes((l) => [...l, n]);
    changed();
    return n;
  };
  const save = async (id: string, text: string) => {
    setEditing(null);
    const n = await updateNote(run, id, text);
    setNotes((l) => l.map((x) => (x.id === id ? n : x)));
  };
  const remove = async (id: string) => {
    const gone = await deleteNote(run, id);
    setNotes((l) => l.filter((x) => x.id !== id));
    changed();
    setRemoved(gone);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRemoved(null), 5000);
  };
  const undoRemove = async () => {
    if (!removed) return;
    const n = await addNote(run, { text: removed.text, anchor: removed.anchor, by: removed.by, id: removed.id, created: removed.created });
    setNotes((l) => [...l, n]);
    changed();
    setRemoved(null);
  };
  const acceptProposal = async (p: Proposal, text: string) => {
    drop(run, p.id);
    await create(text, p.anchor, "agent");
  };
  /** Scrolls to the first note of an anchor and marks it. */
  const show = (a: Anchor) => {
    const n = notes.find((x) => x.anchor.kind === a.kind && x.anchor.key === a.key);
    if (!n) return;
    setHighlight(n.id);
    setTimeout(() => setHighlight(null), 2500);
    setTimeout(() => document.querySelector(`[data-note="${n.id}"]`)?.scrollIntoView({ block: "center" }), 20);
  };

  return {
    notes, draft, editing, highlight, removed, proposals: proposalsOf(run),
    startDraft: (anchor: Anchor) => setDraft({ anchor }), cancelDraft: () => setDraft(null),
    edit: setEditing, create, save, remove, undoRemove, show, reload,
    discardProposal: (p: Proposal) => drop(run, p.id), acceptProposal,
  };
}
export type NotesApi = ReturnType<typeof useNotes>;
