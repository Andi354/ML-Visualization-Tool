// Sample curves, predictions and replicate values for the Feature F (detail) prototypes.
// Everything is derived from a combination key so different rows look different. Numbers are made up.
(function () {
  function hash(t) { var h = 0; t = String(t || ''); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h); }
  function frac(x) { var r = Math.sin(x * 12.9898) * 43758.5453; return r - Math.floor(r); }
  var SEEDS = ['7', '42', '123', '777', '2024'], FOLDS = ['0', '1', '2', '3'];
  var REGIONS = ['us', 'de', 'uk', 'jp'];

  // MAPE per seed × fold around the row mean
  function replicates(key, mean, sd) {
    var k = hash(key);
    return SEEDS.map(function (s, si) {
      return FOLDS.map(function (f, fi) { return mean + sd * ((frac(k + si * 7 + fi * 3) - 0.5) * 2.4 + (fi - 1.5) * 0.25); });
    });
  }

  // train/val loss per seed; early stopping at the epoch with the lowest mean val loss
  function curves(key) {
    var k = hash(key), E = 40 + (k % 3) * 10, runs = [];
    for (var s = 0; s < 5; s++) {
      var tau = 6 + frac(k + s) * 3, base = 0.18 + frac(k * 3 + s) * 0.03, over = 0.0009 + frac(k + s * 5) * 0.0006;
      var tr = [], va = [];
      for (var e = 0; e < E; e++) {
        var n = (frac(k + s * 13 + e * 1.7) - 0.5) * 0.012;
        tr.push(base * 0.85 + 0.6 * Math.exp(-e / tau) + n * 0.6);
        va.push(base + 0.55 * Math.exp(-e / (tau * 1.1)) + Math.max(0, e - 18) * over + n);
      }
      runs.push({ train: tr, val: va });
    }
    var mean = function (key2) { var out = []; for (var e = 0; e < E; e++) { var t = 0; runs.forEach(function (r) { t += r[key2][e]; }); out.push(t / runs.length); } return out; };
    var mt = mean('train'), mv = mean('val'), best = 0;
    mv.forEach(function (v, i) { if (v < mv[best]) best = i; });
    return { epochs: E, runs: runs, train: mt, val: mv, best: best };
  }

  // test period = 3 quarters of daily values; a forecast window is pred_len (30) days starting anywhere in it
  var TEST = [];
  (function () { var d = new Date('2023-04-03T12:00:00'); while (d < new Date('2024-01-01T00:00:00')) { TEST.push(new Date(d)); d.setDate(d.getDate() + 1); } })();
  var HOL = { '5-29': 1, '7-4': 1, '9-4': 1, '11-23': 1, '11-24': 1, '12-25': 1, '12-26': 1 };
  var actualCache = {};
  function actualSeries(region) {
    if (actualCache[region]) return actualCache[region];
    var ri = REGIONS.indexOf(region), scale = [1, 0.62, 0.48, 0.71][ri < 0 ? 0 : ri], k = hash(region);
    var out = TEST.map(function (d, i) {
      var wd = d.getDay(), weekend = wd === 0 || wd === 6, hol = HOL[(d.getMonth() + 1) + '-' + d.getDate()];
      var lvl = (weekend ? 14000 : 18600 + Math.sin(i / 5) * 400) * scale * (1 + i / TEST.length * 0.08);
      return lvl * (hol ? 0.82 : 1) * (i > TEST.length - 7 ? 0.93 : 1) * (1 + (frac(k + i) - 0.5) * 0.03);
    });
    actualCache[region] = out;
    return out;
  }
  function modelSeries(key, region, act) {
    var k = hash(key + region);
    return act.map(function (a, i) {
      var d = TEST[i], hol = HOL[(d.getMonth() + 1) + '-' + d.getDate()];
      return a * (1 + (frac(k * 2 + i) - 0.5) * 0.05 + (hol ? 0.09 : 0.012));
    });
  }
  // start = index of the first day of the window (default: last window); cmpKey = combination to compare
  function forecast(key, region, start, cmpKey, len) {
    len = len || 30;
    var act = actualSeries(region), n = TEST.length, s0 = start === undefined || start === null ? n - len : Math.max(0, Math.min(n - len, start));
    var m = modelSeries(key, region, act), c = cmpKey ? modelSeries(cmpKey, region, act).map(function (v, i) { return v * (1 + 0.025 + (frac(hash(cmpKey) + i) - 0.5) * 0.02); }) : null;
    var sl = function (a) { return a.slice(s0, s0 + len); };
    return {
      days: TEST.slice(s0, s0 + len), actual: sl(act), model: sl(m), lo: sl(m).map(function (v) { return v * 0.965; }), hi: sl(m).map(function (v) { return v * 1.035; }),
      cmp: c ? sl(c) : null, start: s0, len: len, total: n, all: act, allDays: TEST
    };
  }
  window.FData = { TEST: TEST, SEEDS: SEEDS, FOLDS: FOLDS, REGIONS: REGIONS, replicates: replicates, curves: curves, forecast: forecast };
})();
