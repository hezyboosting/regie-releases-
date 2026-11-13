// Pot à cadeaux : chaque cadeau tombe dans un récipient en verre, avec sa vraie image.
// Deux façons de remplir :
//  - « physique douce » : vrais chocs, mais amortis ; un objet posé s'endort et ne bouge plus tant
//    qu'on ne le bouscule pas, ce qui garde un tas calme même avec des centaines de cadeaux ;
//  - « rangés » : chaque cadeau rejoint sa place dans un empilement en nid d'abeille, bien emboîté.
// Les arrivées passent par une file à débit limité, et le pot plein se tasse ou se vide proprement.
import { el, isPreview, fmt } from '../lib.js';

const W = 440, H = 640, CX = W / 2;
const STORE = 'regie.coinjar';
const DEMO = [['🌹', 1], ['🌹', 1], ['🍩', 30], ['🎁', 5], ['💎', 500], ['🦁', 2999], ['🚀', 1000], ['🌹', 1], ['🎈', 10]];

// Récipients : ouverture, fond, demi-largeur intérieure, coins arrondis et fonds bombés.
const SHAPES = {
  bocal: { top: 150, bottom: 600, half: (y) => (y < 196 ? 118 : 164), corner: 44, neck: 196 },
  verre: { top: 122, bottom: 600, half: (y) => 152 - ((y - 122) / 478) * 30, corner: 20 },
  tube: { top: 122, bottom: 600, half: () => 104, bowl: { cy: 496, R: 104 } },
  rond: { top: 214, bottom: 604, half: (y) => Math.sqrt(Math.max(0, 200 ** 2 - (y - 404) ** 2)), ball: { cy: 404, R: 200 } },
};

