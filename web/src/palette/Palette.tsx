import { searchNotes } from "../notes/api";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RunRow } from "../api";
import { handlerFor } from "../agent/bus";
import { CATS, ROWS } from "../settings/catalog";
import { shortName } from "../runs/model";
import { COMMANDS, SHORTCUTS, recentCommands, rememberCommand, type Command, type Ctx, type StepKind } from "./commands";
import { PREFIXES, parseInput, parts, rank } from "./match";

export interface Request {
  /** What the input holds when the palette opens: ">" commands, "" runs and issues. */
  input: string;
  n: number;
}

interface Item {
  key: string;
  label: string;
  at: number[];
  desc?: string;
  /** Hint at the right (category of a setting, why a command is off). */
  right?: string;
  /** Shortcut, drawn as a key box. */
  keys?: string;
  /** Leading "Läufe: " of a command, not part of the match. */
  prefix?: string;
  icon?: [string, string];
  mono?: boolean;
  /** Group name, shown at the right of the first item of the group; a line separates it from the one above. */
  group?: string;
  /** Why it cannot run here. */
  disabled?: string | null;
  run: () => void;
}

const STEP_TITLE: Record<StepKind, string> = {
  run: "Lauf öffnen", issue: "Issue öffnen", run2: "Zweiten Lauf wählen", template: "Vorlage anwenden", widget: "Widget hinzufügen", mode: "Modus wechseln", shortcuts: "Tastenkürzel",
};

const MODE_LIST: [string, string][] = [["direct", "Direkt"], ["mixed", "Gemischt"], ["confirm", "Bestätigen"]];
const runLabel = (r: RunRow) => `${shortName(r)}${r.issue ? ` · ${r.issue}` : ""}`;
const RUN_ICON: [string, string] = ["▤", "#6E9BF5"];
const ISSUE_ICON: [string, string] = ["◆", "#A78BFA"];
const runDesc = (r: RunRow) => `${r.issue ?? "ohne Issue"} · ${String(r.started ?? "").slice(0, 10)}${r.running ? " · ● läuft" : ""}`;
const newest = (runs: RunRow[]) => [...runs].sort((a, b) => String(b.started ?? "").localeCompare(String(a.started ?? "")));

