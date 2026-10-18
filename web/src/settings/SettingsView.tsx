import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getRuns, type ProjectInfo } from "../api";
import { getInstructions, putInstructions } from "../agent/api";
import { CATS, DEFAULTS, PRESETS, ROWS, type Row, type Value } from "./catalog";
import { changedCount, isChanged, search, valueOf } from "./model";
import { canRedo, canUndo, change, current, load, redoLast, resetAll, undoLast, useSettings } from "./store";
import { clearViewState } from "./viewState";

const catTitle = (id: string) => CATS.find((c) => c.id === id)?.title ?? id;

/** Options that depend on the project: metrics, templates. */
function withProjectOptions(row: Row, project: ProjectInfo, templates: string[], features: string[]): Row {
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
  const searchRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<string[]>([]);
  useEffect(() => {
    getRuns().then((rs) => setFeatures([...new Set(rs.flatMap((r) => Object.keys(r.config_values)))])).catch(() => undefined);
    load().catch((e) => setError(String(e)));
  }, []);

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
      <aside class="settings-rail" aria-label="Kategorien">
        {CATS.map((c) => {
          const n = changedCount(values, c.id);
          return (
            <div key={c.id}>
              <button class={"rail-cat" + (!filtering && cat === c.id ? " active" : "")} data-testid={`cat-${c.id}`} onClick={() => { setCat(c.id); setQuery(""); setOnlyChanged(false); }}>
                <span>{c.title}</span>
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
        <button class={"rail-cat" + (!filtering && cat === "about" ? " active" : "")} data-testid="cat-about" onClick={() => { setCat("about"); setQuery(""); setOnlyChanged(false); }}>
          <span>Über</span>
        </button>
      </aside>
      <section class="settings-main">
        <header class="settings-top">
          <input ref={searchRef} class="settings-search" type="search" placeholder="Einstellungen durchsuchen (/)" aria-label="Einstellungen durchsuchen" data-testid="settings-search" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
          <button class={"chip" + (onlyChanged ? " on" : "")} data-testid="only-changed" aria-pressed={onlyChanged} onClick={() => setOnlyChanged(!onlyChanged)}>Geändert {total}</button>
          <select class="settings-preset" aria-label="Vorgaben" data-testid="presets" value="" onChange={(e) => {
            const p = PRESETS.find((x) => x.id === (e.target as HTMLSelectElement).value);
            if (p) void run(change(p.set));
          }}>
            <option value="">Vorgabe …</option>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.title} – {p.desc}</option>)}
          </select>
          <button class="icon-text" title="Rückgängig (Ctrl+Z)" aria-label="Rückgängig" data-testid="settings-undo" disabled={!canUndo()} onClick={() => run(undoLast())}>↶</button>
          <button class="icon-text" title="Wiederholen (Ctrl+Shift+Z)" aria-label="Wiederholen" data-testid="settings-redo" disabled={!canRedo()} onClick={() => run(redoLast())}>↷</button>
        </header>
        {data?.warning && <div class="settings-warning" role="alert" data-testid="settings-warning">⚠ {data.warning}</div>}
        {error && <div class="settings-warning" role="alert" data-testid="settings-error">⚠ {error}</div>}
        <div class="settings-scroll">
          {!filtering && cat === "about" && <About data={data} />}
          {!filtering && active && (
            <>
              <h2>{active.title}</h2>
              <p class="blurb">{active.blurb}</p>
              {active.tips.length > 0 && <div class="tip">{active.tips.map((t) => <div key={t}>{t}</div>)}</div>}
              {active.subs.map((s) => (
                <div key={s.id} data-sub={`${active.id}.${s.id}`}>
                  <h3>{s.title}</h3>
                  {shown.filter((r) => r.sub === s.id).map((r) => <RowView key={r.key} row={r} values={values} run={run} />)}
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

function RowView({ row, values, run }: { row: Row; values: Record<string, Value>; run: (p: Promise<unknown>) => void }) {
  const changed = row.type !== "action" && isChanged(values, row.key);
  const env = current()?.env[row.key];
  return (
    <div class={"srow" + (row.type === "action" && row.danger ? " danger" : "")} data-testid="setting-row" data-key={row.key}>
      <div class="srow-text">
        <div class="srow-label">
          {row.label}
          {changed && <span class="dot" title="Geändert" data-testid="changed-dot" />}
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
  useEffect(() => setText(String(value)), [value]);
  if (row.type === "enum" || row.type === "choice") {
    return (
      <div class="seg" role="radiogroup" aria-label={row.label}>
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
        <span class="mono" data-testid="num-value">{v} {row.unit}</span>
        <button aria-label="mehr" disabled={v >= row.max} onClick={() => step(1)}>+</button>
      </div>
    );
  }
  return (
    <input class="s-input mono" aria-label={row.label} value={text} placeholder={DEFAULTS[row.key] as string} onInput={(e) => setText((e.target as HTMLInputElement).value)} onBlur={() => text !== String(value) && set(text)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
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
