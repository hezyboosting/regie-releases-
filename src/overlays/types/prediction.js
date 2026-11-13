// Pari en verre : la question, chaque réponse avec sa part de la cagnotte, sa cote et ses plus gros
// parieurs, un compte à rebours tant que c'est ouvert, et la bonne réponse qui s'illumine à la fin.
import { el, setVars, isPreview, fmt, countTo, confetti, clock } from '../lib.js';

const DEMO = {
  status: 'open', question: 'On gagne cette partie ?', total: 4850, count: 23, closesAt: 0, winner: -1, command: '!parier',
  options: [{ label: 'Oui, facile', total: 3200, count: 15, pct: 0.66, ratio: 1.52, top: [{ name: 'Lena', amount: 1000 }] }, { label: 'Non, on perd', total: 1650, count: 8, pct: 0.34, ratio: 2.94, top: [{ name: 'Marius', amount: 500 }] }],
};
const COLORS = ['#57B8FF', '#FF5C8A', '#FFC53D', '#3DF0C2'];

export function mount(root) {
  let s = {};
  let v = null;
  let lastStatus = '';
  const box = el('div', 'panel gx pr scaled');
  root.append(box);
  let timer = null;

  function render() {
    const d = v && v.status !== 'idle' ? v : (isPreview ? DEMO : null);
    const hide = !d || (s.hideIdle !== false && (d.status === 'cancelled' || d.status === 'idle') && !isPreview);
    box.hidden = hide;
    clearInterval(timer);
    if (hide) return;
    box.dataset.status = d.status;
    box.textContent = '';
    box.append(el('div', 'gx-shine'));
    const head = el('div', 'pr-head');
    const state = el('span', `pr-state ${d.status}`);
    const label = { open: 'Paris ouverts', locked: 'Paris fermés', done: 'Résultat', cancelled: 'Annulé' }[d.status] || '';
    state.textContent = label;
    head.append(el('span', 'gx-label', s.title || 'Pari'), state);
    box.append(head, el('div', 'pr-q', d.question));
    d.options.forEach((o, i) => {
      const row = el('div', `pr-opt${d.winner === i ? ' win' : ''}${d.status === 'done' && d.winner !== i ? ' lose' : ''}`);
      row.style.setProperty('--c', COLORS[i % COLORS.length]);
      const bar = el('i', 'pr-bar');
      bar.style.width = `${Math.max(2, o.pct * 100)}%`;
      const n = el('span', 'pr-num', String(i + 1));
      const txt = el('div', 'pr-txt');
      txt.append(el('b', '', o.label), el('small', '', `${fmt(o.count)} ${o.count > 1 ? 'parieurs' : 'parieur'}${o.top?.[0] ? ` · ${o.top[0].name} ${fmt(o.top[0].amount)}` : ''}`));
      const right = el('div', 'pr-right');
      const pts = el('b', 'gx-num');
      countTo(pts, o.total);
      right.append(pts, el('small', '', o.ratio ? `cote ×${o.ratio.toFixed(2).replace('.', document.documentElement.lang === 'en' ? '.' : ',')}` : 'cote —'));
      row.append(bar, n, txt, right);
      box.append(row);
    });
    const foot = el('div', 'pr-foot');
    const left = el('span', '', '');
    foot.append(el('span', '', d.status === 'open' ? `Tape ${d.command} 1 100 pour miser` : `${fmt(d.total)} points en jeu`), left);
    box.append(foot);
    if (d.status === 'open' && d.closesAt) {
      const tick = () => { left.textContent = clock(Math.max(0, Math.ceil((d.closesAt - Date.now()) / 1000))); };
      tick();
      timer = setInterval(tick, 500);
    } else left.textContent = d.status === 'open' ? `${fmt(d.total)} pts` : '';
    if (d.status === 'done' && lastStatus && lastStatus !== 'done') confetti([COLORS[d.winner % COLORS.length], '#FFFFFF', '#F3D38A'], 180);
    lastStatus = d.status;
  }

  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.view) { v = data.view; lastStatus = v.status; } render(); },
    on(msg) { if (msg.t === 'prediction') { v = msg.view; render(); } },
  };
}
