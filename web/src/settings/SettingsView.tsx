import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getRuns, type ProjectInfo } from "../api";
import { getInstructions, putInstructions } from "../agent/api";
import { CATS, DEFAULTS, PRESETS, ROWS, type Row, type Value } from "./catalog";
import { changedCount, isChanged, search, valueOf } from "./model";
import { look } from "./projectLook";
import { Swatches } from "./Swatches";
import { canRedo, canUndo, change, current, load, redoLast, resetAll, takeFocus, undoLast, useSettings } from "./store";
import { SearchIcon } from "../frame/icons";
import { clearViewState } from "./viewState";

const CAT_ICONS: Record<string, string> = {
  look: "M9 2.5a6.5 6.5 0 1 0 0 13c1 0 1.3-.8.9-1.5-.5-.8.1-1.8 1-1.8h1.6a3 3 0 0 0 3-3A6.5 6.5 0 0 0 9 2.5zM5.5 8.5h.01M7.5 5.5h.01M11 5.5h.01",
  runs: "M3 4.5h12M3 9h12M3 13.5h8",
  analysis: "M2.5 3h5.5v5.5H2.5zM10 3h5.5v5.5H10zM2.5 10.5h13V15H2.5z",
  export: "M2.5 3.5h13v11h-13zM2.5 12l4-4 3 3 2-2 4 4M11.5 6.5h.01",
  agent: "M9 2.5l1.4 3.6 3.6 1.4-3.6 1.4L9 12.5 7.6 8.9 4 7.5l3.6-1.4z",
  data: "M3 4.5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2zM3 4.5v9c0 1.1 2.7 2 6 2s6-.9 6-2v-9M3 9c0 1.1 2.7 2 6 2s6-.9 6-2",
  about: "M9 2.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM9 8v4.5M9 5.5v.5",
};
const CatIcon = ({ id }: { id: string }) => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d={CAT_ICONS[id]} /></svg>
);

const catTitle = (id: string) => CATS.find((c) => c.id === id)?.title ?? id;

/** Options that depend on the project: metrics, templates. */
function withProjectOptions(row: Row, project: ProjectInfo, templates: string[], features: string[]): Row {
  if (row.key === "project.name") return { ...row, ph: project.name } as Row;
  if (row.key === "project.short") return { ...row, ph: project.short } as Row;
  if (row.key === "runs.feature") return { ...row, opts: [["auto", "automatisch"], ...features.map((f): [string, string] => [f, f.split(".").pop()!]), ["none", "keins"]] } as Row;
  if (row.key === "runs.metric") return { ...row, opts: [["yaml", `aus project.yaml${project.primary_metric ? ` (${project.primary_metric})` : ""}`], ...project.metrics.map((m): [string, string] => [m.key, m.label])] } as Row;
  if (row.key === "ana.template") return { ...row, opts: [["last", "zuletzt benutzt"], ...templates.map((t): [string, string] => [t, t])] } as Row;
  return row;
}

