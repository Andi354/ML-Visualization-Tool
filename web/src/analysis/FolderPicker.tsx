import { useEffect, useState } from "preact/hooks";
import { getJson } from "../api";

interface Listing {
  path: string;
  parent: string | null;
  dirs: string[];
}

/** Choose a folder inside the project (the tool never writes outside it). */
export function FolderPicker({ value, onPick, onClose }: { value: string; onPick: (path: string) => void; onClose: () => void }) {
  const [path, setPath] = useState(value);
  const [list, setList] = useState<Listing | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setError(false);
    getJson<Listing>(`/api/folders?path=${encodeURIComponent(path)}`)
      .then((l) => alive && setList(l))
      .catch(() => alive && (setError(true), setList(null)));
    return () => {
      alive = false;
    };
  }, [path]);
  const join = (a: string, b: string) => (a ? `${a}/${b}` : b);
  return (
    <div class="folder-picker" data-testid="folder-picker">
      <div class="fp-path mono small">/{list?.path ?? path}</div>
      {error && <div class="small muted">Ordner nicht gefunden.</div>}
      <div class="fp-list">
        {list?.parent !== null && list && (
          <button class="fp-item" data-testid="fp-up" onClick={() => setPath(list.parent ?? "")}>
            ↑ eine Ebene hoch
          </button>
        )}
        {list?.dirs.map((d) => (
          <button key={d} class="fp-item mono" data-testid="fp-dir" onClick={() => setPath(join(list.path, d))}>
            {d}
          </button>
        ))}
        {list && !list.dirs.length && <span class="muted small pad">keine Unterordner</span>}
      </div>
      <div class="fp-actions">
        <button class="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button class="btn-primary active" data-testid="fp-choose" disabled={!list || !list.path} onClick={() => list && onPick(list.path)}>
          Diesen Ordner wählen
        </button>
      </div>
    </div>
  );
}
