// Derniers événements : dernier suivi, dernier cadeau (avec sa vraie image), dernier like,
// dernier partage, dernier abonné. Une seule carte, un carrousel qui tourne, ou la liste complète.
import { el, avatar, tag, fmt, isPreview } from '../lib.js';

const KINDS = [
  { id: 'follow', key: 'showFollow', label: 'Dernier suivi', icon: '★' },
  { id: 'gift', key: 'showGift', label: 'Dernier cadeau', icon: '🎁' },
  { id: 'like', key: 'showLike', label: 'Dernier like', icon: '❤' },
  { id: 'share', key: 'showShare', label: 'Dernier partage', icon: '↗' },
  { id: 'sub', key: 'showSub', label: 'Dernier abonné', icon: '◆' },
];
const DEMO = {
  follow: { name: 'Kenza', platform: 'tiktok' }, gift: { name: 'Marius', platform: 'tiktok', amount: 5, gift: { name: 'Rose', image: '' } },
  like: { name: 'Lena', platform: 'tiktok', amount: 320 }, share: { name: 'Yanis', platform: 'tiktok' }, sub: { name: 'Inès', platform: 'twitch', months: 3, type: 'resub' },
};

function detail(kind, x) {
  if (kind === 'gift') return x.gift ? `${x.gift.name}${x.amount > 1 ? ` ×${x.amount}` : ''}` : `${fmt(x.value)} pièces`;
  if (kind === 'like') return `${fmt(x.amount || 1)} likes`;
  if (kind === 'share') return 'a partagé le live';
  if (kind === 'sub') return x.type === 'giftsub' ? `offre ${x.amount || 1} abonnement${x.amount > 1 ? 's' : ''}` : x.months > 1 ? `abonné depuis ${x.months} mois` : 'vient de s\'abonner';
  return 'suit la chaîne';
}

export function mount(root) {
  let s = {};
  let last = {};
  let turn = 0;
  let timer = null;
  const box = el('div', 'lx scaled');
  root.append(box);

  const kinds = () => KINDS.filter((k) => s[k.key] !== false);

  function card(k, x, fresh) {
    const c = el('div', `lx-card${fresh ? ' new' : ''}${x ? '' : ' empty'}`);
    c.dataset.kind = k.id;
    const head = el('div', 'lx-head');
    head.append(el('span', 'lx-ico', k.icon), el('span', 'lx-label', k.label));
    c.append(head);
    const body = el('div', 'lx-body');
    if (!x) { body.append(el('span', 'lx-wait', 'Personne pour l\'instant')); c.append(body); return c; }
    if (s.avatars !== false) body.append(avatar(x.avatar, x.name, 'lx-av'));
    const txt = el('div', 'lx-txt');
    const who = el('div', 'lx-who');
    who.append(el('b', '', x.name));
    if (s.platform !== false && x.platform) who.append(tag(x.platform));
    txt.append(who);
    const d = el('span', 'lx-detail');
    if (k.id === 'gift' && x.gift?.image) { const g = el('img', 'lx-gift'); g.src = x.gift.image; g.alt = ''; g.referrerPolicy = 'no-referrer'; d.append(g); }
    d.append(document.createTextNode(detail(k.id, x)));
    txt.append(d);
    body.append(txt);
    c.append(body);
    return c;
  }

  function render(freshKind) {
    box.textContent = '';
    box.dataset.style = s.style || 'carte';
    const list = kinds();
    if (!list.length) return;
    const mode = s.mode || 'carrousel';
    if (mode === 'liste') { for (const k of list) box.append(card(k, last[k.id], k.id === freshKind)); return; }
    let k;
    if (mode === 'un') k = KINDS.find((x) => x.id === s.kind) || list[0];
    else {
      // Carrousel : on passe d'un type à l'autre ; une nouveauté s'affiche tout de suite.
      const filled = list.filter((x) => last[x.id]);
      const pool = filled.length ? filled : list;
      if (freshKind && pool.some((x) => x.id === freshKind)) turn = pool.findIndex((x) => x.id === freshKind);
      k = pool[turn % pool.length];
    }
    box.append(card(k, last[k.id], k.id === freshKind));
  }

  function loop() {
    clearInterval(timer);
    if ((s.mode || 'carrousel') !== 'carrousel') return;
    timer = setInterval(() => { turn += 1; render(); }, Math.max(3, s.rotate || 6) * 1000);
  }

  return {
    update(settings, data) {
      s = settings;
      if (data?.last) last = data.last;
      if (isPreview && !Object.keys(last).length) last = DEMO;
      box.style.setProperty('--accent', s.accent || '#FE2C55');
      box.style.setProperty('--bg', s.bg || '#10131A');
      box.style.setProperty('--text', s.text || '#F2F5F9');
      render();
      loop();
    },
    on(msg) {
      if (msg.t !== 'last') return;
      last = msg.last || {};
      render(msg.kind);
      loop();
    },
  };
}
