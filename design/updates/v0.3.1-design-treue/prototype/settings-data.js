// Settings of the ML Visualization Tool as data (v0.3.0 prototype). One list: categories, sections, every setting
// with type, default and text. The settings screen reads only this list; a new setting is one entry.
window.SetData = (function () {
  var CATS = [
    { id: 'look', title: 'Darstellung', icon: 'palette', blurb: 'Wie das Tool aussieht: Dichte, Größe, Zahlen.',
      tips: ['Kompakt plus 90 % Größe zeigt in großen Grids deutlich mehr Zeilen.', 'Farben tragen Bedeutung (bester Wert, Fehler, Warnung) und lassen sich deshalb nicht umfärben.'],
      subs: [{ id: 'layout', title: 'Dichte & Größe' }, { id: 'format', title: 'Zahlen & Zeit' }, { id: 'motion', title: 'Bewegung' }] },
    { id: 'runs', title: 'Läufe & Experiment', icon: 'list', blurb: 'Läufe-Liste, Lauf-Tab und was beim Öffnen eines Laufs zu sehen ist.',
      tips: ['Das Lauf-Merkmal färbt den Projektverlauf und warnt, wenn zwei Läufe nicht fair vergleichbar sind.'],
      subs: [{ id: 'project', title: 'Projekt' }, { id: 'open', title: 'Beim Öffnen eines Laufs' }, { id: 'notify', title: 'Hinweise' }] },
    { id: 'analysis', title: 'Analyse & Widgets', icon: 'grid', blurb: 'Boards, Vorlagen und wie Widgets sich zeigen.',
      tips: ['Vorlagen sind Boards ohne Läufe. Die Standardvorlage wird angewendet, wenn ein Lauf zum ersten Mal analysiert wird.'],
      subs: [{ id: 'boards', title: 'Boards & Vorlagen' }, { id: 'widgets', title: 'Widgets' }] },
    { id: 'export', title: 'Export', icon: 'image', blurb: 'Wie Widgets als Bild gespeichert werden.',
      tips: ['Hell ist für Folien gedacht, dunkel für Notizen am Bildschirm.', 'Platzhalter: {datum}, {titel}, {issue}, {nr}, {widget}.'],
      subs: [{ id: 'image', title: 'Bild' }, { id: 'files', title: 'Ordner & Dateien' }] },
    { id: 'agent', title: 'Agent', icon: 'spark', blurb: 'Wie der Agent arbeitet, was er kostet und was er über das Projekt weiß.',
      tips: ['Gemischt fragt nur bei Änderungen und beim Speichern nach.', 'Projekt-Anweisungen gelten in jedem Chat. Jede Änderung macht den Cache aller Chats einmal kalt.'],
      subs: [{ id: 'behaviour', title: 'Verhalten' }, { id: 'voice', title: 'Sprache' }, { id: 'cost', title: 'Kontext & Kosten' }, { id: 'connection', title: 'Verbindung' }] },
    { id: 'data', title: 'Daten & Erweitert', icon: 'db', blurb: 'Wo die Einstellungen liegen, Sichern und Zurücksetzen.',
      tips: ['Alle Einstellungen dieses Projekts liegen in einer kleinen Datei, die du lesen, sichern und ins Repo legen kannst.'],
      subs: [{ id: 'file', title: 'Datei' }, { id: 'reset', title: 'Zurücksetzen' }] }
  ];
  var PAGES = [{ id: 'about', title: 'Über', icon: 'info', blurb: 'Version, Projekt und Tastenkürzel.' }];
  var S = [];
  function add(d) { S.push(d); }
  function seg(key, cat, sub, label, desc, def, opts) { add({ key: key, cat: cat, sub: sub, type: 'enum', label: label, desc: desc, def: def, opts: opts }); }
  function bool(key, cat, sub, label, desc, def) { add({ key: key, cat: cat, sub: sub, type: 'bool', label: label, desc: desc, def: def }); }
  function num(key, cat, sub, label, desc, def, min, max, step, unit) { add({ key: key, cat: cat, sub: sub, type: 'num', label: label, desc: desc, def: def, min: min, max: max, step: step, unit: unit }); }
  function txt(key, cat, sub, label, desc, def) { add({ key: key, cat: cat, sub: sub, type: 'text', label: label, desc: desc, def: def }); }
  function act(key, cat, sub, label, desc, info, button, danger) { add({ key: key, cat: cat, sub: sub, type: 'action', label: label, desc: desc, info: info, button: button, danger: !!danger }); }

  seg('look.density', 'look', 'layout', 'Dichte', 'Wie eng Tabellen, Kacheln und Leisten gepackt sind.', 'comfortable', [['comfortable', 'Bequem'], ['compact', 'Kompakt']]);
  num('look.scale', 'look', 'layout', 'Größe der Oberfläche', 'Macht Schrift, Tabellen und Abstände gemeinsam größer oder kleiner.', 100, 85, 125, 5, '%');
  seg('look.decimal', 'look', 'format', 'Zahlenformat', 'Dezimalzeichen in Tabellen, Widgets und Bildern.', 'de', [['de', '412,8'], ['en', '412.8']]);
  seg('look.time', 'look', 'format', 'Zeit in Läufe', 'Wie die Zeit eines Laufs in der Liste steht.', 'rel', [['rel', 'vor 2 h'], ['abs', '14:32']]);
  bool('look.motion', 'look', 'motion', 'Animationen', 'Aufleuchten nach Agent-Aktionen, Ein- und Ausklappen.', true);

  seg('runs.feature', 'runs', 'project', 'Lauf-Merkmal', 'Merkmal, das zwischen Läufen wechselt und nach dem der Projektverlauf gefärbt wird.', 'auto', [['auto', 'automatisch'], ['pred_len', 'pred_len'], ['features', 'features'], ['none', 'keins']]);
  seg('runs.metric', 'runs', 'project', 'Primäre Metrik', 'Nach dieser Metrik sortieren Tabelle und „bester Wert“.', 'yaml', [['yaml', 'aus project.yaml'], ['test_mse_real', 'test_mse_real'], ['test_commitment_cost', 'commitment_cost']]);
  seg('runs.descOpen', 'runs', 'open', 'Beschreibung', 'Ob die Beschreibung eines Laufs beim ersten Öffnen aufgeklappt ist.', 'open', [['open', 'aufgeklappt'], ['closed', 'zugeklappt']]);
  bool('runs.overview', 'runs', 'open', 'Überblick', 'Grafiken je Achse über der Tabelle.', true);

  bool('runs.notifyMac', 'runs', 'notify', 'Mitteilung auf dem Mac', 'Browser-Mitteilung bei fertigen, fehlerhaften oder hängenden Läufen, wenn der Tab nicht sichtbar ist.', true);
  num('runs.errWarn', 'runs', 'notify', 'Hinweis bei Fehlern ab', 'Anteil fehlgeschlagener Zellen eines laufenden Laufs.', 5, 1, 50, 1, '%');
  num('runs.stallMin', 'runs', 'notify', 'Hängt nach', 'So lange ohne neue Zelle gilt ein laufender Lauf als hängend.', 30, 10, 240, 10, 'min');

  seg('ana.width', 'analysis', 'boards', 'Breite neuer Widgets', 'Breite, mit der ein Widget aufs Board kommt.', 'half', [['half', 'Halb'], ['full', 'Ganz']]);
  seg('ana.template', 'analysis', 'boards', 'Standardvorlage „Ein Lauf“', 'Wird angewendet, wenn ein Lauf zum ersten Mal analysiert wird.', 'Standard', [['Standard', 'Standard'], ['Meeting-Standard', 'Meeting-Standard'], ['last', 'zuletzt benutzt']]);
  bool('ana.hints', 'analysis', 'widgets', 'Was-Zeile und feste Werte', 'Die Zeile unter dem Titel und die FEST-Chips.', true);
  num('ana.chips', 'analysis', 'widgets', 'Sichtbare FEST-Chips', 'Wie viele feste Werte vor „+n weitere“ zu sehen sind.', 4, 2, 10, 1, '');
  act('ana.own', 'analysis', 'widgets', 'Eigene Widgets', 'Umbenennen oder löschen. Kacheln auf Boards zeigen danach „Widget gelöscht“.', '3 eigene Widgets', 'Verwalten …');

  seg('exp.theme', 'export', 'image', 'Hintergrund', 'Standard im Speichern-Dialog.', 'light', [['light', 'hell, für Folien'], ['dark', 'dunkel']]);
  seg('exp.scale', 'export', 'image', 'Auflösung', 'Pixel je Bildpunkt beim Speichern.', '2', [['1', '1×'], ['2', '2×'], ['3', '3×']]);
  bool('exp.footer', 'export', 'image', 'Fußzeile im Bild', 'Lauf, Epoche und Commit unten im Bild.', true);
  bool('exp.hints', 'export', 'image', 'Hinweise im Bild', 'Was-Zeile und feste Werte im Bild.', true);
  txt('exp.folder', 'export', 'files', 'Deliverable-Ordner', 'Wohin gespeichert wird, relativ zum Projekt.', 'deliverables/{datum} {titel}/');
  txt('exp.name', 'export', 'files', 'Dateiname', 'Muster für jedes Bild.', '{nr}_{widget}.png');

  seg('agent.mode', 'agent', 'behaviour', 'Standardmodus', 'Gilt für neue Chats. Im Chat jederzeit mit Shift+Tab umschaltbar.', 'mixed', [['direct', '⏵⏵ Direkt'], ['mixed', '⏵ Gemischt'], ['confirm', '⏸ Bestätigen']]);
  bool('agent.debug', 'agent', 'behaviour', 'Debug-Anzeige', 'Zeigt im Chat auch die Nachschlage-Werkzeuge mit Argumenten und Ergebnis (Käfer-Symbol im Fenster).', false);
  act('agent.instructions', 'agent', 'behaviour', 'Projekt-Anweisungen', 'Text, den der Agent in jedem Chat dieses Projekts mitbekommt.', '312 von 4 000 Zeichen', 'Bearbeiten …');
  seg('agent.voiceLang', 'agent', 'voice', 'Sprache beim Sprechen', 'In welcher Sprache du sprichst. Automatisch erkennt sie pro Aufnahme.', 'de', [['de', 'Deutsch'], ['en', 'Englisch'], ['auto', 'automatisch']]);
  seg('agent.voiceModel', 'agent', 'voice', 'Erkennung', 'Whisper auf dem Server. Genauer braucht länger und mehr Speicher.', 'small', [['small', 'schnell'], ['medium', 'genauer']]);
  bool('agent.voiceReview', 'agent', 'voice', 'Vor dem Senden prüfen', 'Gesprochenes erst im Prüfkasten zeigen. Aus: direkt senden.', true);
  act('agent.voiceTerms', 'agent', 'voice', 'Eigene Begriffe', 'Wörter, die die Erkennung zusätzlich zu den Projektbegriffen kennen soll.', '214 aus dem Projekt · 3 eigene', 'Bearbeiten …');
  num('agent.cacheWarn', 'agent', 'cost', 'Cache-Hinweis ab', 'Bei kaltem Cache fragt das Tool vor dem Senden nach, wenn der Chat größer ist.', 50, 10, 200, 10, 'k Tokens');
  bool('agent.quota', 'agent', 'cost', 'Abo-Kontingent anzeigen', '5 h und Woche im Chat-Menü, wenn Claude Code die Werte liefert.', true);
  txt('agent.claude', 'agent', 'connection', 'Pfad zu claude', 'Leer = aus PATH. Überschreibt MLVIZ_CLAUDE.', '');
  act('agent.billing', 'agent', 'connection', 'Abrechnung', 'Ist ANTHROPIC_API_KEY gesetzt, rechnet der Agent über die API ab.', '✓ Abo · claude 2.1 gefunden', 'Erneut prüfen');

  act('data.file', 'data', 'file', 'Einstellungsdatei', 'Nur geänderte Werte, je Projekt.', '.mlviz/settings.json', 'Im Ordner zeigen');
  act('data.export', 'data', 'file', 'Exportieren / Importieren', 'Alle Einstellungen als Datei sichern oder übernehmen.', '', 'Exportieren …');
  act('data.view', 'data', 'reset', 'Ansicht zurücksetzen', 'Tabs, Spalten, Fensterposition und auf-/zugeklappte Bereiche.', '', 'Zurücksetzen', true);
  act('data.chats', 'data', 'reset', 'Alle Chats löschen', 'Löscht die Chat-Liste dieses Projekts. Die Sessions in Claude Code bleiben.', '7 Chats', 'Löschen …', true);
  act('data.all', 'data', 'reset', 'Alle Einstellungen zurücksetzen', 'Alle Werte auf Standard. Lässt sich rückgängig machen.', '', 'Alle zurücksetzen', true);

  var PRESETS = [
    { id: 'meeting', title: 'Für Meetings', desc: 'Größer, Export hell in 3×, Hinweise im Bild aus.', set: { 'look.scale': 115, 'exp.scale': '3', 'exp.hints': false } },
    { id: 'dense', title: 'Große Grids', desc: 'Kompakt, 90 %, Überblick aus.', set: { 'look.density': 'compact', 'look.scale': 90, 'runs.overview': false } }
  ];
  return { CATS: CATS, PAGES: PAGES, S: S, PRESETS: PRESETS };
})();
