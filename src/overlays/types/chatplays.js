// Le chat joue : les commandes du chat et leurs votes en direct (mode vote, avec le compte à rebours),
// ou le fil des dernières actions (mode chaos). Chaque action lancée s'affiche en grand une seconde.
import { el, setVars, isPreview, fmt, replay } from '../lib.js';

const DEMO = {
  enabled: true, mode: 'vote', voteSeconds: 6, prefix: '',
  commands: [{ id: 'a', word: 'avance', label: 'Avancer', emoji: '⬆️' }, { id: 'b', word: 'saute', label: 'Sauter', emoji: '🦘' }, { id: 'c', word: 'gauche', label: 'Gauche', emoji: '⬅️' }, { id: 'd', word: 'droite', label: 'Droite', emoji: '➡️' }],
  tallies: { a: 4, b: 9, c: 2 }, voters: 15, round: null, recent: [],
};

export function mount(root) {
  let s = {};
  let v = null;
  const box = el('div', 'panel gx cp scaled');
  const flash = el('div', 'cp-flash');
  root.append(box, flash);
  let timer = null;

  function render() {
    const d = v || (isPreview ? DEMO : null);
    box.hidden = !d || (!d.enabled && !isPreview) || (s.hideIdle && !d.round && !(d.recent || []).length && !isPreview);
    if (!d) return;
    box.textContent = '';
    box.append(el('div', 'gx-shine'));
    const head = el('div', 'cp-head');
    head.append(el('span', 'gx-label', s.title || 'Le chat joue'));
    const chip = el('span', `cp-mode ${d.mode}`, d.mode === 'vote' ? 'Vote' : 'Chaos');
    head.append(chip);
    box.append(head);
    if (d.mode === 'vote') {
      const total = Object.values(d.tallies || {}).reduce((n, x) => n + x, 0);
      const best = Math.max(0, ...Object.values(d.tallies || {}));
      const ring = el('div', 'cp-timer');
      const fill = el('i');
      ring.append(fill);
      box.append(ring);
      const end = d.round?.endsAt || 0;
      clearInterval(timer);
      const tick = () => { const left = Math.max(0, end - Date.now()); fill.style.width = `${end ? (left / ((d.voteSeconds || 6) * 1000)) * 100 : 0}%`; };
      tick();
      if (end) timer = setInterval(tick, 100);
      for (const c of d.commands) {
        const n = d.tallies?.[c.id] || 0;
        const row = el('div', `cp-row${n && n === best ? ' lead' : ''}`);
        const bar = el('i', 'cp-bar');
        bar.style.width = `${total ? (n / total) * 100 : 0}%`;
        row.append(bar, el('span', 'cp-emo', c.emoji || '•'), el('b', 'cp-lbl', c.label), el('span', 'cp-word', `${d.prefix || ''}${c.word}`), el('b', 'cp-n', fmt(n)));
        box.append(row);
      }
      box.append(el('div', 'cp-foot', d.voters ? `${fmt(d.voters)} ${d.voters > 1 ? 'votes' : 'vote'} · le plus demandé gagne` : 'Tape un mot dans le chat pour voter'));
    } else {
      const grid = el('div', 'cp-grid');
      for (const c of d.commands) { const k = el('div', 'cp-key'); k.append(el('span', 'cp-emo', c.emoji || '•'), el('b', '', c.label), el('small', '', `${d.prefix || ''}${c.word}`)); grid.append(k); }
      box.append(grid);
      const feed = el('div', 'cp-feed');
      for (const r of (d.recent || []).slice(0, s.feed || 5)) { const it = el('div', 'cp-it'); it.append(el('b', '', r.user || ''), el('span', '', `${r.emoji || ''} ${r.label}`)); feed.append(it); }
      box.append(feed);
    }
  }

  function showFlash(r) {
    if (!r || s.flash === false) return;
    flash.textContent = '';
    flash.append(el('span', 'cp-f-emo', r.emoji || '🎮'), el('b', '', r.label), el('small', '', r.votes ? `${fmt(r.votes)} votes` : r.user || ''));
    replay(flash, 'on');
  }

  return {
    update(settings, data) {
      s = settings;
      setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
      if (data?.view) v = data.view;
      render();
    },
    on(msg) {
      if (msg.t !== 'chatplays') return;
      v = msg.view;
      render();
      if (msg.fired) showFlash(v.recent?.[0]);
    },
  };
}
