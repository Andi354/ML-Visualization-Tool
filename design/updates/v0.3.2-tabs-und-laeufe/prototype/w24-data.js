// Sample widget texts for the v0.2.4 prototypes, taken from Tim's screenshot (TIM-39_grid_multivariate_30).
window.W24 = {
  run: 'TIM-39_grid_multivariate_30',
  region: {
    title: 'timeF ist in 3 von 4 Regionen am besten',
    what: [{ k: 'Metrik', v: 'test_mse_missing' }, { k: 'je', v: 'Region × time_embedding' }],
    fixed: [['attention_func', 'classic'], ['calendar_init', 'ols'], ['calendar_mode', 'future_only'], ['conv_dims', '[[7, 1, 2], [14, 1, 3], [30, 3, 4], [90, 6, 12]]'], ['encoding_size', '32'], ['glu_layer', 'True'], ['learning_rate', '0.0005'], ['lstm_layer', '0'], ['representation_module', 'single_linear']],
    agg: 'Replikate gemittelt',
    cols: ['Region', '', 'timeF', 'posEmb', 'timeF+posEmb'],
    rows: [['region_1', '0,1213', '0,0913', '0,1261', '0,0978', 2], ['region_2', '0,0618', '0,0565', '0,0618', '0,0563', 4], ['region_3', '0,0663', '0,0521', '0,0669', '0,0566', 2], ['region_4', '0,0706', '0,0506', '0,0727', '0,0577', 2]]
  },
  config: {
    combo: [['attention_func', null, true], ['calendar_init', 'ols', true], ['calendar_mode', 'future_only', true], ['conv_dims', '[[7, 1, 2], [14, 1, 3], [30, 3, 4], [90, 6, 12]]', true], ['encoding_size', '16', true], ['glu_layer', 'True', true], ['learning_rate', '0.0005', true], ['lstm_layer', '0', true], ['representation_module', 'single_linear', true], ['time_embedding', 'timeF+posEmb', true]],
    metric: 'test_mape_real', value: '3,863 %'
  }
};
