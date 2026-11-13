// Cadeaux du live en verre : total qui défile, et pour chaque cadeau sa vraie image, son nombre,
// ses pièces et une barre relative au plus gros. Mode objectif : un cadeau précis vers un nombre à atteindre.
import { el, fmt, setVars, isPreview, countTo, GIFT_ICON, confetti } from '../lib.js';

const DEMO = { coins: 8420, count: 133, byGift: [{ id: '1', name: 'Fusée', count: 12, coins: 6000 }, { id: '2', name: 'Couronne', count: 8, coins: 2392 }, { id: '3', name: 'Rose', count: 28, coins: 28 }] };

export function mount(root) {
  let s = {};
  let g = null;
  let catalog = [];
  let wasDone = null;
  const box = el('div', 'panel gx gt2 scaled');
  root.append(box);
  const pic = (x) => { const i = el('img', 'gt2-img'); i.src = x.image || GIFT_ICON; i.alt = ''; i.referrerPolicy = 'no-referrer'; return i; };
  const demo = () => ({ ...DEMO, byGift: DEMO.byGift.map((x, i) => ({ ...x, name: catalog[catalog.length - 1 - i * 2]?.name || x.name, image: catalog[catalog.length - 1 - i * 2]?.image || '' })) });

  const single = (data) => {
    const it = data.byGift.find((x) => x.id === s.giftId) || (s.giftId ? { name: s.giftName || 'Cadeau', count: 0 } : data.byGift[0] || { name: 'Choisis un cadeau', count: 0 });
    const pct = Math.min(100, (it.count / (s.target || 1)) * 100);
    const row = el('div', 'gt2-one');
    row.append(pic(it));
    const txt = el('div', 'gt2-one-txt');
    const n = el('b', 'gx-num');
    countTo(n, it.count);
    const line = el('div', 'gt2-one-n');
    line.append(n, el('span', '', ` / ${fmt(s.target)}`));
    txt.append(el('span', 'gt2-one-name', it.name), line);
    row.append(txt);
    const bar = el('div', 'gt2-bar');
    const fill = el('i');
    fill.style.width = `${Math.max(2, pct)}%`;
    bar.append(fill);
    box.append(row, bar);
    const done = it.count >= s.target;
    box.classList.toggle('done', done);
    if (done && wasDone === false) confetti([s.accent || '#F3D38A', '#fff'], 140);
    wasDone = done;
  };

  const render = () => {
    const data = g?.count ? g : isPreview ? demo() : { coins: 0, count: 0, byGift: [] };
    box.textContent = '';
    box.append(el('div', 'gx-shine'));
    const head = el('div', 'gt2-head');
    head.append(el('span', 'gx-label', s.title || 'Cadeaux du live'));
    if (s.mode !== 'goal') { const t = el('b', 'gx-num gt2-total'); countTo(t, data.coins); const w = el('span', 'gt2-tw'); w.append(t, el('small', '', 'pièces')); head.append(w); }
    box.append(head);
    if (s.mode === 'goal') { single(data); return; }
    const max = Math.max(1, ...data.byGift.map((x) => x.coins));
    for (const x of data.byGift.slice(0, s.count || 6)) {
      const row = el('div', 'gt2-row');
      const bar = el('i', 'gt2-rbar');
      bar.style.width = `${Math.max(3, (x.coins / max) * 100)}%`;
      row.append(bar, pic(x), el('span', 'gt2-name', x.name), el('span', 'gt2-n', `×${fmt(x.count)}`), el('b', 'gt2-c', fmt(x.coins)));
      box.append(row);
    }
    if (!data.byGift.length) box.append(el('div', 'pl-foot', 'Les cadeaux du live apparaîtront ici.'));
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.gifts) g = data.gifts; if (data?.catalog) catalog = data.catalog.filter((x) => x.image); render(); },
    on(msg) { if (msg.t === 'gifts') { g = msg.gifts; render(); } },
  };
}
