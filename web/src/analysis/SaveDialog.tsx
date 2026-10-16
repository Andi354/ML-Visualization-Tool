import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getConfig, getJson, postWidget, type CatalogEntry, type ConfigInfo, type IssueInfo, type ProjectInfo, type RunInfo, type WidgetRequest, type WidgetResult } from "../api";
import type { BoardWidget } from "../widgets/board";
import { EXPORT_WIDTH, ExportCard, footerFor, type Part, type Theme } from "../widgets/ExportCard";
import { rasterize, settle } from "../widgets/rasterize";
import { FolderPicker } from "./FolderPicker";
import { combine, defaultName, detach, groupTitle, patchImage, reorder, reselect, setLayout, singles, split, type Image } from "./images";

export interface Loaded {
  result: WidgetResult;
  configData?: ConfigInfo;
}

interface Props {
  project: ProjectInfo;
  /** What the board is about (scope, run(s), filter, parameters). */
  req: WidgetRequest;
  /** The primary run of the board (config view, export footer). */
  run: RunInfo;
  /** Runs named in the footer of an image. */
  footerRuns: RunInfo[];
  /** Footer text when it is not the list of runs (project boards). */
  footerText?: string;
  /** Folder title and issue offered by default. */
  defaultTitle: string;
  defaultIssue: string | null;
  widgets: BoardWidget[];
  catalog: CatalogEntry[];
  /** Widgets ticked when the dialog opens: none from the header button, one from a tile. */
  initial: string[];
  onClose: () => void;
  onSaved: (info: { path: string; count: number }) => void;
}

const day = (iso: string) => iso.slice(0, 10);

export async function load(w: BoardWidget, req: WidgetRequest): Promise<Loaded> {
  const result = await postWidget(w.type, { ...req, settings: w.settings });
  let configData: ConfigInfo | undefined;
  if (w.type === "config" && !result.unavailable && req.run) {
    const c = (result.data?.combo as Record<string, string> | undefined) ?? req.combo ?? {};
    configData = await getConfig(req.run, c);
  }
  return { result, configData };
}

/** "Als Deliverable speichern": checklist of the board's widgets, preview of the focused image,
 *  names, background, target folder; writes one PNG per selected image. */
