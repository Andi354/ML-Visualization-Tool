// Sample data for the Feature G (one-run analysis) prototypes: a model-comparison run of TIM-52.
// Axes forecaster × pred_len × features, 5 seeds × 4 folds, 4 regions. Numbers are made up,
// in the range of Tim's deliverable table (14.10.).
(function () {
  var RUN = { id: '2026-10-12_1015_TIM-52_model_comparison', issue: 'TIM-52', date: '12.10.2026', epoch: 'eval-all-windows', commit: 'e70b4d1' };
  var DIMS = [
    { key: 'forecaster', label: 'forecaster', values: ['REP-Net', 'SARIMA', 'ETS', 'ETS gedämpft', 'Prophet', 'sNaive'] },
    { key: 'pred_len', label: 'pred_len', values: ['30', '90'] },
    { key: 'features', label: 'features', values: ['M', 'S'], names: { M: 'multivariat', S: 'univariat' } },
    { key: 'channel', label: 'Region', values: ['region_1', 'region_2', 'region_3', 'region_4'] }
  ];
  var METRICS = [
    { key: 'mape', label: 'MAPE (%)', d: 2 },
    { key: 'cc', label: 'Commitment Cost', d: 0 }
  ];
  // base MAPE / CC per forecaster and pred_len (features = M)
  var BASE = {
    'REP-Net': [[4.02, 1926], [4.66, 2034]], 'SARIMA': [[4.36, 1931], [5.0, 2074]], 'ETS': [[4.7, 1971], [4.73, 2031]],
    'ETS gedämpft': [[4.79, 1999], [5.7, 2195]], 'Prophet': [[6.45, 2160], [7.21, 2298]], 'sNaive': [[4.86, 1992], [5.94, 2207]]
  };
  var CH = { M: [-0.22, 0.55, -0.12, 0.05], S: [0.35, 0.02, 0.4, -0.18] };
  var STOCH = { 'REP-Net': 0.035, 'Prophet': 0.01 };
  function frac(x) { var r = Math.sin(x * 12.9898) * 43758.5453; return r - Math.floor(r); }

  var cells = [];
  DIMS[0].values.forEach(function (f, fi) {
    DIMS[1].values.forEach(function (h, hi) {
      DIMS[2].values.forEach(function (ft, ti) {
        for (var s = 0; s < 5; s++) for (var k = 0; k < 4; k++) {
          var seedN = (STOCH[f] || 0) * (frac(fi * 31 + hi * 7 + ti * 3 + s * 1.7) - 0.5) * 2;
          var foldN = (frac(fi * 11 + hi * 5 + ti + k * 2.3) - 0.5) * 0.06;
          var b = BASE[f][hi], fs = ft === 'S' ? 1.06 : 1;
          var ch = {};
          DIMS[3].values.forEach(function (c, ci) { ch[c] = b[0] * fs * (1 + CH[ft][ci] * (f === 'REP-Net' ? 1 : 0.6) + seedN + foldN); });
          var mape = (ch.region_1 + ch.region_2 + ch.region_3 + ch.region_4) / 4;
          cells.push({ forecaster: f, pred_len: h, features: ft, seed: s, fold: k, ch: ch, m: { mape: mape, cc: b[1] * fs * (1 + (mape / (b[0] * fs) - 1) * 0.3) } });
        }
      });
    });
  });

  // mean/sd of a metric over cells matching `filter`, optionally for one channel (MAPE only)
  function stat(filter, metric, channel) {
    var xs = cells.filter(function (c) { for (var k in filter) if (c[k] !== filter[k]) return false; return true; })
      .map(function (c) { return channel && metric === 'mape' ? c.ch[channel] : c.m[metric]; });
    var mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    var sd = Math.sqrt(xs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / Math.max(1, xs.length - 1));
    return { mean: mean, sd: sd, n: xs.length, xs: xs };
  }
  function dim(key) { for (var i = 0; i < DIMS.length; i++) if (DIMS[i].key === key) return DIMS[i]; return null; }
  function metric(key) { for (var i = 0; i < METRICS.length; i++) if (METRICS[i].key === key) return METRICS[i]; return METRICS[0]; }
  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    var s = Math.abs(v).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (v < 0 ? '−' : '') + s.join(',');
  }
  // best REP-Net config, values that differ per pred_len written as "a (30) / b (90)"
  var CONFIG = [
    ['seq_len', '90 (30) / 120 (90)', 1], ['trend_damping', '0.9 (30) / 0.97 (90)', 1], ['features', 'M'], ['output_basis', 'pw'],
    ['encoding_size', '16'], ['FrAug', 'mask 0.1 (30) / aus (90)', 1], ['conv_dims', '[[7,1,2],[14,1,3],[30,3,4],[90,6,12]]'], ['revin', 'an'],
    ['lstm_layer', '0'], ['calendar_mode', 'future_only'], ['representation_module', 'single_linear'], ['calendar_init', 'ols'],
    ['time_embedding', 'timeF+posEmb'], ['learning_rate', '5e-4 (30) / 2.5e-4 (90)', 1], ['time_embedding_reduce_dims', 'token (30) / window (90)', 1], ['min_vali_windows', '10']
  ];
  window.OneData = { RUN: RUN, DIMS: DIMS, METRICS: METRICS, cells: cells, stat: stat, dim: dim, metric: metric, fmt: fmt, CONFIG: CONFIG };
})();
