// Boss dessinés pour Régie.
import { el, svg, fmt, clock, isPreview } from '../lib.js';

const DEMO = { status: 'fight', bossId: 'golem', name: 'Golem de Basalte', level: 2, hp: 4800, maxHp: 7500, endsAt: Date.now() + 182000, hitWord: '!hit', players: [{ name: 'Lena', damage: 1400 }, { name: 'kenza.live', damage: 900 }, { name: 'Nolan', damage: 400 }], log: [] };

function art(id) {
  const s = svg('svg', { viewBox: '0 0 240 240', class: 'bs-art' });
  const eye = (x, y, r = 9) => { svg('circle', { cx: x, cy: y, r: r + 5, fill: 'var(--b2)', opacity: 0.35 }, s); svg('circle', { cx: x, cy: y, r, fill: 'var(--b2)' }, s); };
  if (id === 'golem') {
    svg('path', { d: 'M62 96 22 120l18 56 34-14ZM178 96l40 24-18 56-34-14Z', fill: 'var(--b3)' }, s);
    svg('path', { d: 'M70 62 120 34l50 28 16 92-34 58H88l-34-58Z', fill: 'var(--b1)' }, s);
    svg('path', { d: 'M70 62 120 34l50 28-50 26Z', fill: 'var(--b3)' }, s);
    svg('path', { d: 'M96 150h48l-8 18h-32Z', fill: 'var(--b2)' }, s);
    eye(96, 112); eye(144, 112);
  } else if (id === 'kraken') {
    for (const [d] of [['M60 150C20 170 26 214 56 218'], ['M90 170C70 200 84 226 104 226'], ['M150 170c20 30 6 56-14 56'], ['M180 150c40 20 34 64 4 68']]) svg('path', { d, fill: 'none', stroke: 'var(--b3)', 'stroke-width': 16, 'stroke-linecap': 'round' }, s);
    svg('path', { d: 'M120 22c52 0 82 40 82 88 0 44-34 70-82 70s-82-26-82-70c0-48 30-88 82-88Z', fill: 'var(--b1)' }, s);
    eye(92, 104, 12); eye(148, 104, 12);
    svg('path', { d: 'M100 146q20 14 40 0', fill: 'none', stroke: 'var(--b2)', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
  } else if (id === 'hydre') {
    for (const [x, tilt] of [[60, -14], [120, 0], [180, 14]]) {
      const g = svg('g', { transform: `rotate(${tilt} ${x} 190)` }, s);
      svg('path', { d: `M${x - 18} 220q-6-90 18-120 24 30 18 120Z`, fill: 'var(--b3)' }, g);
      svg('path', { d: `M${x - 30} 86q30-52 60 0l-12 28h-36Z`, fill: 'var(--b1)' }, g);
      svg('circle', { cx: x - 12, cy: 84, r: 6, fill: 'var(--b2)' }, g);
      svg('circle', { cx: x + 12, cy: 84, r: 6, fill: 'var(--b2)' }, g);
    }
  } else {
    svg('path', { d: 'M120 24c50 0 74 40 74 86v104l-24-18-25 18-25-18-25 18-25-18-24 18V110c0-46 24-86 74-86Z', fill: 'var(--b1)' }, s);
    svg('path', { d: 'M46 110c0-46 24-86 74-86-30 12-46 44-46 86v80l-28 24Z', fill: 'var(--b3)' }, s);
    eye(94, 104, 11); eye(146, 104, 11);
    svg('ellipse', { cx: 120, cy: 150, rx: 20, ry: 26, fill: 'var(--b2)', opacity: 0.8 }, s);
  }
  return s;
}

export function mount(root) {
  let s = {};
  let b = null;
  const box = el('div', 'bs scaled');
  root.append(box);
  let shownId = '';
  let refs = {};
  let lastLog = '';

  const build = (d) => {
    box.textContent = '';
    refs = {};
    const name = el('div', 'bs-name');
    refs.name = el('h1');
    refs.level = el('span', 'bs-lv');
    name.append(refs.name, refs.level);
    refs.time = el('b', 'bs-time');
    const head = el('div', 'bs-head');
    head.append(name, refs.time);
    refs.stage = el('div', 'bs-stage');
    refs.stage.append(art(d.bossId));
    const hp = el('div', 'bs-hp');
    refs.fill = el('i');
    refs.hpTxt = el('span');
    hp.append(refs.fill, refs.hpTxt);
    refs.call = el('div', 'bs-call');
    refs.top = el('div', 'bs-top');
    refs.banner = el('div', 'bs-banner');
    box.append(head, refs.stage, hp, refs.call, refs.top, refs.banner);
    shownId = d.bossId;
  };

  const render = () => {
    const d = b && b.status !== 'idle' ? b : isPreview ? DEMO : null;
    box.hidden = !d;
    if (!d) return;
    if (shownId !== d.bossId) build(d);
    refs.name.textContent = d.name;
    refs.level.textContent = `Niveau ${d.level}`;
    const pct = (d.hp / d.maxHp) * 100;
    refs.fill.style.width = `${pct}%`;
    refs.fill.className = pct < 25 ? 'low' : '';
    refs.hpTxt.textContent = `${fmt(d.hp)} / ${fmt(d.maxHp)}`;
    refs.call.textContent = d.status === 'fight' ? `Écris ${d.hitWord}, envoie des likes et des cadeaux pour frapper` : '';
    refs.top.textContent = '';
    if (s.showTop) for (const p of d.players.slice(0, 3)) { const r = el('span'); r.append(el('b', '', p.name), document.createTextNode(` ${fmt(p.damage)}`)); refs.top.append(r); }
    refs.banner.textContent = d.status === 'won' ? `${d.name} est vaincu` : d.status === 'lost' ? `${d.name} a gagné` : '';
    refs.banner.className = `bs-banner${d.status === 'fight' ? '' : ' on'}`;
    box.classList.toggle('dead', d.status === 'won');
    const hit = d.log?.[d.log.length - 1];
    if (hit && hit.id !== lastLog) {
      lastLog = hit.id;
      refs.stage.classList.remove('shake'); void refs.stage.offsetWidth; refs.stage.classList.add('shake');
      const f = el('span', 'bs-float', `-${fmt(hit.amount)}`);
      f.style.left = `${30 + Math.random() * 40}%`;
      refs.stage.append(f);
      setTimeout(() => f.remove(), 900);
    }
  };

  setInterval(() => {
    const d = b && b.status === 'fight' ? b : isPreview ? DEMO : null;
    if (refs.time) refs.time.textContent = d?.endsAt ? clock((d.endsAt - Date.now()) / 1000) : '';
  }, 500);

  return {
    update(settings, data) {
      s = settings;
      root.className = `type-boss th-${s.theme}`;
      if (data?.boss) b = data.boss;
      render();
    },
    on(msg) { if (msg.t === 'boss') { b = msg.boss; render(); } },
  };
}
