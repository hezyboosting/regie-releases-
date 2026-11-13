// Clavier en direct — vraies touches en 3D (profil à cuvette, rendu Blender Cycles) posées dans un boîtier,
// recolorables : touches, modificateurs, Échap/Entrée, boîtier. Disposition par touche physique :
// une touche garde sa place, seule l'inscription change entre AZERTY (ISO) et QWERTY (ANSI).
import { el, isPreview } from '../lib.js';

const AZ = {
  Q: 'A', W: 'Z', A: 'Q', Z: 'W', M: ',', Semicolon: 'M', Comma: ';', Period: ':', Slash: '!', Quote: 'ù', BracketLeft: '^', BracketRight: '$', Backslash: '*', Backquote: '²', Minus: ')', Equal: '=',
  1: '&', 2: 'é', 3: '"', 4: '\'', 5: '(', 6: '-', 7: 'è', 8: '_', 9: 'ç', 0: 'à', IntlBackslash: '<',
};
const LABEL = {
  Escape: 'Échap', Tab: 'Tab', CapsLock: 'Verr. maj', Shift: 'Maj', ShiftRight: 'Maj', Ctrl: 'Ctrl', CtrlRight: 'Ctrl', Alt: 'Alt', AltRight: 'Alt Gr', Meta: 'Win', MetaRight: 'Win',
  Space: '', Enter: 'Entrée', Backspace: 'Retour', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Insert: 'Inser', Delete: 'Suppr', Home: 'Début', End: 'Fin', PageUp: 'Pg ↑', PageDown: 'Pg ↓',
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4', Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9', NumpadAdd: '+', NumpadSubtract: '−', NumpadMultiply: '×', NumpadDivide: '÷', NumpadDecimal: '.', NumpadEnter: 'Entr', NumLock: 'Num',
};
const LABEL_QW = { CapsLock: 'Caps', Shift: 'Shift', ShiftRight: 'Shift', Enter: 'Enter', Backspace: 'Back', Escape: 'Esc', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', AltRight: 'Alt' };
// Windows nomme les touches d'après leur inscription (code virtuel), pas d'après leur place.
// En AZERTY, la touche marquée « A » arrive comme « A » alors qu'elle est à la place du Q américain :
// on ramène chaque nom reçu à la touche physique dessinée.
const FROM_AZERTY = {
  A: 'Q', Q: 'A', Z: 'W', W: 'Z', M: 'Semicolon', Comma: 'M', Period: 'Comma', Slash: 'Period', 125: 'Slash',
  Backquote: 'Quote', Quote: 'Backquote', BracketLeft: 'Minus', BracketRight: 'BracketLeft', Semicolon: 'BracketRight',
  Backslash: 'Backslash', 3654: 'IntlBackslash',
};
// Pavé numérique Verr. Num éteint, touche « < > » des claviers ISO (code brut 0x0E46).
const ALIAS = {
  NumpadInsert: 'Numpad0', NumpadEnd: 'Numpad1', NumpadArrowDown: 'Numpad2', NumpadPageDown: 'Numpad3', NumpadArrowLeft: 'Numpad4',
  3660: 'Numpad5', NumpadArrowRight: 'Numpad6', NumpadHome: 'Numpad7', NumpadArrowUp: 'Numpad8', NumpadPageUp: 'Numpad9', NumpadDelete: 'NumpadDecimal',
  3654: 'IntlBackslash',
};

const MOD = new Set(['Tab', 'CapsLock', 'Shift', 'ShiftRight', 'Ctrl', 'CtrlRight', 'Alt', 'AltRight', 'Meta', 'MetaRight', 'Backspace', 'Space',
  'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'NumpadAdd']);
const ACCENT = new Set(['Escape', 'Enter', 'NumpadEnter']);

// « Nom:largeur » ou « Nom:tall » (2u de haut) ou « Nom:iso » (Entrée ISO) ; « _:largeur » = vide.
const row = (s) => s.split(' ').map((x) => {
  const [n, w] = x.split(':');
  if (n === '_') return { gap: true, w: Number(w) || 1 };
  if (w === 'tall') return { name: n, w: 1, h: 2, type: 'tall' };
  if (w === 'iso') return { name: n, w: 1.5, h: 2, type: 'iso' };
  return { name: n, w: Number(w) || 1, h: 1 };
});
const ANSI = [
  row('Backquote 1 2 3 4 5 6 7 8 9 0 Minus Equal Backspace:2'),
  row('Tab:1.5 Q W E R T Y U I O P BracketLeft BracketRight Backslash:1.5'),
  row('CapsLock:1.75 A S D F G H J K L Semicolon Quote Enter:2.25'),
  row('Shift:2.25 Z X C V B N M Comma Period Slash ShiftRight:2.75'),
  row('Ctrl:1.25 Meta:1.25 Alt:1.25 Space:6.25 AltRight:1.25 MetaRight:1.25 _:1.25 CtrlRight:1.25'),
];
const ISO = [
  row('Backquote 1 2 3 4 5 6 7 8 9 0 Minus Equal Backspace:2'),
  row('Tab:1.5 Q W E R T Y U I O P BracketLeft BracketRight Enter:iso'),
  row('CapsLock:1.75 A S D F G H J K L Semicolon Quote Backslash _:1.25'),
  row('Shift:1.25 IntlBackslash Z X C V B N M Comma Period Slash ShiftRight:2.75'),
  row('Ctrl:1.25 Meta:1.25 Alt:1.25 Space:6.25 AltRight:1.25 MetaRight:1.25 _:1.25 CtrlRight:1.25'),
];
const NAV = [row('Insert Home PageUp'), row('Delete End PageDown'), row('_ _ _'), row('_ ArrowUp _'), row('ArrowLeft ArrowDown ArrowRight')];
const NUM = [row('NumLock NumpadDivide NumpadMultiply NumpadSubtract'), row('Numpad7 Numpad8 Numpad9 NumpadAdd:tall'), row('Numpad4 Numpad5 Numpad6 _'),
  row('Numpad1 Numpad2 Numpad3 NumpadEnter:tall'), row('Numpad0:2 NumpadDecimal _')];
const COMPACT = [row('Escape 1 2 3 4 5'), row('Tab:1.5 Q W E R T'), row('CapsLock:1.75 A S D F G'), row('Shift:2.25 Z X C V'), row('Ctrl:1.25 Alt:1.25 Space:3.5')];

// Blocs posés côte à côte, séparés de 0,25u.
function place(blocks) {
  const keys = [];
  let x0 = 0, rows = 0;
  for (const b of blocks) {
    let bw = 0;
    b.forEach((r, ri) => {
      let x = 0;
      for (const k of r) {
        if (!k.gap) keys.push({ ...k, x: x0 + x, y: ri });
        x += k.w;
      }
      bw = Math.max(bw, x);
    });
    rows = Math.max(rows, b.length);
    x0 += bw + 0.25;
  }
  return { keys, cols: x0 - 0.25, rows };
}

const TYPES = new Set(['1u', '1.25u', '1.5u', '1.75u', '2u', '2.25u', '2.75u', '3.5u', '6.25u', 'tall', 'iso']);
const typeOf = (k) => k.type || (TYPES.has(`${k.w}u`) ? `${k.w}u` : '1u');
const asset = (t) => `/assets/devices/keys/${t}.png`;
const CASE_SLICE = 0.8;    // part du boîtier (en u) qui ne s'étire pas
const CASE_PAD = 0.45;     // marge entre le bord du boîtier et les touches

const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};
const lum = (hex) => {
  const n = Number.parseInt(String(hex || '#000000').slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.04 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ink = (hex) => (lum(hex) > 0.36 ? '#1C1F24' : '#F3F0EA');

let seq = 0;
export function mount(root) {
  let s = {};
  const uid = `kb${++seq}`;
  const box = el('div', 'kb scaled');
  root.append(box);

  // Filtres de teinte : lumière (rouge) × couleur, puis reflets (vert) dosés par la brillance.
  const defs = node('svg', { width: 0, height: 0, class: 'kb-defs', 'aria-hidden': 'true' });
  box.append(defs);
  const filters = {};
  for (const f of ['alpha', 'mod', 'accent', 'press', 'case']) {
    const fl = node('filter', { id: `${uid}-${f}`, 'color-interpolation-filters': 'sRGB', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
    node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0', result: 'shade' }, fl);
    const flood = node('feFlood', { 'flood-color': '#FFFFFF', result: 'paint' }, fl);
    node('feComposite', { in: 'shade', in2: 'paint', operator: 'arithmetic', k1: 1, k2: 0, k3: 0, k4: 0, result: 'col' }, fl);
    const gloss = node('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 1 0 0 0', result: 'hl0' }, fl);
    node('feComposite', { in: 'hl0', in2: 'SourceGraphic', operator: 'in', result: 'hl' }, fl);
    node('feComposite', { in: 'hl', in2: 'col', operator: 'over' }, fl);
    filters[f] = { flood, gloss };
  }

  const caseEl = el('div', 'kb-case');
  caseEl.style.filter = `url(#${uid}-case) drop-shadow(0 calc(var(--u) * .22) calc(var(--u) * .35) rgba(0,0,0,.45))`;
  const keysEl = el('div', 'kb-keys');
  box.append(caseEl, keysEl);

  let built = '';
  let keys = {};
  let geo = { cols: 1, rows: 1 };

  function layout() {
    const iso = s.lang !== 'qwerty';
    const main = iso ? ISO : ANSI;
    if (s.layout === 'tkl') return place([main, NAV]);
    if (s.layout === 'full') return place([main, NAV, NUM]);
    return place([COMPACT]);
  }

  function label(name) {
    if (s.lang !== 'qwerty' && AZ[name] !== undefined) return AZ[name].toUpperCase();
    if (s.lang === 'qwerty' && LABEL_QW[name] !== undefined) return LABEL_QW[name];
    return LABEL[name] ?? name;
  }

  function build() {
    keysEl.textContent = '';
    keys = {};
    const g = layout();
    geo = g;
    for (const k of g.keys) {
      const cls = ACCENT.has(k.name) ? 'accent' : MOD.has(k.name) ? 'mod' : 'alpha';
      const n = el('div', `kk kk-${cls}`);
      n.style.setProperty('--x', k.x); n.style.setProperty('--y', k.y); n.style.setProperty('--w', k.w); n.style.setProperty('--h', k.h);
      const img = el('img');
      img.src = asset(typeOf(k)); img.alt = ''; img.draggable = false;
      img.dataset.f = cls;
      img.style.filter = `url(#${uid}-${cls})`;
      const text = label(k.name);
      const lg = el('span', `kl${text.length > 2 ? ' small' : ''}${k.type === 'iso' ? ' iso' : ''}`, text);
      n.append(img, lg);
      keysEl.append(n);
      (keys[k.name] ||= []).push(n);
    }
    built = `${s.layout}|${s.lang}`;
  }

  function fit() {
    const extra = s.showCase === false ? 0.2 : CASE_PAD * 2;
    const scale = (s.scale || 100) / 100;
    const byW = ((innerWidth - 20) / scale) / (geo.cols + extra);
    const byH = ((innerHeight - 20) / scale) / (geo.rows + extra);
    const u = Math.max(22, Math.min(s.layout === 'wasd' || !s.layout ? 64 : 58, byW, byH));
    box.style.setProperty('--u', `${u}px`);
    const pad = s.showCase === false ? 0.1 : CASE_PAD;
    box.style.setProperty('--pad', pad);
    box.style.width = `${(geo.cols + pad * 2) * u}px`;
    box.style.height = `${(geo.rows + pad * 2) * u}px`;
    caseEl.hidden = s.showCase === false;
  }

  function colors() {
    const shine = s.shine ?? 40;
    const ks = (0.1 + (shine / 100) * 1.4).toFixed(3);
    const set = (f, c) => {
      filters[f].flood.setAttribute('flood-color', c);
      filters[f].gloss.setAttribute('values', `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 ${f === 'case' ? (ks * 0.8).toFixed(3) : ks} 0 0 0`);
    };
    set('alpha', s.key || '#ECEAE4'); set('mod', s.mod || '#4A4F58'); set('accent', s.accentKey || '#F3D38A');
    set('press', s.pressed || '#8FD3FF'); set('case', s.case || '#2A2D33');
    box.style.setProperty('--ink-alpha', ink(s.key || '#ECEAE4'));
    box.style.setProperty('--ink-mod', ink(s.mod || '#4A4F58'));
    box.style.setProperty('--ink-accent', ink(s.accentKey || '#F3D38A'));
    box.style.setProperty('--ink-press', ink(s.pressed || '#8FD3FF'));
    box.style.setProperty('--pressed', s.pressed || '#8FD3FF');
    box.style.setProperty('--glow', (s.glow ?? 45) / 100);
  }

  function slot(name) {
    const n = String(name);
    if (s.lang !== 'qwerty' && FROM_AZERTY[n]) return FROM_AZERTY[n];
    return ALIAS[n] || n;
  }

  function press(name, down, physical = false) {
    for (const n of keys[physical ? name : slot(name)] || []) {
      n.classList.toggle('on', down);
      const img = n.firstChild;
      img.style.filter = down ? `url(#${uid}-press) drop-shadow(0 0 calc(var(--u) * .32 * var(--glow)) var(--pressed))` : `url(#${uid}-${img.dataset.f})`;
    }
  }

  // Aperçu : une démo tourne tant que personne ne tape. Dès qu'une vraie touche arrive, elle s'arrête
  // net et ne reprend qu'après 8 secondes sans rien toucher.
  let lastReal = 0;
  let demoKey = null;
  const stopDemo = () => { if (demoKey) { press(demoKey, false, true); demoKey = null; } };
  if (isPreview) {
    const demo = ['W', 'A', 'S', 'D', 'Space', 'Shift', 'E', 'R'];
    let i = 0;
    setInterval(() => {
      if (Date.now() - lastReal < 8000) { stopDemo(); return; }
      stopDemo();
      demoKey = demo[i % demo.length];
      press(demoKey, true, true);
      i += 1;
    }, 480);
  }
  addEventListener('resize', fit);

  return {
    update(settings) {
      s = settings;
      if (built !== `${s.layout}|${s.lang}`) build();
      colors();
      fit();
    },
    on(msg) {
      if (msg.t !== 'key') return;
      lastReal = Date.now();
      stopDemo();
      press(msg.name, msg.down);
    },
  };
}