export function Palette({ ctx, request, onClose }: { ctx: Ctx; request: Request; onClose: () => void }) {
  const [input, setInput] = useState(request.input);
  const [step, setStep] = useState<StepKind | null>(null);
  const [sel, setSel] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  useEffect(() => {
    setInput(request.input);
    setStep(null);
  }, [request.n]);
  useEffect(() => setSel(0), [input, step]);
  // notes whose text matches the search (quick open without a prefix)
  const [noteHits, setNoteHits] = useState<{ run: string; id: string; excerpt: string }[]>([]);
  useEffect(() => {
    const { mode, query } = parseInput(input);
    if (step || mode !== "runs" || query.trim().length < 2) return setNoteHits([]);
    const t = setTimeout(() => searchNotes(query).then(setNoteHits).catch(() => setNoteHits([])), 150);
    return () => clearTimeout(t);
  }, [input, step]);
  // templates and widgets are the ones of the board that is mounted
  const [board, setBoard] = useState<{ templates: string[]; widgets: { key: string; label: string; question?: string }[] }>({ templates: [], widgets: [] });
  useEffect(() => {
    if (step !== "template" && step !== "widget") return;
    Promise.resolve(handlerFor("board_info")?.({})).then((o) => o && o.data && setBoard(o.data as typeof board)).catch(() => undefined);
  }, [step]);

  const choose = (fn: () => void) => ctx.later(fn);
  const issueTitles = useMemo(() => [...new Set(ctx.runs.map((r) => r.issue).filter((i): i is string => !!i))], [ctx.runs]);

  const items: Item[] = (() => {
    const { mode, query } = parseInput(input);
    const run = (r: RunRow, then?: () => void): Item => ({ key: `run:${r.id}`, label: runLabel(r), at: [], icon: RUN_ICON, mono: true, desc: runDesc(r), run: then ?? (() => choose(() => ctx.dispatch({ type: "open-run", run: r.id }))) });
    const issue = (id: string): Item => ({ key: `issue:${id}`, label: id, at: [], icon: ISSUE_ICON, run: () => choose(() => { ctx.dispatch({ type: "select-area", area: "runs" }); ctx.dispatch({ type: "set-runs-view", view: "issues" }); }) });
    const fromRank = <T,>(list: T[], texts: (t: T) => string[], make: (t: T) => Item): Item[] => rank(list, query, texts).map(({ item, at }) => ({ ...make(item), at }));

    if (step) {
      const q = input;
      const search = <T,>(list: T[], texts: (t: T) => string[], make: (t: T) => Item) => rank(list, q, texts).map(({ item, at }) => ({ ...make(item), at }));
      switch (step) {
        case "run": return search(newest(ctx.runs), (r) => [runLabel(r), r.short ?? ""], (r) => run(r));
        case "issue": return search(issueTitles, (i) => [i], issue);
        case "run2": {
          const first = ctx.frame.active && ctx.frame.active !== "@settings" ? ctx.frame.active : newest(ctx.runs)[0]?.id;
          return search(newest(ctx.runs).filter((r) => r.id !== first), (r) => [runLabel(r)], (r) => run(r, () => choose(() => ctx.dispatch({ type: "open-compare", runs: [first!, r.id] }))));
        }
        case "template": return search(["Standard", ...board.templates.filter((t) => t !== "Standard")], (t) => [t], (t) => ({ key: `t:${t}`, label: t, at: [], run: () => choose(() => void handlerFor("apply_template")?.({ name: t })) }));
        case "widget": return search(board.widgets, (w) => [w.label, w.question ?? ""], (w) => ({ key: `w:${w.key}`, label: w.label, at: [], desc: w.question, run: () => choose(() => void handlerFor("add_widget")?.({ type: w.key })) }));
        case "mode": return MODE_LIST.map(([m, l]) => ({ key: `m:${m}`, label: l, at: [], run: () => choose(() => void handlerFor("ui:mode")?.({ mode: m })) }));
        case "shortcuts": return SHORTCUTS.map(([k, l]) => ({ key: k, label: l, at: [], right: k, run: onClose }));
      }
    }
    if (mode === "prefixes") return PREFIXES.map((p) => ({ key: `p:${p.mode}`, label: p.label, at: [], desc: p.desc, run: () => setInput(p.prefix) }));
    if (mode === "settings") {
      const cat = (id: string) => CATS.find((c) => c.id === id)?.title ?? id;
      return fromRank(ROWS, (r) => [r.label, r.desc], (r) => ({ key: `s:${r.key}`, label: r.label, at: [], icon: ["⚙", "#8590A3"], desc: r.desc, right: cat(r.cat), run: () => choose(() => ctx.openSetting(r.key)) }));
    }
    let out: Item[];
    if (mode === "commands") {
      const make = (c: Command): Item => ({
        key: c.id, label: c.label, at: [], prefix: `${c.cat}: `, keys: c.shortcut, disabled: c.blocked?.(ctx) ?? null,
        run: () => {
          rememberCommand(c.id);
          if (c.id === "set.search") setInput("@");
          else if (c.step) {
            setStep(c.step);
            setInput("");
          } else choose(() => void c.run?.(ctx));
        },
      });
      if (query.trim()) out = fromRank(COMMANDS, (c) => [c.label, c.cat], make);
      else {
        const recent = recentCommands().map((id) => COMMANDS.find((c) => c.id === id)).filter((c): c is Command => !!c);
        out = [...recent.map((c) => ({ ...make(c), group: "zuletzt verwendet" })), ...COMMANDS.filter((c) => !recent.includes(c)).map((c, i) => ({ ...make(c), group: i === 0 ? "weitere Befehle" : undefined }))];
      }
    } else if (query.trim()) {
      const noteItems: Item[] = noteHits.map((h) => {
        const r = ctx.runs.find((x) => x.id === h.run);
        return { key: `note:${h.id}`, label: `✎ ${r ? runLabel(r) : h.run} · ${h.excerpt}`, at: [], run: () => choose(() => ctx.dispatch({ type: "open-run", run: h.run })) };
      });
      out = [...fromRank(ctx.runs, (r) => [runLabel(r), r.issue ?? "", r.short ?? ""], (r) => run(r)), ...fromRank(issueTitles, (i) => [i], issue), ...noteItems];
    } else {
      out = [...newest(ctx.runs).slice(0, 5).map((r, i) => ({ ...run(r), group: i === 0 ? "zuletzt geöffnet" : undefined })), ...issueTitles.slice(0, 3).map((i, k) => ({ ...issue(i), group: k === 0 ? "Issues" : undefined }))];
    }
    const text = query.trim();
    if (text) out.push({ key: "ask", label: `Agent fragen: „${text}“`, at: [], icon: ["✦", "#6E9BF5"], desc: out.length === 0 ? "kein Befehl passt" : undefined, run: () => choose(() => ctx.ask(text)) });
    return out;
  })();

  const act = (it: Item | undefined) => it && !it.disabled && it.run();
  const back = () => {
    setStep(null);
    setInput(">");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) setSel((s) => (s + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      act(items[sel]);
    } else if (step && (e.key === "ArrowLeft" || e.key === "Backspace") && (e.key === "ArrowLeft" ? (field.current?.selectionStart ?? 0) === 0 : input === "")) {
      e.preventDefault();
      back();
    }
  };
  useEffect(() => {
    document.querySelector(`[data-testid="palette-item"][data-selected="true"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel, items.length]);

  return (
    <div class="palette-scrim" data-testid="palette-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="palette" role="dialog" aria-label="Befehlspalette" data-testid="palette">
        {step && (
          <div class="palette-step">
            <button aria-label="Zurück" data-testid="palette-back" onClick={back}>←</button> {STEP_TITLE[step]}
          </div>
        )}
        <input ref={field} class="palette-input" data-testid="palette-input" aria-label="Befehlspalette" placeholder={step ? "Suchen …" : "Lauf suchen, > Befehl, @ Einstellung, ? Hilfe"} value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} onKeyDown={onKey} />
        <div class="palette-list" role="listbox">
          {items.map((it, i) => (
            <div key={it.key}>
              {it.group && i > 0 && <div class="palette-sep" />}
              <div
                role="option"
                aria-selected={i === sel}
                aria-disabled={!!it.disabled}
                class={"palette-item" + (i === sel ? " sel" : "") + (it.disabled ? " off" : "")}
                data-testid="palette-item"
                data-selected={i === sel}
                onMouseMove={() => setSel(i)}
                onClick={() => act(it)}
              >
                {it.icon && <span class="palette-icon" style={{ color: it.icon[1] }}>{it.icon[0]}</span>}
                <span class={"palette-label" + (it.mono ? " mono" : "")}>
                  {it.prefix}
                  {parts(it.label, it.at).map((p, k) => (p.hit ? <mark key={k}>{p.t}</mark> : <span key={k}>{p.t}</span>))}
                </span>
                {it.desc && <span class="palette-desc">{it.desc}</span>}
                {!it.desc && <span class="palette-fill" />}
                {(it.disabled ?? it.right ?? it.group) && !it.keys && <span class="palette-right" data-testid="palette-right">{it.disabled ?? it.right ?? it.group}</span>}
                {it.keys && <span class="palette-key">{it.keys}</span>}
                {it.keys && it.group && <span class="palette-right">{it.group}</span>}
              </div>
            </div>
          ))}
          {items.length === 0 && <div class="palette-empty">Nichts gefunden</div>}
        </div>
      </div>
    </div>
  );
}
