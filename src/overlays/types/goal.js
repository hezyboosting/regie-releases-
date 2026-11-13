// Objectif en verre premium : titre, nombres qui défilent, barre liquide avec reflet qui court,
// tête lumineuse au bout, repères à 25, 50 et 75 %, « plus que X » et fête quand c'est atteint.
import { el, svg, fmt, setVars, isPreview, countTo, confetti } from '../lib.js';

export function mount(root) {
  let s = {};
  let goals = [];
  const box = el('div', 'goal gx scaled');
  root.append(box);
  let builtFor = '';
  let refs = {};
  let wasDone = null;
  let demoTimer = null;
  let demo = null;

  const build = () => {
    box.textContent = '';
    refs = {};
    box.dataset.theme = s.theme || 'barre';
    box.append(el('div', 'gx-shine'));
    refs.title = el('span', 'gx-label g2-title');
    refs.cur = el('b', 'gx-num g2-cur');
    refs.tgt = el('span', 'g2-tgt');
    refs.left = el('span', 'g2-left');
    refs.pct = el('b', 'g2-pct');
    const nums = el('span', 'g2-nums');
    nums.append(refs.cur, refs.tgt);
    if (s.theme === 'anneau') {
      const w = el('div', 'ring-wrap');
      const c = svg('svg', { viewBox: '0 0 120 120' });
      const defs = svg('defs', {}, c);
      defs.innerHTML = '<linearGradient id="gRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient>';
      svg('circle', { class: 'tr', cx: 60, cy: 60, r: 50 }, c);
      refs.ring = svg('circle', { class: 'fg', cx: 60, cy: 60, r: 50, 'stroke-dasharray': 314.2, 'stroke-dashoffset': 314.2, stroke: 'url(#gRing)' }, c);
      const mid = el('div', 'ring-mid');
      mid.append(refs.pct);
      w.append(c, mid);
      const side = el('div', 'ring-side');
      side.append(refs.title, nums, refs.left);
      box.append(w, side);
    } else {
      const head = el('div', 'g2-head');
      head.append(refs.title, nums);
      box.append(head);
      if (s.theme === 'pile') {
        refs.chips = el('div', 'chips');
        for (let i = 0; i < 20; i += 1) refs.chips.append(el('i', 'chip'));
        box.append(refs.chips);
      } else if (s.theme === 'vu') {
        refs.vu = el('div', 'vu-goal');
        for (let i = 0; i < 40; i += 1) { const b = el('i', i >= 34 ? 'hot' : ''); b.style.height = `${28 + i * 1.8}%`; refs.vu.append(b); }
        box.append(refs.vu);
      } else {
        const rail = el('div', 'g2-rail');
        refs.fill = el('div', 'g2-fill');
        refs.fill.append(el('i', 'g2-flow'), el('i', 'g2-tip'));
        rail.append(refs.fill);
        for (const p of [25, 50, 75]) { const t = el('i', 'g2-tick'); t.style.left = `${p}%`; rail.append(t); }
        box.append(rail);
      }
      const foot = el('div', 'g2-foot');
      foot.append(refs.left, refs.pct);
      box.append(foot);
    }
    builtFor = s.theme;
  };

  const render = () => {
    let g = goals.find((x) => x.id === s.goalId) || goals[0];
    if (!g && isPreview) g = demo || (demo = { title: 'Objectif d\'abonnés', current: 64, target: 100 });
    box.hidden = !g;
    if (!g) return;
    if (builtFor !== s.theme || !refs.title) build();
    const pct = Math.min(100, (g.current / Math.max(1, g.target)) * 100);
    const done = pct >= 100;
    refs.title.textContent = g.title;
    countTo(refs.cur, g.current);
    refs.tgt.textContent = s.showNumbers !== false ? `/ ${fmt(g.target)}` : '';
    refs.cur.hidden = s.showNumbers === false;
    refs.pct.textContent = `${Math.floor(pct)} %`;
    refs.left.textContent = done ? 'Objectif atteint !' : `Encore ${fmt(Math.max(0, g.target - g.current))}`;
    box.classList.toggle('done', done);
    if (refs.fill) refs.fill.style.width = `${Math.max(2, pct)}%`;
    if (refs.ring) refs.ring.setAttribute('stroke-dashoffset', 314.2 * (1 - pct / 100));
    if (refs.chips) [...refs.chips.children].forEach((c, i) => c.classList.toggle('on', i < Math.round(pct / 5)));
    if (refs.vu) [...refs.vu.children].forEach((c, i) => c.classList.toggle('on', i < Math.round(pct / 2.5)));
    if (done && wasDone === false) confetti([s.accent || '#8FD3FF', '#FFFFFF', '#F3D38A'], 160);
    wasDone = done;
  };

  // Aperçu : l'objectif avance tout seul pour montrer l'animation.
  function demoLoop() {
    clearInterval(demoTimer);
    if (!isPreview || goals.length) return;
    demoTimer = setInterval(() => {
      demo = demo || { title: 'Objectif d\'abonnés', current: 64, target: 100 };
      demo.current = demo.current >= 100 ? 58 : demo.current + 1 + Math.floor(Math.random() * 4);
      render();
    }, 1400);
  }

  return {
    update(settings, data) {
      s = settings;
      setVars(root, { accent: s.accent, track: s.track, text: s.text });
      if (data?.goals) goals = data.goals;
      builtFor = '';
      render();
      demoLoop();
    },
    on(msg) { if (msg.t === 'goals') { goals = msg.goals; clearInterval(demoTimer); render(); } },
  };
}
