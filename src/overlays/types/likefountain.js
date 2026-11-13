// Fontaine de likes : à chaque salve de likes, des cœurs montent du bas de l'écran en ondulant,
// avec de temps en temps la photo de la personne qui like au milieu des cœurs.
import { el, isPreview, media } from '../lib.js';

const PALETTES = {
  tiktok: ['#FE2C55', '#FF5C8A', '#FF8FB1', '#FFFFFF', '#25F4EE'],
  rose: ['#FF4D6D', '#FF758F', '#FF8FA3', '#FFB3C1', '#C9184A'],
  arcenciel: ['#FF4D6D', '#FFB703', '#FFE066', '#3DF0C2', '#57B8FF', '#B57BFF'],
  or: ['#FFD24A', '#F3C94A', '#FFE9A6', '#E2B03C', '#FFFFFF'],
};

export function mount(root) {
  let s = {};
  const canvas = el('canvas', 'lf-canvas');
  root.append(canvas);
  const c = canvas.getContext('2d');
  let W = 0, H = 0;
  const fit = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };
  fit();
  addEventListener('resize', fit);
  const parts = [];
  const pending = [];
  const images = new Map();
  const img = (src) => {
    if (!src) return null;
    if (!images.has(src)) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = src; images.set(src, im); }
    const im = images.get(src);
    return im.complete && im.naturalWidth ? im : null;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const colors = () => (s.palette === 'unie' ? [s.accent || '#FE2C55'] : PALETTES[s.palette] || PALETTES.tiktok);

  // Cœur dessiné (net à toutes les tailles, teinté comme on veut).
  function heart(x, y, size, col) {
    const k = size / 32;
    c.save(); c.translate(x, y); c.scale(k, k);
    c.beginPath();
    c.moveTo(0, 10); c.bezierCurveTo(-26, -6, -14, -26, 0, -13); c.bezierCurveTo(14, -26, 26, -6, 0, 10);
    c.fillStyle = col; c.fill();
    c.beginPath(); c.ellipse(-8, -12, 4, 2.6, -0.6, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    c.restore();
  }

  function originX() {
    const o = s.origin || 'droite';
    if (o === 'gauche') return rnd(W * 0.04, W * 0.16);
    if (o === 'droite') return rnd(W * 0.84, W * 0.96);
    if (o === 'centre') return rnd(W * 0.42, W * 0.58);
    return rnd(W * 0.05, W * 0.95);
  }

  function spawn(p) {
    const size = (s.size || 46) * rnd(0.7, 1.25);
    const speed = (s.speed || 100) / 100;
    parts.push({ x: originX(), y: H + size, vy: -rnd(2.4, 4.2) * speed * (H / 1080), amp: rnd(14, 46), freq: rnd(0.012, 0.03), phase: rnd(0, 6.28), size, col: colors()[Math.floor(Math.random() * colors().length)], avatar: p.avatar || '', name: p.name || '', life: 0, x0: 0 });
    parts[parts.length - 1].x0 = parts[parts.length - 1].x;
  }

  (function frame() {
    c.clearRect(0, 0, W, H);
    for (let k = 0; k < 3 && pending.length; k += 1) spawn(pending.shift());
    if (pending.length > 300) pending.splice(0, pending.length - 300);
    const custom = s.emoji && s.emoji !== '❤️' ? s.emoji : '';
    const pic = s.image ? img(media(s.image)) : null;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life += 1; p.y += p.vy; p.x = p.x0 + Math.sin(p.life * p.freq + p.phase) * p.amp;
      const top = H * (1 - (s.height || 80) / 100);
      const fade = p.y < top + 160 ? Math.max(0, (p.y - top) / 160) : 1;
      if (fade <= 0 || p.y < -p.size) { parts.splice(i, 1); continue; }
      const grow = Math.min(1, p.life / 14);
      c.globalAlpha = fade;
      const sz = p.size * grow;
      const av = p.avatar && s.avatars !== false ? img(p.avatar) : null;
      if (av) {
        const r = sz * 0.62 * ((s.avatarSize || 100) / 100);
        c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.clip(); c.drawImage(av, p.x - r, p.y - r, r * 2, r * 2); c.restore();
        c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = p.col; c.stroke();
        heart(p.x + r * 0.75, p.y + r * 0.7, r * 0.8, p.col);
      } else if (pic) c.drawImage(pic, p.x - sz / 2, p.y - sz / 2, sz, sz);
      else if (custom) { c.font = `${sz}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(custom, p.x, p.y); }
      else heart(p.x, p.y, sz, p.col);
    }
    c.globalAlpha = 1;
    requestAnimationFrame(frame);
  })();

  let likeBank = 0;
  function onEv(ev) {
    let n = 0;
    if (ev.type === 'like') {
      likeBank += ev.amount || 1;
      const per = Math.max(1, s.likesPerHeart || 1);
      n = Math.min(s.maxBurst || 15, Math.floor(likeBank / per));
      likeBank -= n * per;
    } else if (ev.type === 'gift' && s.gifts) n = Math.min(s.maxBurst || 15, 3 + Math.round(Math.log10((ev.value || 1) + 1) * 4));
    else if (ev.type === 'follow' && s.follows) n = 5;
    if (!n) return;
    const room = Math.max(0, (s.max || 220) - parts.length - pending.length);
    n = Math.min(n, room);
    for (let i = 0; i < n; i += 1) {
      // Une photo de temps en temps au milieu des cœurs.
      const withFace = i === 0 && Math.random() < (s.avatarChance ?? 60) / 100;
      pending.push({ avatar: withFace ? ev.user?.avatar || '' : '', name: ev.user?.display || '' });
    }
  }

  let demoTimer = null;
  return {
    update(settings) {
      s = settings;
      clearInterval(demoTimer);
      if (isPreview) demoTimer = setInterval(() => onEv({ type: 'like', amount: 6 + Math.floor(Math.random() * 10), user: { display: 'Lena' } }), 500);
    },
    on(msg) { if (msg.t === 'ev') onEv(msg.ev); },
  };
}
