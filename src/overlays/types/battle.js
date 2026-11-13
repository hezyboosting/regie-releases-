import { el, fmt, clock, setVars, isPreview } from '../lib.js';

const DEMO = { status: 'running', title: 'Duel', endsAt: Date.now() + 180000, teams: [{ id: 'a', name: 'Rouge', color: '#F0392B', score: 1240, top: [{ name: 'Lena', points: 600 }] }, { id: 'b', name: 'Bleu', color: '#4AA8F0', score: 910, top: [{ name: 'Yanis', points: 450 }] }] };

export function mount(root) {
  let s = {};
  let b = null;
  const box = el('div', 'battle scaled');
  root.append(box);

  const render = () => {
    const data = b && (b.status !== 'idle') ? b : (isPreview ? DEMO : null);
    box.hidden = !data;
    box.textContent = '';
    if (!data) return;
    box.className = `battle scaled ${s.theme === 'ring' ? 'ring-theme' : s.theme === 'tug' ? 'tug-theme' : ''}`;
    const [t1, t2] = data.teams;
    const top = el('div', 'b-top');
    const team = (t, side) => {
      const w = el('div', `b-team ${side}`);
      w.style.setProperty('--tc', t.color);
      const n = el('div', 'b-name', t.name);
      n.style.color = t.color;
      w.append(n, el('div', 'b-score', fmt(t.score)));
      return w;
    };
    const mid = el('div', 'b-mid');
    mid.append(el('div', 'b-title', data.title));
    const time = el('div', 'b-time', data.endsAt ? clock((data.endsAt - Date.now()) / 1000) : 'VS');
    time.dataset.time = 'true';
    mid.append(time);
    top.append(team(t1, ''), mid, team(t2, 'r'));
    box.append(top);

    const bar = el('div', 'b-bar');
    const total = t1.score + t2.score;
    const share = total ? t1.score / total : 0.5;
    const a = el('i');
    a.style.background = t1.color;
    a.style.flexGrow = Math.max(0.02, share);
    const z = el('i');
    z.style.background = t2.color;
    z.style.flexGrow = Math.max(0.02, 1 - share);
    bar.append(a, z);
    if (s.theme === 'tug') { const k = el('div', 'b-knot'); k.style.left = `${share * 100}%`; bar.append(k); }
    box.append(bar);

    if (s.topSupporters) {
      const sup = el('div', 'b-sup');
      const line = (t) => el('div', '', (t.top || []).slice(0, 2).map((x) => `${x.name} ${fmt(x.points)}`).join('   '));
      sup.append(line(t1), line(t2));
      box.append(sup);
    }
    if (data.status === 'ended') {
      const w = data.winner === 'tie' ? null : data.teams.find((t) => t.id === data.winner);
      const banner = el('div', 'b-win', w ? `${w.name} gagne` : 'Égalité');
      if (w) banner.style.color = w.color;
      box.append(banner);
    }
  };

  setInterval(() => {
    const t = box.querySelector('[data-time]');
    const data = b && b.status === 'running' ? b : null;
    if (t && data?.endsAt) t.textContent = clock((data.endsAt - Date.now()) / 1000);
  }, 500);

  return {
    update(settings, data) { s = settings; setVars(root, { bg: s.bg, text: s.text }); if (data?.battle) b = data.battle; render(); },
    on(msg) { if (msg.t === 'battle') { b = msg.battle; render(); } },
  };
}
