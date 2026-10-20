import { useEffect, useRef, useState } from "preact/hooks";
import type { ProjectInfo } from "../api";
import { PROJECT_COLORS } from "../settings/catalog";
import { look } from "../settings/projectLook";
import { change, current, useSettings } from "../settings/store";
import { Swatches } from "../settings/Swatches";

interface Props {
  project: ProjectInfo;
  onClose: () => void;
  onAllSettings: () => void;
}

/** Small popover beside the project symbol (v0.3.2, O): name, two letters and colour, saved as typed. */
export function ProjectPopover({ project, onClose, onAllSettings }: Props) {
  const data = useSettings();
  const box = useRef<HTMLDivElement>(null);
  const l = look(project);
  const values = data?.values ?? {};
  const [name, setName] = useState(String(values["project.name"] ?? ""));
  const [short, setShort] = useState(String(values["project.short"] ?? ""));
  const timer = useRef<number>();
  useEffect(() => {
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-testid=project-badge]") && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  const save = (key: string, value: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void change({ [key]: value }).catch(() => undefined), 250);
  };
  const flush = (key: string, value: string) => {
    window.clearTimeout(timer.current);
    void change({ [key]: value }).catch(() => undefined);
  };
  return (
    <div class="project-pop" role="dialog" aria-label="Projekt" data-testid="project-popover" ref={box}>
      <div class="pp-head">
        <div class="project-badge big" style={{ background: l.color }}>{l.short}</div>
        <div class="pp-id">
          <div class="pp-name" data-testid="pp-name">{l.name}</div>
          <div class="pp-path mono" title={current()?.project_path}>{current()?.project_path}</div>
        </div>
      </div>
      <label class="pp-field">
        Anzeigename
        <input class="s-input" data-testid="pp-input-name" value={name} placeholder={project.name} onInput={(e) => { const v = (e.target as HTMLInputElement).value; setName(v); save("project.name", v); }} onBlur={() => flush("project.name", name)} />
      </label>
      <label class="pp-field">
        Kürzel
        <input class="s-input mono" data-testid="pp-input-short" maxLength={2} value={short} placeholder={project.short} onInput={(e) => { const v = (e.target as HTMLInputElement).value; setShort(v); save("project.short", v); }} onBlur={() => flush("project.short", short)} />
      </label>
      <div class="pp-field">
        Farbe
        <Swatches swatches={PROJECT_COLORS} value={String(values["project.color"] ?? PROJECT_COLORS[0])} custom={values["project.color"] !== undefined && !PROJECT_COLORS.includes(String(values["project.color"]))} onPick={(c) => void change({ "project.color": c }).catch(() => undefined)} />
      </div>
      <div class="pp-foot">
        <button class="ghost" data-testid="pp-all" onClick={onAllSettings}>Alle Einstellungen</button>
      </div>
    </div>
  );
}