export function SaveDialog({ project, req, run, footerRuns, footerText, defaultTitle, defaultIssue, widgets, catalog, initial, onClose, onSaved }: Props) {
  const scope = req.scope ?? "run";
  const combo = req.combo ?? {};
  const [images, setImages] = useState<Image[]>(() => singles(widgets.map((w) => w.id)));
  const [selected, setSelected] = useState<string[]>(initial);
  const [focus, setFocus] = useState<string | null>(initial[0] ?? widgets[0]?.id ?? null);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [theme, setTheme] = useState<Theme>("light");
  const [withConfigs, setWithConfigs] = useState(false);
  const [base, setBase] = useState(project.paths.deliverables ?? "deliverables");
  const [folderTitle, setFolderTitle] = useState(defaultTitle);
  const [issue, setIssue] = useState<string>(defaultIssue ?? "");
  const [issues, setIssues] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflicts: string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    widgets.forEach((w) =>
      load(w, req)
        .then((l) => alive && setLoaded((prev) => ({ ...prev, [w.id]: l })))
        .catch(() => {}),
    );
    getJson<Record<string, IssueInfo>>("/api/issues").then((i) => alive && setIssues(Object.keys(i))).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // --- derived -------------------------------------------------------------------------------------
  const labelOf = (widgetId: string) => catalog.find((c) => c.key === widgets.find((w) => w.id === widgetId)?.type)?.label ?? "";
  const typeOf = (widgetId: string) => widgets.find((w) => w.id === widgetId)?.type ?? "";
  const ordered = images.filter((i) => selected.includes(i.id));
  const nameOf = (img: Image) => {
    if (img.nameEdited) return img.name;
    const pos = ordered.findIndex((o) => o.id === img.id);
    return defaultName(pos >= 0 ? pos : images.indexOf(img), img.members.map(typeOf));
  };
  const isGroup = (img: Image) => img.members.length > 1;
  const titleOf = (img: Image) => (isGroup(img) ? (img.title ?? groupTitle(img.members.map(labelOf))) : (img.title ?? loaded[img.members[0]]?.result.title ?? ""));
  const unavailable = (img: Image) => img.members.map((m) => loaded[m]?.result.unavailable).find(Boolean);
  const ready = (img: Image) => img.members.every((m) => loaded[m] && !loaded[m].result.unavailable);

  const partsOf = (img: Image): Part[] | null => {
    if (!ready(img)) return null;
    return img.members.map((m) => {
      const w = widgets.find((x) => x.id === m)!;
      const l = loaded[m];
      return {
        id: m,
        type: w.type,
        result: l.result,
        configData: l.configData,
        title: isGroup(img) ? "" : titleOf(img),
        hideTitle: isGroup(img),
        hints: img.hints,
      };
    });
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  /** Trennen and lösen: the new images are selected when all their widgets were. */
  const applyChange = (after: Image[]) => {
    setSelected(reselect(images, selected, after));
    setImages(after);
    if (focus && !after.some((i) => i.id === focus)) setFocus(after[0]?.id ?? null);
  };
  const doCombine = () => {
    const out = combine(images, selected);
    setImages(out.images);
    setSelected([out.id]); // the new group stays selected and focused
    setFocus(out.id);
  };

  const target = `${base}/${day(project.now)} ${folderTitle}`.replace(/\/+/g, "/");
  const focused = images.find((i) => i.id === focus);
  const focusedParts = focused ? partsOf(focused) : null;
  const n = ordered.filter(ready).length;

  const save = async (overwrite = false) => {
    setBusy(true);
    setError(null);
    try {
      const files: { name: string; data: string; title: string }[] = [];
      for (const img of ordered) {
        const parts = partsOf(img);
        if (!parts) continue;
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-20000px;top:0";
        document.body.append(host);
        render(
          <ExportCard
            parts={parts}
            title={titleOf(img)}
            layout={img.layout}
            theme={theme}
            footer={img.footer ? (footerText ?? footerFor(footerRuns)) : null}
            run={run}
            project={project}
            combo={combo}
            scope={scope}
          />,
          host,
        );
        await settle(host);
        const data = await rasterize(host.firstElementChild as HTMLElement, { pixelRatio: 2 });
        render(null, host);
        host.remove();
        files.push({ name: nameOf(img), data, title: titleOf(img) });
      }
      const r = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, files, title: folderTitle, issue: issue || null, runs: footerRuns.map((r) => r.id), configs: withConfigs ? footerRuns.map((r) => r.id) : [], overwrite }),
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
  const card = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [cardH, setCardH] = useState(400);
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
  }, [focus, loaded, theme, focused?.hints, focused?.footer, focused?.title, focused?.layout, focused?.members.join(",")]);

  const layouts: [Image["layout"], string][] = [
    ["stack", "übereinander"],
    ["side", "nebeneinander"],
  ];

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
            <div class="list-bar">
              <span class="small muted" data-testid="mark-text">
                {selected.length} {selected.length === 1 ? "Bild" : "Bilder"} gewählt
              </span>
              <span class="grow" />
              <button class="btn" data-testid="combine" disabled={selected.length < 2} onClick={doCombine}>
                Zu einem Bild
              </button>
            </div>
            <div class="image-list" data-testid="image-list">
              {images.map((img) => {
                const group = isGroup(img);
                const missing = unavailable(img);
                return (
                  <div
                    key={img.id}
                    class={"image-item" + (focus === img.id ? " focused" : "") + (group ? " group" : "")}
                    data-testid="image-item"
                    data-image={img.id}
                    data-group={group}
                    onClick={() => setFocus(img.id)}
                  >
                    <input
                      type="checkbox"
                      aria-label={`${img.members.map(labelOf).join(" und ")} speichern`}
                      data-testid="image-check"
                      checked={selected.includes(img.id)}
                      disabled={!!missing}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(img.id)}
                    />
                    <div class="image-info">
                      {group && (
                        <div class="group-head">
                          <span class="group-label" data-testid="group-label">
                            1 Bild · {img.members.length} Widgets
                          </span>
                          <span class="grow" />
                          <div class="seg" role="group" aria-label="Anordnung">
                            {layouts.map(([l, label]) => (
                              <button
                                key={l}
                                class={img.layout === l ? "on" : ""}
                                aria-pressed={img.layout === l}
                                data-testid={`layout-${l}`}
                                onClick={(e) => (e.stopPropagation(), setImages(setLayout(images, img.id, l)))}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <button class="btn" data-testid="split" onClick={(e) => (e.stopPropagation(), applyChange(split(images, img.id)))}>
                            Trennen
                          </button>
                        </div>
                      )}
                      {img.members.map((m) => (
                        <div class="member" key={m} data-testid="member" data-widget-id={m}>
                          <span class="image-label">{labelOf(m)}</span>
                          {!group && <span class="small muted ellipsis grow">{loaded[m]?.result.unavailable ?? loaded[m]?.result.title ?? "…"}</span>}
                          {group && <span class="grow" />}
                          {group && (
                            <>
                              <button class="icon-small" aria-label="nach oben" data-testid="member-up" onClick={(e) => (e.stopPropagation(), setImages(reorder(images, img.id, m, -1)))}>
                                ↑
                              </button>
                              <button class="icon-small" aria-label="nach unten" data-testid="member-down" onClick={(e) => (e.stopPropagation(), setImages(reorder(images, img.id, m, 1)))}>
                                ↓
                              </button>
                              <button class="link" data-testid="member-detach" onClick={(e) => (e.stopPropagation(), applyChange(detach(images, img.id, m)))}>
                                lösen
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      <input
                        class="name-input mono"
                        aria-label="Dateiname"
                        data-testid="image-name"
                        value={nameOf(img)}
                        onClick={(e) => e.stopPropagation()}
                        onInput={(e) => setImages(patchImage(images, img.id, { name: (e.target as HTMLInputElement).value, nameEdited: true }))}
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
                  {[...new Set([...(defaultIssue ? [defaultIssue] : []), ...issues])].map((i) => (
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
                  <input class="text-input" data-testid="image-title" value={titleOf(focused)} onInput={(e) => setImages(patchImage(images, focused.id, { title: (e.target as HTMLInputElement).value }))} />
                </label>
                <label class="check">
                  <input type="checkbox" data-testid="hints-check" checked={focused.hints} onChange={() => setImages(patchImage(images, focused.id, { hints: !focused.hints }))} />
                  Hinweise einblenden
                </label>
                <label class="check">
                  <input type="checkbox" data-testid="footer-check" checked={focused.footer} onChange={() => setImages(patchImage(images, focused.id, { footer: !focused.footer }))} />
                  Fußzeile einblenden
                </label>
              </div>
            )}
            <div class="preview-box" ref={box} data-testid="preview" style={{ height: focusedParts ? `${cardH * scale + 2}px` : undefined }}>
              {focused && focusedParts ? (
                <div class="preview-scale" style={{ transform: `scale(${scale})`, width: `${EXPORT_WIDTH}px` }}>
                  <div ref={card}>
                    <ExportCard
                      parts={focusedParts}
                      title={titleOf(focused)}
                      layout={focused.layout}
                      theme={theme}
                      footer={focused.footer ? (footerText ?? footerFor(footerRuns)) : null}
                      run={run}
                      project={project}
                      combo={combo}
                      scope={scope}
                    />
                  </div>
                </div>
              ) : (
                <div class="muted pad">{focused ? (unavailable(focused) ?? "Lade Vorschau …") : ""}</div>
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
