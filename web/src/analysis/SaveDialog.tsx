import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getConfig, getJson, postWidget, type CatalogEntry, type ConfigInfo, type IssueInfo, type ProjectInfo, type RunInfo, type WidgetResult } from "../api";
import type { BoardWidget } from "../widgets/board";
import { EXPORT_WIDTH, ExportCard, footerFor, type Part, type Theme } from "../widgets/ExportCard";
import { rasterize, settle } from "../widgets/rasterize";
import { FolderPicker } from "./FolderPicker";

interface Image {
  id: string;
  widgetId: string;
  name: string;
  nameEdited: boolean;
  title: string | null; // null = the data's own key statement
  hints: boolean;
  footer: boolean;
}

interface Loaded {
  result: WidgetResult;
  configData?: ConfigInfo;
}

interface Props {
  project: ProjectInfo;
  run: RunInfo;
  scope: string;
  combo: Record<string, string>;
  widgets: BoardWidget[];
  catalog: CatalogEntry[];
  /** Widgets ticked when the dialog opens: none from the header button, one from a tile. */
  initial: string[];
  onClose: () => void;
  onSaved: (info: { path: string; count: number }) => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
export const defaultName = (index: number, type: string) => `${pad2(index + 1)}_${type}.png`;
const day = (iso: string) => iso.slice(0, 10);

async function load(w: BoardWidget, run: RunInfo, scope: string, combo: Record<string, string>): Promise<Loaded> {
  const result = await postWidget(w.type, { run: run.id, combo, scope, settings: w.settings });
  let configData: ConfigInfo | undefined;
  if (w.type === "config" && !result.unavailable) {
    const c = (result.data?.combo as Record<string, string> | undefined) ?? combo;
    configData = await getConfig(run.id, c);
  }
  return { result, configData };
}

/** "Als Deliverable speichern": checklist of the board's widgets, preview of the focused image,
 *  names, background, target folder; writes one PNG per selected image. */
export function SaveDialog({ project, run, scope, combo, widgets, catalog, initial, onClose, onSaved }: Props) {
  const [images, setImages] = useState<Image[]>(() =>
    widgets.map((w, i) => ({ id: w.id, widgetId: w.id, name: defaultName(i, w.type), nameEdited: false, title: null, hints: true, footer: true })),
  );
  const [selected, setSelected] = useState<string[]>(initial);
  const [focus, setFocus] = useState<string | null>(initial[0] ?? widgets[0]?.id ?? null);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [theme, setTheme] = useState<Theme>("light");
  const [withConfigs, setWithConfigs] = useState(false);
  const [base, setBase] = useState(project.paths.deliverables ?? "deliverables");
  const [folderTitle, setFolderTitle] = useState(run.name);
  const [issue, setIssue] = useState<string>(run.issue ?? "");
  const [issues, setIssues] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflicts: string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    widgets.forEach((w) =>
      load(w, run, scope, combo)
        .then((l) => alive && setLoaded((prev) => ({ ...prev, [w.id]: l })))
        .catch(() => {}),
    );
    getJson<Record<string, IssueInfo>>("/api/issues").then((i) => alive && setIssues(Object.keys(i))).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // default names follow the position among the selected images, until the name was edited
  const ordered = images.filter((i) => selected.includes(i.id));
  const nameOf = (img: Image) => {
    if (img.nameEdited) return img.name;
    const w = widgets.find((x) => x.id === img.widgetId)!;
    const pos = ordered.findIndex((o) => o.id === img.id);
    return defaultName(pos >= 0 ? pos : widgets.indexOf(w), w.type);
  };
  const patch = (id: string, p: Partial<Image>) => setImages((all) => all.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const target = `${base}/${day(project.now)} ${folderTitle}`.replace(/\/+/g, "/");
  const focused = images.find((i) => i.id === focus);
  const focusedWidget = widgets.find((w) => w.id === focused?.widgetId);
  const focusedLoaded = focused ? loaded[focused.widgetId] : undefined;

  const partOf = (img: Image): Part | null => {
    const w = widgets.find((x) => x.id === img.widgetId)!;
    const l = loaded[w.id];
    if (!l || l.result.unavailable) return null;
    return { id: img.id, type: w.type, result: l.result, configData: l.configData, title: img.title ?? l.result.title ?? "", hints: img.hints };
  };

  const save = async (overwrite = false) => {
    setBusy(true);
    setError(null);
    try {
      const files: { name: string; data: string; title: string }[] = [];
      for (const img of ordered) {
        const part = partOf(img);
        if (!part) continue;
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-20000px;top:0";
        document.body.append(host);
        render(
          <ExportCard parts={[part]} theme={theme} footer={img.footer ? footerFor([run]) : null} run={run} project={project} combo={combo} scope={scope} />,
          host,
        );
        await settle();
        const data = await rasterize(host.firstElementChild as HTMLElement, { pixelRatio: 2 });
        render(null, host);
        host.remove();
        files.push({ name: nameOf(img), data, title: part.title });
      }
      const r = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, files, title: folderTitle, issue: issue || null, runs: [run.id], configs: withConfigs ? [run.id] : [], overwrite }),
      });
      if (r.status === 409) {
        const body = await r.json();
        setError({ message: "Diese Dateien gibt es schon", conflicts: body.detail?.conflicts ?? [] });
      } else if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError({ message: body.detail?.message ?? `Speichern fehlgeschlagen (${r.status})`, conflicts: [] });
      } else {
        const out = await r.json();
        onSaved({ path: out.path, count: files.length });
      }
    } catch (e) {
      setError({ message: `Speichern fehlgeschlagen: ${(e as Error).message}`, conflicts: [] });
    } finally {
      setBusy(false);
    }
  };

  // preview scaled to its box
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [cardH, setCardH] = useState(400);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      if (box.current) setScale(Math.min(1, (box.current.clientWidth - 2) / EXPORT_WIDTH));
      if (card.current) setCardH(card.current.offsetHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    if (card.current) ro.observe(card.current);
    return () => ro.disconnect();
  }, [focus, focusedLoaded, theme, focused?.hints, focused?.footer, focused?.title]);

  const part = focused ? partOf(focused) : null;
  const n = ordered.filter((i) => partOf(i)).length;
  const label = (id: string) => catalog.find((c) => c.key === widgets.find((w) => w.id === id)?.type)?.label ?? "";

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Als Deliverable speichern" data-testid="save-dialog">
      <div class="modal">
        <header class="modal-head">
          <h2>Als Deliverable speichern</h2>
          <span class="grow" />
          <button class="icon-small" aria-label="Schließen" data-testid="dialog-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div class="modal-body">
          <div class="modal-left">
            <div class="small muted">Widgets des Boards</div>
            <div class="image-list" data-testid="image-list">
              {images.map((img) => {
                const l = loaded[img.widgetId];
                const unavailable = l?.result.unavailable;
                return (
                  <div key={img.id} class={"image-item" + (focus === img.id ? " focused" : "")} data-testid="image-item" data-image={img.id} onClick={() => setFocus(img.id)}>
                    <input
                      type="checkbox"
                      aria-label={`${label(img.widgetId)} speichern`}
                      data-testid="image-check"
                      checked={selected.includes(img.id)}
                      disabled={!!unavailable}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(img.id)}
                    />
                    <div class="image-info">
                      <span class="image-label">{label(img.widgetId)}</span>
                      <span class="small muted ellipsis">{unavailable ?? l?.result.title ?? "…"}</span>
                      <input
                        class="name-input mono"
                        aria-label="Dateiname"
                        data-testid="image-name"
                        value={selected.includes(img.id) ? nameOf(img) : img.nameEdited ? img.name : nameOf(img)}
                        onClick={(e) => e.stopPropagation()}
                        onInput={(e) => patch(img.id, { name: (e.target as HTMLInputElement).value, nameEdited: true })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div class="dialog-options">
              <div class="setting">
                <span class="small muted">Hintergrund</span>
                <div class="seg" role="group" aria-label="Hintergrund">
                  {(["light", "dark"] as const).map((t) => (
                    <button key={t} class={theme === t ? "on" : ""} aria-pressed={theme === t} data-testid={`bg-${t}`} onClick={() => setTheme(t)}>
                      {t === "light" ? "hell" : "dunkel"}
                    </button>
                  ))}
                </div>
              </div>
              <label class="check">
                <input type="checkbox" data-testid="with-configs" checked={withConfigs} onChange={() => setWithConfigs(!withConfigs)} />
                Configs des Laufs mitspeichern
              </label>
              <label class="setting">
                <span class="small muted">Titel</span>
                <input class="text-input" data-testid="folder-title" value={folderTitle} onInput={(e) => setFolderTitle((e.target as HTMLInputElement).value)} />
              </label>
              <div class="setting">
                <span class="small muted">Zielordner</span>
                <span class="mono small target" data-testid="target-path">
                  {target}
                </span>
                <button class="btn" data-testid="change-folder" onClick={() => setPicking(!picking)}>
                  Ändern
                </button>
              </div>
              {picking && (
                <FolderPicker
                  value={base}
                  onClose={() => setPicking(false)}
                  onPick={(p) => {
                    setBase(p);
                    setPicking(false);
                  }}
                />
              )}
              <label class="setting">
                <span class="small muted">Issue</span>
                <select class="select" data-testid="issue-select" value={issue} onChange={(e) => setIssue((e.target as HTMLSelectElement).value)}>
                  <option value="">keins</option>
                  {[...new Set([...(run.issue ? [run.issue] : []), ...issues])].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div class="modal-right">
            {focused && (
              <div class="preview-tools">
                <label class="setting grow">
                  <span class="small muted">Titel</span>
                  <input
                    class="text-input"
                    data-testid="image-title"
                    value={focused.title ?? focusedLoaded?.result.title ?? ""}
                    onInput={(e) => patch(focused.id, { title: (e.target as HTMLInputElement).value })}
                  />
                </label>
                <label class="check">
                  <input type="checkbox" data-testid="hints-check" checked={focused.hints} onChange={() => patch(focused.id, { hints: !focused.hints })} />
                  Hinweise einblenden
                </label>
                <label class="check">
                  <input type="checkbox" data-testid="footer-check" checked={focused.footer} onChange={() => patch(focused.id, { footer: !focused.footer })} />
                  Fußzeile einblenden
                </label>
              </div>
            )}
            <div class="preview-box" ref={box} data-testid="preview" style={{ height: part ? `${cardH * scale + 2}px` : undefined }}>
              {part && focused && focusedWidget ? (
                <div class="preview-scale" style={{ transform: `scale(${scale})`, width: `${EXPORT_WIDTH}px` }}>
                  <div ref={card}>
                    <ExportCard parts={[part]} theme={theme} footer={focused.footer ? footerFor([run]) : null} run={run} project={project} combo={combo} scope={scope} />
                  </div>
                </div>
              ) : (
                <div class="muted pad">{focusedLoaded?.result.unavailable ?? "Lade Vorschau …"}</div>
              )}
            </div>
          </div>
        </div>
        <footer class="modal-foot">
          {error && (
            <span class="dialog-error" data-testid="dialog-error">
              {error.message}
              {error.conflicts.length > 0 && <span class="mono small"> ({error.conflicts.join(", ")})</span>}
              {error.conflicts.length > 0 && (
                <button class="btn" data-testid="overwrite" onClick={() => save(true)}>
                  Überschreiben
                </button>
              )}
            </span>
          )}
          <span class="grow" />
          <button class="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button class="btn-primary active" data-testid="save-images" disabled={n === 0 || busy} onClick={() => save(false)}>
            {n === 0 ? "Widgets auswählen" : busy ? "Speichere …" : `${n} ${n === 1 ? "Bild" : "Bilder"} speichern`}
          </button>
        </footer>
      </div>
    </div>
  );
}

export { useMemo };
