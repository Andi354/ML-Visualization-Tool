export interface Anchor {
  kind: "run" | "section" | "group";
  key: string;
}
export interface Note {
  id: string;
  text: string;
  created: string;
  updated: string;
  anchor: Anchor;
  by: "user" | "agent";
}

const json = { "content-type": "application/json" };
async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `Fehler ${r.status}`);
  return r.json();
}

export const listNotes = (run: string) => fetch(`/api/runs/${encodeURIComponent(run)}/notes`).then(ok<Note[]>);
export const addNote = (run: string, body: { text: string; anchor: Anchor; by?: string; id?: string; created?: string }) =>
  fetch(`/api/runs/${encodeURIComponent(run)}/notes`, { method: "POST", headers: json, body: JSON.stringify(body) }).then(ok<Note>);
export const updateNote = (run: string, id: string, text: string) =>
  fetch(`/api/runs/${encodeURIComponent(run)}/notes/${id}`, { method: "PUT", headers: json, body: JSON.stringify({ text }) }).then(ok<Note>);
export const deleteNote = (run: string, id: string) => fetch(`/api/runs/${encodeURIComponent(run)}/notes/${id}`, { method: "DELETE" }).then(ok<Note>);
export const searchNotes = (q: string) => fetch(`/api/notes/search?q=${encodeURIComponent(q)}`).then(ok<{ run: string; id: string; excerpt: string }[]>);
