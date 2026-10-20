// Shared state and values for the frame studies B1–B3. Each B file only differs in markup.
window.Frame = (function () {
  const RUN = '2026-10-14_0900_BEISPIEL_grid';
  const RUN2 = '2026-10-13_1830_TIM-52_best_combined_30';
  const PAGES = {
    runs: { label: 'Läufe', src: 'F-Runs.dc.html' },
    issues: { label: 'Läufe', src: 'F-Issues.dc.html' },
    cmp: { label: 'Vergleich', soon: 'Vergleich · kommt mit Block E' },
    del: { label: 'Deliverables', soon: 'Deliverables · kommt mit Block G' }
  };
  const COMMANDS = [
    { k: 'Lauf', t: RUN, go: { view: 'exp', run: RUN } },
    { k: 'Lauf', t: RUN2, go: { view: 'exp', run: RUN2 } },
    { k: 'Issue', t: 'TIM-52 · Bestes kombiniertes Modell', go: { view: 'issues' } },
    { k: 'Ansicht', t: 'Läufe · Liste', go: { view: 'runs' } },
    { k: 'Ansicht', t: 'Läufe · Issues', go: { view: 'issues' } },
    { k: 'Ansicht', t: 'Vergleich', go: { view: 'cmp' } },
    { k: 'Ansicht', t: 'Deliverables', go: { view: 'del' } },
    { k: 'Agent', t: 'Agent öffnen', go: { agent: true } }
  ];
  const btn = (on) => "font: 500 12px 'IBM Plex Sans', sans-serif; cursor: pointer; border-radius: 8px; padding: 5px 10px; border: 1px solid " + (on ? '#3A4166' : 'transparent') + '; background: ' + (on ? '#262B42' : 'transparent') + '; color: ' + (on ? '#EEEEF1' : '#B0B0BA') + ';';

  function build(self) {
    const st = self.state || {};
    const set = (p) => self.setState(p);
    const view = st.view || 'runs';
    const tabs = st.tabs || [RUN];
    const run = st.run || RUN;
    const area = view === 'runs' || view === 'issues' ? 'runs' : view;
    const open = (go) => {
      const p = Object.assign({ palette: false, pq: '' }, go);
      if (go.run && tabs.indexOf(go.run) < 0) p.tabs = tabs.concat(go.run);
      set(p);
    };
    const page = view === 'exp' ? { src: 'F-Exp.dc.html#' + encodeURIComponent(run) } : PAGES[view];
    const nav = (key, label, icon) => ({
      label, icon, active: area === key,
      st: btn(area === key), on: () => open({ view: key === 'runs' ? 'runs' : key })
    });
    const pq = (st.pq || '').toLowerCase();
    return {
      isRuns: view === 'runs', isIssues: view === 'issues', isExp: view === 'exp',
      openRunId: (id) => open({ view: 'exp', run: id }),
      setView: (v) => open({ view: v, lastRunsView: v }),
      src: page.src || '', hasSrc: !!page.src, soon: page.soon || '', isSoon: !!page.soon,
      inRun: view === 'exp', runName: run,
      areaLabel: (PAGES[area] || PAGES.runs).label,
      nav: [nav('runs', 'Läufe', 'L'), nav('cmp', 'Vergleich', 'V'), nav('del', 'Deliverables', 'D')],
      cmpCount: '2',
      goRuns: () => open({ view: 'runs' }),
      // B2: icon bar
      rail: [nav('runs', 'Läufe'), nav('cmp', 'Vergleich'), nav('del', 'Deliverables')].map((n) => Object.assign(n, {
        st: 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 12px; border: 1px solid ' + (n.active ? '#3A4166' : 'transparent') + '; background: ' + (n.active ? '#262B42' : 'transparent') + '; color: ' + (n.active ? '#8AA4FF' : '#7C7C87') + ';',
        isRuns: n.label === 'Läufe', isCmp: n.label === 'Vergleich', isDel: n.label === 'Deliverables'
      })),
      // open runs as tabs (B2)
      tabs: [{ id: '', label: area === 'runs' ? 'Läufe' : (PAGES[area] || PAGES.runs).label, active: view !== 'exp', pinned: true }]
        .concat(tabs.map((id) => ({ id, label: id.slice(16) || id, active: view === 'exp' && run === id, pinned: false })))
        .map((t) => ({
          label: t.label, pinned: t.pinned, closable: !t.pinned, title: t.id || t.label,
          st: "display: flex; align-items: center; gap: 8px; height: 100%; padding: 0 14px; cursor: pointer; font: 400 12px " + (t.pinned ? "'IBM Plex Sans'" : "'IBM Plex Mono'") + ", monospace; border: 0; border-right: 1px solid #2E2E35; border-top: 2px solid " + (t.active ? '#8AA4FF' : 'transparent') + '; background: ' + (t.active ? '#131315' : 'transparent') + '; color: ' + (t.active ? '#EEEEF1' : '#7C7C87') + ';',
          on: () => (t.pinned ? set({ view: area === 'runs' ? (st.lastRunsView || 'runs') : area }) : set({ view: 'exp', run: t.id })),
          close: (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            const rest = tabs.filter((x) => x !== t.id);
            set({ tabs: rest, view: run === t.id && view === 'exp' ? 'runs' : view, run: rest[rest.length - 1] || RUN });
          }
        })),
      // agent panel (all variants)
      agent: !!st.agent,
      agentSt: btn(!!st.agent),
      toggleAgent: () => set({ agent: !st.agent }),
      agentMsgs: [
        { who: 'Du', t: 'Welche lstm_layer-Einstellung ist über alle Seeds am stabilsten?' },
        { who: 'Agent', t: 'Platzhalter für Block H. Der Agent sieht die aktuelle Ansicht (Lauf, Filter, Gruppierung) als Kontext.' }
      ],
      // B3: command palette
      palette: !!st.palette,
      openPalette: () => set({ palette: true, pq: '' }),
      closePalette: () => set({ palette: false }),
      pq: st.pq || '',
      onPq: (e) => set({ pq: e.target.value }),
      cmds: COMMANDS.filter((c) => !pq || (c.k + ' ' + c.t).toLowerCase().indexOf(pq) >= 0).map((c) => ({
        k: c.k, t: c.t, on: () => open(c.go)
      })),
      topTabs: [nav('runs', 'Läufe'), nav('cmp', 'Vergleich'), nav('del', 'Deliverables')].map((n) => Object.assign(n, {
        st: "height: 100%; padding: 0 14px; cursor: pointer; font: 500 13px 'IBM Plex Sans', sans-serif; background: transparent; border: 0; border-bottom: 2px solid " + (n.active ? '#8AA4FF' : 'transparent') + '; color: ' + (n.active ? '#EEEEF1' : '#7C7C87') + ';'
      })),
      openRun: () => open({ view: 'exp', run: RUN }),
      // keep frame state in sync when a link inside the content page navigates
      onFrameLoad: (e) => {
        let path = '', hash = '';
        try { path = e.target.contentWindow.location.pathname; hash = decodeURIComponent(e.target.contentWindow.location.hash.slice(1)).replace(/^↳ /, ''); } catch (err) { return; }
        const v = /F-Exp/.test(path) ? 'exp' : /F-Issues/.test(path) ? 'issues' : /F-Runs/.test(path) ? 'runs' : null;
        const id = hash || RUN;
        if (v === 'exp' && (view !== 'exp' || run !== id)) open({ view: v, run: id });
        else if (v && v !== 'exp' && v !== view) open({ view: v, lastRunsView: v });
      }
    };
  }
  return { build };
})();
