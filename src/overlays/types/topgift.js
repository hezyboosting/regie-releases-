// Meilleur cadeau du live, en verre : le vrai cadeau en grand avec des rayons qui tournent,
// la photo et le pseudo, la valeur qui défile et une couronne. Un nouveau record fait briller la carte.
import { el, tag, fmt, setVars, isPreview, avatar, countTo, replay, GIFT_ICON } from '../lib.js';

export function mount(root) {
  let s = {};
  let g = null;
  let catalog = [];
  let lastKey = '';
  const box = el('div', 'tg gx tg2 scaled');
  root.append(box);
  const parts = {};
  (function build() {
    const vis = el('div', 'tg2-vis');
    parts.rays = el('i', 'tg2-rays');
    parts.gift = el('img', 'tg2-gift'); parts.gift.alt = ''; parts.gift.referrerPolicy = 'no-referrer';
    vis.append(parts.rays, parts.gift);
    const txt = el('div', 'tg2-txt');
    parts.title = el('span', 'gx-label');
    const who = el('div', 'tg2-who');
    parts.av = el('span', 'tg2-avw');
    parts.name = el('b');
    parts.pf = el('span', 'tg2-pf');
    who.append(parts.av, parts.name, parts.pf);
    parts.what = el('span', 'tg2-what');
    txt.append(parts.title, who, parts.what);
    const val = el('div', 'tg2-val');
    parts.val = el('b', 'gx-num');
    parts.unit = el('span', 'tg2-unit');
    val.append(el('span', 'tg2-crown', '👑'), parts.val, parts.unit);
    box.append(el('div', 'gx-shine'), vis, txt, val);
  })();
  const render = () => {
    const demoGift = catalog[catalog.length - 1];
    const t = g?.topGift || (isPreview ? { user: 'Lena', platform: 'tiktok', name: demoGift?.name || 'Lion', image: demoGift?.image || '', value: 29999, count: 1 } : null);
    box.hidden = !t;
    if (!t) return;
    parts.title.textContent = s.title || 'Meilleur cadeau';
    parts.gift.src = t.image || GIFT_ICON;
    parts.av.textContent = '';
    parts.av.append(avatar(t.avatar, t.user, 'tg2-av'));
    parts.name.textContent = t.user;
    parts.pf.textContent = '';
    if (t.platform) parts.pf.append(tag(t.platform));
    parts.what.textContent = `${t.count > 1 ? `${fmt(t.count)} × ` : ''}${t.name}`;
    countTo(parts.val, t.value);
    parts.unit.textContent = 'pièces';
    const key = `${t.user}:${t.value}`;
    if (lastKey && key !== lastKey) replay(box, 'record');
    lastKey = key;
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.gifts) g = data.gifts; if (data?.catalog) catalog = data.catalog.filter((x) => x.image); render(); },
    on(msg) { if (msg.t === 'gifts') { g = msg.gifts; render(); } },
  };
}
