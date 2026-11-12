import { el, fmt, setVars, emblem, isPreview } from '../lib.js';

const DEMO = { name: 'Rocket League', pseudo: 'hezy', modes: [{ id: '2v2', name: '2v2', label: 'Champion II', color: '#B77BFF', level: 2, mmr: 1168, target: 1195, progress: 97, nextLabel: 'Champion III', bestLabel: 'Grand Champion I', image: '' }, { id: '3v3', name: '3v3', label: 'Diamant III', color: '#57B8FF', level: 1, mmr: 992, target: 1075, progress: 92, nextLabel: 'Champion I', bestLabel: '', image: '' }], stats: [{ key: 'wins', label: 'Victoires', value: 8 }, { key: 'losses', label: 'Défaites', value: 3 }] };

export function mount(root) {
  let s = {};
  let g = null;
  const box = el('div', 'gc scaled');
  root.append(box);
  const render = () => {
    const d = g || (isPreview ? DEMO : null);
    box.textContent = '';
    if (!d) return;
    box.classList.toggle('col', s.layout === 'colonne');
    const head = el('div', 'gc-head');
    head.append(el('b', '', d.name));
    if (d.pseudo) head.append(el('span', '', d.pseudo));
    box.append(head);
    const list = el('div', 'gc-modes');
    for (const m of d.modes.slice(0, 3)) {
      const row = el('div', 'gc-mode');
      row.style.setProperty('--r', m.color);
      row.append(emblem(m, 58, m.image));
      const txt = el('div', 'gc-txt');
      txt.append(el('span', 'gc-name', m.name), el('b', '', m.label));
      if (s.showMmr && m.mmr) txt.append(el('span', 'gc-mmr', `${fmt(m.mmr)} ${d.metric || ''}`.trim()));
      if (s.showBest && m.bestLabel) txt.append(el('span', 'gc-best', `Record : ${m.bestLabel}`));
      if (s.showNext && m.target > 0) {
        const bar = el('div', 'gc-bar');
        const f = el('i');
        f.style.width = `${m.progress}%`;
        bar.append(f);
        txt.append(bar);
        if (m.nextLabel) txt.append(el('span', 'gc-best', `Vers ${m.nextLabel}`));
      }
      row.append(txt);
      list.append(row);
    }
    box.append(list);
    if (s.showStats && d.stats.length) {
      const st = el('div', 'gc-stats');
      for (const x of d.stats.slice(0, 5)) { const c = el('span'); c.append(el('b', '', fmt(x.value)), el('i', '', x.label)); st.append(c); }
      box.append(st);
    }
  };
  return {
    update(settings, data) { s = settings; setVars(root, { bg: s.bg, text: s.text }); if (data?.game) g = data.game; render(); },
    on(msg) { if (msg.t === 'game') { g = msg.game; render(); } },
  };
}
