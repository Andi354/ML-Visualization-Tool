// v0.3.0 block E: own notes on a run, a sample description with Markdown, table groups, and a tiny Markdown reader
// for the prototypes (the tool uses the reader from v0.2.3, web/src/agent/markdown.ts).
window.NotesData = (function () {
  var RUN = '2026-10-14_0912_TIM-52_best_combined_90';
  var DESC = [
    { key: 'purpose', title: 'Zweck', text: 'Die beste Konfiguration aus pred_len 30 direkt auf pred_len 90 zu übertragen hat die Lücke zu ETS **nicht** geschlossen.\nDieser Lauf justiert `lstm_layer` und Lernrate für den langen Horizont nach.' },
    { key: 'shows', title: 'Zeigt', text: '- ob `lstm_layer` = 3 bei 90 Tagen schadet wie in TIM-49\n- welche `lr_epochs`-Kombination über die Folds am stabilsten ist\n- wie nah REP-Net an **ETS** herankommt' },
    { key: 'expect', title: 'Erwartung', text: '`lstm_layer` 1–2 besser als 3, Abstand zu ETS *unter 0,3* Prozentpunkten MAPE.' }
  ];
  var GROUPS = [
    { key: 'g1', label: 'lstm_layer 2 · lr_epochs 40', mse: '5,82', sd: '0,04', best: true },
    { key: 'g2', label: 'lstm_layer 1 · lr_epochs 40', mse: '5,86', sd: '0,05' },
    { key: 'g3', label: 'lstm_layer 2 · lr_epochs 20', mse: '5,91', sd: '0,07' },
    { key: 'g4', label: 'lstm_layer 3 · lr_epochs 40', mse: '6,04', sd: '0,21' },
    { key: 'g5', label: 'lstm_layer 3 · lr_epochs 1e-3', mse: '6,77', sd: '0,93', warn: true },
    { key: 'g6', label: 'lstm_layer 1 · lr_epochs 20', mse: '5,95', sd: '0,06' }
  ];
  var NOTES = [
    { id: 'n1', text: 'Für den Modellvergleich (TIM-52) **diesen Lauf** nehmen, nicht den vom 13.10.', when: '15.10. 09:12', anchor: { kind: 'run' } },
    { id: 'n2', text: '**lstm_layer 3** divergiert mit `lr_epochs` 1e-3 in 2 von 5 Seeds.\n- nicht weiter verfolgen\n- in TIM-49 war es genauso', when: '14.10. 21:40', anchor: { kind: 'group', key: 'g5' } },
    { id: 'n3', by: 'agent', text: 'Erwartung erfüllt: Abstand zu ETS *0,21* Prozentpunkte mit `lstm_layer` 2.', when: '15.10. 09:30', anchor: { kind: 'section', key: 'expect' } }
  ];
  var SUGGEST = { text: 'Streuung über die Seeds ist bei **lstm_layer 2** am kleinsten (0,04), bei lstm_layer 3 bis 0,93.', anchor: { kind: 'group', key: 'g1' } };

  // Markdown, small: lines → blocks (paragraph or bullet), inline **bold**, *italic*, `code`
  function inline(s) {
    var out = [], re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ t: s.slice(last, m.index), cls: '' });
      var v = m[0];
      if (v[0] === '`') out.push({ t: v.slice(1, -1), cls: 'mdc' });
      else if (v[1] === '*') out.push({ t: v.slice(2, -2), cls: 'mdb' });
      else out.push({ t: v.slice(1, -1), cls: 'mdi' });
      last = m.index + v.length;
    }
    if (last < s.length) out.push({ t: s.slice(last), cls: '' });
    return out;
  }
  function md(text) {
    return String(text || '').split('\n').map(function (line) {
      var b = /^\s*[-*] /.test(line);
      return { bullet: b, parts: inline(b ? line.replace(/^\s*[-*] /, '') : line) };
    });
  }
  return { RUN: RUN, DESC: DESC, GROUPS: GROUPS, NOTES: NOTES, SUGGEST: SUGGEST, md: md };
})();
