import { useState } from "preact/hooks";
import { BUILTIN, scopeTitle, type StoredTemplate, type TemplateScope } from "../widgets/templates";

interface Props {
  scope: TemplateScope;
  /** Name of the template the board is based on. */
  current: string;
  dirty: boolean;
  templates: StoredTemplate[];
  standard: StoredTemplate["widgets"];
  label: (type: string) => string;
  runLabel: (id: string) => string;
  appliedTo: string;
  widgetCount: number;
  onApply: (name: string) => void;
  onUpdate: () => void;
  onSave: (name: string) => Promise<string | null>;
  onDelete: (name: string) => void;
}

/** Template button, "Vorlage aktualisieren" and "Als Vorlage speichern" with their menus (header of a board). */
export function TemplateBar({ scope, current, dirty, templates, standard, label, runLabel, appliedTo, widgetCount, onApply, onUpdate, onSave, onDelete }: Props) {
  const [open, setOpen] = useState<"menu" | "save" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const all = [{ name: BUILTIN, scope, widgets: standard, last_used: null } as StoredTemplate, ...templates];

  const submit = async () => {
    const err = await onSave(name);
    if (err) setError(err);
    else {
      setOpen(null);
      setName("");
    }
  };
  return (
    <>
      <span class="head-divider" />
      <div class="relative">
        <button class="btn" aria-expanded={open === "menu"} data-testid="template-menu" onClick={() => setOpen(open === "menu" ? null : "menu")}>
          Vorlage <b data-testid="template-current">{current}</b>
          {dirty && (
            <span class="warn-text" data-testid="template-dirty">
              {" "}
              · geändert
            </span>
          )}{" "}
          ▾
        </button>
        {open === "menu" && (
          <div class="popover left wide-templates" data-testid="template-menu-list">
            <div class="pop-head muted tiny">
              Vorlagen für „{scopeTitle[scope]}“ · angewendet auf {appliedTo}
            </div>
            {all.map((t) => (
              <div class="pop-row" key={t.name}>
                <button
                  class={`pop-choice${t.name === current ? " current" : ""}`}
                  data-testid="template-item"
                  data-template={t.name}
                  onClick={() => {
                    onApply(t.name);
                    setOpen(null);
                  }}
                >
                  <span class="w-label">{t.name}</span>
                  <span class="muted small" data-testid="template-meta">
                    {t.name === BUILTIN ? "eingebaut" : t.last_used ? `zuletzt ${t.last_used.runs.map(runLabel).join(" ↔ ")} · ${t.last_used.at.slice(0, 10)}` : "noch nicht angewendet"}
                  </span>
                  <span class="muted tiny">{t.widgets.map((w) => label(w.type)).join(" · ")}</span>
                </button>
                {t.name !== BUILTIN && (
                  <button class="pop-delete" title="Vorlage löschen" aria-label={`${t.name} löschen`} data-testid="template-delete" onClick={() => onDelete(t.name)}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {dirty && current !== BUILTIN && (
        <button class="btn" data-testid="template-update" onClick={onUpdate}>
          Vorlage aktualisieren
        </button>
      )}
      <span class="grow" />
      <div class="relative">
        <button class="btn" aria-expanded={open === "save"} data-testid="template-save-open" onClick={() => { setError(null); setOpen(open === "save" ? null : "save"); }}>
          Als Vorlage speichern
        </button>
        {open === "save" && (
          <div class="popover right save-template" data-testid="template-save-popover">
            <input
              class="text-input"
              data-testid="template-name"
              placeholder="Name, z. B. Meeting-Standard"
              value={name}
              autofocus
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <p class="muted small" data-testid="template-save-hint">
              Speichert die {widgetCount} Widgets mit Reihenfolge und Einstellungen, ohne den Lauf. Anwendbar auf jeden Lauf in „{scopeTitle[scope]}“.
            </p>
            {error && <p class="error-text small" data-testid="template-error">{error}</p>}
            <div class="row-end">
              <button class="btn" onClick={() => setOpen(null)}>Abbrechen</button>
              <button class="btn-primary active" data-testid="template-save" onClick={submit}>Speichern</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
