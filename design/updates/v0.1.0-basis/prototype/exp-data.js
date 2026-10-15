// Shared sample data and aggregation for the Feature D prototypes (data only, no UI).
(function () {
  var AX = [
    { key: 'lstm_layer', block: 'model', values: ['1', '2', '3'] },
    { key: 'time_embedding', block: 'model', values: ['sin', 'learned', 'none'] },
    { key: 'conv_dims', block: 'model', values: ['[32]', '[64]'] },
    { key: 'lr_epochs', block: 'train', values: ['0.0005 · 20', '0.0001 · 60'] }
  ];
  var CONSTS = { data: ['pred_len = 30', 'seq_len = 360'], model: ['forecaster = repnet'], train: [] };
  var METRICS = [
    { key: 'test_mape_real', label: 'MAPE %', fam: 'real', f: function (m) { return m * 100; }, d: 2 },
    { key: 'test_mae_real', label: 'MAE', fam: 'real', f: function (m) { return m * 10000; }, d: 1 },
    { key: 'test_commitment_cost', label: 'Commitment Cost', fam: 'real', f: function (m) { return m * 48000; }, d: 0 },
    { key: 'test_mse_missing', label: 'MSE (skaliert)', fam: 'scaled', f: function (m) { return m * m * 120; }, d: 3 }
  ];
  var CH = ['us', 'de', 'uk', 'jp'];
  var SEEDS = ['7', '42', '123', '777', '2024'];
  var FOLDS = ['0', '1', '2', '3'];
  var _cells = null, _seed = 0;

  // Sample data differs per run: the run id seeds offsets, effect order and noise.
  function useRun(id) {
    var h = 0, t = String(id || '');
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    h = Math.abs(h);
    if (h !== _seed) { _seed = h; _cells = null; }
  }

  function cells() {
    if (_cells) return _cells;
    var eff = [[0.0025, 0, 0.0008], [0, 0.0006, 0.0022], [0.0005, 0], [0, 0.0012]];
    var chEff = { us: -0.004, de: 0.006, uk: 0.002, jp: 0.009 };
    var out = [], idx = 0;
    for (var a0 = 0; a0 < 3; a0++) for (var a1 = 0; a1 < 3; a1++) for (var a2 = 0; a2 < 2; a2++) for (var a3 = 0; a3 < 2; a3++) {
      idx++;
      var combo = [a0, a1, a2, a3];
      var k = _seed, rot = function (row, a) { return row[(a + k) % row.length]; };
      var base = 0.041 + (k % 7) * 0.0012 + rot(eff[0], a0) + rot(eff[1], a1) + rot(eff[2], a2) + rot(eff[3], a3);
      for (var s = 0; s < 5; s++) for (var f = 0; f < 4; f++) {
        if (a0 === 2 && a2 === 1 && a3 === 1 && f === 0 && s < 2) { out.push({ combo: combo, s: s, f: f, err: true }); continue; }
        var r = Math.sin((s + 1) * 12.9898 + (f + 1) * 78.233 + idx * 3.17 + (k % 97)) * 43758.5453;
        var noise = ((r - Math.floor(r)) - 0.5) * 0.004 + f * 0.0007;
        var ch = {}, sum = 0;
        for (var ci = 0; ci < CH.length; ci++) {
          var c = CH[ci];
          var v = base + noise + chEff[c] + (c === 'jp' && a1 === 2 ? 0.006 : 0) + (c === 'de' && a0 === 0 ? 0.003 : 0);
          ch[c] = v; sum += v;
        }
        out.push({ combo: combo, s: s, f: f, ch: ch, total: sum / CH.length });
      }
    }
    _cells = out;
    return out;
  }

  function dimValue(c, key) {
    for (var i = 0; i < AX.length; i++) if (AX[i].key === key) return AX[i].values[c.combo[i]];
    if (key === 'shuffle_seed') return SEEDS[c.s];
    if (key === 'cv_fold') return FOLDS[c.f];
    return null;
  }

  // o.split: dimension keys kept apart (axes, 'shuffle_seed', 'cv_fold', 'channel')
  // o.filter: {key: [allowed values]}; o.channel: null = overall, 'us' = one channel
  function aggregate(o) {
    o = o || {};
    var split = o.split || [], filter = o.filter || {};
    var chSplit = split.indexOf('channel') >= 0;
    var groups = {}, order = [], used = 0;
    var cs = cells();
    for (var n = 0; n < cs.length; n++) {
      var c = cs[n], ok = true;
      for (var fk in filter) {
        var allowed = filter[fk];
        if (allowed && allowed.length && fk !== 'channel' && allowed.indexOf(dimValue(c, fk)) < 0) { ok = false; break; }
      }
      if (!ok) continue;
      used++;
      var parts = {};
      for (var k = 0; k < split.length; k++) if (split[k] !== 'channel') parts[split[k]] = dimValue(c, split[k]);
      var chans = chSplit ? CH.filter(function (x) { return !filter.channel || !filter.channel.length || filter.channel.indexOf(x) >= 0; }) : [o.channel || null];
      for (var q = 0; q < chans.length; q++) {
        var chn = chans[q];
        var p = chSplit ? Object.assign({}, parts, { channel: chn }) : parts;
        var gk = JSON.stringify(p);
        var g = groups[gk];
        if (!g) { g = { parts: p, vals: [], err: 0 }; groups[gk] = g; order.push(gk); }
        if (c.err) g.err++; else g.vals.push(chn ? c.ch[chn] : c.total);
      }
    }
    var rows = order.map(function (gk) {
      var g = groups[gk], m = {};
      METRICS.forEach(function (mt) {
        var xs = g.vals.map(mt.f);
        if (!xs.length) { m[mt.key] = { mean: null, sd: null, min: null, max: null }; return; }
        var mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
        var sd = Math.sqrt(xs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / Math.max(1, xs.length - 1));
        m[mt.key] = { mean: mean, sd: sd, min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) };
      });
      return { parts: g.parts, n: g.vals.length, err: g.err, m: m };
    });
    return { rows: rows, used: used };
  }

  function sortRows(rows, key, dir) {
    return rows.slice().sort(function (x, y) {
      var a = x.m[key].mean, b = y.m[key].mean;
      if (a === null) return 1; if (b === null) return -1;
      return (a - b) * (dir || 1);
    });
  }

  function count(key, value) {
    var cs = cells(), n = 0;
    for (var i = 0; i < cs.length; i++) if (dimValue(cs[i], key) === value) n++;
    return n;
  }

  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    var s = v.toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return s.join(',');
  }

  function metric(key) { for (var i = 0; i < METRICS.length; i++) if (METRICS[i].key === key) return METRICS[i]; return METRICS[0]; }

  window.ExpData = { AX: AX, CONSTS: CONSTS, METRICS: METRICS, CH: CH, SEEDS: SEEDS, FOLDS: FOLDS,
    useRun: useRun, cells: cells, aggregate: aggregate, sortRows: sortRows, count: count, fmt: fmt, metric: metric };
})();
