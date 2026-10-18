import { useEffect, useRef, useState } from "preact/hooks";
import { Markdown } from "../agent/Markdown";
import type { Anchor, Note } from "./api";
import { anchorLabel, dateLabel, orderNotes } from "./model";
import type { NotesApi, Proposal } from "./store";

const RUN: Anchor = { kind: "run", key: "" };

/** The text editor of a note: Ctrl+Enter or "Speichern" saves, Esc cancels. */
function Editor({ initial, onSave, onCancel, label = "Speichern" }: { initial: string; onSave: (t: string) => void; onCancel: () => void; label?: string }) {
  const [text, setText] = useState(initial);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  return (
    <div class="note-edit">
      <textarea
        ref={field}
        aria-label="Notiz"
        data-testid="note-input"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave(text);
          }
        }}
      />
      <div class="note-edit-actions">
        <button class="btn" data-testid="note-save" onClick={() => onSave(text)}>{label}</button>
        <button class="link" data-testid="note-cancel" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
}

function Card({ note, api, missing }: { note: Note; api: NotesApi; missing: boolean }) {
  const editing = api.editing === note.id;
  return (
    <div class={"my-note" + (api.highlight === note.id ? " hl" : "")} data-testid="my-note" data-note={note.id}>
      <div class="my-note-where">
        {anchorLabel(note.anchor)}
        {missing && " (Gruppe nicht in der Ansicht)"} · {dateLabel(note.created)}
        {note.by === "agent" && <span class="by-agent" data-testid="by-agent"> · ✦ vom Agenten, von dir bestätigt</span>}
      </div>
      {editing ? (
        <Editor initial={note.text} onSave={(t) => void api.save(note.id, t)} onCancel={() => api.edit(null)} />
      ) : (
        <>
          <div class="my-note-text"><Markdown text={note.text} /></div>
          <div class="my-note-actions">
            <button class="link" data-testid="note-edit" onClick={() => api.edit(note.id)}>Bearbeiten</button>
            <button class="link" data-testid="note-delete" onClick={() => void api.remove(note.id)}>Löschen</button>
          </div>
        </>
      )}
    </div>
  );
}

function ProposalCard({ p, api }: { p: Proposal; api: NotesApi }) {
  const [editing, setEditing] = useState(false);
  return (
    <div class="my-note proposal" data-testid="proposal">
      <div class="my-note-where">✦ Vorschlag des Agenten · {anchorLabel(p.anchor)}</div>
      {editing ? (
        <Editor initial={p.text} label="Speichern" onSave={(t) => void api.acceptProposal(p, t)} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div class="my-note-text"><Markdown text={p.text} /></div>
          <div class="my-note-actions">
            <button class="link" data-testid="proposal-save" onClick={() => void api.acceptProposal(p, p.text)}>Speichern</button>
            <button class="link" data-testid="proposal-edit" onClick={() => setEditing(true)}>Bearbeiten</button>
            <button class="link" data-testid="proposal-discard" onClick={() => api.discardProposal(p)}>Verwerfen</button>
          </div>
        </>
      )}
    </div>
  );
}

/** The right column of a run tab while no table row is selected: "✎ Meine Notizen". */
export function NotesColumn({ api, tableKeys }: { api: NotesApi; tableKeys: string[] }) {
  const ordered = orderNotes(api.notes, tableKeys);
  return (
    <aside class="notes-col" data-testid="notes-column">
      <header class="notes-head">
        <span class="notes-title">✎ Meine Notizen · {api.notes.length}</span>
        <button class="link" data-testid="note-add-run" onClick={() => api.startDraft(RUN)}>+ zum Lauf</button>
      </header>
      <div class="notes-scroll">
        {api.proposals.map((p) => <ProposalCard key={p.id} p={p} api={api} />)}
        {api.draft && (
          <div class="my-note" data-testid="note-draft">
            <div class="my-note-where">{anchorLabel(api.draft.anchor)} · neu</div>
            <Editor initial="" onSave={(t) => void api.create(t, api.draft!.anchor)} onCancel={api.cancelDraft} />
          </div>
        )}
        {ordered.length === 0 && !api.draft && api.proposals.length === 0 && <div class="notes-empty">Noch keine Notizen zu diesem Lauf.</div>}
        {ordered.map((n) => <Card key={n.id} note={n} api={api} missing={n.anchor.kind === "group" && !tableKeys.includes(n.anchor.key)} />)}
      </div>
      {api.removed && (
        <div class="notes-toast" data-testid="notes-toast">
          Notiz gelöscht <button class="link" data-testid="note-undo" onClick={() => void api.undoRemove()}>Rückgängig</button>
        </div>
      )}
    </aside>
  );
}

/** Notes of one group, in the detail panel above the widgets. */
export function GroupNotes({ api, groupKey }: { api: NotesApi; groupKey: string }) {
  const mine = api.notes.filter((n) => n.anchor.kind === "group" && n.anchor.key === groupKey);
  const anchor: Anchor = { kind: "group", key: groupKey };
  return (
    <section class="dp-notes" data-testid="dp-notes">
      <div class="notes-head">
        <span class="notes-title">✎ Notizen zu dieser Kombination</span>
        <button class="link" data-testid="note-add-group" onClick={() => api.startDraft(anchor)}>+ Notiz</button>
      </div>
      {api.draft && api.draft.anchor.key === groupKey && (
        <div class="my-note" data-testid="note-draft">
          <Editor initial="" onSave={(t) => void api.create(t, anchor)} onCancel={api.cancelDraft} />
        </div>
      )}
      {mine.map((n) => <Card key={n.id} note={n} api={api} missing={false} />)}
    </section>
  );
}
