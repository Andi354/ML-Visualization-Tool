// Draws an own widget: a Vega-Lite description with the rows of its dataset, themed to the tokens (feature E).
// Vega is loaded when the first own widget is drawn, so boards without one do not pay for it.
import { useEffect, useRef, useState } from "preact/hooks";
import { readThemeVars, themeConfig } from "./own-theme";

export interface OwnData {
  rows: Record<string, unknown>[];
  spec: Record<string, unknown>;
  name: string;
}

/** "Widget kann nicht gezeichnet werden: <reason>", the message the agent sees as well. */
export const cannotDraw = (reason: string) => `Widget kann nicht gezeichnet werden: ${reason}`;

const HEIGHT = 300;

export function OwnChart({ data }: { data: OwnData }) {
  const host = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let view: { finalize: () => void } | null = null;
    setPending(true);
    setError(null);
    (async () => {
      try {
        const [vega, vl] = await Promise.all([import("vega"), import("vega-lite")]);
        if (!alive || !host.current) return;
        const config = themeConfig(readThemeVars(host.current));
        const spec = {
          width: "container",
          height: HEIGHT,
          autosize: { type: "fit", contains: "padding" },
          ...data.spec,
          data: { values: data.rows },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compiled = vl.compile(spec as any, { config: config as any }).spec;
        const v = new vega.View(vega.parse(compiled), { renderer: "svg", container: host.current, hover: false });
        view = v;
        await v.runAsync();
        if (alive) setPending(false);
      } catch (e) {
        if (alive) {
          setError(cannotDraw(e instanceof Error ? e.message : String(e)));
          setPending(false);
        }
      }
    })();
    return () => {
      alive = false;
      view?.finalize();
      if (host.current) host.current.innerHTML = "";
    };
  }, [data]);

  return (
    <div class="own-chart" data-testid="own-chart" data-pending={pending ? "true" : undefined}>
      <div ref={host} class="own-chart-host" />
      {error && (
        <div class="w-unavailable" data-testid="own-chart-error">
          {error}
        </div>
      )}
    </div>
  );
}
