// The settings screen as data: categories, sections and every row. One list; a new setting is one entry.
// Keys, defaults and ranges are the ones of `src/mlviz/settings.py` (a test compares them).
export type Value = string | number | boolean;
export type Values = Record<string, Value>;

export interface Cat {
  id: string;
  title: string;
  blurb: string;
  tips: string[];
  subs: { id: string; title: string }[];
}

interface Base {
  key: string;
  cat: string;
  sub: string;
  label: string;
  desc: string;
}
export type Row =
  | (Base & { type: "enum"; def: string; opts: [string, string][] })
  /** Options come from the project (metrics, templates, Lauf-Merkmale): see `dynamicOptions`. */
  | (Base & { type: "choice"; def: string; opts: [string, string][] })
  | (Base & { type: "bool"; def: boolean })
  | (Base & { type: "num"; def: number; min: number; max: number; step: number; unit: string })
  | (Base & { type: "text"; def: string })
  | (Base & { type: "action"; button: string; danger: boolean });

export const CATS: Cat[] = [
  { id: "look", title: "Darstellung", blurb: "Wie das Tool aussieht: Dichte, Größe, Zahlen.",
    tips: ["Kompakt plus 90 % Größe zeigt in großen Grids deutlich mehr Zeilen.", "Farben tragen Bedeutung (bester Wert, Fehler, Warnung) und lassen sich deshalb nicht umfärben."],
    subs: [{ id: "layout", title: "Dichte & Größe" }, { id: "format", title: "Zahlen & Zeit" }, { id: "motion", title: "Bewegung" }] },
  { id: "runs", title: "Läufe & Experiment", blurb: "Läufe-Liste, Lauf-Tab und was beim Öffnen eines Laufs zu sehen ist.",
    tips: ["Das Lauf-Merkmal färbt den Projektverlauf und warnt, wenn zwei Läufe nicht fair vergleichbar sind."],
    subs: [{ id: "project", title: "Projekt" }, { id: "open", title: "Beim Öffnen eines Laufs" }, { id: "notify", title: "Hinweise" }] },
  { id: "analysis", title: "Analyse & Widgets", blurb: "Boards, Vorlagen und wie Widgets sich zeigen.",
    tips: ["Vorlagen sind Boards ohne Läufe. Die Standardvorlage wird angewendet, wenn ein Lauf zum ersten Mal analysiert wird."],
    subs: [{ id: "boards", title: "Boards & Vorlagen" }] },
  { id: "export", title: "Export", blurb: "Wie Widgets als Bild gespeichert werden.",
    tips: ["Hell ist für Folien gedacht, dunkel für Notizen am Bildschirm.", "Platzhalter: {datum}, {titel}, {issue}, {nr}, {widget}."],
    subs: [{ id: "image", title: "Bild" }, { id: "files", title: "Ordner & Dateien" }] },
  { id: "agent", title: "Agent", blurb: "Wie der Agent arbeitet, was er kostet und was er über das Projekt weiß.",
    tips: ["Gemischt fragt nur bei Änderungen und beim Speichern nach.", "Projekt-Anweisungen gelten in jedem Chat. Jede Änderung macht den Cache aller Chats einmal kalt."],
    subs: [{ id: "behaviour", title: "Verhalten" }, { id: "voice", title: "Sprache" }, { id: "cost", title: "Kontext & Kosten" }, { id: "connection", title: "Verbindung" }] },
  { id: "data", title: "Daten & Erweitert", blurb: "Wo die Einstellungen liegen, Sichern und Zurücksetzen.",
    tips: ["Alle Einstellungen dieses Projekts liegen in einer kleinen Datei, die du lesen, sichern und ins Repo legen kannst."],
    subs: [{ id: "file", title: "Datei" }, { id: "reset", title: "Zurücksetzen" }] },
];

