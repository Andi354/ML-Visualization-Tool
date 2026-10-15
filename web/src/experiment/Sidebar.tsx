import { useState } from "preact/hooks";
import type { Dim, DimsInfo } from "../api";
import {
  constantCount,
  dimMatches,
  dimState,
  filterConstants,
  resetDim,
  setDim,
  stateTag,
  toggleValue,
  type DimState,
} from "./model";

interface Props {
  info: DimsInfo;
  state: DimState;
  onState: (s: DimState) => void;
}

function DimRow({ dim, state, onState, q }: { dim: Dim; state: DimState; onState: (s: DimState) => void; q: string }) {
  const [open, setOpen] = useState(false);
  const s = dimState(state, dim);
  const m = dimMatches(dim, q);
  const expanded = open || (!!q && m.values);
  const tag = stateTag(dim, s);
  const isChannel = dim.kind === "channel";
  return (
    <div class={"dim" + (expanded ? " open" : "")} data-testid="dim" data-dim={dim.key}>
      <button class="dim-head mono" aria-expanded={expanded} onClick={() => setOpen(!open)}>
        <span class="caret">{expanded ? "▾" : "▸"}</span>
        <span class="dim-key">{dim.key}</span>
        <span class={"dim-tag" + (tag.accent ? " accent" : "")} data-testid="dim-tag">
          {tag.text}
        </span>
      </button>
      {expanded && (
        <div class="dim-body">
          <div class="seg wide" role="group" aria-label={`${dim.key}: Teilen oder mitteln`}>
            <button
              class={s.mode === "split" ? "on" : ""}
              aria-pressed={s.mode === "split"}
              data-testid="mode-split"
              onClick={() => onState(setDim(state, dim, { mode: "split" }))}
            >
              {isChannel ? "je Kanal" : "Teilen"}
            </button>
            <button
              class={s.mode === "agg" ? "on" : ""}
              aria-pressed={s.mode === "agg"}
              data-testid="mode-agg"
              onClick={() => onState(setDim(state, dim, { mode: "agg" }))}
            >
              {isChannel ? "gesamt" : "Ø mitteln"}
            </button>
          </div>
          <div class="dim-values">
            {dim.values.map((v) => (
              <label key={v.value} class="dim-value mono">
                <input
                  type="checkbox"
                  data-testid="dim-value"
                  data-value={v.value}
                  checked={s.sel.includes(v.value)}
                  onChange={() => onState(toggleValue(state, dim, v.value))}
                />
                <span class="grow ellipsis">{v.value}</span>
                <span class="muted tiny">{v.n}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ info, state, onState }: Props) {
  const [q, setQ] = useState("");
  const [constOpen, setConstOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const consts = filterConstants(info.constants, query);
  const total = constantCount(info.constants);
  const constExpanded = constOpen || (!!query && constantCount(consts) > 0);
  return (
    <aside class="exp-sidebar" data-testid="sidebar">
      <input
        type="search"
        class="search small-input"
        placeholder="Achse oder Wert suchen"
        aria-label="Achse oder Wert suchen"
        data-testid="dim-search"
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      {info.sections.map((section) => {
        const dims = info.dims.filter((d) => d.section === section && dimMatches(d, query).row);
        if (!dims.length) return null;
        return (
          <div class="dim-section" key={section} data-testid="section" data-section={section}>
            <div class="section-head mono">
              <span class="grow">{section}</span>
              <span>{dims.length}</span>
            </div>
            {dims.map((d) => (
              <DimRow key={d.key} dim={d} state={state} onState={onState} q={query} />
            ))}
          </div>
        );
      })}
      {total > 0 && (!query || constantCount(consts) > 0) && (
        <div class="constants" data-testid="constants">
          <button class="constants-head" aria-expanded={constExpanded} onClick={() => setConstOpen(!constOpen)}>
            <span class="caret">{constExpanded ? "▾" : "▸"}</span>
            <span class="grow">Konstante Werte</span>
            <span class="badge mono">{total}</span>
          </button>
          {constExpanded && (
            <div class="constants-body">
              {consts.map((b) => (
                <div class="const-block" key={b.block}>
                  <div class="section-head mono">{b.block}</div>
                  {b.rows.map((r) => (
                    <div class="const-row mono" key={r.key}>
                      <span class="grow ellipsis muted-2">{r.key}</span>
                      <span class="nowrap">{r.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export { resetDim };
