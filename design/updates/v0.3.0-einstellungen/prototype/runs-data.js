// Sample runs and Linear issues for the Feature C prototypes (data only, no UI).
// Issue titles and statuses from Linear (project Snowflake REP-Net, 14.10.); run numbers are made up.
(function () {
  var TODAY = new Date('2026-10-14T16:00:00');
  var ISSUES = {
    'TIM-52': { title: 'Research — Beste REP-Net-Config für den Modellvergleich bei pred_len 30 und 90 zusammenführen', status: 'In Progress' },
    'TIM-49': { title: 'Research — REP-Net bei pred_len 90 gegen ETS aufholen', status: 'In Review' },
    'TIM-67': { title: 'Results — Ansicht: MLflow vs. eigenes Dashboard vergleichen', status: 'Committed' },
    'TIM-48': { title: 'Research — Hält die REP-Net-Implementierung LSTM, Attention und Time-Embedding zurück?', status: 'In Review' },
    'TIM-45': { title: 'Experiment — G6: Einzelgewinne aus TIM-44 kombiniert testen', status: 'In Review', analysis: 'analysis/TIM-45_g6_combined/', deliverable: 'deliverables/2026-09-29 More Parameter Combinations/' },
    'TIM-44': { title: 'Experiment — Kleine Grids G1–G5 auf fixer Basis-Config', status: 'In Review', analysis: 'analysis/TIM-44_small_grids/' },
    'TIM-39': { title: 'Grid Search mit fehlenden Konfigurationen', status: 'Todo' },
    'TIM-37': { title: 'Training — Early Stopping und Kapazität bei langen Horizonten prüfen', status: 'In Progress' },
    'TIM-23': { title: 'Horizontvergleich - pred_len 30 vs. pred_len 90', status: 'Done', analysis: 'analysis/TIM-23_horizon/' },
    'TIM-22': { title: 'Großes Experiment', status: 'Done', deliverable: 'deliverables/2026-09-22 Comparison Experiment/' }
  };
  // id, issue, cells, err, best MAPE % (real), horizon, axes, flags, extras
  var RUNS = [
    { id: '2026-10-14_0912_TIM-52_best_combined_90', issue: 'TIM-52', cells: 2592, done: 1204, err: 3, best: 5.82, h: 90, axes: ['forecaster', 'lstm_layer', 'lr_epochs'], ch: true, curves: true, pred: true, running: true },
    { id: '2026-10-13_1830_TIM-52_best_combined_30', issue: 'TIM-52', cells: 864, err: 0, best: 3.97, h: 30, axes: ['forecaster', 'lstm_layer', 'lr_epochs'], ch: true, curves: true, pred: true },
    { id: '2026-10-09_1422_TIM-49_ets_gap_90', issue: 'TIM-49', cells: 1440, err: 12, best: 6.31, h: 90, axes: ['season_len', 'loss_function_forecasting', 'lr_epochs'], ch: true, curves: true, pred: true },
    { id: '2026-10-08_2105_TIM-49_ets_gap_90', issue: 'TIM-49', cells: 1440, err: 210, best: 6.48, h: 90, axes: ['season_len', 'loss_function_forecasting', 'lr_epochs'], ch: true, curves: true, pred: false },
    { id: '2026-10-06_0030_TIM-67_curve_run', issue: 'TIM-67', cells: 4, err: 0, best: 4.24, h: 30, axes: ['encoding_size', 'lstm_layer'], ch: true, curves: true, pred: true },
    { id: '2026-09-28_195436_TIM-48_49_best_30', issue: 'TIM-48', cells: 25, err: 0, best: 4.12, h: 30, axes: ['forecaster'], ch: true, migrated: true },
    { id: '2026-09-28_144008_TIM-45_g6_combined', issue: 'TIM-45', cells: 54, err: 0, best: 4.21, h: 30, axes: ['encoding_size', 'lstm_layer', 'lr_epochs'], ch: true, migrated: true },
    { id: '2026-09-26_1012_TIM-44_g5_revin', issue: 'TIM-44', cells: 216, err: 0, best: 4.35, h: 30, axes: ['revin', 'revin_affine'], ch: true, migrated: true },
    { id: '2026-09-26_0844_TIM-44_g4_calendar', issue: 'TIM-44', cells: 324, err: 0, best: 4.29, h: 30, axes: ['calendar_mode', 'time_embedding'], ch: true, migrated: true },
    { id: '2026-09-25_1730_TIM-44_g3_capacity', issue: 'TIM-44', cells: 432, err: 0, best: 4.40, h: 30, axes: ['encoding_size', 'conv_dims', 'lstm_layer'], ch: true, migrated: true },
    { id: '2026-09-24_130216_TIM-39_grid_multivariate_30', issue: 'TIM-39', cells: 222264, err: 31752, best: 4.18, h: 30, axes: ['conv_dims', 'representation_module', 'lstm_layer', 'time_embedding', 'encoding_size', 'lr_epochs'], ch: true, migrated: true, sizeMb: 68 },
    { id: '2026-09-23_1600_TIM-37_early_stopping_90', issue: 'TIM-37', cells: 96, err: 0, best: 6.92, h: 90, axes: ['patience', 'max_epochs'], ch: true, migrated: true },
    { id: '2026-09-21_142630_cv_shavedice_ablation_multivariate', issue: null, cells: 5184, err: 0, best: 4.55, h: 30, axes: ['revin', 'time_embedding', 'lstm_layer', 'calendar_mode'], ch: true, migrated: true, folds: true },
    { id: '2026-09-19_1105_TIM-23_horizon_30_90', issue: 'TIM-23', cells: 180, err: 0, best: 4.62, h: 30, axes: ['pred_len', 'forecaster'], ch: true, migrated: true, epoch: 'tsrm6' },
    { id: '2026-09-15_0930_TIM-22_big_grid', issue: 'TIM-22', cells: 12960, err: 1100, best: 4.71, h: 30, axes: ['lstm_layer', 'encoding_size', 'conv_dims', 'time_embedding', 'revin'], ch: true, migrated: true, epoch: 'tsrm6' },
    { id: '2026-09-12_1400_cv_shavedice_revin', issue: null, cells: 288, err: 0, best: 4.95, h: 30, axes: ['revin', 'revin_affine'], ch: false, migrated: true, epoch: 'tsrm6' }
  ];
  RUNS.forEach(function (r) {
    var m = r.id.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})\d*_(.*)$/);
    r.date = new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00');
    r.exp = m[6];
    r.epoch = r.epoch || 'eval-all-windows';
    r.ok = (r.running ? r.done : r.cells) - r.err;
  });

  function rel(d) {
    var days = Math.floor((TODAY - d) / 86400000);
    if (days <= 0) return 'heute ' + d.toTimeString().slice(0, 5);
    if (days === 1) return 'gestern';
    if (days < 7) return 'vor ' + days + ' Tagen';
    return d.getDate() + '.' + (d.getMonth() + 1) + '.';
  }
  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    var s = v.toFixed(d || 0).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return s.join(',');
  }
  // groups: [{key, issue, runs (newest first), experiments: [{exp, runs}], last}]
  function groups() {
    var map = {}, order = [];
    RUNS.slice().sort(function (a, b) { return b.date - a.date; }).forEach(function (r) {
      var k = r.issue || '—';
      if (!map[k]) { map[k] = { key: k, issue: r.issue ? ISSUES[r.issue] : null, runs: [], experiments: [], last: r.date }; order.push(k); }
      var g = map[k];
      g.runs.push(r);
      var e = g.experiments.filter(function (x) { return x.exp === r.exp; })[0];
      if (!e) { e = { exp: r.exp, runs: [] }; g.experiments.push(e); }
      e.runs.push(r);
    });
    var out = order.map(function (k) { return map[k]; });
    // runs without issue last
    return out.filter(function (g) { return g.issue; }).concat(out.filter(function (g) { return !g.issue; }));
  }

  window.RunsData = { TODAY: TODAY, ISSUES: ISSUES, RUNS: RUNS, rel: rel, fmt: fmt, groups: groups };
})();
