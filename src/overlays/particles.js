// Particules de saison derrière l'overlay : neige, cœurs, feuilles, pétales, citrouilles, confettis, soleil, étoiles.
// Un seul canevas, une seule boucle, coupée quand il n'y a rien à dessiner.
const KINDS = {
  neige: { n: 70, vy: [25, 70], vx: [-12, 12], size: [2, 5], draw: (c, p) => { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(0, 0, p.s, 0, 7); c.fill(); } },
  coeurs: { n: 26, vy: [-55, -25], vx: [-10, 10], size: [14, 26], up: true, draw: (c, p) => emoji(c, '❤', p.s, '#FF5C8A') },
  feuilles: { n: 24, vy: [30, 60], vx: [-25, 25], size: [18, 28], spin: true, draw: (c, p) => emoji(c, p.alt ? '🍁' : '🍂', p.s) },
  petales: { n: 40, vy: [25, 55], vx: [-20, 20], size: [5, 9], spin: true, draw: (c, p) => { c.fillStyle = p.alt ? '#FFD1E3' : '#FFB7D5'; c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 7); c.fill(); } },
  citrouilles: { n: 18, vy: [30, 60], vx: [-15, 15], size: [20, 30], spin: true, draw: (c, p) => emoji(c, p.alt ? '🦇' : '🎃', p.s) },
  confettis: { n: 60, vy: [60, 120], vx: [-30, 30], size: [5, 9], spin: true, draw: (c, p) => { c.fillStyle = p.color; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); } },
  soleil: { n: 28, vy: [-12, -4], vx: [-8, 8], size: [3, 9], up: true, twinkle: true, draw: (c, p) => { const g = c.createRadialGradient(0, 0, 0, 0, 0, p.s * 2.4); g.addColorStop(0, 'rgba(255,230,140,.9)'); g.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.s * 2.4, 0, 7); c.fill(); } },
  etoiles: { n: 40, vy: [-3, 3], vx: [-3, 3], size: [1, 3], twinkle: true, draw: (c, p) => { c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, p.s, 0, 7); c.fill(); } },
};
const COLORS = ['#FFD24A', '#FF4D6D', '#3DF0C2', '#57B8FF', '#B46BFF', '#FFFFFF'];
const rnd = (a, b) => a + Math.random() * (b - a);
function emoji(c, ch, size, color) {
  c.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (color) c.fillStyle = color;
  c.fillText(ch, 0, 0);
}

let canvas = null;
let ctx = null;
let kind = 'none';
let parts = [];
let raf = 0;
let last = 0;

function spawn(k, w, h, anywhere) {
  const d = KINDS[k];
  return {
    x: rnd(0, w), y: anywhere ? rnd(0, h) : (d.up ? h + 30 : -30), vx: rnd(...d.vx), vy: rnd(...d.vy), s: rnd(...d.size), r: rnd(0, 6.3), vr: d.spin ? rnd(-2, 2) : 0,
    alt: Math.random() < 0.4, color: COLORS[Math.floor(Math.random() * COLORS.length)], t: Math.random() * 6, a: 1,
  };
}

function loop(now) {
  const d = KINDS[kind];
  if (!d) { raf = 0; return; }
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  const target = Math.min(120, Math.round(d.n * Math.max(0.35, (w * h) / (1920 * 1080))));
  while (parts.length < target) parts.push(spawn(kind, w, h, parts.length < target && last < 1000));
  ctx.clearRect(0, 0, w, h);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.t += dt;
    p.x += (p.vx + Math.sin(p.t * 1.3) * 12) * dt;
    p.y += p.vy * dt;
    p.r += p.vr * dt;
    if (p.y > h + 40 || p.y < -40 || p.x < -40 || p.x > w + 40) { parts[i] = spawn(kind, w, h, false); continue; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.globalAlpha = d.twinkle ? 0.35 + 0.65 * Math.abs(Math.sin(p.t * 2)) : 0.9;
    d.draw(ctx, p);
    ctx.restore();
  }
  raf = requestAnimationFrame(loop);
}

export function setParticles(next) {
  const k = KINDS[next] ? next : 'none';
  if (k === kind) return;
  kind = k;
  parts = [];
  if (k === 'none') { cancelAnimationFrame(raf); raf = 0; if (canvas) canvas.remove(); canvas = null; return; }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-particles';
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
  }
  last = 0;
  // Au démarrage, les particules sont déjà réparties sur tout l'écran.
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  for (let i = 0; i < KINDS[k].n; i += 1) parts.push(spawn(k, w, h, true));
  if (!raf) raf = requestAnimationFrame(loop);
}
