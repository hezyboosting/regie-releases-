// Fil des cadeaux en verre : chaque envoi arrive avec le vrai cadeau en grand, le pseudo, et un combo
// « ×12 » qui saute à chaque nouvel envoi du même cadeau. Les lignes s'effacent après quelques secondes.
import { el, tag, fmt, setVars, isPreview, avatar, replay, GIFT_ICON } from '../lib.js';

export function mount(root) {
  let s = {};
  let catalog = [];
  const box = el('div', 'gf gf2 scaled');
  root.append(box);
  const rows = new Map();

  const hidden = () => String(s.hidden || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

  const row = (g, key) => {
    if (hidden().includes(String(g.name || '').toLowerCase())) return;
    let r = rows.get(key);
    if (!r) {
      const n = el('div', 'gf-row gx gf2-row');
      const vis = el('div', 'gf2-vis');
      const gift = el('img', 'gf2-gift'); gift.alt = ''; gift.referrerPolicy = 'no-referrer'; gift.src = g.image || GIFT_ICON;
      vis.append(el('i', 'gf2-glow'), gift);
      if (s.avatars) vis.append(avatar(g.avatar, g.user, 'gf2-av'));
      const txt = el('div', 'gf2-txt');
      const who = el('div', 'gf2-who');
      who.append(el('b', '', g.user), tag(g.platform));
      const what = el('span', 'gf2-what');
      txt.append(who, what);
      const count = el('div', 'gf2-count');
      n.append(vis, txt, count);
      box.prepend(n);
      r = { n, what, count };
      rows.set(key, r);
      while (box.children.length > (s.maxRows || 6)) { const last = box.lastChild; for (const [k, v] of rows) if (v.n === last) rows.delete(k); last.remove(); }
    }
    r.what.textContent = g.name ? `envoie ${g.name}` : '';
    r.count.textContent = '';
    r.count.append(el('span', 'gf2-x', '×'), el('b', '', fmt(g.count)));
    replay(r.count, 'bump');
    replay(r.n, 'hit');
    clearTimeout(r.timer);
    if (!isPreview) r.timer = setTimeout(() => { r.n.classList.add('gone'); setTimeout(() => { r.n.remove(); rows.delete(key); }, 500); }, (s.stay || 12) * 1000);
  };

  const fromEv = (e) => {
    const map = { gift: e.gift?.name, bits: 'Bits', superchat: e.money, supersticker: e.money, giftsub: 'Abonnements offerts' };
    if (!map[e.type]) return;
    row({ user: e.user.display, avatar: e.user.avatar, platform: e.platform, name: map[e.type], image: e.gift?.image, count: e.amount || 1 }, `${e.user.id || e.user.display}:${e.gift?.id || e.type}`);
  };

  let demoTimer = null;
  return {
    update(settings, data) {
      const first = !s.maxRows;
      s = settings;
      if (data?.catalog) catalog = data.catalog.filter((x) => x.image);
      setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
      if (first) (data?.backlog || []).forEach((g, i) => row(g, `b${i}`));
      clearInterval(demoTimer);
      if (isPreview && (first ? !box.children.length : true)) {
        const people = [['Lena', 'tiktok'], ['Marius', 'tiktok'], ['kenza.live', 'tiktok'], ['Nolan', 'tiktok']];
        const counts = {};
        const go = () => {
          const [u, p] = people[Math.floor(Math.random() * people.length)];
          const gift = catalog.length ? catalog[Math.floor(Math.random() * Math.min(5, catalog.length))] : { name: 'Rose', image: '' };
          const k = `${u}:${gift.name}`;
          counts[k] = (counts[k] || 0) + 1 + Math.floor(Math.random() * 3);
          row({ user: u, platform: p, name: gift.name, image: gift.image, count: counts[k] }, k);
        };
        for (let i = 0; i < 3; i += 1) go();
        demoTimer = setInterval(go, 1300);
      }
    },
    on(msg) {
      if (msg.t === 'ev') { clearInterval(demoTimer); fromEv(msg.ev); }
      if (msg.t === 'giftstreak') { const e = msg.ev; row({ user: e.user.display, avatar: e.user.avatar, platform: e.platform, name: e.gift?.name, image: e.gift?.image, count: e.amount }, `${e.user.id || e.user.display}:${e.gift?.id}`); }
    },
  };
}
