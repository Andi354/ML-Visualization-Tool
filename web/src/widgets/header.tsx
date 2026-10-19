import { useState } from "preact/hooks";
import type { WidgetHeader } from "../api";

/** A value that is Python's None (shown "null", grey and italic, instead of an empty cell or "None"). */
export const isNull = (v: unknown): boolean => v === null || v === undefined || v === "None";

export function Val({ v }: { v: unknown }) {
  return isNull(v) ? <span class="null-value">null</span> : <>{String(v)}</>;
}

const SHOWN = 4;

interface Props {
  header: WidgetHeader | null | undefined;
  /** Fallback: a plain `subtitle` (own widgets that only give a string) is the what line. */
  subtitle?: string | null;
  /** Hints on: the what line and the chips; off (an image without hints) leaves them out. */
  hints: boolean;
  /** The exported image shows every fixed value (no "+n weitere"). */
  exporting?: boolean;
}

/** The parts of the widget header under the title (v0.3.2, Q.I): what line and values line. */
export function WidgetHead({ header, subtitle, hints, exporting = false }: Props) {
  const [all, setAll] = useState(false);
  const what = header?.what?.length ? header.what : subtitle && !header ? [{ text: subtitle }] : [];
  const values = header?.values;
  const showWhat = hints && (what.length > 0 || !!header?.agg);
  const chips = values?.style === "chips" && hints;
  const list = values?.style === "list";
  return (
    <>
      {showWhat && (
        <div class="w-what w-sub" data-testid="widget-what">
          {what.map((p, i) => (
            <span key={i} class={p.mono ? "mono w-what-mono" : undefined}>
              {p.text}
            </span>
          ))}
          {header?.agg && (
            <span class="w-agg">
              {what.length > 0 ? " · " : ""}
              <span aria-hidden="true">≡</span> {header.agg}
            </span>
          )}
        </div>
      )}
      {chips && values && values.items.length > 0 && (
        <div class="w-values" data-testid="widget-values">
          {values.label && <span class="w-values-label">{values.label}</span>}
          {(exporting || all ? values.items : values.items.slice(0, SHOWN)).map(([name, v]) => (
            <span key={name} class="w-chip mono" title={`${name} = ${isNull(v) ? "null" : v}`} data-testid="widget-chip">
              <span class="w-chip-name">{name}</span> <span class="w-chip-value"><Val v={v} /></span>
            </span>
          ))}
          {!exporting && values.items.length > SHOWN && (
            <button class="w-more" data-testid="widget-more" onClick={() => setAll(!all)}>
              {all ? "weniger" : `+${values.items.length - SHOWN} weitere`}
            </button>
          )}
        </div>
      )}
      {list && values && values.items.length > 0 && (
        <div class="w-list" data-testid="widget-list">
          {values.items.map(([name, v]) => (
            <div class="w-list-row mono" key={name} title={`${name} = ${isNull(v) ? "null" : v}`}>
              <span class="w-list-name">{name}</span>
              <span class="w-list-value"><Val v={v} /></span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
