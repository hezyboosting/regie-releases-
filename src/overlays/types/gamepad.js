// Manette en direct. Le dessin suit la manette branchée, et chaque finition se règle à part.
// Les silhouettes sont des créations originales. Pour montrer sa propre manette, on importe sa photo.
import { el, svg, media, isPreview, query } from '../lib.js';
import { cleanSvg } from '../svg-clean.js';

// Silhouette Régie : coque large, visière de verre, croix en pétales et sticks cerclés de lumière.
const BODY = 'M310 88C392 88 440 82 488 82C544 82 580 108 594 158C606 204 612 262 602 312C594 350 556 366 528 346C504 329 484 304 452 292C420 282 372 280 310 280C248 280 200 282 168 292C136 304 116 329 92 346C64 366 26 350 18 312C8 262 14 204 26 158C40 108 76 82 132 82C180 82 228 88 310 88Z';
const GRIP_R = 'M599 178C560 196 500 238 452 292C484 304 504 329 528 346C556 366 594 350 602 312C610 268 608 216 599 178Z';
const SEAM_R = 'M599 178C560 196 500 238 452 292';
const BUMPER_R = 'M392 92C410 72 470 62 516 64C542 66 558 82 562 112L392 92Z';
const TRIGGER_R = 'M420 80C430 52 470 38 504 40C530 42 544 60 548 92L420 80Z';
const PETAL = 'M0 -11C-6 -15 -21 -24 -21 -33C-21 -40 -12 -43 0 -43C12 -43 21 -40 21 -33C21 -24 6 -15 0 -11Z';
const ARROW = 'M0 -37L6 -29L-6 -29Z';
const PAIR = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;
const mirror = (d) => d.replace(PAIR, (_, x, y) => `${620 - x} ${y}`);
const turn = (d, deg, cx, cy) => {
  const a = (deg * Math.PI) / 180;
  return d.replace(PAIR, (_, x, y) => `${(cx + x * Math.cos(a) - y * Math.sin(a)).toFixed(2)} ${(cy + x * Math.sin(a) + y * Math.cos(a)).toFixed(2)}`);
};
const GROUPS = ['shell', 'grips', 'buttons', 'sticks', 'triggers', 'light'];
const WELL = '#07090D';

// Pièces d'un modèle en calques, reliées aux boutons de la manette.
const PACK_BUTTONS = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15, home: 16, pad: 17 };
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

const LAYOUTS = {
  abxy: { stickL: [146, 168], dpad: [242, 226], stickR: [378, 226], face: [474, 168], labels: ['A', 'B', 'X', 'Y'] },
  bayx: { stickL: [146, 168], dpad: [242, 226], stickR: [378, 226], face: [474, 168], labels: ['B', 'A', 'Y', 'X'] },
  symbols: { stickL: [242, 226], dpad: [146, 168], stickR: [378, 226], face: [474, 168], labels: ['cross', 'circle', 'square', 'triangle'] },
  symbols2: { stickL: [146, 168], dpad: [242, 226], stickR: [378, 226], face: [474, 168], labels: ['cross', 'circle', 'square', 'triangle'] },
};

