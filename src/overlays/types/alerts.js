// Alertes en verre premium : une carte qui arrive avec un reflet, le visuel de l'événement (vrai cadeau,
// image de l'alerte ou photo du spectateur dans un anneau qui tourne), une étiquette du type d'événement,
// le titre avec le pseudo mis en valeur, le message éventuel et une fine barre qui montre le temps restant.
import { el, media, playSound, setVars, PLATFORM, isPreview, avatar, tag, fmt, GIFT_ICON } from '../lib.js';

const KIND = {
  follow: 'Nouveau suivi', sub: 'Abonnement', resub: 'Réabonnement', giftsub: 'Abonnements offerts', gift: 'Cadeau', bits: 'Bits', raid: 'Raid',
  share: 'Partage', like: 'Likes', superchat: 'Super Chat', supersticker: 'Super Sticker', member: 'Nouveau membre', redeem: 'Récompense',
  join: 'Arrivée', superfan: 'Super Fan', milestone: 'Fidélité', hypetrain: 'Hype Train',
};

export function mount(root) {
  let s = {};
  let current = null;
  let outTimer = null;
  let lastTheme = '';
  let catalog = [];
  let demoTimer = null;

  // Le pseudo ressort dans le titre, dans la couleur d'accent.
  function titleNode(text, user) {
    const t = el('div', 'al-title');
    const i = user ? String(text).indexOf(user) : -1;
    if (i < 0) { t.textContent = text; return t; }
    t.append(document.createTextNode(text.slice(0, i)), el('b', 'al-name', user), document.createTextNode(text.slice(i + user.length)));
    return t;
  }

  function visual(a) {
    const wrap = el('div', 'al-vis');
    let pic = null;
    if (/\.(mp4|webm)$/i.test(a.image || '')) {
      pic = el('video', 'al-media');
      pic.src = media(a.image); pic.autoplay = true; pic.muted = true; pic.playsInline = true; pic.loop = true;
      wrap.classList.add('media');
    } else if (a.image) {
      pic = el('img', 'al-media'); pic.src = media(a.image); pic.alt = ''; wrap.classList.add('media');
    } else if (a.gift?.image || a.type === 'gift') {
      pic = el('img', 'al-gift'); pic.src = a.gift?.image || GIFT_ICON; pic.alt = ''; wrap.classList.add('gift');
      wrap.append(el('i', 'al-rays'));
    } else if (s.avatar !== false) {
      pic = avatar(a.avatar, a.user, 'al-av'); wrap.classList.add('face');
      wrap.append(el('i', 'al-ring'));
    }
    if (pic && pic.tagName === 'IMG') pic.referrerPolicy = 'no-referrer';
    if (!pic) return null;
    wrap.append(pic);
    if (a.platform && PLATFORM[a.platform]) { const p = tag(a.platform); p.classList.add('al-pf'); wrap.append(p); }
    return wrap;
  }

  function chip(a) {
    if (a.type === 'gift' && a.gift) return `${a.amount > 1 ? `${fmt(a.amount)} × ` : ''}${a.gift.name}${a.value ? ` · ${fmt(a.value)} pièces` : ''}`;
    if ((a.type === 'bits' || a.type === 'raid' || a.type === 'giftsub') && a.amount) return a.type === 'raid' ? `${fmt(a.amount)} personnes` : a.type === 'bits' ? `${fmt(a.amount)} bits` : `${fmt(a.amount)} abonnements`;
    if (a.type === 'resub' && a.months > 1) return `${a.months} mois`;
    if ((a.type === 'superchat' || a.type === 'supersticker') && a.money) return a.money;
    return '';
  }

  const show = (a) => {
    clear();
    const theme = ['verre', 'carte', 'minimal'].includes(a.theme) ? a.theme : (s.theme || 'verre');
    const box = el('div', `al ${theme}`);
    box.dataset.kind = a.type || '';
    root.className = `type-alerts ${a.position || s.position}`;
    if (s.platformColor && PLATFORM[a.platform]) box.style.setProperty('--accent', PLATFORM[a.platform].color);
    const dur = Math.max(1.5, a.duration || 6);
    box.style.setProperty('--dur', `${dur - 0.5}s`);
    const vis = visual(a);
    if (vis) box.append(vis);
    const body = el('div', 'al-body');
    if (theme !== 'minimal' && KIND[a.type]) body.append(el('span', 'al-kind', KIND[a.type]));
    body.append(titleNode(a.title, a.user));
    const c = chip(a);
    if (c && theme !== 'minimal') body.append(el('span', 'al-chip', c));
    if (a.text) body.append(el('div', 'al-text', a.text));
    box.append(body);
    if (theme !== 'minimal') box.append(el('i', 'al-time'));
    if (theme !== 'minimal' && (a.type === 'gift' || a.type === 'raid' || a.type === 'giftsub' || a.value >= 100)) {
      const sp = el('div', 'al-sparks');
      for (let i = 0; i < 14; i += 1) { const d = el('i'); d.style.setProperty('--a', `${(i / 14) * 360}deg`); d.style.setProperty('--d', `${60 + Math.random() * 70}px`); sp.append(d); }
      box.append(sp);
    }
    root.append(box);
    current = box;
    playSound(a.sound, a.volume, s.volume);
    outTimer = setTimeout(() => {
      box.classList.add('out');
      setTimeout(() => box.remove(), 600);
    }, (dur - 0.5) * 1000);
  };

  const clear = () => { clearTimeout(outTimer); current?.remove(); current = null; };

  // Aperçu : un suivi, un vrai cadeau, un abonnement avec message, à tour de rôle.
  function demo() {
    clearInterval(demoTimer);
    if (!isPreview) return;
    const g = catalog[Math.floor(catalog.length * 0.7)] || null;
    const list = [
      { type: 'follow', platform: 'tiktok', user: 'Lena', title: 'Lena suit la chaîne', duration: 4.5 },
      { type: 'gift', platform: 'tiktok', user: 'Marius', title: `Marius envoie ${g ? g.name : 'une Rose'}`, gift: { name: g?.name || 'Rose', image: g?.image || '' }, amount: 5, value: (g?.cost || 1) * 5, duration: 4.5 },
      { type: 'resub', platform: 'twitch', user: 'Kenza', title: 'Kenza se réabonne', months: 14, text: 'Toujours là depuis le début !', duration: 4.5 },
    ];
    let i = 0;
    const go = () => { show({ sound: 'none', ...list[i % list.length] }); i += 1; };
    go();
    demoTimer = setInterval(go, 4600);
  }

  return {
    update(settings, data) {
      s = settings;
      if (data?.catalog) catalog = data.catalog.filter((x) => x.image);
      root.className = `type-alerts ${s.position}`;
      setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
      if (isPreview && (!current || lastTheme !== s.theme || !demoTimer)) demo();
      lastTheme = s.theme;
    },
    on(msg) {
      if (msg.t === 'alert') { clearInterval(demoTimer); show(msg.alert); }
      if (msg.t === 'alertSkip') clear();
    },
  };
}
