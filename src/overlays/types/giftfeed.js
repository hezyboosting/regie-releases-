import { el, tag, fmt, setVars, isPreview, avatar } from '../lib.js';

const DEMO = [{ user: 'kenza.live', platform: 'tiktok', name: 'Rose', count: 12, value: 12 }, { user: 'Lena', platform: 'twitch', name: 'Bits', count: 500, value: 500 }, { user: 'Nolan', platform: 'youtube', name: 'Super Chat', count: 1, value: 1000 }];

export function mount(root) {
  let s = {};
  const box = el('div', 'gf scaled');
  root.append(box);
  const rows = new Map();

  const hidden = () => String(s.hidden || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

  const row = (g, key) => {
    if (hidden().includes(String(g.name || '').toLowerCase())) return;
    let r = rows.get(key);
    if (!r) {
      const n = el('div', 'gf-row');
      const pic = g.image && !s.avatars ? Object.assign(el('img', 'gf-img'), { src: g.image, alt: '', referrerPolicy: 'no-referrer' }) : avatar(g.avatar, g.user, 'gf-img');
      const txt = el('div', 'gf-txt');
      const who = el('b', '', g.user);
      const what = el('span');
      txt.append(who, what);
      const count = el('span', 'gf-count');
      n.append(pic, txt, tag(g.platform), count);
      box.prepend(n);
      r = { n, what, count };
      rows.set(key, r);
      while (box.children.length > s.maxRows) { const last = box.lastChild; for (const [k, v] of rows) if (v.n === last) rows.delete(k); last.remove(); }
    }
    r.what.textContent = g.name;
    r.count.textContent = `×${fmt(g.count)}`;
    r.count.classList.remove('bump'); void r.count.offsetWidth; r.count.classList.add('bump');
    clearTimeout(r.timer);
    if (!isPreview) r.timer = setTimeout(() => { r.n.classList.add('gone'); setTimeout(() => { r.n.remove(); rows.delete(key); }, 500); }, s.stay * 1000);
  };

  const fromEv = (e) => {
    const map = { gift: e.gift?.name, bits: 'Bits', superchat: e.money, supersticker: e.money, giftsub: 'Abonnements offerts' };
    if (!map[e.type]) return;
    row({ user: e.user.display, avatar: e.user.avatar, platform: e.platform, name: map[e.type], image: e.gift?.image, count: e.amount || 1 }, `${e.user.id || e.user.display}:${e.gift?.id || e.type}`);
  };

  return {
    update(settings, data) {
      const first = !s.maxRows;
      s = settings;
      setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
      if (first) {
        (data?.backlog || []).forEach((g, i) => row(g, `b${i}`));
        if (isPreview && !box.children.length) DEMO.forEach((g, i) => row(g, `d${i}`));
      }
    },
    on(msg) {
      if (msg.t === 'ev') fromEv(msg.ev);
      if (msg.t === 'giftstreak') { const e = msg.ev; row({ user: e.user.display, avatar: e.user.avatar, platform: e.platform, name: e.gift?.name, image: e.gift?.image, count: e.amount }, `${e.user.id || e.user.display}:${e.gift?.id}`); }
    },
  };
}
