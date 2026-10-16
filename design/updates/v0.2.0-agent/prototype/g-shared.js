// Shared widget catalog and settings controls for the Feature G prototypes.
window.GShared = (function () {
  var CAT = [
    { key: 'table', label: 'Vergleichstabelle', q: 'Welcher Wert einer Achse ist je Spalte am besten?', opts: { rows: 'forecaster', groups: 'pred_len' } },
    { key: 'channel', label: 'Je Region', q: 'Wie schneiden zwei Varianten je Region ab?', opts: { series: 'features', format: 'table' } },
    { key: 'config', label: 'Beste Config', q: 'Mit welcher Konfiguration wurde das erreicht?', opts: {} },
    { key: 'effect', label: 'Wirkung je Achse', q: 'Welche Achse hat den größten Einfluss?', opts: {} },
    { key: 'stability', label: 'Stabilität', q: 'Wie stark schwanken die Werte über Seeds und Folds?', opts: {} }
  ];
  var seg = function (on) { return "font: 500 12px 'IBM Plex Sans', sans-serif; cursor: pointer; border: 0; border-radius: 3px; padding: 3px 9px; background: " + (on ? '#1A2030' : 'transparent') + '; color: ' + (on ? '#E4E8EF' : '#8590A3') + ';'; };
  function group(label, cur, values, names, pick) {
    return { label: label, items: values.map(function (v, i) { return { label: names ? names[i] : v, st: seg(cur === v), on: function () { pick(v); } }; }) };
  }
  // controls for a widget type; set(patch) merges into opts
  function controls(type, o, set) {
    if (type === 'table') return [
      group('Zeilen', o.rows, ['forecaster', 'features', 'pred_len'], null, function (v) { set({ rows: v, groups: o.groups === v ? 'none' : o.groups }); }),
      group('Spalten je', o.groups, ['pred_len', 'features', 'none'], ['pred_len', 'features', 'keine'], function (v) { set({ groups: v === o.rows ? 'none' : v }); })
    ];
    if (type === 'channel') return [
      group('Vergleich', o.series, ['features', 'pred_len'], null, function (v) { set({ series: v, fix: v === 'pred_len' ? { forecaster: 'REP-Net', features: 'M' } : { forecaster: 'REP-Net', pred_len: '30' } }); }),
      group('Format', o.format, ['table', 'bars'], ['Tabelle', 'Balken'], function (v) { set({ format: v }); })
    ];
    if (type === 'stability') return [group('pred_len', (o.fix || {}).pred_len || '30', ['30', '90'], null, function (v) { set({ fix: { pred_len: v, features: 'M' } }); })];
    return [];
  }
  return { CAT: CAT, controls: controls, seg: seg, byKey: function (k) { return CAT.filter(function (c) { return c.key === k; })[0]; } };
})();
