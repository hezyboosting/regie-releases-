import { el, svg, fmt, setVars, isPreview } from '../lib.js';

export function mount(root) {
  let s = {};
  let goals = [];
  const box = el('div', 'goal scaled');
  root.append(box);
  let builtFor = '';
  let refs = {};

  const build = () => {
    box.textContent = '';
    refs = {};
    const head = el('div', 'goal-head');
    refs.title = el('span');
    refs.num = el('span', 'goal-num');
    head.append(refs.title, refs.num);
    if (s.theme === 'anneau') {
      const w = el('div', 'ring-wrap');
      const c = svg('svg', { viewBox: '0 0 110 110' });
      svg('circle', { class: 'tr', cx: 55, cy: 55, r: 47 }, c);
      refs.ring = svg('circle', { class: 'fg', cx: 55, cy: 55, r: 47, 'stroke-dasharray': 295.3, 'stroke-dashoffset': 295.3 }, c);
      const txt = el('div', 'ring-txt');
      txt.append(refs.title, el('br'), refs.num);
      w.append(c, txt);
      box.append(w);
    } else if (s.theme === 'pile') {
      refs.chips = el('div', 'chips');
      for (let i = 0; i < 20; i += 1) refs.chips.append(el('i', 'chip'));
      box.append(head, refs.chips);
    } else if (s.theme === 'vu') {
      refs.vu = el('div', 'vu-goal');
      for (let i = 0; i < 40; i += 1) { const b = el('i', i >= 34 ? 'hot' : ''); b.style.height = `${28 + i * 1.8}%`; refs.vu.append(b); }
      box.append(head, refs.vu);
    } else {
      const rail = el('div', 'goal-rail');
      refs.fill = el('div', 'goal-fill');
      rail.append(refs.fill);
      for (const p of [25, 50, 75]) { const t = el('i', 'goal-tick'); t.style.left = `${p}%`; rail.append(t); }
      box.append(head, rail);
    }
    builtFor = s.theme;
  };

  const render = () => {
    let g = goals.find((x) => x.id === s.goalId) || goals[0];
    if (!g && isPreview) g = { title: 'Objectif de followers', current: 64, target: 100 };
    box.hidden = !g;
    if (!g) return;
    if (builtFor !== s.theme) build();
    const pct = Math.min(100, (g.current / Math.max(1, g.target)) * 100);
    refs.title.textContent = g.title;
    refs.num.textContent = s.showNumbers ? `${fmt(g.current)} / ${fmt(g.target)}` : `${Math.round(pct)} %`;
    box.classList.toggle('done', pct >= 100);
    if (refs.fill) refs.fill.style.width = `${pct}%`;
    if (refs.ring) refs.ring.setAttribute('stroke-dashoffset', 295.3 * (1 - pct / 100));
    if (refs.chips) [...refs.chips.children].forEach((c, i) => c.classList.toggle('on', i < Math.round(pct / 5)));
    if (refs.vu) [...refs.vu.children].forEach((c, i) => c.classList.toggle('on', i < Math.round(pct / 2.5)));
  };

  return {
    update(settings, data) {
      s = settings;
      setVars(root, { accent: s.accent, track: s.track, text: s.text });
      if (data?.goals) goals = data.goals;
      render();
    },
    on(msg) { if (msg.t === 'goals') { goals = msg.goals; render(); } },
  };
}