export function SettingsView({ project, templates }: { project: ProjectInfo; templates: string[] }) {
  const data = useSettings();
  const [cat, setCat] = useState("look");
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<string[]>([]);
  useEffect(() => {
    getRuns().then((rs) => setFeatures([...new Set(rs.flatMap((r) => Object.keys(r.config_values)))])).catch(() => undefined);
    load().catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!presets) return;
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest?.("[data-presets]") && setPresets(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [presets]);
  const run = (p: Promise<unknown>) => p.then(() => setError(null), (e) => setError(String(e.message ?? e)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!root.current || root.current.closest("[hidden]")) return;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        void run(e.shiftKey ? redoLast() : undoLast());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    const key = takeFocus();
    const row = ROWS.find((r) => r.key === key);
    if (!row) return;
    setCat(row.cat);
    setQuery("");
    setOnlyChanged(false);
    setFlash(row.key);
    setTimeout(() => root.current?.querySelector(`[data-key="${row.key}"]`)?.scrollIntoView({ block: "center" }), 30);
    setTimeout(() => setFlash(null), 1800);
  });

  const values = data?.values ?? {};
  const rows = useMemo(() => ROWS.map((r) => withProjectOptions(r, project, templates, features)), [project, templates, features]);
  const filtering = query.trim() !== "" || onlyChanged;
  let shown = rows;
  if (query.trim()) shown = search(shown, query, catTitle);
  if (onlyChanged) shown = shown.filter((r) => r.type !== "action" && isChanged(values, r.key));
  if (!filtering) shown = shown.filter((r) => r.cat === cat && cat !== "about");
  const total = changedCount(values);

  const groups = filtering ? CATS.map((c) => ({ cat: c, rows: shown.filter((r) => r.cat === c.id) })).filter((g) => g.rows.length) : [];
  const active = CATS.find((c) => c.id === cat);

  return (
    <div class="settings" ref={root} data-testid="settings">
      <header class="settings-top">
        <div class="settings-title">
          <span class="settings-title-main">Einstellungen</span>
          <span class="settings-title-sub" data-testid="settings-sub">{look(project).name} · v{data?.version ?? ""}</span>
        </div>
        <label class="settings-search-box">
          <SearchIcon />
          <input ref={searchRef} class="settings-search" type="search" placeholder="Einstellungen durchsuchen …" aria-label="Einstellungen durchsuchen" data-testid="settings-search" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
          <kbd>/</kbd>
        </label>
        <span class="grow" />
        <button class={"chip" + (onlyChanged ? " on" : "")} data-testid="only-changed" aria-pressed={onlyChanged} title="Nur geänderte Einstellungen zeigen" onClick={() => setOnlyChanged(!onlyChanged)}>
          Geändert <span class="chip-count" data-testid="only-changed-count">{total}</span>
        </button>
        <div class="relative" data-presets>
          <button class="chip" aria-expanded={presets} data-testid="presets" title="Mehrere Einstellungen auf einmal übernehmen" onClick={() => setPresets(!presets)}>★ Voreinstellungen ▾</button>
          {presets && (
            <div class="preset-menu" data-testid="presets-menu">
              {PRESETS.map((p) => (
                <button key={p.id} data-testid={`preset-${p.id}`} onClick={() => { setPresets(false); void run(change(p.set)); }}>
                  <span class="preset-title">{p.title}</span>
                  <span class="preset-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button class="icon-text" title="Rückgängig (Ctrl+Z)" aria-label="Rückgängig" data-testid="settings-undo" disabled={!canUndo()} onClick={() => run(undoLast())}>↶</button>
        <button class="icon-text" title="Wiederholen (Ctrl+Shift+Z)" aria-label="Wiederholen" data-testid="settings-redo" disabled={!canRedo()} onClick={() => run(redoLast())}>↷</button>
      </header>
      {data?.warning && <div class="settings-warning" role="alert" data-testid="settings-warning">⚠ {data.warning}</div>}
      {error && <div class="settings-warning" role="alert" data-testid="settings-error">⚠ {error}</div>}
      <div class="settings-body">
      <aside class="settings-rail" aria-label="Kategorien">
        <div class="rail-label">Kategorien</div>
        {CATS.map((c) => {
          const n = changedCount(values, c.id);
          return (
            <div key={c.id}>
              <button class={"rail-cat" + (!filtering && cat === c.id ? " active" : "")} data-testid={`cat-${c.id}`} onClick={() => { setCat(c.id); setQuery(""); setOnlyChanged(false); }}>
                <CatIcon id={c.id} />
                <span class="rail-title">{c.title}</span>
                {n > 0 && <span class="rail-count" data-testid={`cat-count-${c.id}`}>{n}</span>}
              </button>
              {!filtering && cat === c.id && c.subs.map((s) => (
                <button key={s.id} class="rail-sub" onClick={() => root.current?.querySelector(`[data-sub="${c.id}.${s.id}"]`)?.scrollIntoView({ block: "start" })}>
                  {s.title}
                </button>
              ))}
            </div>
          );
        })}
        <div class="rail-label more">Mehr</div>
        <button class={"rail-cat" + (!filtering && cat === "about" ? " active" : "")} data-testid="cat-about" onClick={() => { setCat("about"); setQuery(""); setOnlyChanged(false); }}>
          <CatIcon id="about" />
          <span class="rail-title">Über</span>
        </button>
      </aside>
      <section class="settings-main">
        <div class="settings-scroll">
          {!filtering && cat === "about" && <About data={data} />}
          {!filtering && active && (
            <>
              <h2>{active.title}</h2>
              <p class="blurb">{active.blurb}</p>
              {active.tips.length > 0 && <div class="tip"><span class="tip-icon" aria-hidden="true">💡</span><div>{active.tips.map((t) => <div key={t}>{t}</div>)}</div></div>}
              {active.subs.map((s) => (
                <div key={s.id} data-sub={`${active.id}.${s.id}`}>
                  <h3>{s.title}</h3>
                  {active.id === "runs" && s.id === "project" && <ProjectCard project={project} values={values} run={run} />}
                  {shown.filter((r) => r.sub === s.id).map((r) => <RowView key={r.key} row={r} values={values} run={run} flash={flash === r.key} />)}
                </div>
              ))}
            </>
          )}
          {filtering && (
            <>
              <div class="count-line" data-testid="count-line">{shown.length} {shown.length === 1 ? "Einstellung" : "Einstellungen"}</div>
              {shown.length === 0 && <div class="empty" data-testid="no-match">{query.trim() ? `Keine Einstellung zu „${query.trim()}“` : "Nichts geändert"}</div>}
              {groups.map((g) => (
                <div key={g.cat.id}>
                  <h3>{g.cat.title}</h3>
                  {g.rows.map((r) => <RowView key={r.key} row={r} values={values} run={run} />)}
                </div>
              ))}
            </>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

const PROJECT_KEYS = ["project.name", "project.short", "project.color"];

/** Preview of the project symbol with the way back to project.yaml (v0.3.2, O). */
function ProjectCard({ project, values, run }: { project: ProjectInfo; values: Record<string, Value>; run: (p: Promise<unknown>) => void }) {
  useSettings();
  const l = look(project);
  const differs = PROJECT_KEYS.some((k) => isChanged(values, k));
  return (
    <div class="project-card" data-testid="project-card">
      <div class="project-badge big" style={{ background: l.color }} data-testid="project-card-badge">{l.short}</div>
      <div class="pp-id">
        <div class="pp-name" data-testid="project-card-name">{l.name}</div>
        <div class="pp-path mono">{current()?.project_path}</div>
      </div>
      <span class="grow" />
      <button class="ghost" data-testid="project-card-reset" disabled={!differs} onClick={() => run(change({}, PROJECT_KEYS))}>Aus project.yaml</button>
    </div>
  );
}

function About({ data }: { data: ReturnType<typeof useSettings> }) {
  return (
    <>
      <h2>Über</h2>
      <p class="blurb">Version, Projekt und Tastenkürzel.</p>
      <dl class="about" data-testid="about">
        <dt>Version</dt><dd>{data?.version}</dd>
        <dt>Projektordner</dt><dd class="mono">{data?.project_path}</dd>
        <dt>Einstellungsdatei</dt><dd class="mono">{data?.file}</dd>
        <dt>Einstellungen</dt><dd>Strg/Cmd + ,</dd>
        <dt>Suche</dt><dd>/</dd>
        <dt>Rückgängig · Wiederholen</dt><dd>Strg/Cmd + Z · Umschalt + Strg/Cmd + Z</dd>
      </dl>
    </>
  );
}

function RowView({ row, values, run, flash }: { row: Row; values: Record<string, Value>; run: (p: Promise<unknown>) => void; flash?: boolean }) {
  const changed = row.type !== "action" && isChanged(values, row.key);
  const env = current()?.env[row.key];
  return (
    <div class={"srow" + (row.type === "action" && row.danger ? " danger" : "") + (flash ? " flash" : "")} data-testid="setting-row" data-key={row.key}>
      <div class="srow-text">
        <div class="srow-label">
          {row.label}
          {changed && <span class="chg-dot" title="Geändert" data-testid="changed-dot" />}
        </div>
        <div class="srow-desc">{row.desc}</div>
        {env && <div class="srow-desc">Gesetzt in {env}; diese Einstellung hat Vorrang, wenn sie einen Wert hat.</div>}
      </div>
      <div class="srow-control">
        {row.type === "action" ? <Action row={row} run={run} /> : <Control row={row} value={valueOf(values, row.key)} run={run} />}
      </div>
      <button class="reset" title="Auf Standard zurücksetzen" aria-label={`${row.label} zurücksetzen`} data-testid="reset" style={{ visibility: changed ? "visible" : "hidden" }} onClick={() => run(change({}, [row.key]))}>↺</button>
    </div>
  );
}

function Control({ row, value, run }: { row: Exclude<Row, { type: "action" }>; value: Value; run: (p: Promise<unknown>) => void }) {
  const set = (v: Value) => run(change({ [row.key]: v }));
  const [text, setText] = useState(String(value));
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => setText(String(value)), [value]);
  if (row.type === "enum" || row.type === "choice") {
    return (
      <div class="s-seg" role="radiogroup" aria-label={row.label}>
        {row.opts.length > 4 ? (
          <select aria-label={row.label} value={String(value)} onChange={(e) => set((e.target as HTMLSelectElement).value)}>
            {row.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ) : row.opts.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={value === v} class={value === v ? "on" : ""} data-value={v} onClick={() => set(v)}>{l}</button>
        ))}
      </div>
    );
  }
  if (row.type === "bool") {
    return <button class={"switch" + (value ? " on" : "")} role="switch" aria-checked={value === true} aria-label={row.label} onClick={() => set(!value)}><span /></button>;
  }
  if (row.type === "num") {
    const v = Number(value);
    const step = (d: number) => set(Math.min(row.max, Math.max(row.min, v + d * row.step)));
    return (
      <div class="stepper">
        <button aria-label="weniger" disabled={v <= row.min} onClick={() => step(-1)}>−</button>
        <input type="range" class="s-slider" aria-label={row.label} min={row.min} max={row.max} step={row.step} value={drag ?? v} onInput={(e) => setDrag(Number((e.target as HTMLInputElement).value))} onChange={(e) => { setDrag(null); set(Number((e.target as HTMLInputElement).value)); }} />
        <button aria-label="mehr" disabled={v >= row.max} onClick={() => step(1)}>+</button>
        <span class="mono" data-testid="num-value">{drag ?? v} {row.unit}</span>
      </div>
    );
  }
  if (row.type === "color") {
    return <Swatches swatches={row.swatches} value={String(value)} custom={!row.swatches.some((c) => c.toLowerCase() === String(value).toLowerCase())} onPick={set} />;
  }
  return (
    <input class="s-input mono" style={row.key === "project.short" ? { textTransform: "uppercase" } : undefined} aria-label={row.label} maxLength={row.max} value={text} placeholder={row.ph ?? (DEFAULTS[row.key] as string)} onInput={(e) => setText((e.target as HTMLInputElement).value)} onBlur={() => text !== String(value) && set(text)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
}

function Action({ row, run }: { row: Extract<Row, { type: "action" }>; run: (p: Promise<unknown>) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [editor, setEditor] = useState<{ text: string; max: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const go = async () => {
    switch (row.key) {
      case "agent.instructions": {
        setEditor(await getInstructions());
        return;
      }
      case "agent.billing": {
        const s = await (await fetch("/api/agent/setup")).json();
        setNote(s.ready ? (s.api_key ? "API-Schlüssel gesetzt: Abrechnung über die API" : "✓ Abo, Claude Code gefunden") : s.problem);
        return;
      }
      case "data.file":
        await navigator.clipboard?.writeText(current()?.file ?? "").catch(() => undefined);
        setNote(current()?.file ?? "");
        return;
      case "data.export": {
        const blob = new Blob([JSON.stringify(current()?.values ?? {}, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mlviz-settings.json";
        a.click();
        return;
      }
      case "data.view":
        clearViewState();
        location.reload();
        return;
      case "data.chats": {
        const r = await fetch("/api/agent/chats", { method: "DELETE" });
        setNote(r.ok ? `${(await r.json()).deleted} Chats gelöscht` : "Ein Chat arbeitet noch.");
        setConfirm(false);
        return;
      }
      case "data.all":
        await resetAll();
    }
  };
  const importFile = async (f: File) => {
    const data = JSON.parse(await f.text()) as Record<string, Value>;
    const known = Object.fromEntries(Object.entries(data).filter(([k]) => k in DEFAULTS));
    await change(known);
    setNote(`${Object.keys(known).length} Werte übernommen`);
  };
  const needsConfirm = row.danger && row.key !== "data.all";
  return (
    <div class="action">
      {note && <span class="note" data-testid="action-note">{note}</span>}
      {confirm ? (
        <>
          <button class="btn danger" data-testid="confirm-yes" onClick={() => run(go())}>Ja, {row.button.replace(" …", "")}</button>
          <button class="btn" onClick={() => setConfirm(false)}>Abbrechen</button>
        </>
      ) : (
        <button class={"btn" + (row.danger ? " danger" : "")} data-testid={`action-${row.key}`} onClick={() => (needsConfirm ? setConfirm(true) : run(go()))}>{row.button}</button>
      )}
      {row.key === "data.export" && (
        <>
          <button class="btn" onClick={() => file.current?.click()}>Importieren …</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) run(importFile(f)); }} />
        </>
      )}
      {editor && (
        <div class="inline-editor">
          <textarea aria-label="Projekt-Anweisungen" value={editor.text} onInput={(e) => setEditor({ ...editor, text: (e.target as HTMLTextAreaElement).value })} />
          <div class="count">{editor.text.length} von {editor.max} Zeichen</div>
          <button class="btn" onClick={() => run(putInstructions(editor.text).then(() => setEditor(null)))}>Speichern</button>
          <button class="btn" onClick={() => setEditor(null)}>Abbrechen</button>
        </div>
      )}
    </div>
  );
}
