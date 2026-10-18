// v0.3.0 block C: commands of the command palette (prototype data; labels as the tool shows them).
window.PaletteData = (function () {
  // k: shortcut shown on the right; step: a second list opens; go: what the prototype pretends to do
  var CMDS = [
    { id: 'runs.open', cat: 'Läufe', t: 'Lauf öffnen …', k: 'Strg+P', step: 'runs' },
    { id: 'runs.issue', cat: 'Läufe', t: 'Issue öffnen …', step: 'issues' },
    { id: 'runs.list', cat: 'Läufe', t: 'Als Liste zeigen', go: 'Läufe · Liste' },
    { id: 'runs.byIssue', cat: 'Läufe', t: 'Nach Issue gruppieren', go: 'Läufe · Issues' },
    { id: 'run.analyse', cat: 'Lauf', t: 'Diesen Lauf analysieren', go: 'Analyse · Ein Lauf' },
    { id: 'run.note', cat: 'Lauf', t: 'Notiz hinzufügen', go: 'Notiz im Lauf-Tab (Feature E)' },
    { id: 'run.filters', cat: 'Lauf', t: 'Filter zurücksetzen', go: 'Filter zurückgesetzt' },
    { id: 'run.desc', cat: 'Lauf', t: 'Beschreibung auf- oder zuklappen', go: 'Beschreibung umgeschaltet' },
    { id: 'ana.one', cat: 'Analyse', t: 'Ein Lauf', go: 'Analyse · Ein Lauf' },
    { id: 'ana.two', cat: 'Analyse', t: 'Zwei Läufe vergleichen …', step: 'runs', then: 'Analyse · Zwei Läufe' },
    { id: 'ana.project', cat: 'Analyse', t: 'Projektverlauf', go: 'Analyse · Projektverlauf' },
    { id: 'ana.template', cat: 'Analyse', t: 'Vorlage anwenden …', step: 'templates' },
    { id: 'ana.widget', cat: 'Analyse', t: 'Widget hinzufügen …', step: 'widgets' },
    { id: 'ana.save', cat: 'Analyse', t: 'Als Deliverable speichern …', k: 'Strg+S', go: 'Speichern-Dialog' },
    { id: 'agent.toggle', cat: 'Agent', t: 'Fenster zeigen oder verbergen', k: 'Strg+J', go: 'Agent-Fenster' },
    { id: 'agent.new', cat: 'Agent', t: 'Neuer Chat', go: 'Neuer Chat' },
    { id: 'agent.voice', cat: 'Agent', t: 'Spracheingabe starten', k: 'Strg+M', go: 'Spracheingabe' },
    { id: 'agent.mode', cat: 'Agent', t: 'Modus wechseln …', k: 'Shift+Tab', step: 'modes' },
    { id: 'agent.compact', cat: 'Agent', t: 'Chat komprimieren (/compact)', go: 'Chat komprimiert' },
    { id: 'set.open', cat: 'Einstellungen', t: 'Öffnen', k: 'Strg+,', go: 'Einstellungen' },
    { id: 'set.search', cat: 'Einstellungen', t: 'Einstellung suchen …', prefix: '@' },
    { id: 'set.density', cat: 'Einstellungen', t: 'Dichte umschalten', go: 'Dichte: Kompakt' },
    { id: 'set.bigger', cat: 'Einstellungen', t: 'Größer', k: 'Strg++', go: 'Größe 105 %' },
    { id: 'set.smaller', cat: 'Einstellungen', t: 'Kleiner', k: 'Strg+-', go: 'Größe 95 %' },
    { id: 'view.reset', cat: 'Ansicht', t: 'Zurücksetzen', go: 'Ansicht zurückgesetzt' },
    { id: 'help.keys', cat: 'Hilfe', t: 'Tastenkürzel', go: 'Tastenkürzel' }
  ];
  var STEPS = {
    templates: { title: 'Vorlage anwenden', items: [['Standard', 'eingebaut'], ['Meeting-Standard', '6 Widgets'], ['Seeds im Blick', '4 Widgets']] },
    widgets: { title: 'Widget hinzufügen', items: [['Bester Wert je Achse', 'Katalog'], ['Lernkurven', 'Katalog'], ['Fehler je Region', 'eigenes'], ['Konfiguration', 'Katalog']] },
    modes: { title: 'Modus wechseln', items: [['⏵⏵ Direkt', 'handelt ohne Rückfrage'], ['⏵ Gemischt', 'fragt bei Änderungen und Speichern'], ['⏸ Bestätigen', 'fragt vor jeder Aktion']] }
  };
  var PREFIXES = [
    ['', 'Läufe und Issues öffnen', 'Strg+P'],
    ['>', 'Befehle', 'Strg+Shift+P'],
    ['@', 'Einstellungen suchen', ''],
    ['?', 'diese Hilfe', '']
  ];
  return { CMDS: CMDS, STEPS: STEPS, PREFIXES: PREFIXES, RECENT: ['ana.one', 'runs.open', 'agent.voice'] };
})();
