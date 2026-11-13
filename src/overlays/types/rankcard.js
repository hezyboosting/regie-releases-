import { el, tag, setVars, emblem, isPreview, playSound, avatar, confetti } from '../lib.js';

// Suivi = Rang : carte directe, ou ouverture façon caisse CS2 : une bande de rangs défile à toute
// vitesse sous un repère doré, ralentit longuement, et s'arrête sur le rang obtenu. Les rangs rares
// passent rarement dans la bande, comme les objets rares d'une caisse.
const CARD = 168, GAP = 10, STEP = CARD + GAP, STAGE = 960, COUNT = 64, WIN = 56;
const DEMO_POOL = [
  { id: 'b', name: 'Bronze', color: '#C98A5A', chance: 0.3 }, { id: 'a', name: 'Argent', color: '#C9D3E0', chance: 0.25 }, { id: 'o', name: 'Or', color: '#F3C94A', chance: 0.18 },
  { id: 'p', name: 'Platine', color: '#5FE0D0', chance: 0.12 }, { id: 'd', name: 'Diamant', color: '#57B8FF', chance: 0.08 }, { id: 'c', name: 'Champion', color: '#B57BFF', chance: 0.05 }, { id: 'g', name: 'Légende', color: '#FF5A6E', chance: 0.02 },
];
const T = (x) => (window.regieTr ? window.regieTr(x) : x);
const pct = (x) => {
  const v = x * 100;
  const s = v >= 10 ? Math.round(v).toString() : v >= 1 ? v.toFixed(1) : v.toFixed(2);
  return `${s.replace('.', document.documentElement.lang === 'en' ? '.' : ',')} %`;
};

