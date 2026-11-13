// Roue de la fortune : les viewers la lancent (cadeau, commande, likes), elle s'arrête sur une case,
// et la case lance ses actions côté Régie. Dessin SVG net à toutes les tailles, rotation calculée à la main
// pour faire « cliquer » chaque case sous le repère.
import { el, svg, isPreview, media, confetti } from '../lib.js';

const DEMO = {
  status: 'idle', title: 'Roue de la fortune', command: '!roue', minCoins: 10, likesEvery: 1000, queue: 0, next: [],
  segments: [
    { label: 'Gage du chat', color: '#FF4D6D' }, { label: '100 points', color: '#3DF0C2' }, { label: 'Confettis', color: '#FFC53D' }, { label: 'Rien du tout', color: '#6F8FB5' },
    { label: 'Défi de 2 minutes', color: '#8B3DFF' }, { label: 'Fanfare', color: '#57B8FF' }, { label: 'Jackpot', color: '#FFD24A' }, { label: 'Relance !', color: '#3BBF7C' },
  ],
};
const R = 300;
const C = 320;
// Arrêt de la roue : doux, suspense (fin très lente) ou rebond (dépasse un peu puis revient).
const EASES = {
  douce: (t) => 1 - (1 - t) ** 4,
  suspense: (t) => 1 - (1 - t) ** 6,
  rebond: (t) => { const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
};
// Palettes prêtes : elles remplacent les couleurs des cases à l'affichage.
const PALETTES = {
  arcenciel: (i, n) => `hsl(${Math.round((i * 360) / n)} 85% 58%)`,
  pastel: (i, n) => `hsl(${Math.round((i * 360) / n)} 75% 80%)`,
  neon: (i) => ['#FF2E88', '#00F0FF', '#B6FF00', '#FF9F1C', '#8B5CF6', '#00FFA3'][i % 6],
  or: (i) => (i % 2 ? '#D4A73A' : '#15161B'),
  tiktok: (i) => ['#FE2C55', '#25F4EE', '#161823'][i % 3],
  bonbon: (i) => ['#FF8FB1', '#FFD166', '#7BDFF2', '#B9F18C', '#C3A6FF', '#FFB385'][i % 6],
};
const POINTER_ANGLE = { haut: 0, droite: 90, bas: 180, gauche: 270 };

// Texte clair ou sombre selon la case.
function ink(hex) {
  const h = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(hex || '');
  if (h) return Number(h[3]) > 66 ? '#14161C' : '#FFFFFF';
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? '#14161C' : '#FFFFFF';
}

function lines(label, max) {
  const words = String(label || '').split(/\s+/);
  const out = [''];
  for (const w of words) {
    const cur = out[out.length - 1];
    if ((cur + ' ' + w).trim().length <= max || !cur) out[out.length - 1] = (cur + ' ' + w).trim();
    else if (out.length < 2) out.push(w);
    else { out[1] = `${out[1].slice(0, max - 1)}…`; break; }
  }
  return out.map((l) => (l.length > max + 2 ? `${l.slice(0, max)}…` : l));
}

export function mount(root) {
  let s = {};
  let w = null;
  let rot = 0;
  let anim = null;
  let lastSpin = 0;
  let demoTimer = null;
  let audio = null;

  const box = el('div', 'wh scaled');
  const head = el('div', 'wh-head');
  const title = el('b', 'wh-title');
  const hint = el('span', 'wh-hint');
  head.append(title, hint);
  const stage = el('div', 'wh-stage');
  const art = svg('svg', { viewBox: '0 0 640 640', class: 'wh-svg' });
  const defs = svg('defs', {}, art);
  defs.innerHTML = `<radialGradient id="whShine" cx="50%" cy="38%" r="65%"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".55" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient>
    <linearGradient id="whGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A6"/><stop offset=".5" stop-color="#E2B03C"/><stop offset="1" stop-color="#9C6A12"/></linearGradient>
    <filter id="whGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const rim = svg('g', { class: 'wh-rim' }, art);
  const disc = svg('g', { class: 'wh-disc' }, art);
  const shine = svg('circle', { cx: C, cy: C, r: R, fill: 'url(#whShine)', class: 'wh-shine', 'pointer-events': 'none' }, art);
  const hub = svg('g', { class: 'wh-hub' }, art);
  const pointerWrap = svg('g', {}, art);
  const pointer = svg('g', { class: 'wh-pointer' }, pointerWrap);
  stage.append(art);
  const result = el('div', 'wh-result');
  const queue = el('div', 'wh-queue');
  box.append(head, stage, result, queue);
  root.append(box);
  void shine;
  window.addEventListener('regie-lang', () => drawDisc());

  const data = () => w || (isPreview ? DEMO : { status: 'idle', segments: [], queue: 0, next: [] });
  const slice = () => 360 / Math.max(1, data().segments.length);

  function click() {
    if (s.ticks === false) return;
    try {
      audio = audio || new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle'; o.frequency.value = 1500;
      g.gain.setValueAtTime(0.12, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.05);
      o.connect(g).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.06);
    } catch { /* pas de son possible */ }
  }

  // Couleur de chaque case : la sienne, ou celle de la palette choisie.
  const fillOf = (g, i, n) => (s.palette && PALETTES[s.palette] ? PALETTES[s.palette](i, n) : g.color);
  const off = () => POINTER_ANGLE[s.pointerPos] || 0;

  function drawPointer(style) {
    pointer.textContent = '';
    const col = s.accent || '#8FD3FF';
    const y0 = C - R - 30;
    const shape = s.pointer || 'triangle';
    const common = { fill: col, stroke: '#fff', 'stroke-width': 4, 'stroke-linejoin': 'round', filter: style === 'minimal' ? '' : 'url(#whGlow)' };
    if (shape === 'fleche') svg('path', { d: `M${C - 14},${y0 - 14} h28 v22 h16 L${C},${C - R + 26} L${C - 30},${y0 + 8} h16 Z`, ...common }, pointer);
    else if (shape === 'goutte') svg('path', { d: `M${C},${C - R + 26} C${C - 34},${y0 + 6} ${C - 30},${y0 - 34} ${C},${y0 - 34} C${C + 30},${y0 - 34} ${C + 34},${y0 + 6} ${C},${C - R + 26} Z`, ...common }, pointer);
    else if (shape === 'diamant') svg('path', { d: `M${C},${y0 - 22} L${C + 22},${y0 + 12} L${C},${C - R + 26} L${C - 22},${y0 + 12} Z`, ...common }, pointer);
    else svg('path', { d: `M${C - 26},${y0} L${C + 26},${y0} L${C},${C - R + 22} Z`, ...common }, pointer);
    pointerWrap.setAttribute('transform', `rotate(${off()} ${C} ${C})`);
  }

  function drawDisc() {
    const segs = data().segments;
    disc.textContent = '';
    rim.textContent = '';
    hub.textContent = '';
    const style = s.style || 'verre';
    const n = Math.max(1, segs.length);
    const a = (2 * Math.PI) / n;
    const scaleText = (s.textSize || 100) / 100;
    const max = n <= 6 ? 14 : n <= 10 ? 12 : 9;
    const fs = (n <= 6 ? 26 : n <= 10 ? 22 : 17) * scaleText;
    const across = s.textOrient === 'travers';
    const mode = s.labelMode || 'texte-image';
    // Couleurs de la bordure, des séparateurs et du centre : celles du style, ou les tiennes.
    const mine = Boolean(s.customColors);
    const sepW = s.sepWidth === undefined || (s.sepWidth === 2 && style === 'bonbon') ? (style === 'bonbon' ? 6 : 2) : s.sepWidth;
    const sepC = mine ? (s.sepColor || '#FFFFFF') : (style === 'bonbon' ? '#FFFFFF' : 'rgba(255,255,255,.55)');
    segs.forEach((g, i) => {
      const a0 = -Math.PI / 2 + i * a;
      const a1 = a0 + a;
      const x0 = C + R * Math.cos(a0); const y0 = C + R * Math.sin(a0);
      const x1 = C + R * Math.cos(a1); const y1 = C + R * Math.sin(a1);
      const d = n === 1 ? `M${C - R},${C}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0` : `M${C},${C}L${x0},${y0}A${R},${R} 0 ${a > Math.PI ? 1 : 0},1 ${x1},${y1}Z`;
      const color = fillOf(g, i, n);
      const fill = style === 'neon' ? '#0E1018' : color;
      svg('path', { d, fill, stroke: style === 'neon' ? color : sepC, 'stroke-width': style === 'neon' ? 3 : sepW, class: 'wh-seg', 'data-i': i, filter: style === 'neon' ? 'url(#whGlow)' : '' }, disc);
      const mid = (a0 + a1) / 2;
      // Image de la case (ton image, un vrai cadeau TikTok ou un émoji), vers le bord.
      const pic = g.image ? (/^https?:/.test(g.image) ? g.image : media(g.image)) : '';
      const hasPic = mode !== 'texte' && (pic || g.emoji);
      const picR = R * 0.8;
      const picSize = Math.min(R * 0.24, ((2 * Math.PI * picR) / n) * 0.62) * ((s.imageSize || 100) / 100);
      if (hasPic) {
        const px = C + picR * Math.cos(mid), py = C + picR * Math.sin(mid);
        const rot = (mid * 180) / Math.PI + 90;
        if (pic) svg('image', { href: pic, x: px - picSize / 2, y: py - picSize / 2, width: picSize, height: picSize, transform: `rotate(${rot} ${px} ${py})`, preserveAspectRatio: 'xMidYMid meet', class: 'wh-pic' }, disc);
        else { const t = svg('text', { x: px, y: py, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': picSize * 0.8, transform: `rotate(${rot} ${px} ${py})`, translate: 'no' }, disc); t.textContent = g.emoji; }
      }
      if (mode === 'image' && hasPic) return;
      let deg = (mid * 180) / Math.PI;
      const pos = (s.textPos || (hasPic ? 52 : 60)) / 100;
      let flip;
      if (across) { deg += 90; flip = Math.sin(mid) > 0.01; } else flip = Math.cos(mid) < -0.01;
      if (flip) deg += 180;
      // Le texte est posé sur l'axe horizontal du centre puis tourné : on le place à la bonne distance.
      const tx = across ? C : (flip ? C - R * pos : C + R * pos);
      const ty = across ? (flip ? C + R * pos : C - R * pos) : C;
      const fillText = style === 'neon' ? color : (s.textColor === 'perso' ? (s.segText || '#FFFFFF') : ink(color));
      const t = svg('text', { x: tx, y: ty, transform: `rotate(${deg} ${C} ${C})`, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: fillText, 'font-size': fs, class: 'wh-label', translate: 'no' }, disc);
      const ls = lines(window.regieTr ? window.regieTr(g.label) : g.label, across ? Math.max(6, Math.round(max * 0.9)) : max);
      ls.forEach((l, k) => {
        const sp = svg('tspan', { x: tx, dy: k === 0 ? (ls.length > 1 ? -fs * 0.55 : 0) : fs * 1.1 }, t);
        sp.textContent = l;
      });
    });
    // Bordure : anneau, et des ampoules (réglables) en style casino, verre ou bonbon.
    const gold = style === 'casino' || style === 'or';
    const rimColor = gold && !s.rimCustom ? 'url(#whGold)' : (s.rim || '#F2F5F9');
    const rimW = s.rimWidth === undefined || (s.rimWidth === 16 && style === 'minimal') ? (style === 'minimal' ? 6 : 16) : s.rimWidth;
    if (rimW > 0) svg('circle', { cx: C, cy: C, r: R + rimW / 2 + 1, fill: 'none', stroke: rimColor, 'stroke-width': rimW, class: 'wh-ring' }, rim);
    const bulbsOn = s.bulbs === 'oui' || ((s.bulbs || 'auto') === 'auto' && (style === 'casino' || style === 'verre' || style === 'or' || style === 'bonbon'));
    if (bulbsOn && rimW >= 6) {
      const bulbs = s.bulbCount || (gold ? 24 : 16);
      for (let i = 0; i < bulbs; i += 1) {
        const b = (i / bulbs) * 2 * Math.PI;
        svg('circle', { cx: C + (R + rimW / 2 + 1) * Math.cos(b), cy: C + (R + rimW / 2 + 1) * Math.sin(b), r: Math.max(2.5, rimW * 0.32), class: `wh-bulb ${i % 2 ? 'odd' : ''}`, fill: mine ? (s.bulbColor || '#FFFFFF') : (gold ? '#FFF6D6' : '#FFFFFF') }, rim);
      }
    }
    // Centre : couleur, taille, texte ou émoji, ou ton logo.
    const hr = s.hubSize || 54;
    const hubFill = mine ? (s.hubColor || '#10131A') : (gold ? 'url(#whGold)' : (style === 'neon' ? '#0E1018' : style === 'bonbon' ? '#FFFFFF' : 'rgba(16,19,26,.86)'));
    svg('circle', { cx: C, cy: C, r: hr, fill: hubFill, stroke: style === 'neon' ? (s.accent || '#8FD3FF') : 'rgba(255,255,255,.7)', 'stroke-width': 4 }, hub);
    if (s.hubImage) {
      const cp = svg('clipPath', { id: 'whHubClip' }, hub);
      svg('circle', { cx: C, cy: C, r: hr - 4 }, cp);
      svg('image', { href: media(s.hubImage), x: C - hr + 4, y: C - hr + 4, width: (hr - 4) * 2, height: (hr - 4) * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#whHubClip)' }, hub);
    } else {
      const ht = svg('text', { x: C, y: C + 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: mine ? (s.hubTextColor || '#FFFFFF') : (gold ? '#3A2600' : style === 'bonbon' ? (s.accent || '#FF4D6D') : '#fff'), 'font-size': Math.round(hr * 0.62), class: 'wh-hub-t', translate: 'no' }, hub);
      ht.textContent = s.hubText ?? '★';
    }
    drawPointer(style);
    setRotation(rot);
  }

  // Au repos, la roue peut tourner tout doucement.
  let idleAnim = 0;
  function idle() {
    cancelAnimationFrame(idleAnim);
    idleAnim = 0;
    if (!s.idleSpin) return;
    const loop = () => {
      if (anim || !s.idleSpin) { idleAnim = 0; return; }
      if (data().status !== 'spinning') { rot += 0.06 * ((s.idleSpeed || 100) / 100); setRotation(rot); }
      idleAnim = requestAnimationFrame(loop);
    };
    idleAnim = requestAnimationFrame(loop);
  }

  function setRotation(deg) {
    disc.setAttribute('transform', `rotate(${deg} ${C} ${C})`);
  }

  // Angle où le repère (en haut) tombe au milieu de la case « index », avec un petit décalage naturel.
  function targetFor(index, turns) {
    const sl = slice();
    const center = index * sl + sl / 2;
    const jitter = (Math.random() - 0.5) * sl * (s.ease === 'suspense' ? 0.9 : 0.6);
    const want = off() - (center + jitter);
    const base = rot - (rot % 360);
    let target = base + turns * 360 + (((want % 360) + 360) % 360);
    if (target - rot < turns * 360) target += 360;
    return target;
  }

  function spinTo(index, turns, ms) {
    cancelAnimationFrame(anim);
    cancelAnimationFrame(idleAnim);
    idleAnim = 0;
    const from = rot;
    const to = targetFor(index, s.turns > 0 ? s.turns : turns);
    const t0 = performance.now();
    const sl = slice();
    const ease = EASES[s.ease] || EASES.douce;
    let lastTick = Math.floor((from - off()) / sl);
    box.classList.add('spinning');
    box.querySelectorAll('.wh-seg.win').forEach((p) => p.classList.remove('win'));
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      rot = from + (to - from) * ease(t);
      setRotation(rot);
      const tick = Math.floor((rot - off()) / sl);
      if (tick !== lastTick) { lastTick = tick; click(); pointer.classList.remove('kick'); void pointer.getBBox(); pointer.classList.add('kick'); }
      if (t < 1) anim = requestAnimationFrame(step);
      else {
        anim = 0;
        box.classList.remove('spinning');
        const win = s.winFx || 'surbrillance';
        if (win !== 'aucun') disc.querySelector(`.wh-seg[data-i="${index}"]`)?.classList.add('win');
        if (win === 'confettis') { const g = data().segments[index]; confetti([g ? fillOf(g, index, data().segments.length) : (s.accent || '#8FD3FF'), '#FFFFFF', s.accent || '#F3D38A'], 170); }
        idle();
      }
    };
    anim = requestAnimationFrame(step);
  }

  function renderText() {
    const d = data();
    box.style.setProperty('--accent', s.accent || '#8FD3FF');
    box.style.setProperty('--text', s.text || '#F2F5F9');
    box.dataset.style = s.style || 'verre';
    box.dataset.result = s.resultStyle || 'bandeau';
    box.classList.toggle('no-shadow', s.shadow === false);
    box.classList.toggle('no-shine', s.shine === false);
    title.textContent = d.title || 'Roue de la fortune';
    title.hidden = s.showTitle === false;
    const ways = [];
    if (d.command) ways.push(d.command);
    if (d.minCoins > 0) ways.push(`🎁 ${d.minCoins}+`);
    if (d.likesEvery > 0) ways.push(`❤️ ${d.likesEvery}`);
    hint.textContent = ways.join(' · ');
    hint.hidden = s.showHint === false || !ways.length;
    result.textContent = '';
    if (d.status === 'spinning' && s.showUser !== false && d.user) {
      result.append(el('span', 'wh-who', d.user), el('span', 'wh-what', 'lance la roue…'));
      result.className = 'wh-result on';
    } else if (d.status === 'result' && s.resultStyle !== 'cache') {
      if (s.showUser !== false && d.user) result.append(el('span', 'wh-who', d.user));
      const r = el('b', 'wh-win', d.result);
      const idx = d.segments.findIndex((x) => x.label === d.result);
      r.style.setProperty('--seg', s.palette && PALETTES[s.palette] && idx >= 0 ? PALETTES[s.palette](idx, d.segments.length) : (d.resultColor || s.accent || '#8FD3FF'));
      result.append(r);
      result.className = 'wh-result on win';
    } else result.className = 'wh-result';
    queue.textContent = '';
    if (s.showQueue !== false && d.queue > 0) {
      queue.append(el('span', 'wh-q-n', `+${d.queue}`), el('span', 'wh-q-t', (d.next || []).join(', ')));
    }
    box.classList.toggle('idle-hide', Boolean(s.hideIdle) && d.status === 'idle' && !isPreview);
  }

  function apply(next) {
    const prev = w;
    w = next;
    const segChanged = !prev || JSON.stringify(prev.segments) !== JSON.stringify(next.segments);
    if (segChanged) drawDisc();
    if (next.status === 'spinning' && next.startedAt !== lastSpin) {
      lastSpin = next.startedAt;
      const left = Math.max(1200, next.spinMs - (Date.now() - next.startedAt));
      spinTo(next.index, next.turns || 5, left);
    } else if (next.status === 'result' && prev?.status !== 'spinning' && !anim) {
      rot = targetFor(next.index, 0);
      setRotation(rot);
    }
    renderText();
  }

  // Aperçu : la roue tourne toute seule pour montrer l'effet.
  function demo() {
    clearInterval(demoTimer);
    if (!isPreview || w) return;
    demoTimer = setInterval(() => {
      if (w) { clearInterval(demoTimer); return; }
      const index = Math.floor(Math.random() * DEMO.segments.length);
      spinTo(index, 4, 4200);
    }, 7000);
  }

  return {
    update(settings, d) {
      s = settings;
      if (d?.wheel) apply(d.wheel);
      else { drawDisc(); renderText(); demo(); }
      if (d?.wheel) { drawDisc(); renderText(); }
      idle();
    },
    on(msg) { if (msg.t === 'wheel') apply(msg.wheel); },
  };
}
