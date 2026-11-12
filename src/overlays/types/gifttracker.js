import { el, fmt, setVars, isPreview } from '../lib.js';

const DEMO = { coins: 8420, count: 133, byGift: [{ id: '1', name: 'Fusée', count: 12, coins: 6000 }, { id: '2', name: 'Couronne', count: 8, coins: 2392 }, { id: '3', name: 'Rose', count: 28, coins: 28 }] };

export function mount(root) {
  let s = {};
  let g = null;
  const box = el('div', 'panel scaled');
  root.append(box);
  const pic = (x) => { const i = el('img', 'av'); i.src = x.image; i.alt = ''; i.referrerPolicy = 'no-referrer'; return i; };

  // Un seul cadeau suivi, avec un objectif à atteindre.
  const single = (data) => {
    const it = data.byGift.find((x) => x.id === s.giftId) || (s.giftId ? { name: s.giftName || 'Cadeau', count: 0 } : data.byGift[0] || { name: 'Choisis un cadeau', count: 0 });
    const pct = Math.min(100, (it.count / (s.target || 1)) * 100);
    const row = el('div', 'gt-one');
    if (it.image) row.append(pic(it));
    const txt = el('div', 'gt-one-txt');
    txt.append(el('b', '', it.name), el('span', '', `${fmt(it.count)} sur ${fmt(s.target)}`));
    row.append(txt);
    const bar = el('div', 'gt-bar');
    const fill = el('div', 'gt-fill');
    fill.style.width = `${pct}%`;
    bar.append(fill);
    box.append(row, bar);
    box.classList.toggle('done', it.count >= s.target);
  };

  const render = () => {
    const data = g?.count ? g : isPreview ? DEMO : { coins: 0, count: 0, byGift: [] };
    box.textContent = '';
    const head = el('div', 'gt-head');
    head.append(el('h1', '', s.title));
    if (s.mode !== 'goal') head.append(el('b', 'gt-total', fmt(data.coins)));
    box.append(head);
    if (s.mode === 'goal') { single(data); return; }
    for (const x of data.byGift.slice(0, s.count)) {
      const row = el('div', 'lb-row');
      if (x.image) row.append(pic(x));
      row.append(el('span', 'lb-name', x.name), el('span', 'gt-n', `×${fmt(x.count)}`), el('span', 'lb-pts', fmt(x.coins)));
      box.append(row);
    }
    if (!data.byGift.length) box.append(el('div', 'pl-foot', 'Les cadeaux du live apparaîtront ici.'));
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.gifts) g = data.gifts; render(); },
    on(msg) { if (msg.t === 'gifts') { g = msg.gifts; render(); } },
  };
}