export function mount(root) {
  let s = {};
  let catalog = [];
  const box = el('div', 'cj scaled');
  const canvas = el('canvas', 'cj-canvas');
  canvas.width = W * 2; canvas.height = H * 2;
  const label = el('div', 'cj-label');
  const title = el('b', 'cj-title');
  const total = el('span', 'cj-total');
  label.append(title, total);
  box.append(canvas, label);
  root.append(box);
  const c = canvas.getContext('2d');
  c.scale(2, 2);

  let bodies = [];
  let coins = 0;
  const pending = [];
  let lastDrop = 0;
  let likeBank = 0;
  const images = new Map();
  const img = (src) => {
    if (!src) return null;
    if (!images.has(src)) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = src; images.set(src, im); }
    return images.get(src);
  };

  const shape = () => SHAPES[s.shape] || SHAPES.bocal;
  const tidy = () => s.mode === 'range';
  const baseR = () => Math.max(10, Math.min(44, s.size || 20));
  const sizeOf = (value) => {
    if (tidy() || s.sizeByValue === false) return baseR();
    return Math.min(baseR() * 2.1, baseR() * (0.78 + Math.log10((value || 1) + 1) * 0.28));
  };

  // ---------- Parois ----------
  // Ramène un objet à l'intérieur du récipient. Renvoie la normale du contact (vers l'intérieur) ou null.
  function contain(b) {
    const sh = shape();
    if (b.out || b.y < sh.top - b.r * 0.4) return null;
    let nx = 0, ny = 0, hit = false;
    const radial = (ox, oy, R) => {
      const dx = b.x - ox, dy = b.y - oy, d = Math.hypot(dx, dy), lim = R - b.r;
      if (lim <= 0) { b.x = ox; b.y = Math.min(b.y, oy); return; }
      if (d > lim) { b.x = ox + (dx / d) * lim; b.y = oy + (dy / d) * lim; nx -= dx / d; ny -= dy / d; hit = true; }
    };
    if (sh.ball) radial(CX, sh.ball.cy, sh.ball.R);
    else if (sh.bowl && b.y > sh.bowl.cy) radial(CX, sh.bowl.cy, sh.bowl.R);
    else {
      const half = sh.half(b.y) - b.r;
      if (b.x < CX - half) { b.x = CX - half; nx += 1; hit = true; }
      if (b.x > CX + half) { b.x = CX + half; nx -= 1; hit = true; }
      if (sh.corner) {
        const hw = sh.half(sh.bottom), cy = sh.bottom - sh.corner;
        for (const side of [-1, 1]) {
          const ox = CX + side * (hw - sh.corner);
          if (b.y > cy && (b.x - ox) * side > 0) radial(ox, cy, sh.corner);
        }
      }
      if (b.y > sh.bottom - b.r) { b.y = sh.bottom - b.r; ny -= 1; hit = true; }
    }
    if (!hit) return null;
    const n = Math.hypot(nx, ny) || 1;
    return [nx / n, ny / n];
  }

  // ---------- Physique douce ----------
  const G = 0.38;
  const grid = new Map();
  const cell = 64;
  const keyOf = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  function rebuild() {
    grid.clear();
    for (const b of bodies) {
      if (b.out) continue;
      const k = keyOf(b.x, b.y);
      (grid.get(k) || grid.set(k, []).get(k)).push(b);
    }
  }
  function near(b, fn) {
    const gx = Math.floor(b.x / cell), gy = Math.floor(b.y / cell);
    for (let i = -1; i <= 1; i += 1) for (let j = -1; j <= 1; j += 1) {
      const list = grid.get(`${gx + i},${gy + j}`);
      if (list) for (const o of list) if (o !== b) fn(o);
    }
  }
  const wake = (b) => { b.sleep = false; b.still = 0; };

  function collide(a, b, e) {
    if (a.out || b.out) return;
    const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 < 1e-6) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    // Un objet qui dort sert d'appui fixe, sauf si on le percute franchement.
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (a.sleep && rel < -2.2) wake(a);
    if (b.sleep && rel < -2.2) wake(b);
    const ia = a.sleep ? 0 : 1 / (a.r * a.r), ib = b.sleep ? 0 : 1 / (b.r * b.r);
    if (!ia && !ib) return;
    const pen = Math.max(0, min - d - 0.25) * 0.8 / (ia + ib);
    a.x -= nx * pen * ia; a.y -= ny * pen * ia; b.x += nx * pen * ib; b.y += ny * pen * ib;
    if (rel < 0) {
      const j = (-(1 + e) * rel) / (ia + ib);
      a.vx -= nx * j * ia; a.vy -= ny * j * ia; b.vx += nx * j * ib; b.vy += ny * j * ib;
      // Frottement : les objets glissent peu les uns sur les autres, le tas tient.
      const tx = -ny, ty = nx;
      const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
      const jt = Math.max(-j * 0.5, Math.min(j * 0.5, -vt / (ia + ib)));
      a.vx -= tx * jt * ia; a.vy -= ty * jt * ia; b.vx += tx * jt * ib; b.vy += ty * jt * ib;
    }
    if (ny > 0.35) a.below = true; else if (ny < -0.35) b.below = true;
  }

  function physics() {
    const e = Math.max(0, Math.min(0.6, (s.bounce ?? 15) / 100));
    const sub = 2, dt = 1 / sub;
    for (let k = 0; k < sub; k += 1) {
      for (const b of bodies) {
        b.below = false;
        if (b.sleep || b.out) continue;
        b.vy += G * dt;
        b.vx *= 0.995; b.vy *= 0.998;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 16) { b.vx *= 16 / sp; b.vy *= 16 / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.dying) b.r = Math.max(0.5, b.r - b.r0 / 36);
      }
      rebuild();
      for (let it = 0; it < 6; it += 1) {
        for (const a of bodies) {
          if (a.out) continue;
          near(a, (o) => { if (o.id > a.id) collide(a, o, e); });
          const n = contain(a);
          if (n) {
            const vn = a.vx * n[0] + a.vy * n[1];
            if (vn < 0) { a.vx -= (1 + e) * vn * n[0]; a.vy -= (1 + e) * vn * n[1]; a.vx *= 0.9; }
            if (n[1] < -0.35) a.below = true;
          }
        }
      }
    }
    // Un objet endormi qui n'a plus rien en dessous (appui disparu) se réveille et retombe.
    for (const b of bodies) {
      if (!b.sleep || b.out) continue;
      const sh = shape();
      let held = b.y >= sh.bottom - b.r - 1.5;
      if (!held) {
        const probe = { x: b.x, y: b.y + 1.5, r: b.r };
        const n = contain(probe);
        held = Boolean(n && n[1] < -0.2);
      }
      if (!held) near(b, (o) => { if (!held && !o.out && o.y > b.y + 1) { const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < b.r + o.r + 1.5 && (o.y - b.y) / d > 0.3) held = true; } });
      if (!held) wake(b);
    }
    for (const b of bodies) {
      if (b.sleep || b.out) continue;
      b.rot += (b.vx / b.r) * 0.55;
      const slow = b.vx * b.vx + b.vy * b.vy < 0.03;
      b.still = slow && b.below ? (b.still || 0) + 1 : 0;
      if (b.still > 24) { b.sleep = true; b.vx = 0; b.vy = 0; }
    }
  }

  // ---------- Rangés : emplacements en nid d'abeille ----------
  let slots = [];
  let slotsKey = '';
  function buildSlots() {
    const sh = shape();
    const r = baseR();
    const key = `${s.shape}:${r}`;
    if (key === slotsKey) return;
    slotsKey = key;
    slots = [];
    const probe = { x: 0, y: 0, r };
    for (let row = 0; ; row += 1) {
      const y = sh.bottom - r - row * r * Math.sqrt(3) - 0.5;
      if (y < sh.top + r) break;
      const line = [];
      for (let m = -12; m <= 12; m += 1) {
        const x = CX + m * 2 * r + (row % 2 ? r : 0);
        probe.x = x; probe.y = y; probe.out = false;
        contain(probe);
        if (Math.abs(probe.x - x) < 0.5 && Math.abs(probe.y - y) < 0.5) line.push({ x, y, row });
      }
      line.sort((a, b) => Math.abs(a.x - CX) - Math.abs(b.x - CX) || a.x - b.x);
      slots.push(...line);
    }
  }
  function tidyMove() {
    buildSlots();
    let i = 0;
    for (const b of bodies) {
      if (b.out) continue;
      if (b.dying) { b.r = Math.max(0.5, b.r - b.r0 / 30); continue; }
      const t = slots[i];
      i += 1;
      if (!t) continue;
      b.r = baseR();
      if (b.landed) {
        b.x += (t.x - b.x) * 0.18; b.y += (t.y - b.y) * 0.18;
        continue;
      }
      b.x += (t.x - b.x) * 0.08;
      b.vy += G * 1.1;
      b.y += b.vy;
      if (b.y >= t.y) {
        b.y = t.y;
        if (b.vy > 3) { b.vy = -b.vy * 0.28; b.rot *= 0.5; } else { b.landed = true; b.vy = 0; b.rot = 0; }
      }
      b.rot *= 0.94;
    }
  }

  // ---------- Arrivées, débordement, vidage ----------
  let nextId = 1;
  function make(item, x, y) {
    const r = item.r || sizeOf(item.value);
    return { id: nextId++, x, y, vx: (Math.random() - 0.5) * 1.6, vy: 1 + Math.random() * 2, r, r0: r, src: item.src || '', emoji: item.emoji || '', value: item.value || 0, rot: (Math.random() - 0.5) * 0.8 };
  }
  function drop(item) {
    const sh = shape();
    const spread = Math.min(70, sh.half(sh.top + 1) - 30);
    const b = make(item, CX + (Math.random() - 0.5) * 2 * spread, sh.top - 50 - Math.random() * 40);
    bodies.push(b);
    coins += item.value || 0;
    overflow();
    save();
  }
  // Surface intérieure du récipient (mesurée une fois par forme), pour savoir quand il est plein.
  const areas = {};
  function areaOf() {
    const key = s.shape || 'bocal';
    if (areas[key]) return areas[key];
    const sh = shape();
    const probe = { x: 0, y: 0, r: 0.5 };
    let n = 0;
    for (let y = sh.top + 4; y < sh.bottom; y += 3) for (let x = 0; x < W; x += 3) {
      probe.x = x; probe.y = y; probe.out = false;
      contain(probe);
      if (Math.abs(probe.x - x) < 0.01 && Math.abs(probe.y - y) < 0.01) n += 1;
    }
    areas[key] = n * 9;
    return areas[key];
  }
  function overflow() {
    const live = bodies.filter((b) => !b.out && !b.dying);
    let cap = tidy() ? Math.min(s.max || 140, (buildSlots(), slots.length)) : (s.max || 140);
    // Physique : on compte aussi la place prise. Au-delà de ~70 % de la surface, le tas dépasserait.
    if (!tidy()) {
      const room = areaOf() * 0.7;
      let used = 0, fit = 0;
      for (let i = live.length - 1; i >= 0; i -= 1) { used += Math.PI * live[i].r0 * live[i].r0; if (used > room) break; fit += 1; }
      cap = Math.min(cap, Math.max(1, fit));
    }
    if (live.length <= cap) return;
    if (s.overflow === 'vider') { empty(); return; }
    // Les plus anciens fondent doucement : le tas descend sans s'écrouler.
    // Rangés : on retire tout le rang du bas d'un coup, et le reste descend d'un cran.
    let extra = live.length - cap;
    if (tidy()) extra = Math.max(extra, slots.filter((t) => t.row === 0).length);
    for (const b of live) { if (extra <= 0) break; b.dying = true; extra -= 1; }
    for (const b of bodies) wake(b);
  }
  function empty() {
    for (const b of bodies) { b.out = true; b.sleep = false; b.vy = 2 + Math.random() * 3; b.vx = (Math.random() - 0.5) * 3; }
    coins = 0;
    save();
  }
  function release(now) {
    const rate = Math.max(1, s.rate || 8);
    while (pending.length && now - lastDrop >= 1000 / rate) {
      lastDrop = now;
      drop(pending.shift());
      if (rate < 60) break;
    }
    if (pending.length > 400) pending.splice(0, pending.length - 400);
  }

  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (isPreview) return;
      try { localStorage.setItem(STORE, JSON.stringify({ coins, at: Date.now(), items: bodies.filter((b) => !b.out && !b.dying).map((b) => ({ r: b.r0, src: b.src, emoji: b.emoji, value: b.value })) })); } catch { /* stockage indisponible */ }
    }, 800);
  }
  // Au retour, les objets reprennent leur place directement, sans pluie ni bousculade.
  function restore() {
    if (isPreview) return;
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!d?.items) return;
      coins = d.coins || 0;
      place(d.items);
    } catch { /* rien à reprendre */ }
  }
  function place(items) {
    slotsKey = '';
    buildSlots();
    items.slice(-slots.length).forEach((it, i) => {
      const t = slots[i];
      // En physique douce, chacun garde sa taille et le tas se tasse tout seul, sans élan.
      const b = make({ ...it, r: tidy() ? baseR() : it.r || baseR() }, t.x, t.y);
      b.vx = 0; b.vy = 0; b.rot = 0; b.landed = true;
      bodies.push(b);
    });
  }

  // ---------- Dessin ----------
  function jarPath() {
    const sh = shape();
    c.beginPath();
    if (s.shape === 'tube') {
      c.roundRect(CX - 112, sh.top - 12, 224, sh.bottom - sh.top + 20, [12, 12, 112, 112]);
    } else if (s.shape === 'rond') {
      const a = Math.asin((sh.ball.cy - sh.top) / (sh.ball.R + 8));
      c.arc(CX, sh.ball.cy, sh.ball.R + 8, -Math.PI / 2 + (Math.PI / 2 - a) + 0.02, -Math.PI / 2 - (Math.PI / 2 - a) - 0.02 + Math.PI * 2);
      c.closePath();
    } else if (s.shape === 'verre') {
      c.moveTo(CX - 160, sh.top - 12); c.lineTo(CX + 160, sh.top - 12); c.lineTo(CX + 130, sh.bottom + 6); c.lineTo(CX - 130, sh.bottom + 6); c.closePath();
    } else {
      c.roundRect(CX - 126, sh.top - 32, 252, 52, 14);
      c.roundRect(CX - 172, sh.neck - 8, 344, sh.bottom - sh.neck + 16, 48);
    }
  }
  function drawJar(front) {
    const sh = shape();
    const glass = s.glass || '#CFE8FF';
    const alpha = Math.round(Math.max(0, Math.min(60, s.glassAlpha ?? 14)) * 2.55).toString(16).padStart(2, '0');
    c.save();
    jarPath();
    if (!front) {
      c.fillStyle = `${glass}${alpha}`; c.fill();
    } else {
      c.lineWidth = 4; c.strokeStyle = `${glass}B0`; c.stroke();
      const grd = c.createLinearGradient(CX - 172, 0, CX + 172, 0);
      grd.addColorStop(0, '#FFFFFF4A'); grd.addColorStop(0.16, '#FFFFFF10'); grd.addColorStop(0.82, '#FFFFFF05'); grd.addColorStop(0.96, '#FFFFFF2C');
      c.fillStyle = grd; c.fill();
      c.beginPath(); c.roundRect(CX - 142, (sh.neck || sh.top) + 26, 13, (sh.bottom - sh.top) * 0.5, 7); c.fillStyle = '#FFFFFF3C'; c.fill();
      if (s.lid !== false && (s.shape || 'bocal') === 'bocal') {
        c.beginPath(); c.roundRect(CX - 136, sh.top - 52, 272, 26, 10); c.fillStyle = s.accent || '#F3D38A'; c.fill();
        c.beginPath(); c.roundRect(CX - 136, sh.top - 52, 272, 9, [10, 10, 0, 0]); c.fillStyle = '#FFFFFF40'; c.fill();
      }
      if (s.labelPos === 'etiquette') {
        const y = sh.top + (sh.bottom - sh.top) * 0.46;
        c.beginPath(); c.roundRect(CX - 112, y - 44, 224, 88, 14);
        c.fillStyle = '#FFFFFFE6'; c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0;
        c.lineWidth = 3; c.strokeStyle = s.accent || '#F3D38A'; c.stroke();
      }
    }
    c.restore();
  }
  function drawBodies() {
    for (const b of bodies) {
      if (b.r < 1) continue;
      c.save();
      c.translate(b.x, b.y); c.rotate(b.rot || 0);
      if (b.dying || b.out) c.globalAlpha = Math.max(0, Math.min(1, b.out ? 1 - (b.y - 560) / 120 : b.r / b.r0));
      const im = img(b.src);
      if (im && im.complete && im.naturalWidth) {
        const sz = b.r * 2.45;
        c.drawImage(im, -sz / 2, -sz / 2, sz, sz);
      } else if (b.emoji) {
        c.font = `${b.r * 1.75}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(b.emoji, 0, b.r * 0.1);
      } else {
        c.beginPath(); c.arc(0, 0, b.r, 0, 6.283); c.fillStyle = s.accent || '#F3D38A'; c.fill();
      }
      c.restore();
    }
  }
  function draw() {
    c.clearRect(0, 0, W, H);
    drawJar(false);
    drawBodies();
    drawJar(true);
    const pos = s.labelPos || 'haut';
    label.hidden = pos === 'cache';
    label.dataset.pos = pos;
    if (pos === 'etiquette') { const sh = shape(); label.style.top = `${sh.top + (sh.bottom - sh.top) * 0.46 - 34}px`; } else label.style.top = '';
    title.textContent = s.title || '';
    total.textContent = s.showCount !== false ? `${fmt(Math.round(coins))} pièces` : '';
  }

  let paused = false;
  (function frame(now) {
    release(now || 0);
    if (tidy()) tidyMove(); else physics();
    for (const b of bodies) if (b.out) { b.vy += G; b.x += b.vx; b.y += b.vy; }
    bodies = bodies.filter((b) => !(b.out && b.y > H + 60) && !(b.dying && b.r <= 0.6));
    if (!paused) draw();
    requestAnimationFrame(frame);
  })();
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  // ---------- Événements ----------
  function queue(item, n = 1) { for (let k = 0; k < n; k += 1) pending.push(item); }
  function onEv(ev) {
    if (ev.type === 'gift') {
      const per = Math.max(1, s.perGift || 10);
      const n = Math.min(per, Math.max(1, ev.amount || 1));
      const each = (ev.value || n) / n;
      queue({ src: ev.gift?.image, emoji: '🎁', value: each }, n);
    } else if (ev.type === 'bits' || ev.type === 'superchat' || ev.type === 'supersticker') {
      queue({ emoji: '💎', value: ev.value || ev.amount || 1 });
    } else if (ev.type === 'like' && s.likes) {
      likeBank += ev.amount || 1;
      const every = Math.max(1, s.likesEvery || 50);
      const n = Math.min(10, Math.floor(likeBank / every));
      likeBank -= n * every;
      queue({ emoji: '❤️', value: 0 }, n);
    } else if (ev.type === 'follow' && s.follows !== false) {
      queue({ emoji: '⭐', value: 0 });
    } else if (ev.type === 'share' && s.shares) {
      queue({ emoji: '🔁', value: 0 });
    }
  }

  // Aperçu : de vrais cadeaux du catalogue quand il est chargé, sinon des émojis.
  let demoTimer = null;
  function demo() {
    clearInterval(demoTimer);
    if (!isPreview) return;
    demoTimer = setInterval(() => {
      if (catalog.length) {
        const g = catalog[Math.floor(Math.random() * catalog.length)];
        queue({ src: g.image, emoji: '🎁', value: g.cost || 1 });
      } else {
        const [e, v] = DEMO[Math.floor(Math.random() * DEMO.length)];
        queue({ emoji: e, value: v });
      }
    }, 260);
  }

  let resetTimer = null;
  let started = false;
  return {
    update(settings, data) {
      const prev = s;
      s = settings;
      if (data?.catalog) catalog = data.catalog.filter((g) => g.image);
      clearInterval(resetTimer);
      if (s.resetMin > 0) resetTimer = setInterval(empty, s.resetMin * 60000);
      box.style.setProperty('--text', s.text || '#F2F5F9');
      box.style.setProperty('--accent', s.accent || '#F3D38A');
      if (!started) { started = true; restore(); demo(); return; }
      // Changement de récipient, de taille ou de mode : tout reprend sa place sans pluie.
      if (prev.shape !== s.shape || prev.mode !== s.mode || prev.size !== s.size) {
        const items = bodies.filter((b) => !b.out && !b.dying).map((b) => ({ r: b.r0, src: b.src, emoji: b.emoji, value: b.value }));
        bodies = [];
        slotsKey = '';
        place(items);
      }
      if (isPreview) demo();
    },
    on(msg) {
      if (msg.t === 'ev') onEv(msg.ev);
      if (msg.t === 'coinjar' && msg.action === 'empty') empty();
    },
  };
}
