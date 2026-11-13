// Canon à cadeaux : à chaque cadeau, la photo du spectateur part en cloche à travers l'écran
// avec le vrai cadeau accroché, son pseudo et le nombre envoyé. Plus le cadeau vaut cher, plus il est gros.
import { el, isPreview, playSound } from '../lib.js';

const DEMO = [['Lena', 1], ['Marius', 30], ['Kenza', 500], ['Yanis', 5], ['Inès', 1000], ['Théo', 1], ['Sofia', 99]];

export function mount(root) {
  let s = {};
  let catalog = [];
  const canvas = el('canvas', 'gc-canvas');
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
    const im = images.get(src);
    return im.complete && im.naturalWidth ? im : null;
  };
  const shots = [];
  const sparks = [];
  const pending = [];
  let side = 1;
  let fontFam = 'sans-serif';
  let lastShot = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function fire(p) {
    const base = s.size || 90;
    const size = s.sizeByValue === false ? base : Math.min(base * 1.9, base * (0.8 + Math.log10((p.value || 1) + 1) * 0.3));
    const speed = (s.speed || 100) / 100;
    let from = s.side || 'alterne';
    if (from === 'alterne') { side = -side; from = side > 0 ? 'gauche' : 'droite'; }
    let x, y, vx, vy;
    if (from === 'bas') { x = rnd(W * 0.2, W * 0.8); y = H + size; vx = rnd(-4, 4) * speed; vy = -rnd(20, 26) * speed * (H / 1080) ** 0.5; } else {
      const dir = from === 'gauche' ? 1 : -1;
      x = dir > 0 ? -size : W + size; y = H * rnd(0.72, 0.88);
      vx = dir * rnd(13, 18) * speed * (W / 1920); vy = -rnd(17, 23) * speed * (H / 1080) ** 0.5;
    }
    shots.push({ ...p, x, y, vx, vy, size, rot: 0, vr: rnd(-0.05, 0.05), life: 0 });
    if (s.volume) playSound(s.sound || 'pop', s.volume);
    if (s.showCannon !== false && from !== 'bas') for (let i = 0; i < 18; i += 1) sparks.push({ x: from === 'gauche' ? 60 : W - 60, y: H * 0.86, vx: (from === 'gauche' ? 1 : -1) * rnd(2, 9), vy: rnd(-7, 1), life: rnd(20, 40), max: 40, col: `hsl(${rnd(20, 50)} 95% 60%)` });
  }

  function round(x, y, r, im, name) {
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.closePath();
    c.fillStyle = s.accent || '#FE2C55'; c.fill();
    c.clip();
    if (im) c.drawImage(im, x - r, y - r, r * 2, r * 2);
    else { c.fillStyle = '#fff'; c.font = `800 ${r}px ${fontFam}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(name || '?').replace(/^@/, '').slice(0, 1).toUpperCase(), x, y + r * 0.05); }
    c.restore();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.lineWidth = Math.max(3, r * 0.08); c.strokeStyle = s.ring || '#FFFFFF'; c.stroke();
  }

  function drawCannon(left) {
    c.save();
    c.translate(left ? 30 : W - 30, H * 0.9);
    c.scale(left ? 1 : -1, 1);
    c.rotate(-0.75);
    c.fillStyle = '#20232C'; c.strokeStyle = s.accent || '#FE2C55'; c.lineWidth = 5;
    c.beginPath(); c.roundRect(-20, -26, 120, 52, 18); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(92, -32, 22, 64, 8); c.fill(); c.stroke();
    c.restore();
    c.beginPath(); c.arc(left ? 40 : W - 40, H * 0.93, 30, 0, Math.PI * 2); c.fillStyle = '#2C303B'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#11131A'; c.stroke();
  }

  (function frame(now) {
    c.clearRect(0, 0, W, H);
    const rate = 1000 / Math.max(1, s.rate || 6);
    if (pending.length && now - lastShot > rate) { lastShot = now; fire(pending.shift()); }
    if (pending.length > 120) pending.splice(0, pending.length - 120);
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 1;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      c.globalAlpha = p.life / p.max; c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x, p.y, p.r || 3, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    const g = 0.42 * ((s.speed || 100) / 100) ** 2 * (H / 1080);
    for (let i = shots.length - 1; i >= 0; i -= 1) {
      const p = shots[i];
      p.vy += g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life += 1;
      if (s.trail !== false && p.life % 2 === 0) sparks.push({ x: p.x, y: p.y, vx: rnd(-1, 1), vy: rnd(-1, 1), life: 26, max: 26, col: s.accent || '#FE2C55', r: p.size * 0.08 });
      if (p.y > H + p.size * 2 || p.x < -p.size * 3 || p.x > W + p.size * 3) { shots.splice(i, 1); continue; }
      const r = p.size / 2;
      // Le cadeau accroché à la photo, un peu décalé, qui tourne avec elle.
      round(p.x, p.y, r, s.avatars === false ? null : img(p.avatar), p.name);
      const gi = img(p.giftImage);
      c.save(); c.translate(p.x + r * 0.78, p.y - r * 0.72); c.rotate(p.rot * 2);
      c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10;
      if (gi) c.drawImage(gi, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
      else if (p.emoji) { c.font = `${r * 0.95}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.emoji, 0, 0); }
      c.restore();
      if (p.count > 1) {
        const t = `×${p.count}`;
        c.font = `900 ${Math.round(r * 0.55)}px ${fontFam}`;
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.65)'; c.strokeText(t, p.x + r * 0.95, p.y + r * 0.55);
        c.fillStyle = s.text || '#FFFFFF'; c.fillText(t, p.x + r * 0.95, p.y + r * 0.55);
      }
      if (s.names !== false) {
        c.font = `800 ${Math.max(14, Math.round(r * 0.36))}px ${fontFam}`;
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(p.name, p.x, p.y + r + 6);
        c.fillStyle = s.text || '#FFFFFF'; c.fillText(p.name, p.x, p.y + r + 6);
      }
    }
    const from = s.side || 'alterne';
    if (s.showCannon !== false && from !== 'bas') {
      if (from !== 'droite') drawCannon(true);
      if (from !== 'gauche') drawCannon(false);
    }
    requestAnimationFrame(frame);
  })(0);

  function onEv(ev) {
    if (ev.type !== 'gift') return;
    if ((ev.value || 0) < (s.minCoins || 0)) return;
    const n = Math.max(1, ev.amount || 1);
    const base = { name: ev.user?.display || ev.user?.name || '', avatar: ev.user?.avatar || '', giftImage: ev.gift?.image || '', emoji: '🎁' };
    if (s.mode === 'rafale') {
      const k = Math.min(n, s.maxPerGift || 10);
      for (let i = 0; i < k; i += 1) pending.push({ ...base, value: (ev.value || n) / n, count: 1 });
    } else pending.push({ ...base, value: ev.value || 1, count: n });
  }

  let demoTimer = null;
  return {
    update(settings, data) {
      s = settings;
      setTimeout(() => { fontFam = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'sans-serif'; }, 0);
      if (data?.catalog) catalog = data.catalog.filter((g) => g.image);
      clearInterval(demoTimer);
      if (isPreview) demoTimer = setInterval(() => {
        const [name, v] = DEMO[Math.floor(Math.random() * DEMO.length)];
        const g = catalog.length ? catalog[Math.floor(Math.random() * catalog.length)] : null;
        pending.push({ name, avatar: '', giftImage: g?.image || '', emoji: '🎁', value: g?.cost || v, count: Math.random() < 0.3 ? 5 : 1 });
      }, 900);
    },
    on(msg) { if (msg.t === 'ev') onEv(msg.ev); },
  };
}
