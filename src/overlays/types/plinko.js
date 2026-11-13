// Plinko : la planche de clous, les balles avec la vraie image du cadeau (ou la photo du parieur),
// les cases en verre en bas. Régie tire le trajet, l'overlay l'anime rebond par rebond.
import { el, setVars, isPreview, fmt, rgba } from '../lib.js';

const DEMO_ROWS = 12;
const demoBins = (n) => {
  const m = [20, 5.5, 2.5, 1.3, 0.9, 0.7, 0.7, 0.7, 0.9, 1.3, 2.5, 5.5, 20];
  const col = ['#D13DFF', '#FF3D7F', '#FF5E4D', '#FF8A3D', '#FFB13D', '#FFD84D', '#FFD84D', '#FFD84D', '#FFB13D', '#FF8A3D', '#FF5E4D', '#FF3D7F', '#D13DFF'];
  return Array.from({ length: n }, (_, i) => ({ label: `×${String(m[i] ?? 1).replace('.', ',')}`, color: col[i] || '#FFD84D' }));
};

export function mount(root) {
  let s = {};
  let v = { rows: DEMO_ROWS, bins: demoBins(DEMO_ROWS + 1), stepMs: 260, recent: [] };
  const box = el('div', 'panel gx pk scaled');
  const head = el('div', 'pk-head');
  const title = el('span', 'gx-label', 'Plinko');
  const hint = el('span', 'pk-hint');
  head.append(title, hint);
  const stage = el('div', 'pk-stage');
  const canvas = el('canvas', 'pk-canvas');
  const binsRow = el('div', 'pk-bins');
  const pops = el('div', 'pk-pops');
  stage.append(canvas, binsRow, pops);
  const feed = el('div', 'pk-feed');
  stage.append(feed);
  box.append(el('div', 'gx-shine'), head, stage);
  root.append(box);
  const c = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let geo = null;
  const balls = new Map();
  const pegHits = new Map();
  const images = new Map();
  const img = (src) => {
    if (!src) return null;
    if (!images.has(src)) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = src; images.set(src, im); }
    const im = images.get(src);
    return im.complete && im.naturalWidth ? im : null;
  };

  // ---- Petit « tic » de rebond, synthétisé (aucun fichier son à charger).
  let audio = null;
  function tick(pitch = 1) {
    if (!s.sound) return;
    try {
      audio = audio || new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = 900 * pitch + Math.random() * 120;
      g.gain.setValueAtTime(((s.volume ?? 40) / 100) * 0.12, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.07);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.08);
    } catch { /* son facultatif */ }
  }

  function layout() {
    const r = stage.getBoundingClientRect();
    dpr = devicePixelRatio || 1;
    W = Math.max(50, r.width);
    H = Math.max(50, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const R = v.rows;
    const binH = Math.max(34, Math.min(50, W / (R + 2) * 0.9));
    const top = 18;
    const bottom = H - binH - 22;
    const sp = (W - 16) / (R + 2);
    const dy = Math.min((bottom - top) / Math.max(1, R - 1), sp * 1.02);
    const cx = W / 2;
    // La planche est posée sur les cases : l'espace libre reste en haut, où s'affichent les derniers gains.
    const y0 = bottom - dy * (R - 1);
    geo = { R, sp, dy, cx, y0, pegR: Math.max(2.2, sp * 0.085), ballR: Math.max(7, sp * 0.3 * ((s.ballSize ?? 100) / 100)), binY: H - binH - 4, binH };
    binsRow.textContent = '';
    binsRow.style.height = `${binH}px`;
    v.bins.forEach((b, i) => {
      const d = el('div', 'pk-bin');
      d.style.left = `${cx + (i - R / 2) * sp - sp / 2 + 2}px`;
      d.style.width = `${sp - 4}px`;
      d.style.setProperty('--c', b.color || '#FFD84D');
      d.append(el('b', '', b.label));
      binsRow.append(d);
    });
  }

  const pegX = (r, j) => geo.cx + (j - (r + 2) / 2) * geo.sp;
  const rowY = (r) => geo.y0 + r * geo.dy;
  // Position du contact sur le clou de la rangée r, après « rights » rebonds à droite.
  const contact = (r, rights) => ({ x: geo.cx + (rights - r / 2) * geo.sp, y: rowY(r) - geo.pegR - geo.ballR * 0.9 });

  function drop(d) {
    if (!geo) layout();
    const b = { ...d, t0: performance.now(), done: false, trail: [], rot: Math.random() * 6, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3), lastStep: -1 };
    balls.set(d.id, b);
  }

  function ballPos(b, now) {
    const step = v.stepMs || 260;
    const t = (now - b.t0) / step; // 0..1 : chute jusqu'au premier clou, puis un rebond par rangée
    const R = geo.R;
    if (t < 1) {
      const p = contact(0, 0);
      const e = t * t;
      return { x: p.x, y: rowY(0) - geo.dy * 1.6 + (p.y - (rowY(0) - geo.dy * 1.6)) * e, step: -1 };
    }
    const k = Math.floor(t - 1);
    const f = (t - 1) - k;
    let rights = 0;
    for (let i = 0; i < Math.min(k, R); i += 1) rights += b.path[i];
    if (k >= R) {
      const binX = geo.cx + (b.bin - R / 2) * geo.sp;
      const sink = Math.min(1, (t - 1 - R) * 2.2);
      return { x: binX, y: geo.binY - geo.ballR * 0.2 + sink * geo.ballR * 0.6, step: R, landed: true, fade: Math.min(1, Math.max(0, (t - 1 - R - 0.6) * 2)) };
    }
    const a = contact(k, rights);
    const isLast = k === R - 1;
    const nextRights = rights + b.path[k];
    const bTarget = isLast ? { x: geo.cx + (nextRights - R / 2) * geo.sp, y: geo.binY - geo.ballR * 0.2 } : contact(k + 1, nextRights);
    const hop = geo.dy * 0.42;
    const x = a.x + (bTarget.x - a.x) * f;
    const y = a.y + (bTarget.y - a.y) * f * f - hop * 4 * f * (1 - f) * (1 - f * 0.4);
    return { x, y, step: k, rights };
  }

  function drawPegs(now) {
    const R = geo.R;
    const pc = s.pegColor || '#FFFFFF';
    for (let r = 0; r < R; r += 1) {
      for (let j = 0; j < r + 3; j += 1) {
        const x = pegX(r, j), y = rowY(r);
        const hit = pegHits.get(`${r}:${j}`);
        const glow = hit ? Math.max(0, 1 - (now - hit.at) / 380) : 0;
        if (glow > 0 && s.glow !== false) {
          c.fillStyle = rgba(hit.color || s.accent || '#3DF0C2', 0.35 * glow);
          c.beginPath(); c.arc(x, y, geo.pegR * (2.6 + glow * 2), 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = glow > 0 ? (hit.color || s.accent || '#3DF0C2') : rgba(pc, 0.85);
        c.beginPath(); c.arc(x, y, geo.pegR * (1 + glow * 0.5), 0, Math.PI * 2); c.fill();
      }
    }
  }

  function drawBall(b, p) {
    const r = geo.ballR;
    const alpha = 1 - (p.fade || 0);
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    if (s.trail !== false) {
      b.trail.push({ x: p.x, y: p.y });
      if (b.trail.length > 10) b.trail.shift();
      b.trail.forEach((q, i) => { c.fillStyle = rgba(s.accent || '#3DF0C2', (i / b.trail.length) * 0.18); c.beginPath(); c.arc(q.x, q.y, r * (0.4 + (i / b.trail.length) * 0.5), 0, Math.PI * 2); c.fill(); });
    }
    const im = img(b.image);
    c.translate(p.x, p.y);
    if (s.glow !== false) { c.shadowColor = rgba(s.accent || '#3DF0C2', 0.7); c.shadowBlur = r * 0.9; }
    if (im) {
      c.rotate(b.rot);
      c.drawImage(im, -r * 1.15, -r * 1.15, r * 2.3, r * 2.3);
    } else {
      const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, s.accent || '#3DF0C2'); g.addColorStop(1, rgba(s.accent || '#3DF0C2', 0.6));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function frame(now) {
    if (geo) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      drawPegs(now);
      for (const [id, b] of balls) {
        const p = ballPos(b, now);
        b.rot += b.spin * 0.016;
        if (p.step !== b.lastStep) {
          if (p.step >= 0 && p.step < geo.R) {
            const rights = p.rights;
            pegHits.set(`${p.step}:${rights + 1}`, { at: now, color: v.bins[b.bin]?.color });
            tick(1 + p.step * 0.04);
          } else if (p.landed && !b.pulsed) {
            b.pulsed = true;
            const node = binsRow.children[b.bin];
            if (node) { node.classList.remove('hit'); void node.offsetWidth; node.classList.add('hit'); }
            tick(1.6);
          }
          b.lastStep = p.step;
        }
        drawBall(b, p);
        if (p.landed && p.fade >= 1) balls.delete(id);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function popText(entry) {
    if (!geo) return;
    const x = geo.cx + (entry.bin - geo.R / 2) * geo.sp;
    const p = el('div', 'pk-pop');
    p.style.left = `${x}px`;
    p.style.top = `${geo.binY - geo.ballR * 1.6}px`;
    p.style.setProperty('--c', entry.color || '#FFD84D');
    p.append(el('b', '', entry.payout ? `+${fmt(entry.payout)}` : entry.label), el('small', '', entry.user || ''));
    pops.append(p);
    setTimeout(() => p.remove(), 1900);
    if (s.showFeed !== false) {
      const it = el('div', 'pk-it');
      it.style.setProperty('--c', entry.color || '#FFD84D');
      if (entry.image) { const im = el('img'); im.src = entry.image; im.referrerPolicy = 'no-referrer'; it.append(im); }
      it.append(el('b', '', entry.user || ''), el('span', 'pk-it-l', entry.label), el('span', 'pk-it-p', entry.payout ? `+${fmt(entry.payout)}` : ''));
      feed.prepend(it);
      while (feed.children.length > (s.feedCount ?? 4)) feed.lastChild.remove();
    }
  }

  function setView(nv) {
    const rowsChanged = !geo || nv.rows !== v.rows || JSON.stringify(nv.bins.map((b) => [b.label, b.color])) !== JSON.stringify(v.bins.map((b) => [b.label, b.color]));
    v = { ...v, ...nv };
    hint.textContent = v.command && s.showHint !== false ? `${v.command} 100 pour jouer` : '';
    if (rowsChanged) layout();
  }

  let demoTimer = null;
  function demo() {
    clearInterval(demoTimer);
    if (!isPreview) return;
    const gifts = ['/img/rose.png', '/img/donut.png', '/img/couronne.png', '/img/diamant.png', '/img/lion.png'];
    let n = 0;
    const one = () => {
      const path = Array.from({ length: v.rows }, () => (Math.random() < 0.5 ? 0 : 1));
      const bin = path.reduce((a, x) => a + x, 0);
      const id = `d${n += 1}`;
      const image = gifts[n % gifts.length];
      drop({ id, path, bin, image, user: ['Léna', 'Marius', 'Kenza', 'Yanis'][n % 4] });
      setTimeout(() => popText({ bin, label: v.bins[bin]?.label, color: v.bins[bin]?.color, payout: 0, user: ['Léna', 'Marius', 'Kenza', 'Yanis'][n % 4], image }), (v.rows + 1) * (v.stepMs || 260) + 200);
    };
    one();
    demoTimer = setInterval(one, 900);
  }

  new ResizeObserver(() => layout()).observe(stage);

  return {
    update(settings, data) {
      s = settings;
      setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
      title.textContent = s.title || 'Plinko';
      head.hidden = s.showTitle === false;
      feed.hidden = s.showFeed === false;
      if (data?.view) setView(data.view);
      requestAnimationFrame(() => { layout(); if (isPreview && !demoTimer) demo(); });
    },
    on(msg) {
      if (msg.t !== 'plinko') return;
      if (msg.view) setView(msg.view);
      if (msg.drop) drop(msg.drop);
      if (msg.land) popText(msg.land);
    },
  };
}
