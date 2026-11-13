// Vraies manettes : rendus 3D (pads/<modèle>.svg) découpés en zones colorables.
// Chaque calque porte la lumière diffuse dans le rouge et les reflets dans le vert :
// couleur choisie × lumière, puis reflets blancs dosés par la « brillance ».
// Aucune dépendance : utilisé par l'overlay et par la page d'aperçu.

const NS = 'http://www.w3.org/2000/svg';
export const PAD_GROUPS = ['shell', 'grips', 'buttons', 'sticks', 'triggers', 'light'];
const FALLBACK = { fill: 'solid', c1: '#FFFFFF', c2: '#FFFFFF', shine: 40, alpha: 100 };
const node = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};
const gradientUri = (c1, c2) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="${NS}" width="100" height="100" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">`
  + `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`)}`;

let seq = 0;

// root : <svg> du modèle. Retourne { el, colors(finish, opts), paint(state), size }.
export function mountRealPad(root) {
  const uid = `rp${++seq}`;
  const vb = root.viewBox.baseVal;
  const W = vb.width || 1000, H = vb.height || 700;
  root.removeAttribute('width'); root.removeAttribute('height');
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  root.style.overflow = 'visible';
  const defs = node('defs', {});
  root.prepend(defs);

  const shade = {}, gloss = {}, paint = {};
  for (const g of PAD_GROUPS) {
    const f = node('filter', { id: `${uid}-${g}`, filterUnits: 'userSpaceOnUse', x: -40, y: -40, width: W + 80, height: H + 80, 'color-interpolation-filters': 'sRGB' }, defs);
    shade[g] = node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', result: 'shade' }, f);           // R → lumière
    paint[g] = node('feImage', { x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none', result: 'paint' }, f);
    node('feComposite', { in: 'shade', in2: 'paint', operator: 'arithmetic', k1: 1, k2: 0, k3: 0, k4: 0, result: 'col' }, f);
    gloss[g] = node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', result: 'hl0' }, f);             // G → reflets
    node('feComposite', { in: 'hl0', in2: 'SourceGraphic', operator: 'in', result: 'hl' }, f);
    node('feComposite', { in: 'hl', in2: 'col', operator: 'over', result: 'lit' }, f);
    if (g === 'light') {  // voyant : léger halo de sa propre couleur
      node('feGaussianBlur', { in: 'col', stdDeviation: Math.max(W, H) / 160, result: 'halo' }, f);
      const mg = node('feMerge', {}, f);
      node('feMergeNode', { in: 'halo' }, mg); node('feMergeNode', { in: 'lit' }, mg);
    }
  }

  // Filtre « appuyé » : même modelé, peint dans la couleur d'appui (utilisé par la souris).
  const pf = node('filter', { id: `${uid}-press`, filterUnits: 'userSpaceOnUse', x: -40, y: -40, width: W + 80, height: H + 80, 'color-interpolation-filters': 'sRGB' }, defs);
  node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', result: 'shade', values: '1.1 0 0 0 0  1.1 0 0 0 0  1.1 0 0 0 0  0 0 0 1 0' }, pf);
  const pressPaint = node('feFlood', { 'flood-color': '#8FD3FF', result: 'paint' }, pf);
  node('feComposite', { in: 'shade', in2: 'paint', operator: 'arithmetic', k1: 1, k2: 0, k3: 0, k4: 0, result: 'col' }, pf);
  node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', result: 'hl0', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 1 0 0 0' }, pf);
  node('feComposite', { in: 'hl0', in2: 'SourceGraphic', operator: 'in', result: 'hl' }, pf);
  node('feComposite', { in: 'hl', in2: 'col', operator: 'over' }, pf);
  let pressTint = false;

  for (const n of root.querySelectorAll('[data-pad-group]')) {
    const g = n.getAttribute('data-pad-group');
    if (PAD_GROUPS.includes(g)) n.setAttribute('filter', `url(#${uid}-${g})`);
  }
  const btns = {}, sticks = {};
  for (const n of root.querySelectorAll('[data-btn]')) (btns[n.getAttribute('data-btn')] ||= []).push(n);
  for (const n of root.querySelectorAll('[data-stick]')) sticks[n.getAttribute('data-stick')] = { n, r: Number.parseFloat(n.getAttribute('data-r')) || 30 };
  const legends = [...root.querySelectorAll('[data-pad-legend]')];

  let pressed = '#8FD3FF';
  const drawn = new Map();

  // Jauges L2/R2 : deux pilules de verre à l'extérieur des gâchettes, remplies selon l'appui.
  let gaugesOn = false, gauges = null;
  function buildGauges() {
    if (gauges || !root.isConnected) return;
    gauges = {};
    for (const [i, side] of [['6', -1], ['7', 1]]) {
      const t = btns[i]?.[0];
      if (!t) continue;
      const bb = t.getBBox();
      if (!bb.width) { gauges = null; return; }
      const w = Math.max(W, H) / 95, gap = w * 1.4;
      const x = side < 0 ? bb.x - gap - w : bb.x + bb.width + gap;
      const g = node('g', { 'data-gauge': i, opacity: gaugesOn ? 1 : 0 }, root);
      node('rect', { x, y: bb.y, width: w, height: bb.height, rx: w / 2, fill: 'rgba(255,255,255,.16)', stroke: 'rgba(255,255,255,.22)', 'stroke-width': 1 }, g);
      const fill = node('rect', { x, y: bb.y + bb.height, width: w, height: 0, rx: w / 2, fill: pressed }, g);
      gauges[i] = { g, fill, y: bb.y, h: bb.height };
    }
  }

  function colors(finish = {}, { pressedColor, labels = true, triggerBars, tintPressed } = {}) {
    pressed = pressedColor || pressed;
    pressPaint.setAttribute('flood-color', pressed);
    if (tintPressed !== undefined) pressTint = Boolean(tintPressed);
    if (triggerBars !== undefined) gaugesOn = Boolean(triggerBars);
    if (gauges) for (const g of Object.values(gauges)) { g.g.setAttribute('opacity', gaugesOn ? 1 : 0); g.fill.setAttribute('fill', pressed); }
    for (const g of PAD_GROUPS) {
      const c = { ...FALLBACK, ...(finish[g] || {}) };
      const alpha = Math.max(0, Math.min(1, (c.alpha ?? 100) / 100));
      const kd = g === 'light' ? 1.15 : 1;
      shade[g].setAttribute('values', `${kd} 0 0 0 0  ${kd} 0 0 0 0  ${kd} 0 0 0 0  0 0 0 ${alpha.toFixed(3)} 0`);
      const ks = 0.15 + ((c.shine ?? 40) / 100) * 1.7;   // brillance : du mat au très verni
      gloss[g].setAttribute('values', `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 ${ks.toFixed(3)} 0 0 0`);
      paint[g].setAttribute('href', gradientUri(c.c1, c.fill === 'gradient' ? c.c2 : c.c1));
    }
    for (const n of legends) n.style.display = labels === false ? 'none' : '';
    drawn.clear();
  }

  function paintState(state) {
    const b = state.b || [];
    const lt = state.lt || 0, rt = state.rt || 0;
    const level = (i) => Math.max(b[i] ? 1 : 0, i === 6 ? lt : i === 7 ? rt : 0);
    const glow = Math.max(W, H) / 110;
    for (const [i, list] of Object.entries(btns)) {
      const v = level(+i);
      const key = `b${i}`, sig = v.toFixed(2);
      if (drawn.get(key) === sig) continue;
      drawn.set(key, sig);
      for (const n of list) {
        if (pressTint) {
          for (const z of n.querySelectorAll('[data-pad-group]')) z.setAttribute('filter', `url(#${uid}-${v > 0.05 ? 'press' : z.getAttribute('data-pad-group')})`);
          n.style.filter = v > 0.05 ? `drop-shadow(0 0 ${(glow * 0.8 * v).toFixed(1)}px ${pressed})` : '';
        } else n.style.filter = v > 0.05 ? `brightness(${(1 + 0.3 * v).toFixed(2)}) drop-shadow(0 0 ${(glow * v).toFixed(1)}px ${pressed})` : '';
      }
    }
    if (gaugesOn) {
      buildGauges();
      for (const [i, g] of Object.entries(gauges || {})) {
        const v = level(+i), key = `g${i}`, sig = v.toFixed(2);
        if (drawn.get(key) === sig) continue;
        drawn.set(key, sig);
        const h = g.h * v;
        g.fill.setAttribute('y', (g.y + g.h - h).toFixed(1)); g.fill.setAttribute('height', h.toFixed(1));
      }
    }
    const a = state.a || [];
    for (const [side, s] of Object.entries(sticks)) {
      const xi = side === 'l' ? 0 : 2;
      const x = a[xi] || 0, y = a[xi + 1] || 0;
      const sig = `${x.toFixed(2)},${y.toFixed(2)}`;
      if (drawn.get(side) === sig) continue;
      drawn.set(side, sig);
      const t = s.r * 0.38;
      s.n.setAttribute('transform', `translate(${(x * t).toFixed(2)} ${(y * t).toFixed(2)})`);
    }
  }

  // Centres des sticks (unités du dessin) et course, pour la trace dessinée par l'overlay.
  const stickInfo = () => Object.fromEntries(Object.entries(sticks).map(([side, s]) => [side, {
    cx: Number.parseFloat(s.n.getAttribute('data-cx')) || 0, cy: Number.parseFloat(s.n.getAttribute('data-cy')) || 0, travel: s.r * 0.38,
  }]));

  // Recolore une seule zone sans tout reconstruire (lumière animée de la souris, par exemple).
  const tint = (g, c1, c2 = c1) => paint[g]?.setAttribute('href', gradientUri(c1, c2));

  return { el: root, colors, paint: paintState, size: { w: W, h: H }, sticks: stickInfo, tint };
}
