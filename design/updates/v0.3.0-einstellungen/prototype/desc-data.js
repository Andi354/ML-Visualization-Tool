// Sample descriptions (description.yaml via ds-store read_description) for the v0.2.1 H prototypes.
// demo mode: 'full' = all fields, 'none' = run without description, 'problems' = file with problems.
window.DescData = (function () {
  var FULL = {
    short: 'Beste Config aus 30 auf pred_len 90 übertragen, lstm_layer und lr nachjustiert',
    purpose: 'Die beste Konfiguration aus pred_len 30 direkt auf pred_len 90 zu übertragen hat die Lücke zu ETS nicht geschlossen.\nDieser Lauf justiert lstm_layer und Lernrate für den langen Horizont nach, bevor die Konfiguration in den Modellvergleich geht.',
    shows: ['ob lstm_layer = 3 bei 90 Tagen schadet wie in TIM-49', 'welche lr_epochs-Kombination über die Folds am stabilsten ist', 'wie nah REP-Net mit der besten Kombination an ETS herankommt'],
    expectation: 'lstm_layer 1–2 besser als 3, Abstand zu ETS unter 0,3 Prozentpunkten MAPE.',
    notes: ['Basis-Config aus TIM-52_best_combined_30, nur Horizont geändert', 'encoding_size 64 läuft auf der GPU knapp an der Speichergrenze'],
    compare_to: ['2026-10-13_1830_TIM-52_best_combined_30', '2026-10-09_1422_TIM-49_ets_gap_90'],
    problems: []
  };
  var PROB = {
    short: FULL.short,
    purpose: FULL.purpose,
    shows: [],
    notes: ['Basis-Config aus TIM-52_best_combined_30, nur Horizont geändert'],
    compare_to: ['2026-10-13_1830_TIM-52_best_combined_30', '2026-10-01_TIM-99_gibt_es_nicht'],
    problems: ['Pflichtfeld „shows“ fehlt', 'compare_to: Lauf „2026-10-01_TIM-99_gibt_es_nicht“ nicht gefunden']
  };
  var KNOWN = { '2026-10-13_1830_TIM-52_best_combined_30': 1, '2026-10-09_1422_TIM-49_ets_gap_90': 1 };
  var short = function (id) { return id.replace(/^\d{4}-\d{2}-\d{2}_\d{4,6}_/, ''); };
  // view model: sections in fixed order, empty optional fields left out
  function view(mode, openRun) {
    var d = mode === 'none' ? null : mode === 'problems' ? PROB : FULL;
    if (!d) return { has: false, none: true, short: '', sections: [], problems: [], hasProblems: false, compare: [], hasCompare: false };
    var sec = [];
    if (d.purpose) sec.push({ key: 'purpose', label: 'Zweck', paras: d.purpose.split('\n').map(function (t) { return { t: t }; }), isText: true, isList: false });
    if (d.shows && d.shows.length) sec.push({ key: 'shows', label: 'Soll zeigen', items: d.shows.map(function (t) { return { t: t }; }), isText: false, isList: true });
    if (d.expectation) sec.push({ key: 'expectation', label: 'Erwartung', paras: [{ t: d.expectation }], isText: true, isList: false });
    if (d.notes && d.notes.length) sec.push({ key: 'notes', label: 'Notizen', items: d.notes.map(function (t) { return { t: t }; }), isText: false, isList: true });
    var cmp = (d.compare_to || []).map(function (id) {
      var ok = !!KNOWN[id];
      return { name: short(id), title: ok ? id + ' · als Tab öffnen' : id + ' · nicht gefunden', on: function () { if (ok && openRun) openRun(id); },
        st: "font: 400 12px 'IBM Plex Mono', monospace; padding: 3px 8px; border-radius: 4px; cursor: " + (ok ? 'pointer' : 'default') + '; border: 1px solid ' + (ok ? '#2C4572' : '#262E3E') + '; background: ' + (ok ? '#192640' : 'transparent') + '; color: ' + (ok ? '#C9D3E3' : '#6B7385') + '; text-decoration: ' + (ok ? 'none' : 'line-through') + ';' };
    });
    return { has: true, none: false, short: d.short || '', sections: sec, problems: d.problems.map(function (t) { return { t: t }; }), hasProblems: d.problems.length > 0, compare: cmp, hasCompare: cmp.length > 0 };
  }
  return { view: view };
})();
