import { el, fmt, clock, setVars, isPreview } from '../lib.js';

const DEMO = { kind: 'rl', blue: 3, orange: 2, time: 142, overtime: false, team: 0, me: { goals: 2, assists: 1, saves: 3 } };

export function mount(root) {
  let s = {};
  let live = null;
  const box = el('div', 'gl scaled');
  root.append(box);
  const stat = (v, l) => { const c = el('span', 'gl-stat'); c.append(el('b', '', fmt(v)), el('i', '', l)); return c; };
  const sides = (a, b, mid, ca, cb) => {
    const row = el('div', 'gl-score');
    const x = el('b', 'gl-a', String(a)); x.style.background = ca;
    const y = el('b', 'gl-b', String(b)); y.style.background = cb;
    row.append(x, el('span', 'gl-mid', mid), y);
    return row;
  };
  const render = () => {
    const d = live || (isPreview ? DEMO : null);
    box.textContent = '';
    box.hidden = !d && s.hideIdle;
    if (!d) { box.append(el('div', 'gl-wait', 'En attente de ta partie')); return; }
    const st = el('div', 'gl-stats');
    if (d.kind === 'rl') {
      box.append(sides(d.blue, d.orange, d.overtime ? `+${clock(d.time)}` : clock(d.time), '#2F7BFF', '#FF8A2B'));
      if (d.me) st.append(stat(d.me.goals, 'Buts'), stat(d.me.assists, 'Passes'), stat(d.me.saves, 'Arrêts'));
    } else if (d.kind === 'cs2') {
      box.append(sides(d.mine, d.theirs, `Manche ${d.round + 1}`, 'var(--accent)', 'rgba(255,255,255,.18)'));
      st.append(stat(d.kills, 'Éliminations'), stat(d.deaths, 'Morts'), stat(d.assists, 'Assists'));
    } else {
      box.append(sides(d.kills, d.deaths, d.champion || clock(d.time), 'var(--accent)', 'rgba(255,255,255,.18)'));
      st.append(stat(d.assists, 'Assists'), stat(d.cs, 'CS'), stat(d.level, 'Niveau'));
    }
    box.append(st);
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data) live = data.live || null; render(); },
    on(msg) { if (msg.t === 'gamelive') { live = msg.live; render(); } },
  };
}
