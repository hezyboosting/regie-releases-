// Outils partagés par tous les overlays. Le texte des viewers passe toujours par textContent.
import { crest } from './crest.js';

export const query = new URLSearchParams(location.search);
export const isPreview = Boolean(query.get('preview'));
const key = query.get('k');

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

export function setVars(node, vars) {
  for (const [k, v] of Object.entries(vars)) node.style.setProperty(`--${k}`, v);
}

const FONTS = {
  onest: '"Onest", system-ui, sans-serif', geist: '"Geist", system-ui, sans-serif', syne: '"Syne", "Geist", sans-serif', archivo: '"Archivo", system-ui, sans-serif', system: 'system-ui, "Segoe UI", sans-serif', serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Nunito", "Arial Rounded MT Bold", "Segoe UI", sans-serif', impact: 'Impact, "Arial Narrow Bold", sans-serif',
};
export const setFont = (f) => document.documentElement.style.setProperty('--font', FONTS[f] || FONTS.onest);

export const PLATFORM = {
  tiktok: { label: 'TikTok', short: 'TT', color: '#FE2C55' }, twitch: { label: 'Twitch', short: 'TW', color: '#9146FF' },
  youtube: { label: 'YouTube', short: 'YT', color: '#FF0033' }, kick: { label: 'Kick', short: 'KI', color: '#53FC18' },
};

export const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
export const clock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (v) => String(v).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

export const proxied = (url) => (url ? `/proxy?k=${encodeURIComponent(key)}&u=${encodeURIComponent(url)}` : '');
export const media = (v) => {
  if (!v) return '';
  if (/^https?:/.test(v)) return v;
  return `/media/${encodeURIComponent(v)}?k=${encodeURIComponent(key)}`;
};

const BUILTIN = ['chime', 'pop', 'coins', 'fanfare', 'horn', 'tally'];
export function playSound(sound, volume = 80, master = 100) {
  if (!sound || sound === 'none') return;
  const a = new Audio(BUILTIN.includes(sound) ? `/assets/sounds/${sound}.wav` : media(sound));
  a.volume = Math.max(0, Math.min(1, (volume / 100) * (master / 100)));
  a.play().catch(() => {});
}

export function tag(platform) {
  const p = PLATFORM[platform];
  const t = el('span', 'pf', p ? p.short : '');
  if (p) t.style.background = p.color;
  return t;
}

export function hexToRgb(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || '') || [];
  return m.length ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

export const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Blason de rang dessiné pour Régie : les paliers se lisent au nombre de pointes et de pastilles.
// Blason d'un rang, ou l'image du streamer si elle existe.
export function emblem(rank, size = 96, image = '') {
  if (image) {
    const i = el('img', 'emblem');
    i.src = media(image); i.alt = ''; i.width = size; i.height = size;
    i.style.objectFit = 'contain';
    return i;
  }
  const t = document.createElement('template');
  t.innerHTML = crest({ ...rank, size });
  return t.content.firstElementChild;
}

export function initials(name) { return String(name || '?').replace(/^@/, '').slice(0, 1).toUpperCase(); }

export function avatar(url, name, cls = 'av') {
  if (url) { const i = el('img', cls); i.src = url; i.alt = ''; i.referrerPolicy = 'no-referrer'; return i; }
  return el('span', `${cls} av-txt`, initials(name));
}

// Confettis sur un canvas plein écran.
let confettiCanvas = null;
let parts = [];
function confettiLoop() {
  const c = confettiCanvas.getContext('2d');
  c.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  parts = parts.filter((p) => p.y < confettiCanvas.height + 30 && p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.vx *= 0.99; p.rot += p.vr; p.life -= 1;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.globalAlpha = Math.min(1, p.life / 40);
    c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); c.restore();
  }
  if (parts.length) requestAnimationFrame(confettiLoop); else c.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}
export function confetti(colors = ['#8FD3FF', '#FFFFFF', '#B9A7FF', '#F3D38A'], count = 140) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!confettiCanvas) { confettiCanvas = el('canvas', 'fx-canvas'); document.body.append(confettiCanvas); }
  confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight;
  const start = parts.length === 0;
  for (let i = 0; i < count; i += 1) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const v = 7 + Math.random() * 11;
    parts.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.7, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 6 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, color: colors[i % colors.length], life: 160 + Math.random() * 80 });
  }
  if (start) requestAnimationFrame(confettiLoop);
}
