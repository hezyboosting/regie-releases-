// Feu d'artifice de cadeaux : chaque cadeau part en fusée depuis le bas de l'écran et explose en
// étincelles et en copies de son image. Plus le cadeau vaut cher, plus l'explosion est grande.
import { el, isPreview, GIFT_ICON } from '../lib.js';

const DEMO = ['🎁', '💎', '⭐', '🎉'];

export function mount(root) {
  let s = {};
  const canvas = el('canvas', 'fw');
  root.append(canvas);
  const c = canvas.getContext('2d');
  let W = 0, H = 0;
  const fit = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };
  fit();
  addEventListener('resize', fit);

  const images = new Map();
  const img = (src) => {
    if (!src) return null;
    if (!images.has(src)) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = src; images.set(src, im); }
    return images.get(src);
  };

  const rockets = [];
  const parts = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hex = (h) => { const n = Number.parseInt(String(h || '#F3D38A').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  function launch({ value = 1, image = '', emoji = '' }) {
    const power = (s.power ?? 60) / 100;
    const big = s.bigOnly !== false && value >= 1000;
    const size = Math.min(1, 0.25 + Math.log10(value + 1) / 4) * power;
    const x = rnd(W * 0.15, W * 0.85);
    rockets.push({ x, y: H + 10, vx: rnd(-1.5, 1.5), vy: -rnd(13, 17) * (0.75 + size * 0.5), size, image, emoji, big, trail: [] });
  }

  function burst(r) {
    const [cr, cg, cb] = hex(s.accent);
    const count = Math.round(40 + r.size * 140 + (r.big ? 120 : 0));
    const speed = 3 + r.size * 7 + (r.big ? 4 : 0);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + rnd(-0.05, 0.05), v = speed * rnd(0.55, 1);
      const hue = Math.random() < 0.65;
      parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(55, 95), max: 95, col: hue ? `rgb(${cr},${cg},${cb})` : `hsl(${rnd(0, 360)} 95% 65%)`, r: rnd(1.6, 3.2) });
    }
    const pics = Math.round(6 + r.size * 14 + (r.big ? 12 : 0));
    for (let i = 0; i < pics; i += 1) {
      const a = (i / pics) * Math.PI * 2, v = speed * rnd(0.4, 0.8);
      parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(70, 110), max: 110, image: r.image, emoji: r.emoji, r: 18 + r.size * 22, rot: rnd(0, 6.28), vr: rnd(-0.1, 0.1) });
    }
    if (r.big) setTimeout(() => burst({ ...r, big: false, x: r.x + rnd(-160, 160), y: r.y + rnd(-90, 60) }), 260);
  }

  (function frame() {
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const r = rockets[i];
      r.trail.push([r.x, r.y]); if (r.trail.length > 12) r.trail.shift();
      r.x += r.vx; r.y += r.vy; r.vy += 0.22;
      c.beginPath(); c.moveTo(r.trail[0][0], r.trail[0][1]);
      for (const [tx, ty] of r.trail) c.lineTo(tx, ty);
      c.strokeStyle = 'rgba(255,230,180,.8)'; c.lineWidth = 3; c.stroke();
      if (r.vy >= -1.5) { burst(r); rockets.splice(i, 1); }
    }
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.vx *= 0.985; p.vy *= 0.985; p.life -= 1;
      const a = Math.max(0, p.life / p.max);
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.image || p.emoji) {
        c.globalCompositeOperation = 'source-over';
        c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.rotate(p.rot += p.vr);
        const im = img(p.image);
        if (im && im.complete && im.naturalWidth) c.drawImage(im, -p.r, -p.r, p.r * 2, p.r * 2);
        else { c.font = `${p.r * 1.6}px "Segoe UI Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.emoji || '🎁', 0, 0); }
        c.restore();
        c.globalCompositeOperation = 'lighter';
      } else {
        c.globalAlpha = a; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fillStyle = p.col; c.fill();
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }());

  function onEv(ev) {
    if (ev.type === 'gift') {
      const value = ev.value || ev.amount || 1;
      if (value < (s.minCoins || 1)) return;
      launch({ value, image: ev.gift?.image, emoji: '🎁' });
    } else if ((ev.type === 'bits' || ev.type === 'superchat' || ev.type === 'supersticker') && (ev.value || ev.amount || 0) >= (s.minCoins || 1)) {
      launch({ value: ev.value || ev.amount, emoji: '💎' });
    } else if (ev.type === 'follow' && s.follows) {
      launch({ value: 1, emoji: '⭐' });
    } else if (['sub', 'resub', 'giftsub', 'member'].includes(ev.type) && s.subs !== false) {
      launch({ value: 300, emoji: '💜' });
    }
  }

  // Aperçu : de vrais cadeaux du catalogue quand il est chargé.
  let catalog = [];
  if (isPreview) setInterval(() => {
    const g = catalog.length ? catalog[Math.floor(Math.random() * catalog.length)] : null;
    const v = g?.cost || [5, 30, 99, 500, 1500][Math.floor(Math.random() * 5)];
    launch({ value: Math.max(5, v), image: g?.image || (Math.random() < 0.5 ? GIFT_ICON : ''), emoji: DEMO[Math.floor(Math.random() * DEMO.length)] });
  }, 1100);

  return {
    update(settings, data) { s = settings; if (data?.catalog) catalog = data.catalog.filter((x) => x.image); },
    on(msg) { if (msg.t === 'ev') onEv(msg.ev); },
  };
}