function faceGlyph(parent, kind, x, y) {
  const attrs = { fill: 'none', stroke: 'var(--glegend)', 'stroke-width': 2.4, 'pointer-events': 'none', class: 'legend' };
  if (kind === 'cross') { svg('path', { ...attrs, d: `M${x - 8} ${y - 8} L${x + 8} ${y + 8} M${x + 8} ${y - 8} L${x - 8} ${y + 8}`, 'stroke-linecap': 'round' }, parent); return; }
  if (kind === 'circle') { svg('circle', { ...attrs, cx: x, cy: y, r: 9 }, parent); return; }
  if (kind === 'square') { svg('rect', { ...attrs, x: x - 8, y: y - 8, width: 16, height: 16 }, parent); return; }
  if (kind === 'triangle') { svg('path', { ...attrs, d: `M${x} ${y - 10} L${x + 10} ${y + 7} L${x - 10} ${y + 7} Z`, 'stroke-linejoin': 'round' }, parent); return; }
  const t = svg('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 600, fill: 'var(--glegend)', 'pointer-events': 'none', class: 'legend' }, parent);
  t.textContent = kind;
}

export function mount(root) {
  let s = {};
  const box = el('div', 'gp scaled');
  const canvas = el('canvas', 'gp-trail');
  canvas.width = 620; canvas.height = 420;
  root.append(box);
  const ctx = canvas.getContext('2d');
  let built = '';
  let btn = {};
  let sticks = {};
  let stops = {};
  let shines = {};
  let lastWs = 0;
  let lastMove = Date.now();
  let lastSig = '';
  let detected = '';
  let pack = null;
  let packRoot = null;
  let packParts = {};
  let packFilters = {};
  let dpadWhole = null;
  let state = { b: Array(18).fill(false), a: [0, 0, 0, 0], lt: 0, rt: 0 };

  const layoutName = () => (s.layout === 'auto' || !s.layout ? (detected === 'playstation' ? 'symbols2' : 'abxy') : s.layout);
  const fill = (k) => `url(#f-${k})`;

  function addButton(i, node, group) {
    btn[i] = { node, off: fill(group) };
    node.classList.add('btn');
    return node;
  }

  function grad(d, tag, id, attrs, list) {
    const g = svg(tag, { id, ...attrs }, d);
    for (const [offset, color, opacity] of list) svg('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, g);
  }

  function defs(v) {
    const d = svg('defs', {}, v);
    stops = {};
    for (const k of GROUPS) {
      const g = svg('linearGradient', { id: `f-${k}`, x1: 0, y1: 0, x2: 0.35, y2: 1 }, d);
      stops[k] = [svg('stop', { offset: '0%' }, g), svg('stop', { offset: '100%' }, g)];
    }
    grad(d, 'linearGradient', 'f-gloss', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0%', '#fff', 0.9], ['55%', '#fff', 0]]);
    grad(d, 'linearGradient', 'v-depth', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0%', '#fff', 0.14], ['30%', '#fff', 0], ['58%', '#000', 0.06], ['100%', '#000', 0.58]]);
    grad(d, 'linearGradient', 'v-part', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0%', '#fff', 0.34], ['46%', '#fff', 0], ['100%', '#000', 0.5]]);
    grad(d, 'radialGradient', 'v-dome', { cx: 0.5, cy: 0.5, r: 0.52, fx: 0.36, fy: 0.28 }, [['0%', '#fff', 0.5], ['42%', '#fff', 0.06], ['72%', '#000', 0.08], ['100%', '#000', 0.5]]);
    grad(d, 'linearGradient', 'v-dish', { x1: 0.2, y1: 0, x2: 0.8, y2: 1 }, [['0%', '#000', 0.5], ['62%', '#000', 0.22], ['100%', '#fff', 0.14]]);
    grad(d, 'linearGradient', 'v-lip', { x1: 0.2, y1: 0, x2: 0.8, y2: 1 }, [['0%', '#fff', 0.5], ['48%', '#fff', 0.03], ['100%', '#000', 0.55]]);
    grad(d, 'linearGradient', 'v-hollow', { x1: 0.2, y1: 0, x2: 0.8, y2: 1 }, [['0%', '#000', 0.62], ['58%', '#000', 0.1], ['100%', '#fff', 0.32]]);
    const blur = (id, std) => svg('feGaussianBlur', { stdDeviation: std }, svg('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, d));
    blur('v-b2', 2.4); blur('v-b6', 6); blur('v-b14', 14);
    const dot = svg('pattern', { id: 'v-grain', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(28)' }, d);
    svg('circle', { cx: 1.5, cy: 1.5, r: 0.95, fill: '#fff', opacity: 0.14 }, dot);
    svg('circle', { cx: 4.5, cy: 4.5, r: 0.95, fill: '#000', opacity: 0.3 }, dot);
    svg('path', { d: BODY }, svg('clipPath', { id: 'v-clip' }, d));
  }

  function gloss(group, tagName, attrs, parent) {
    const n = svg(tagName, { fill: 'url(#f-gloss)', ...attrs, 'pointer-events': 'none' }, parent);
    (shines[group] = shines[group] || []).push(n);
    return n;
  }

  const shade = (tagName, attrs, parent) => svg(tagName, { ...attrs, 'pointer-events': 'none' }, parent);

  function stick(g, x, y, idxPress, key) {
    shade('circle', { cx: x, cy: y, r: 46, fill: 'url(#v-lip)' }, g);
    shade('circle', { cx: x, cy: y, r: 43, fill: WELL }, g);
    shade('circle', { cx: x, cy: y, r: 43, fill: 'url(#v-dish)' }, g);
    shade('circle', { cx: x, cy: y, r: 39.5, fill: 'none', stroke: fill('light'), 'stroke-width': 6, filter: 'url(#v-b2)', opacity: 0.7 }, g);
    shade('circle', { cx: x, cy: y, r: 39.5, fill: 'none', stroke: fill('light'), 'stroke-width': 1.6 }, g);
    const head = svg('g', {}, g);
    shade('circle', { cx: x + 1.5, cy: y + 6, r: 31, fill: '#000', opacity: 0.62, filter: 'url(#v-b2)' }, head);
    const cap = svg('circle', { cx: x, cy: y, r: 29.5, fill: fill('sticks') }, head);
    shade('circle', { cx: x, cy: y, r: 29.5, fill: 'url(#v-dome)' }, head);
    shade('circle', { cx: x, cy: y, r: 26, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.2, 'stroke-width': 3.4, 'stroke-dasharray': '1.5 2.6' }, head);
    shade('circle', { cx: x, cy: y, r: 21.5, fill: fill('sticks') }, head);
    shade('circle', { cx: x, cy: y, r: 21.5, fill: 'url(#v-hollow)' }, head);
    shade('circle', { cx: x, cy: y, r: 21.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 0.8 }, head);
    addButton(idxPress, cap, 'sticks');
    sticks[key] = { head, x, y, r: 14 };
  }

  function dpad(g, x, y) {
    shade('circle', { cx: x, cy: y, r: 49, fill: 'url(#v-lip)', opacity: 0.55 }, g);
    shade('circle', { cx: x, cy: y, r: 47, fill: WELL, opacity: 0.8 }, g);
    shade('circle', { cx: x, cy: y, r: 47, fill: 'url(#v-dish)' }, g);
    for (const [i, deg] of [[12, 0], [15, 90], [13, 180], [14, 270]]) {
      const d = turn(PETAL, deg, x, y);
      addButton(i, svg('path', { d, fill: fill('buttons') }, g), 'buttons');
      shade('path', { d, fill: 'url(#v-part)' }, g);
      shade('path', { d, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.16, 'stroke-width': 0.9 }, g);
      shade('path', { d: turn(ARROW, deg, x, y), fill: 'var(--glegend)', class: 'legend', opacity: 0.8 }, g);
    }
    shade('circle', { cx: x, cy: y, r: 6.5, fill: WELL }, g);
    shade('circle', { cx: x, cy: y, r: 6.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.2, 'stroke-width': 0.8 }, g);
  }

  function face(g, cx, cy, labels) {
    shade('circle', { cx, cy, r: 67, fill: 'url(#v-lip)', opacity: 0.4 }, g);
    shade('circle', { cx, cy, r: 65.5, fill: WELL, opacity: 0.6 }, g);
    shade('circle', { cx, cy, r: 65.5, fill: 'url(#v-dish)' }, g);
    const pos = [[0, 39], [39, 0], [-39, 0], [0, -39]];
    labels.forEach((lab, i) => {
      const [dx, dy] = pos[i];
      const x = cx + dx;
      const y = cy + dy;
      shade('circle', { cx: x, cy: y, r: 23, fill: WELL }, g);
      shade('circle', { cx: x, cy: y, r: 23, fill: 'url(#v-lip)', opacity: 0.32 }, g);
      addButton(i, svg('circle', { cx: x, cy: y, r: 20.5, fill: fill('buttons') }, g), 'buttons');
      shade('circle', { cx: x, cy: y, r: 20.5, fill: 'url(#v-dome)' }, g);
      faceGlyph(g, lab, x, y);
    });
  }

  function pill(g, i, x, y, w, h, group = 'buttons') {
    shade('rect', { x: x - 2.5, y: y - 2.5, width: w + 5, height: h + 5, rx: (h + 5) / 2, fill: WELL, opacity: 0.85 }, g);
    addButton(i, svg('rect', { x, y, width: w, height: h, rx: h / 2, fill: fill(group) }, g), group);
    shade('rect', { x, y, width: w, height: h, rx: h / 2, fill: 'url(#v-part)' }, g);
  }

  function visor(g) {
    shade('rect', { x: 238, y: 103, width: 144, height: 40, rx: 20, fill: 'url(#v-lip)', opacity: 0.6 }, g);
    shade('rect', { x: 240, y: 105, width: 140, height: 36, rx: 18, fill: WELL }, g);
    for (const x of [258, 336]) {
      shade('rect', { x, y: 119.5, width: 26, height: 7, rx: 3.5, fill: fill('light'), filter: 'url(#v-b2)', opacity: 0.85 }, g);
      shade('rect', { x, y: 121.5, width: 26, height: 3, rx: 1.5, fill: fill('light') }, g);
    }
    shade('circle', { cx: 310, cy: 123, r: 13, fill: fill('light'), filter: 'url(#v-b2)', opacity: 0.55 }, g);
    addButton(16, svg('circle', { cx: 310, cy: 123, r: 10.5, fill: fill('light') }, g), 'light');
    shade('circle', { cx: 310, cy: 123, r: 10.5, fill: 'url(#v-dome)' }, g);
    gloss('shell', 'path', { d: 'M256 107H364C372 107 376 110 376 113C340 120 280 120 244 113C244 110 248 107 256 107Z' }, g);
  }

  function shoulders(v) {
    for (const [i, d] of [[6, mirror(TRIGGER_R)], [7, TRIGGER_R], [4, mirror(BUMPER_R)], [5, BUMPER_R]]) {
      addButton(i, svg('path', { d, fill: fill('triggers') }, v), 'triggers');
      shade('path', { d, fill: 'url(#v-part)' }, v);
      shade('path', { d, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.2, 'stroke-width': 1 }, v);
    }
  }

  function triggerBars(v) {
    for (const [k, x] of [['lt', 82], ['rt', 446]]) {
      svg('rect', { x, y: 16, width: 92, height: 7, rx: 3.5, fill: 'rgba(255,255,255,.16)' }, v);
      sticks[k] = svg('rect', { x, y: 16, width: 0, height: 7, rx: 3.5, fill: 'var(--gpressed)' }, v);
    }
  }

  function pad(layout) {
    const L = LAYOUTS[layout] || LAYOUTS.abxy;
    const v = svg('svg', { viewBox: '0 0 620 420', width: 620, height: 420, class: 'gp-pad' }, box);
    defs(v);
    shade('path', { d: BODY, fill: '#000', opacity: 0.5, filter: 'url(#v-b14)', transform: 'translate(0 16)' }, v);
    if (s.triggers) triggerBars(v);
    shoulders(v);
    const hull = svg('g', { 'clip-path': 'url(#v-clip)' }, v);
    shade('path', { d: BODY, fill: fill('shell') }, hull);
    for (const d of [GRIP_R, mirror(GRIP_R)]) {
      shade('path', { d, fill: fill('grips') }, hull);
      shade('path', { d, fill: 'url(#v-grain)' }, hull);
    }
    shade('rect', { x: 0, y: 60, width: 620, height: 320, fill: 'url(#v-depth)' }, hull);
    shade('path', { d: BODY, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 18, filter: 'url(#v-b6)', transform: 'translate(0 -5)' }, hull);
    shade('path', { d: BODY, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.55, 'stroke-width': 5, filter: 'url(#v-b2)', transform: 'translate(0 3)' }, hull);
    gloss('shell', 'ellipse', { cx: 150, cy: 108, rx: 104, ry: 11, transform: 'rotate(-6 150 108)', fill: '#fff', filter: 'url(#v-b6)' }, hull);
    gloss('shell', 'ellipse', { cx: 470, cy: 108, rx: 104, ry: 11, transform: 'rotate(6 470 108)', fill: '#fff', filter: 'url(#v-b6)' }, hull);
    for (const d of [SEAM_R, mirror(SEAM_R)]) {
      shade('path', { d, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 1.5 }, hull);
      shade('path', { d, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.14, 'stroke-width': 1, transform: 'translate(0 1.6)' }, hull);
    }
    const g = svg('g', {}, v);
    visor(g);
    stick(g, ...L.stickL, 10, 'l');
    stick(g, ...L.stickR, 11, 'r');
    dpad(g, ...L.dpad);
    face(g, ...L.face, L.labels);
    pill(g, 8, 264, 156, 30, 10);
    pill(g, 9, 326, 156, 30, 10);
    pill(g, 17, 282, 182, 56, 9);
  }

  function arcade() {
    const v = svg('svg', { viewBox: '0 0 620 420', width: 620, height: 420 }, box);
    defs(v);
    svg('path', { d: 'M28 92 L592 92 L606 340 C606 356 596 366 580 366 L40 366 C24 366 14 356 14 340 Z', fill: fill('shell') }, v);
    svg('path', { d: 'M28 92 L592 92 L596 132 L24 132 Z', fill: fill('grips') }, v);
    gloss('shell', 'path', { d: 'M28 92 L592 92 L606 340 C606 356 596 366 580 366 L40 366 C24 366 14 356 14 340 Z' }, v);
    shade('path', { d: 'M28 92 L592 92 L606 340 C606 356 596 366 580 366 L40 366 C24 366 14 356 14 340 Z', fill: 'url(#v-depth)' }, v);
    svg('circle', { cx: 150, cy: 230, r: 74, fill: 'rgba(0,0,0,.14)' }, v);
    const head = svg('g', {}, v);
    svg('rect', { x: 142, y: 170, width: 16, height: 62, fill: fill('buttons') }, head);
    svg('circle', { cx: 150, cy: 164, r: 34, fill: fill('sticks'), stroke: 'rgba(0,0,0,.25)' }, head);
    shade('circle', { cx: 150, cy: 164, r: 34, fill: 'url(#v-dome)' }, head);
    sticks.l = { head, x: 150, y: 164, arcade: true };
    const layout = [[310, 198, 2], [386, 170, 3], [464, 170, 5], [540, 190, 4], [290, 288, 0], [366, 262, 1], [444, 262, 7], [520, 282, 6]];
    for (const [x, y, i] of layout) {
      svg('circle', { cx: x, cy: y, r: 37, fill: 'rgba(0,0,0,.18)' }, v);
      addButton(i, svg('circle', { cx: x, cy: y, r: 31, fill: fill('buttons') }, v), 'buttons');
      shade('circle', { cx: x, cy: y, r: 31, fill: 'url(#v-dome)' }, v);
    }
    addButton(8, svg('rect', { x: 250, y: 104, width: 44, height: 16, rx: 8, fill: fill('buttons') }, v), 'buttons');
    addButton(9, svg('rect', { x: 326, y: 104, width: 44, height: 16, rx: 8, fill: fill('buttons') }, v), 'buttons');
  }

  // Photo de la manette du streamer : des zones lumineuses se posent sur l'image.
  const skin = () => {
    const both = [s.skin, s.skinPs].filter((x) => x?.image);
    return detected === 'playstation' && s.skinPs?.image ? s.skinPs : both[0] || null;
  };

  function photo() {
    const v = svg('svg', { viewBox: '0 0 620 420', width: 620, height: 420 }, box);
    defs(v);
    const img = svg('image', { x: 0, y: 0, width: 620, height: 420, preserveAspectRatio: 'xMidYMid meet' }, v);
    img.setAttribute('href', media(skin().image));
    const zones = skin().zones || {};
    for (const [key, z] of Object.entries(zones)) {
      if (key === 'l' || key === 'r') {
        const head = svg('g', { class: 'gp-stickdot' }, v);
        svg('circle', { cx: z.x, cy: z.y, r: z.r, fill: 'none', stroke: 'var(--gpressed)', 'stroke-width': 3, opacity: 0.85 }, head);
        svg('circle', { cx: z.x, cy: z.y, r: 4, fill: 'var(--gpressed)' }, head);
        sticks[key] = { head, x: z.x, y: z.y, r: z.r * 0.55, hideIdle: true };
      } else {
        const n = svg('circle', { cx: z.x, cy: z.y, r: z.r, fill: 'var(--gpressed)', class: 'gp-zone' }, v);
        btn[key] = { node: n, zone: true };
      }
    }
  }

  // Modèle de la bibliothèque : isolé dans son propre espace pour que ses styles restent chez lui.
  function packed() {
    const host = el('div', 'gp-pack');
    const shadow = host.attachShadow({ mode: 'open' });
    const v = packRoot.cloneNode(true);
    const w = Number.parseFloat(v.getAttribute('width')) || 620;
    const h = Number.parseFloat(v.getAttribute('height')) || 420;
    if (!v.getAttribute('viewBox')) v.setAttribute('viewBox', `0 0 ${w} ${h}`);
    v.setAttribute('width', 620);
    v.setAttribute('height', 420);
    v.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    shadow.append(v);
    box.append(host);
    const box2 = v.viewBox.baseVal;
    const unit = (box2.width || 620) / 620;
    const defsNode = svg('defs', {}, v);
    packParts = {};
    packFilters = {};
    dpadWhole = null;
    for (const [part, name] of Object.entries(pack.map || {})) {
      const safe = CSS.escape(name);
      const node = v.querySelector(`#${safe}`) || [...v.querySelectorAll('[*|label], [data-name]')].find((n) => n.getAttribute('inkscape:label') === name || n.getAttribute('data-name') === name);
      if (!node || node === v) continue;
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.replaceWith(wrap);
      wrap.append(node);
      const f = svg('filter', { id: `pk-${part}`, x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' }, defsNode);
      packFilters[part] = svg('feColorMatrix', { type: 'matrix', values: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0' }, f);
      packParts[part] = { wrap, unit, base: '', on: false, level: 0 };
      if (part in PACK_BUTTONS) btn[PACK_BUTTONS[part]] = { pack: packParts[part] };
      if (part === 'stickl') { sticks.l = { head: wrap, x: 0, y: 0, r: 14 * unit, noTrail: true }; btn[10] = { pack: packParts[part], still: true }; }
      if (part === 'stickr') { sticks.r = { head: wrap, x: 0, y: 0, r: 14 * unit, noTrail: true }; btn[11] = { pack: packParts[part], still: true }; }
      if (part === 'dpad') dpadWhole = packParts[part];
    }
  }

  function applyPack() {
    const colors = s.packColors || {};
    const g = (s.packGain ?? 170) / 100;
    for (const [part, p] of Object.entries(packParts)) {
      const c = colors[part];
      p.base = c ? `url(#pk-${part})` : '';
      if (c) {
        const [r, gr, b] = hex(c);
        const row = (k) => `${k * 0.2126 * g} ${k * 0.7152 * g} ${k * 0.0722 * g} 0 ${k * 0.1}`;
        packFilters[part].setAttribute('values', `${row(r)} ${row(gr)} ${row(b)} 0 0 0 1 0`);
      }
      p.wrap.style.filter = p.base;
      p.drawn = '';
    }
  }

  // Une pièce appuyée s'éclaire et s'enfonce un peu. On ne touche au dessin que si son état change.
  function drawPart(p, level, still) {
    const key = level.toFixed(2);
    if (p.drawn === key) return;
    p.drawn = key;
    p.wrap.style.filter = level > 0 ? `${p.base} brightness(${1 + 0.45 * level}) drop-shadow(0 0 ${6 * level}px ${s.pressed || '#8FD3FF'})`.trim() : p.base;
    if (!still) p.wrap.setAttribute('transform', level > 0 ? `translate(0 ${1.6 * level * p.unit})` : '');
  }

  function build() {
    box.textContent = '';
    btn = {}; sticks = {}; shines = {};
    const name = layoutName();
    if (pack && packRoot) packed();
    else if (skin()) photo();
    else if (name === 'arcade') arcade();
    else pad(name);
    box.append(canvas);
    built = signature();
    applyFinish();
    if (pack && packRoot) applyPack();
  }

  const signature = () => `${pack?.file || ''}|${packRoot ? 1 : 0}|${JSON.stringify(pack?.map || '')}|${layoutName()}|${skin()?.image}|${JSON.stringify(skin()?.zones || '')}|${s.triggers}`;

  async function loadPack(next) {
    if (next?.file === pack?.file && JSON.stringify(next?.map) === JSON.stringify(pack?.map)) return;
    const sameFile = next?.file === pack?.file;
    pack = next || null;
    if (!sameFile) packRoot = null;
    if (next && !sameFile) {
      try {
        const res = await fetch(media(next.file));
        packRoot = res.ok ? cleanSvg(await res.text()) : null;
      } catch { packRoot = null; }
    }
    build();
  }

  function applyFinish() {
    const f = s.finish || {};
    for (const k of GROUPS) {
      const c = f[k] || { fill: 'solid', c1: '#FFFFFF', c2: '#FFFFFF', shine: 30, alpha: 20 };
      if (stops[k]) {
        const alpha = (c.alpha ?? 100) / 100;
        stops[k][0].setAttribute('stop-color', c.c1);
        stops[k][1].setAttribute('stop-color', c.fill === 'gradient' ? c.c2 : c.c1);
        stops[k][0].setAttribute('stop-opacity', alpha);
        stops[k][1].setAttribute('stop-opacity', c.fill === 'gradient' && alpha < 0.9 ? alpha * 0.45 : alpha);
      }
      for (const n of shines[k] || []) n.setAttribute('opacity', ((c.shine ?? 30) / 100) * 0.42);
    }
    box.classList.toggle('no-labels', s.labels === false);
  }

  function paint() {
    for (const [i, b] of Object.entries(btn)) {
      const on = Boolean(state.b[i]);
      if (b.pack) {
        const analog = i === '6' ? state.lt || 0 : i === '7' ? state.rt || 0 : 0;
        drawPart(b.pack, Math.max(on ? 1 : 0, analog), b.still);
      } else if (b.zone) b.node.classList.toggle('on', on);
      else {
        b.node.setAttribute('fill', on ? 'var(--gpressed)' : b.off);
        b.node.classList.toggle('on', on);
      }
    }
    const a = state.a;
    const move = (st, x, y) => {
      if (!st) return;
      if (st.arcade) {
        const dx = state.b[14] ? -1 : state.b[15] ? 1 : x;
        const dy = state.b[12] ? -1 : state.b[13] ? 1 : y;
        st.head.setAttribute('transform', `translate(${dx * 26} ${dy * 14}) rotate(${dx * 8} 150 232)`);
      } else st.head.setAttribute('transform', `translate(${x * st.r} ${y * st.r})`);
    };
    move(sticks.l, a[0], a[1]);
    move(sticks.r, a[2], a[3]);
    if (sticks.lt) sticks.lt.setAttribute('width', 92 * (state.lt || 0));
    if (sticks.rt) sticks.rt.setAttribute('width', 92 * (state.rt || 0));
    // Les gâchettes s'allument aussi quand le jeu les lit de façon analogique.
    if (btn[6]?.node && !btn[6].zone && (state.lt || 0) > 0.05) btn[6].node.setAttribute('fill', 'var(--gpressed)');
    if (btn[7]?.node && !btn[7].zone && (state.rt || 0) > 0.05) btn[7].node.setAttribute('fill', 'var(--gpressed)');
    if (dpadWhole) drawPart(dpadWhole, state.b[12] || state.b[13] || state.b[14] || state.b[15] ? 1 : 0, true);
  }

  function trail() {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.09)';
    ctx.fillRect(0, 0, 620, 420);
    ctx.globalCompositeOperation = 'source-over';
    if (!s.trail) return;
    for (const [st, x, y] of [[sticks.l, state.a[0], state.a[1]], [sticks.r, state.a[2], state.a[3]]]) {
      if (!st || st.arcade || st.noTrail || (Math.abs(x) < 0.08 && Math.abs(y) < 0.08)) continue;
      ctx.fillStyle = s.pressed;
      ctx.beginPath();
      ctx.arc(st.x + x * 15, st.y + y * 15, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function readBrowser() {
    if (s.source === 'xinput' || Date.now() - lastWs < 800) return;
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = list[(s.pad || 1) - 1];
    if (!p) return;
    const next = /054c|dualsense|dualshock|wireless controller/i.test(p.id) ? 'playstation' : 'xbox';
    if (next !== detected) { detected = next; }
    state = {
      b: Array.from({ length: 18 }, (_, i) => Boolean(p.buttons[i]?.pressed)),
      a: [...p.axes].slice(0, 4).map((v) => (Math.abs(v) < 0.06 ? 0 : v)),
      lt: p.buttons[6]?.value || 0, rt: p.buttons[7]?.value || 0,
    };
  }

  function demo(t) {
    if (!isPreview || query.get('nodemo') || Date.now() - lastWs < 2000) return;
    const k = Math.floor(t / 650) % 18;
    state = {
      b: Array.from({ length: 18 }, (_, i) => i === k), a: [Math.sin(t / 500) * 0.8, Math.cos(t / 500) * 0.8, Math.sin(t / 720), Math.cos(t / 900)],
      lt: (Math.sin(t / 800) + 1) / 2, rt: (Math.cos(t / 800) + 1) / 2,
    };
  }

  function idle() {
    const sig = `${state.b.join()}|${state.a.map((v) => v.toFixed(1)).join()}|${(state.lt || 0).toFixed(1)}|${(state.rt || 0).toFixed(1)}`;
    if (sig !== lastSig) { lastSig = sig; lastMove = Date.now(); }
    box.classList.toggle('gp-idle', !isPreview && s.idleFade > 0 && Date.now() - lastMove > s.idleFade * 1000);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!built) return;
    demo(t);
    readBrowser();
    if (built !== signature()) build();
    paint();
    trail();
    idle();
  }
  requestAnimationFrame(loop);

  const fromList = (list) => {
    const p = (list || []).find((x) => x.pad === (s.pad || 1) - 1);
    if (p) detected = p.kind;
  };

  return {
    update(settings, data) {
      s = settings;
      fromList(data?.pads);
      for (const [k, v] of Object.entries({ gpressed: s.pressed, glegend: s.legend })) box.style.setProperty(`--${k}`, v);
      loadPack(data?.pack || null);
      if (built !== signature()) build(); else { applyFinish(); if (pack && packRoot) applyPack(); }
    },
    on(msg) {
      if (msg.t === 'pads') fromList(msg.list);
      if (msg.t === 'pad' && msg.pad === (s.pad || 1) - 1 && s.source !== 'browser') {
        lastWs = Date.now();
        state = msg;
        if (msg.kind) detected = msg.kind;
      }
    },
  };
}