const seg = (key: string, cat: string, sub: string, label: string, desc: string, def: string, opts: [string, string][]): Row => ({ key, cat, sub, label, desc, type: "enum", def, opts });
const choice = (key: string, cat: string, sub: string, label: string, desc: string, def: string, opts: [string, string][]): Row => ({ key, cat, sub, label, desc, type: "choice", def, opts });
const bool = (key: string, cat: string, sub: string, label: string, desc: string, def: boolean): Row => ({ key, cat, sub, label, desc, type: "bool", def });
const num = (key: string, cat: string, sub: string, label: string, desc: string, def: number, min: number, max: number, step: number, unit: string): Row => ({ key, cat, sub, label, desc, type: "num", def, min, max, step, unit });
const txt = (key: string, cat: string, sub: string, label: string, desc: string, def: string): Row => ({ key, cat, sub, label, desc, type: "text", def });
const act = (key: string, cat: string, sub: string, label: string, desc: string, button: string, danger = false): Row => ({ key, cat, sub, label, desc, type: "action", button, danger });

export const ROWS: Row[] = [
  seg("look.density", "look", "layout", "Dichte", "Wie eng Tabellen, Kacheln und Leisten gepackt sind.", "comfortable", [["comfortable", "Bequem"], ["compact", "Kompakt"]]),
  num("look.scale", "look", "layout", "Größe der Oberfläche", "Macht Schrift, Tabellen und Abstände gemeinsam größer oder kleiner.", 100, 85, 125, 5, "%"),
  seg("look.decimal", "look", "format", "Zahlenformat", "Dezimalzeichen in Tabellen, Widgets und Bildern.", "de", [["de", "412,8"], ["en", "412.8"]]),
  seg("look.time", "look", "format", "Zeit in Läufe", "Wie die Zeit eines Laufs in der Liste steht.", "rel", [["rel", "vor 2 h"], ["abs", "14:32"]]),
  bool("look.motion", "look", "motion", "Animationen", "Aufleuchten nach Agent-Aktionen, Ein- und Ausklappen.", true),

  choice("runs.feature", "runs", "project", "Lauf-Merkmal", "Merkmal, das zwischen Läufen wechselt und nach dem der Projektverlauf gefärbt wird.", "auto", [["auto", "automatisch"], ["none", "keins"]]),
  choice("runs.metric", "runs", "project", "Primäre Metrik", "Nach dieser Metrik sortieren Tabelle und „bester Wert“.", "yaml", [["yaml", "aus project.yaml"]]),
  seg("runs.descOpen", "runs", "open", "Beschreibung", "Ob die Beschreibung eines Laufs beim ersten Öffnen aufgeklappt ist.", "open", [["open", "aufgeklappt"], ["closed", "zugeklappt"]]),
  bool("runs.overview", "runs", "open", "Überblick", "Grafiken je Achse über der Tabelle.", true),
  bool("runs.notifyMac", "runs", "notify", "Mitteilung auf dem Mac", "Browser-Mitteilung bei fertigen, fehlerhaften oder hängenden Läufen, wenn der Tab nicht sichtbar ist.", true),
  num("runs.errWarn", "runs", "notify", "Hinweis bei Fehlern ab", "Anteil fehlgeschlagener Zellen eines laufenden Laufs.", 5, 1, 50, 1, "%"),
  num("runs.stallMin", "runs", "notify", "Hängt nach", "So lange ohne neue Zelle gilt ein laufender Lauf als hängend.", 30, 10, 240, 10, "min"),

  seg("ana.width", "analysis", "boards", "Breite neuer Widgets", "Breite, mit der ein Widget aufs Board kommt. Automatisch: je nach Widget.", "auto", [["auto", "automatisch"], ["half", "Halb"], ["full", "Ganz"]]),
  choice("ana.template", "analysis", "boards", "Standardvorlage „Ein Lauf“", "Wird angewendet, wenn ein Lauf zum ersten Mal analysiert wird.", "last", [["last", "zuletzt benutzt"]]),

  seg("exp.theme", "export", "image", "Hintergrund", "Standard im Speichern-Dialog.", "light", [["light", "hell, für Folien"], ["dark", "dunkel"]]),
  seg("exp.scale", "export", "image", "Auflösung", "Pixel je Bildpunkt beim Speichern.", "2", [["1", "1×"], ["2", "2×"], ["3", "3×"]]),
  bool("exp.footer", "export", "image", "Fußzeile im Bild", "Lauf, Epoche und Commit unten im Bild.", true),
  txt("exp.folder", "export", "files", "Deliverable-Ordner", "Wohin gespeichert wird, relativ zum Projekt.", "{deliverables}/{datum} {titel}/"),
  txt("exp.name", "export", "files", "Dateiname", "Muster für jedes Bild.", "{nr}_{widget}.png"),

  seg("agent.mode", "agent", "behaviour", "Standardmodus", "Gilt für neue Chats. Im Chat jederzeit mit Shift+Tab umschaltbar.", "mixed", [["direct", "⏵⏵ Direkt"], ["mixed", "⏵ Gemischt"], ["confirm", "⏸ Bestätigen"]]),
  bool("agent.debug", "agent", "behaviour", "Debug-Anzeige", "Zeigt im Chat auch die Nachschlage-Werkzeuge mit Argumenten und Ergebnis.", false),
  act("agent.instructions", "agent", "behaviour", "Projekt-Anweisungen", "Text, den der Agent in jedem Chat dieses Projekts mitbekommt.", "Bearbeiten …"),
  seg("agent.voiceLang", "agent", "voice", "Sprache beim Sprechen", "In welcher Sprache du sprichst. Automatisch erkennt sie pro Aufnahme.", "de", [["de", "Deutsch"], ["en", "Englisch"], ["auto", "automatisch"]]),
  seg("agent.voiceModel", "agent", "voice", "Erkennung", "Whisper auf dem Server. Genauer braucht länger und mehr Speicher.", "small", [["small", "schnell"], ["medium", "genauer"]]),
  bool("agent.voiceReview", "agent", "voice", "Vor dem Senden prüfen", "Gesprochenes erst im Prüfkasten zeigen. Aus: direkt senden.", true),
  txt("agent.voiceTerms", "agent", "voice", "Eigene Begriffe", "Wörter (mit Komma getrennt), die die Erkennung zusätzlich zu den Projektbegriffen kennen soll.", ""),
  num("agent.cacheWarn", "agent", "cost", "Cache-Hinweis ab", "Bei kaltem Cache fragt das Tool vor dem Senden nach, wenn der Chat größer ist.", 50, 10, 200, 10, "k Tokens"),
  bool("agent.quota", "agent", "cost", "Abo-Kontingent anzeigen", "5 h und Woche im Chat-Menü, wenn Claude Code die Werte liefert.", true),
  txt("agent.claude", "agent", "connection", "Pfad zu claude", "Leer = aus PATH. Überschreibt MLVIZ_CLAUDE.", ""),
  act("agent.billing", "agent", "connection", "Abrechnung", "Ist ANTHROPIC_API_KEY gesetzt, rechnet der Agent über die API ab.", "Erneut prüfen"),

  act("data.file", "data", "file", "Einstellungsdatei", "Nur geänderte Werte, je Projekt.", "Pfad kopieren"),
  act("data.export", "data", "file", "Exportieren / Importieren", "Alle Einstellungen als Datei sichern oder übernehmen.", "Exportieren …"),
  act("data.view", "data", "reset", "Ansicht zurücksetzen", "Tabs, Spalten, Fensterposition und auf-/zugeklappte Bereiche dieses Browsers.", "Zurücksetzen", true),
  act("data.chats", "data", "reset", "Alle Chats löschen", "Löscht die Chat-Liste dieses Projekts. Die Sessions in Claude Code bleiben.", "Löschen …", true),
  act("data.all", "data", "reset", "Alle Einstellungen zurücksetzen", "Alle Werte auf Standard. Lässt sich rückgängig machen.", "Alle zurücksetzen", true),
];

export const PRESETS: { id: string; title: string; desc: string; set: Values }[] = [
  { id: "meeting", title: "Für Meetings", desc: "Größer, Export in 3×.", set: { "look.scale": 115, "exp.scale": "3" } },
  { id: "dense", title: "Große Grids", desc: "Kompakt, 90 %, Überblick aus.", set: { "look.density": "compact", "look.scale": 90, "runs.overview": false } },
];

export const VALUE_ROWS = ROWS.filter((r) => r.type !== "action");
export const DEFAULTS: Values = Object.fromEntries(VALUE_ROWS.map((r) => [r.key, (r as { def: Value }).def]));