export function mount(root) {
  let s = {};
  let timer = null;
  let busy = false;
  let pool = [];
  let game = '';
  let ctx = null;
  const queue = [];

  // Petit clic synthétique à chaque rang qui passe sous le repère (léger, même à grande vitesse).
  function tick(vol) {
    if (!vol) return;
    try {
      ctx = ctx || new AudioContext();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 2100;
      g.gain.setValueAtTime(0.05 * vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.04);
    } catch { /* pas de son possible */ }
  }

  const done = (box) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      box.classList.add('out');
      setTimeout(() => { box.remove(); busy = false; next(); }, 450);
    }, (s.stay || 6) * 1000);
  };

  const card = (c, keep) => {
    root.querySelector('.rc, .cs')?.remove();
    const box = el('div', 'rc scaled');
    box.style.setProperty('--r', c.rank.color);
    const text = el('div', 'rc-txt');
    const who = el('div', 'rc-who');
    if (s.avatars !== false) who.append(avatar(c.avatar, c.user, 'rc-av'));
    who.append(el('b', '', c.user), tag(c.platform));
    text.append(el('span', 'rc-title', c.game ? `${T(s.title)} · ${c.game}` : T(s.title)), who, el('span', 'rc-rank', c.rank.name));
    if (s.showOdds && c.rank.chance) text.append(el('span', 'rc-odds', `${pct(c.rank.chance)} de chance`));
    box.append(emblem(c.rank, 104, c.rank.image), text);
    root.append(box);
    clearTimeout(timer);
    if (keep) { busy = false; return; }
    done(box);
  };

  // Bande de la caisse : tirée selon les chances (option), le rang gagné posé à sa place.
  function strip(list, win) {
    const byChance = s.stripMode !== 'mix';
    const total = list.reduce((n, x) => n + (byChance ? Math.max(0.004, x.chance || 0) : 1), 0);
    const draw = () => {
      let r = Math.random() * total;
      for (const x of list) { r -= byChance ? Math.max(0.004, x.chance || 0) : 1; if (r <= 0) return x; }
      return list[list.length - 1];
    };
    const items = [];
    for (let i = 0; i < COUNT; i += 1) items.push(draw());
    items[WIN] = win;
    // Suspense : un rang rare juste avant ou juste après le gagnant, comme dans une vraie caisse.
    const rare = [...list].sort((a, b) => (a.chance || 0) - (b.chance || 0))[0];
    if (rare && rare.id !== win.id && Math.random() < 0.6) items[WIN + (Math.random() < 0.5 ? -1 : 1)] = rare;
    return items;
  }

  function cell(it) {
    const c = el('div', 'cs-card');
    c.style.setProperty('--r', it.color || '#8FD3FF');
    const pic = el('div', 'cs-pic');
    pic.append(emblem(it, 92, it.image));
    c.append(pic, el('span', 'cs-name', it.name));
    if (s.showOdds && it.chance) c.append(el('span', 'cs-odds', pct(it.chance)));
    c.append(el('i', 'cs-bar'));
    return c;
  }

  function caseOpen(c) {
    root.querySelector('.rc, .cs')?.remove();
    const list = c.pool?.length ? c.pool : (pool.length ? pool : [c.rank]);
    const box = el('div', 'cs scaled');
    box.style.setProperty('--r', c.rank.color || '#8FD3FF');
    const head = el('div', 'cs-head');
    if (s.avatars !== false) head.append(avatar(c.avatar, c.user, 'cs-av'));
    const who = el('div', 'cs-who');
    who.append(el('b', '', c.user), el('span', '', c.game ? `${T(s.title)} · ${c.game}` : T(s.title)));
    head.append(who, tag(c.platform));
    const stage = el('div', 'cs-stage');
    const band = el('div', 'cs-strip');
    const items = strip(list, c.rank);
    const cells = items.map(cell);
    band.append(...cells);
    stage.append(band, el('div', 'cs-mark'), el('div', 'cs-fade l'), el('div', 'cs-fade r'));
    const result = el('div', 'cs-result');
    box.append(head, stage, result);
    root.append(box);

    const jitter = (Math.random() - 0.5) * CARD * 0.72;
    const target = -(WIN * STEP) + STAGE / 2 - CARD / 2 + jitter;
    const start = performance.now() + 350;
    const duration = Math.max(3, Math.min(14, s.spin || 6.5)) * 1000;
    const vol = (s.volume ?? 60) / 100;
    let last = -1, lastTick = 0;
    const ease = (t) => 1 - (1 - t) ** 4.4;
    const frame = (now) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      const x = target * ease(p);
      band.style.transform = `translate3d(${x}px,0,0)`;
      const idx = Math.floor((-x + STAGE / 2) / STEP);
      if (idx !== last) { last = idx; if (now - lastTick > 28) { lastTick = now; tick(vol); } }
      if (p < 1) { requestAnimationFrame(frame); return; }
      // Arrêt : le rang gagné s'illumine, les autres s'éteignent.
      cells[WIN].classList.add('win');
      box.classList.add('landed');
      if (vol) playSound(s.winSound || 'fanfare', Math.round(vol * 100));
      if (s.confetti !== false) confetti([c.rank.color || '#8FD3FF', '#FFFFFF', '#F3D38A'], 160);
      result.append(el('span', 'cs-get', 'obtient'), el('b', 'cs-rank', c.rank.name));
      if (s.showOdds && c.rank.chance) result.append(el('span', 'cs-chance', `${pct(c.rank.chance)} de chance`));
      result.classList.add('on');
      if (c.demo) { setTimeout(() => { box.remove(); busy = false; next(); }, 3200); return; }
      done(box);
    };
    requestAnimationFrame(frame);
  }

  function next() {
    if (busy || !queue.length) return;
    busy = true;
    const c = queue.shift();
    if (c.roulette) caseOpen(c); else card(c);
  }

  // Aperçu : une ouverture en boucle avec les rangs du jeu choisi.
  let demoTimer = null;
  function demo(reveal) {
    clearInterval(demoTimer);
    if (!isPreview) return;
    const list = pool.length ? pool : DEMO_POOL;
    const play = () => {
      if (busy) return;
      const total = list.reduce((n, x) => n + (x.chance || 0), 0) || 1;
      let r = Math.random() * total;
      const rank = list.find((x) => (r -= x.chance || 0) <= 0) || list[0];
      queue.push({ user: 'Lena', platform: 'tiktok', rank, pool: list, game, roulette: reveal === 'roulette', demo: true });
      next();
    };
    if (reveal === 'roulette') { play(); demoTimer = setInterval(play, 1500); } else card({ user: 'Lena', platform: 'tiktok', rank: list[Math.min(4, list.length - 1)], game }, true);
  }

  return {
    update(settings, data) {
      s = settings;
      if (data?.pool) pool = data.pool;
      if (data?.game !== undefined) game = data.game;
      setVars(root, { bg: s.bg, text: s.text, mark: s.accent || '#F3C94A' });
      if (isPreview) { root.querySelector('.rc, .cs')?.remove(); busy = false; queue.length = 0; demo(data?.reveal || 'roulette'); }
    },
    on(msg) {
      if (msg.t === 'rankPool') { pool = msg.pool || []; game = msg.game || ''; return; }
      if (msg.t !== 'rank') return;
      if (isPreview) { clearInterval(demoTimer); root.querySelector('.rc, .cs')?.remove(); busy = false; queue.length = 0; }
      queue.push(msg.card);
      next();
    },
  };
}
