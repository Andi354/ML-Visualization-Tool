// Sample resolved config of one combination for the Feature J prototypes (config view).
// sweep = all values of the axis in this run (the combination's value is `v`); rep = replicate key;
// base = differs from configs/base.yaml (the value base has is given).
window.CfgData = {
  file: 'configs/experiments/TIM-52/TIM-52_best_combined_30.yaml',
  blocks: [
    { block: 'data', entries: [
      { k: 'dataset', v: 'shavedice_daily' }, { k: 'features', v: 'M' }, { k: 'target', v: 'vm_usage' },
      { k: 'seq_len', v: '90', base: '120' }, { k: 'pred_len', v: '30' }, { k: 'channels', v: '[us, de, uk, jp]' },
      { k: 'scale', v: 'standard' }, { k: 'test_quarters', v: '3' }, { k: 'calendar_mode', v: 'future_only' }, { k: 'FrAug', v: 'mask 0.1', base: 'aus' }
    ] },
    { block: 'model', entries: [
      { k: 'forecaster', v: 'repnet' }, { k: 'lstm_layer', v: '2', sweep: ['1', '2', '3'] }, { k: 'time_embedding', v: 'learned', sweep: ['sin', 'learned', 'none'] },
      { k: 'conv_dims', v: '[[7,1,2],[14,1,3],[30,3,4],[90,6,12]]', sweep: ['[32]', '[64]', '[[7,1,2],[14,1,3],[30,3,4],[90,6,12]]'] },
      { k: 'encoding_size', v: '16' }, { k: 'representation_module', v: 'single_linear' }, { k: 'time_embedding_reduce_dims', v: 'token' },
      { k: 'output_basis', v: 'pw' }, { k: 'trend_norm', v: 'linear' }, { k: 'trend_damping', v: '0.9', base: '0.97' }, { k: 'revin', v: 'true' }, { k: 'calendar_init', v: 'ols' }
    ] },
    { block: 'train', entries: [
      { k: 'learning_rate', v: '5e-4', sweep: ['5e-4', '1e-4'], pair: 'lr_epochs' }, { k: 'max_epochs', v: '20', sweep: ['20', '60'], pair: 'lr_epochs' },
      { k: 'batch_size', v: '32' }, { k: 'patience', v: '5' }, { k: 'loss_function_forecasting', v: 'mse' }, { k: 'min_vali_windows', v: '10' }, { k: 'optimizer', v: 'adam' }
    ] },
    { block: 'replicates', entries: [
      { k: 'shuffle_seed', v: '[7, 42, 123, 777, 2024]', rep: true }, { k: 'cv_fold', v: '[0, 1, 2, 3]', rep: true }
    ] },
    { block: 'run', entries: [
      { k: 'epoch', v: 'eval-all-windows' }, { k: 'calc_per_channel', v: 'true' }, { k: 'save_curves', v: 'true' }, { k: 'save_predictions', v: 'true' }, { k: 'device', v: 'cuda' }
    ] }
  ]
};
