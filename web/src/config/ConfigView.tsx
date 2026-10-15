import { useEffect, useState } from "preact/hooks";
import { getConfig, type ConfigInfo } from "../api";
import { loadJson, saveJson, storageKey } from "../state/storage";

export type ConfigMode = "blocks" | "yaml";

const isMode = (v: unknown): ConfigMode | null => (v === "blocks" || v === "yaml" ? v : null);
export const loadMode = (project: string): ConfigMode => loadJson(storageKey(project, "configView"), isMode) ?? "blocks";
export const saveMode = (project: string, m: ConfigMode) => saveJson(storageKey(project, "configView"), m);

export function Legend({ baseKnown }: { baseKnown: boolean }) {
  return (
    <div class="cfg-legend small muted" data-testid="cfg-legend">
      <span>
        <span class="cfg-swatch accent" /> im Grid variiert
      </span>
      {baseKnown && (
        <span>
          <span class="cfg-swatch amber" /> weicht von base.yaml ab
        </span>
      )}
      <span>
        <span class="cfg-swatch dashed" /> Wiederholungen
      </span>
    </div>
  );
}

/** The grid box: every swept axis with all its values, the combination's value highlighted. */
export function GridBox({ data }: { data: ConfigInfo }) {
  const { axes, replicates } = data.grid;
  return (
    <div class="cfg-grid" data-testid="cfg-grid">
      <div class="cfg-grid-title">
        Im Grid variiert · {axes.length} {axes.length === 1 ? "Achse" : "Achsen"}
      </div>
      {axes.map((a) => (
        <div class="cfg-axis" key={a.key} data-testid="cfg-axis" data-axis={a.key}>
          <span class="mono cfg-axis-key">{a.key}</span>
          <span class="cfg-chips">
            {a.values.map((v) => (
              <span
                key={v.label}
                class={"cfg-chip mono" + (v.label === a.current ? " current" : "")}
                data-testid="cfg-chip"
                aria-current={v.label === a.current}
              >
                {v.display}
              </span>
            ))}
          </span>
        </div>
      ))}
      {replicates.length > 0 && (
        <div class="cfg-reps" data-testid="cfg-reps">
          {replicates.map((r) => (
            <div class="cfg-axis" key={r.key} data-testid="cfg-rep" data-rep={r.key}>
              <span class="mono cfg-axis-key">{r.key}</span>
              <span class="cfg-chips">
                {r.values.map((v) => (
                  <span key={v} class="cfg-chip mono dashed">
                    {v}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfigBlocks({ data, embedded }: { data: ConfigInfo; embedded: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div class="cfg-blocks" data-testid="cfg-blocks">
      <GridBox data={data} />
      {data.blocks.map((b) => {
        const isOpen = open[b.name] ?? !embedded; // in the detail panel the blocks start folded
        return (
          <section class="cfg-block" key={b.name} data-testid="cfg-block" data-block={b.name}>
            <button class="cfg-block-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [b.name]: !isOpen })}>
              <span class="caret">{isOpen ? "▾" : "▸"}</span>
              <span class="mono grow">{b.name}</span>
              <span class="muted tiny">{b.entries.length} Einträge</span>
              {data.base_known && (
                <span class={"tiny" + (b.differs ? " amber" : " muted")} data-testid="cfg-differs">
                  {b.differs} abweichend von base
                </span>
              )}
            </button>
            {isOpen && (
              <div class="cfg-entries mono">
                {b.entries.map((e) => (
                  <>
                    <span class="cfg-key muted-2 ellipsis" key={e.key + "k"} title={e.key}>
                      {e.key}
                    </span>
                    <span
                      key={e.key + "v"}
                      class={"cfg-value" + (e.swept ? " swept" : "") + (e.differs ? " differs" : "")}
                      data-testid="cfg-entry"
                      data-key={e.key}
                      title={e.differs ? `base: ${e.base}` : e.swept ? `Grid: ${e.values.join(", ")}` : undefined}
                    >
                      {e.differs && <span class="cfg-dot" />}
                      {e.value}
                    </span>
                  </>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ConfigYaml({ data }: { data: ConfigInfo }) {
  const blocks = [...new Set(data.lines.filter((l) => l.kind === "block").map((l) => l.block))];
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const current = data.grid.axes.filter((a) => a.current !== null);
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(data.yaml);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const displayOf = (a: (typeof current)[number]) => a.values.find((v) => v.label === a.current)?.display ?? a.current;
  return (
    <div class="cfg-yaml" data-testid="cfg-yaml">
      {current.length > 0 && (
        <div class="cfg-grid-chips" data-testid="cfg-grid-chips">
          <span class="muted small">Im Grid</span>
          {current.map((a) => (
            <span class="cfg-chip current mono" key={a.key}>
              {a.key} = {displayOf(a)}
            </span>
          ))}
        </div>
      )}
      <div class="cfg-yaml-tools">
        <button class="btn" data-testid="fold-all" onClick={() => setFolded(Object.fromEntries(blocks.map((b) => [b, true])))}>
          Alles zuklappen
        </button>
        <button class="btn" data-testid="unfold-all" onClick={() => setFolded({})}>
          aufklappen
        </button>
        <span class="grow" />
        <button class="btn" data-testid="copy-yaml" onClick={copy}>
          {copied ? "kopiert" : "YAML kopieren"}
        </button>
      </div>
      <div class="cfg-lines mono" role="code">
        {data.lines.map((l) => {
          if (l.kind === "entry" && folded[l.block]) return null;
          const head = l.kind === "block";
          return (
            <div
              key={l.n}
              class={
                "cfg-line" +
                (l.swept ? " swept" : "") +
                (l.replicate ? " replicate" : "") +
                (l.differs ? " differs" : "") +
                (head ? " head" : "")
              }
              data-testid="yaml-line"
              data-n={l.n}
            >
              <span class="cfg-ln">{l.n}</span>
              {head ? (
                <button class="cfg-fold" aria-expanded={!folded[l.block]} onClick={() => setFolded({ ...folded, [l.block]: !folded[l.block] })}>
                  {folded[l.block] ? "▸" : "▾"} {l.text}
                </button>
              ) : (
                <span class="cfg-text" style={{ paddingLeft: `${l.indent * 16}px` }}>
                  {l.text}
                </span>
              )}
              <span class="grow" />
              {l.differs && <span class="cfg-note amber">base: {l.base}</span>}
              {l.note && <span class="cfg-note">{l.note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  runId: string;
  projectName: string;
  combo?: Record<string, string>;
  /** In the detail panel: blocks start folded. */
  embedded?: boolean;
  /** Show the Blöcke | YAML switch (the tile of a board shows it in its own settings). */
  showSwitch?: boolean;
  mode?: ConfigMode;
}

/** One way to show a whole resolved config (feature J): views "Blöcke" and "YAML" on the same data. */
export function ConfigView({ runId, projectName, combo, embedded = false, showSwitch = true, mode: forced }: Props) {
  const [data, setData] = useState<ConfigInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<ConfigMode>(() => loadMode(projectName));
  const key = JSON.stringify(combo ?? null);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    getConfig(runId, combo)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [runId, key]);
  const shown = forced ?? mode;
  const choose = (m: ConfigMode) => {
    setMode(m);
    saveMode(projectName, m);
  };
  if (failed) return <div class="notice">Die Config konnte nicht geladen werden.</div>;
  if (!data)
    return (
      <div class="placeholder">
        <div class="loading-row" />
      </div>
    );
  return (
    <div class="cfg" data-testid="cfg">
      <div class="cfg-head">
        <Legend baseKnown={data.base_known} />
        <span class="grow" />
        {showSwitch && (
          <div class="seg" role="group" aria-label="Ansicht der Config">
            {(["blocks", "yaml"] as const).map((m) => (
              <button key={m} class={shown === m ? "on" : ""} aria-pressed={shown === m} data-testid={`cfg-mode-${m}`} onClick={() => choose(m)}>
                {m === "blocks" ? "Blöcke" : "YAML"}
              </button>
            ))}
          </div>
        )}
      </div>
      {shown === "blocks" ? <ConfigBlocks data={data} embedded={embedded} /> : <ConfigYaml data={data} />}
    </div>
  );
}
