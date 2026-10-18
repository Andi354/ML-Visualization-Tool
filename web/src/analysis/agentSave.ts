// "Als Deliverable speichern" without the dialog, for the agent (feature C): one image per widget with the
// default names, titles and footer of the dialog, written the same way (POST /api/deliverables).
import { h, render } from "preact";
import type { CatalogEntry, ProjectInfo, RunInfo, WidgetRequest } from "../api";
import type { BoardWidget } from "../widgets/board";
import { ExportCard, footerFor, type Part } from "../widgets/ExportCard";
import { rasterize, settle } from "../widgets/rasterize";
import { setting } from "../settings/store";
import { defaultName, targetFolder } from "./images";
import { load } from "./SaveDialog";

export interface SaveOutcome {
  path: string;
  files: string[];
  hashes: Record<string, string>;
  skipped: string[];
}

export async function saveWidgets(o: {
  project: ProjectInfo;
  req: WidgetRequest;
  run: RunInfo;
  footerRuns: RunInfo[];
  footerText?: string;
  widgets: BoardWidget[];
  catalog: CatalogEntry[];
  title: string;
}): Promise<SaveOutcome> {
  const scope = o.req.scope ?? "run";
  const combo = o.req.combo ?? {};
  const base = o.project.paths.deliverables ?? "deliverables";
  const target = targetFolder(base, o.project.now.slice(0, 10), o.title);
  const files: { name: string; data: string; title: string }[] = [];
  const skipped: string[] = [];
  for (const w of o.widgets) {
    const label = o.catalog.find((c) => c.key === w.type)?.label ?? w.type;
    const loaded = await load(w, o.req).catch(() => null);
    if (!loaded || loaded.result.unavailable) {
      skipped.push(`${label}: ${loaded?.result.unavailable ?? "nicht ladbar"}`);
      continue;
    }
    const title = loaded.result.title ?? "";
    const part: Part = { id: w.id, type: w.type, result: loaded.result, configData: loaded.configData, title, hideTitle: false, hints: true };
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-20000px;top:0";
    document.body.append(host);
    render(
      h(ExportCard, { parts: [part], title, layout: "stack", theme: setting<"light" | "dark">("exp.theme"), footer: setting<boolean>("exp.footer") ? (o.footerText ?? footerFor(o.footerRuns)) : null, run: o.run, project: o.project, combo, scope }),
      host,
    );
    await settle(host);
    const data = await rasterize(host.firstElementChild as HTMLElement, { pixelRatio: Number(setting("exp.scale")) });
    render(null, host);
    host.remove();
    files.push({ name: defaultName(files.length, [w.type]), data, title });
  }
  if (!files.length) throw new Error(`Kein Widget ließ sich als Bild speichern (${skipped.join("; ")})`);
  const r = await fetch("/api/deliverables", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, files, title: o.title, issue: null, runs: o.footerRuns.map((x) => x.id), configs: [], overwrite: false }),
  });
  if (r.status === 409) throw new Error("Diese Dateien gibt es schon in diesem Ordner. Wähle einen anderen Titel.");
  if (!r.ok) throw new Error(`Speichern fehlgeschlagen (${r.status})`);
  const out = await r.json();
  return { path: out.path, files: files.map((f) => f.name), hashes: out.hashes ?? {}, skipped };
}
