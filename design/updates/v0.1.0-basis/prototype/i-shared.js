// Shared model for the Feature I prototypes (combining widgets into one deliverable image).
// An output = one image: { id, ids: [widget ids], layout: 'stack' | 'side' | 'big' }.
window.IShared = (function () {
  var G = window.GShared;
  var ORDER = ['table', 'config', 'channel', 'effect', 'stability'];
  var WIDGETS = ORDER.map(function (k, i) { var c = G.byKey(k); return { id: 'w' + i, type: k, opts: Object.assign({}, c.opts), label: c.label }; });
  function w(id) { return WIDGETS.filter(function (x) { return x.id === id; })[0]; }
  function singles() { return WIDGETS.map(function (x, i) { return { id: 'o' + i, ids: [x.id], layout: 'stack' }; }); }
  function clean(outs) { return outs.filter(function (o) { return o.ids.length; }); }
  function without(outs, wid) { return outs.map(function (o) { return Object.assign({}, o, { ids: o.ids.filter(function (x) { return x !== wid; }) }); }); }
  // merge the given widgets into the output of the first one, in list order
  function combine(outs, wids) {
    var first = outs.filter(function (o) { return o.ids.some(function (x) { return wids.indexOf(x) >= 0; }); })[0];
    var all = [];
    outs.forEach(function (o) { o.ids.forEach(function (x) { if (wids.indexOf(x) >= 0) all.push(x); }); });
    var res = outs.map(function (o) { return o === first ? Object.assign({}, o, { ids: all }) : Object.assign({}, o, { ids: o.ids.filter(function (x) { return wids.indexOf(x) < 0; }) }); });
    return clean(res);
  }
  function split(outs, oid) {
    var res = [];
    outs.forEach(function (o) { if (o.id !== oid || o.ids.length < 2) res.push(o); else o.ids.forEach(function (x, i) { res.push({ id: o.id + '_' + i, ids: [x], layout: 'stack' }); }); });
    return res;
  }
  function moveInto(outs, wid, oid) {
    var res = without(outs, wid).map(function (o) { return o.id === oid ? Object.assign({}, o, { ids: o.ids.concat(wid) }) : o; });
    return clean(res);
  }
  function detach(outs, wid) {
    var at = 0; outs.forEach(function (o, i) { if (o.ids.indexOf(wid) >= 0) at = i; });
    var res = clean(without(outs, wid));
    res.splice(Math.min(at + 1, res.length), 0, { id: 'o' + Date.now(), ids: [wid], layout: 'stack' });
    return res;
  }
  function reorder(outs, oid, wid, dir) {
    return outs.map(function (o) {
      if (o.id !== oid) return o;
      var ids = o.ids.slice(), i = ids.indexOf(wid), j = i + dir;
      if (j < 0 || j >= ids.length) return o;
      ids[i] = ids[j]; ids[j] = wid; return Object.assign({}, o, { ids: ids });
    });
  }
  function setLayout(outs, oid, layout) { return outs.map(function (o) { return o.id === oid ? Object.assign({}, o, { layout: layout }) : o; }); }
  function defaultName(o, i) { return String(i + 1).padStart(2, '0') + '_' + o.ids.map(function (x) { return w(x).type; }).join('+') + '.png'; }
  function defaultTitle(o) { return o.ids.length > 1 ? o.ids.map(function (x) { return w(x).label; }).join(' und ') : ''; }
  return { WIDGETS: WIDGETS, w: w, singles: singles, combine: combine, split: split, moveInto: moveInto, detach: detach, reorder: reorder, setLayout: setLayout, defaultName: defaultName, defaultTitle: defaultTitle };
})();
