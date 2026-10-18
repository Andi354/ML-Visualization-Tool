// Shared sample data for the Feature E (comparison) prototypes. Numbers are made up but shaped
// so that parameter effects differ between runs (e.g. lstm_layer = 3 helps at pred_len 30, hurts at 90).
(function () {
  var AX = [
    { key: 'lstm_layer', values: ['1', '2', '3'] },
    { key: 'time_embedding', values: ['sin', 'learned', 'none'] },
    { key: 'conv_dims', values: ['[32]', '[64]'] },
    { key: 'lr_epochs', values: ['0.0005 · 20', '0.0001 · 60'] }
  ];
  var CH = ['us', 'de', 'uk', 'jp'];
  var METRICS = [
    { key: 'mape', label: 'MAPE %', d: 2 },
    { key: 'mae', label: 'MAE', d: 1 },
    { key: 'cc', label: 'Commitment Cost', d: 0 },
    { key: 'mse', label: 'MSE (skaliert)', d: 3, scaled: true }
  ];
  // eff: relative effect in % per axis value (null = axis not varied in this run)
  // mt: per-metric multipliers so that winners can differ between metrics
  var RUNS = [
    { id: '2026-09-15_0930_TIM-22_big_grid', issue: 'TIM-22', date: '2026-09-15', h: 30, epoch: 'tsrm6', base: 4.95,
      eff: { lstm_layer: [3, -1, -2], time_embedding: [1, -3, 2], conv_dims: [1, -1], lr_epochs: null } },
    { id: '2026-09-24_130216_TIM-39_grid_multivariate_30', issue: 'TIM-39', date: '2026-09-24', h: 30, base: 4.52,
      eff: { lstm_layer: [4, -1, -3], time_embedding: [0, -4, 4], conv_dims: [2, -2], lr_epochs: [-1, 1] } },
    { id: '2026-09-28_144008_TIM-45_g6_combined', issue: 'TIM-45', date: '2026-09-28', h: 30, base: 4.41,
      eff: { lstm_layer: [5, -1, -4], time_embedding: null, conv_dims: null, lr_epochs: [0, 0] } },
    { id: '2026-10-13_1830_TIM-52_best_combined_30', issue: 'TIM-52', date: '2026-10-13', h: 30, base: 4.18,
      eff: { lstm_layer: [6, -1, -5], time_embedding: [1, -4, 3], conv_dims: [1, -1], lr_epochs: [-1, 1] },
      mt: { mae: 1, cc: 1, mse: 1 }, cells: 864, err: 0, dur: '3 h 12 min' },
    { id: '2026-09-23_1600_TIM-37_early_stopping_90', issue: 'TIM-37', date: '2026-09-23', h: 90, base: 7.25,
      eff: { lstm_layer: null, time_embedding: null, conv_dims: null, lr_epochs: [5, -5] } },
    { id: '2026-10-08_2105_TIM-49_ets_gap_90', issue: 'TIM-49', date: '2026-10-08', h: 90, base: 6.82,
      eff: { lstm_layer: [-3, -1, 4], time_embedding: [0, -2, 2], conv_dims: [0, 0], lr_epochs: [4, -4] },
      mt: { mae: 0.98, cc: 0.94, mse: 1.03 }, cells: 1440, err: 210, dur: '5 h 40 min', git: 'a1c93f2' },
    { id: '2026-10-09_1422_TIM-49_ets_gap_90', issue: 'TIM-49', date: '2026-10-09', h: 90, base: 6.64,
      eff: { lstm_layer: [-4, -1, 5], time_embedding: [0, -3, 3], conv_dims: [1, -1], lr_epochs: [4, -4] },
      mt: { mae: 1, cc: 1, mse: 1 }, cells: 1440, err: 12, dur: '5 h 05 min', git: 'e70b4d1' },
    { id: '2026-10-14_0912_TIM-52_best_combined_90', issue: 'TIM-52', date: '2026-10-14', h: 90, base: 6.12, running: true,
      eff: { lstm_layer: [-5, -1, 6], time_embedding: [1, -4, 3], conv_dims: [1, -1], lr_epochs: [3, -3] },
      mt: { mae: 1.01, cc: 0.97, mse: 1 }, cells: 2592, err: 3, dur: 'läuft' }
  ];
  var byId = {};
  RUNS.forEach(function (r) { byId[r.id] = r; });

  function frac(x) { var r = Math.sin(x * 12.9898) * 43758.5453; return r - Math.floor(r); }

  // All combos of a run with metric means (over seeds/folds) and per-channel MAPE.
  var cache = {};
  function combos(id) {
    if (cache[id]) return cache[id];
    var r = byId[id], out = [], idx = 0, mt = r.mt || { mae: 1, cc: 1, mse: 1 };
    var chEff = { us: -0.06, de: 0.07, uk: 0.01, jp: 0.11 };
    for (var a0 = 0; a0 < 3; a0++) for (var a1 = 0; a1 < 3; a1++) for (var a2 = 0; a2 < 2; a2++) for (var a3 = 0; a3 < 2; a3++) {
      idx++;
      var c = [a0, a1, a2, a3], e = 0;
      AX.forEach(function (ax, i) { var t = r.eff[ax.key]; if (t) e += t[c[i]]; });
      var mape = r.base * (1 + e / 100 + (frac(idx + r.base) - 0.5) * 0.03);
      var ch = {};
      CH.forEach(function (k, j) { ch[k] = mape * (1 + chEff[k] + (frac(idx * 7 + j + r.base) - 0.5) * 0.04 + (k === 'jp' && r.h === 90 && a0 === 2 ? 0.05 : 0)); });
      out.push({
        c: c, label: AX.map(function (ax, i) { return ax.values[c[i]]; }),
        m: { mape: mape, mae: mape * 21.5 * mt.mae, cc: mape * 1040 * mt.cc, mse: mape * mape * 0.0058 * mt.mse },
        sd: mape * (0.025 + frac(idx * 3 + r.base) * 0.03), ch: ch
      });
    }
    out.sort(function (x, y) { return x.m.mape - y.m.mape; });
    out.forEach(function (x, i) { x.rank = i + 1; });
    cache[id] = out;
    return out;
  }
  function key(c) { return c.join('-'); }
  function mean(xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }
  function median(xs) { var s = xs.slice().sort(function (a, b) { return a - b; }); var n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }

  // Relative effect (% vs run mean) of each axis value, from the combos; null where the axis is not varied.
  function effects(id) {
    var r = byId[id], cs = combos(id), all = mean(cs.map(function (x) { return x.m.mape; })), out = {};
    AX.forEach(function (ax, i) {
      if (!r.eff[ax.key]) { out[ax.key] = null; return; }
      out[ax.key] = ax.values.map(function (v, vi) {
        return (mean(cs.filter(function (x) { return x.c[i] === vi; }).map(function (x) { return x.m.mape; })) / all - 1) * 100;
      });
    });
    return out;
  }

  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    var s = Math.abs(v).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (v < 0 ? '−' : '') + s.join(',');
  }
  function signed(v, d) { return (v > 0 ? '+' : '') + fmt(v, d); }
  function short(id) { return id.replace(/^\d{4}-\d{2}-\d{2}_\d{4,6}_/, ''); }

  // Spearman rank correlation of two runs over matched combos (MAPE)
  function spearman(a, b) {
    var A = combos(a), B = combos(b), rb = {};
    B.forEach(function (x) { rb[key(x.c)] = x.rank; });
    var n = A.length, s = 0;
    A.forEach(function (x) { var d = x.rank - rb[key(x.c)]; s += d * d; });
    return 1 - 6 * s / (n * (n * n - 1));
  }

  window.CmpData = {
    AX: AX, CH: CH, METRICS: METRICS, RUNS: RUNS, run: function (id) { return byId[id]; },
    combos: combos, effects: effects, key: key, mean: mean, median: median, spearman: spearman,
    fmt: fmt, signed: signed, short: short,
    A: { 'A': '#1FA3A3', 'B': '#8C7CF0' },
    // diverging scale for effects: negative (lower error, better) teal, positive (worse) amber
    effColor: function (v) {
      if (v === null) return 'transparent';
      var t = Math.min(1, Math.abs(v) / 6), c = v < 0 ? [31, 163, 163] : [196, 127, 20];
      return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.12 + t * 0.7).toFixed(2) + ')';
    }
  };
})();
