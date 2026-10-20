// v0.3.0 block D: running runs and run events for the notification prototypes (made-up numbers).
window.NotifyData = (function () {
  // rate = cells per hour from the finished_at of the last cells; eta = remaining / rate
  var RUNNING = [
    { id: '2026-10-14_0912_TIM-52_best_combined_90', issue: 'TIM-52', done: 1204, planned: 2592, err: 3, rate: 640, eta: '2 h 10 min', at: '18:40' },
    { id: '2026-10-18_0810_TIM-49_ets_gap_90_v3', issue: 'TIM-49', done: 312, planned: 1440, err: 0, rate: 0, stalled: '34 min', last: '15:26' }
  ];
  var EVENTS = {
    done: { kind: 'done', icon: '✓', col: '#3FB68B', title: 'Lauf fertig', run: '2026-10-13_1830_TIM-52_best_combined_30',
      text: '864 Zellen in 3 h 12 min · bester Wert 3,97 (test_mse_real) · 0 Fehler', actions: ['Öffnen', 'Analysieren', '✦ Zusammenfassen'],
      summary: 'Platzhalter · Kurzfazit des Agenten: lstm_layer 2 mit lr_epochs 40 ist am besten (3,97), 0,24 besser als TIM-48_49_best_30. Die Streuung über die Seeds ist klein.' },
    err: { kind: 'err', icon: '✕', col: '#E5484D', title: 'Viele Fehler', run: '2026-10-14_0912_TIM-52_best_combined_90',
      text: '64 von 1 268 fertigen Zellen fehlgeschlagen (5,0 %) · zuletzt: CUDA out of memory', actions: ['Fehler zeigen'] },
    stalled: { kind: 'stalled', icon: '⚠', col: '#E0A43A', title: 'Lauf hängt', run: '2026-10-18_0810_TIM-49_ets_gap_90_v3',
      text: 'Seit 30 min keine neue Zelle · letzte um 15:26 · 312 von 1 440', actions: ['Öffnen'] },
    started: { kind: 'started', silent: true, run: '2026-10-18_1610_TIM-37_early_stopping_90_b', title: 'Lauf gestartet' }
  };
  var OLD = [
    { kind: 'done', icon: '✓', col: '#3FB68B', title: 'Lauf fertig', run: '2026-10-09_1422_TIM-49_ets_gap_90', text: '1 440 Zellen in 9 h 41 min · bester Wert 6,31 · 12 Fehler', when: 'gestern 23:10', read: true, actions: ['Öffnen', 'Analysieren', '✦ Zusammenfassen'] }
  ];
  return { RUNNING: RUNNING, EVENTS: EVENTS, OLD: OLD };
})();
