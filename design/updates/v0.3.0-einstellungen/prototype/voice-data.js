// v0.3.0 block B: sample utterance for the voice prototypes (recognition is simulated).
window.VoiceData = (function () {
  // what was said, split into plain text and recognised project terms
  var SEGS = [
    { t: 'Öffne ' },
    { term: 'TIM-52_best_combined_90', heard: 'tim 52 best combined neunzig', kind: 'Lauf', alts: ['TIM-52_best_combined_90', 'TIM-52_best_combined_30', 'TIM-52_model_comparison'] },
    { t: ' und zeig mir, wie ' },
    { term: 'lstm_layer', heard: 'lstm layer', kind: 'Achse', alts: ['lstm_layer', 'lstm_hidden'] },
    { t: ' bei ' },
    { term: 'pred_len 90', heard: 'pred len neunzig', kind: 'Lauf-Merkmal', alts: ['pred_len 90', 'pred_len 30'] },
    { t: ' abschneidet, nur mit ' },
    { term: 'conv_dims 64', heard: 'conv dims vierundsechzig', kind: 'Achse · Wert', alts: ['conv_dims 64', 'conv_dims 32', 'conv_dims 128'] },
    { t: '.' }
  ];
  var CHAT = [
    { k: 'user', t: 'Welche lstm_layer-Einstellung ist über alle Seeds am stabilsten?' },
    { k: 'agent', t: 'Im Lauf TIM-45_g6_combined ist lstm_layer 2 am stabilsten: kleinste Streuung über 5 Seeds bei fast gleichem Mittelwert wie 3.' }
  ];
  return { SEGS: SEGS, CHAT: CHAT, text: function (segs) { return segs.map(function (s) { return s.term || s.t; }).join(''); } };
})();
