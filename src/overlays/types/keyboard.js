// Disposition par touche physique : une touche garde sa place, seule l'inscription change entre AZERTY et QWERTY.
import { el, isPreview } from '../lib.js';

const AZ = {
  Q: 'A', W: 'Z', A: 'Q', Z: 'W', M: ',', Semicolon: 'M', Comma: ';', Period: ':', Slash: '!', Quote: 'ù', BracketLeft: '^', BracketRight: '$', Backslash: '*', Backquote: '²', Minus: ')', Equal: '=',
  1: '&', 2: 'é', 3: '"', 4: '\'', 5: '(', 6: '-', 7: 'è', 8: '_', 9: 'ç', 0: 'à',
};
const LABEL = {
  Escape: 'Échap', Tab: 'Tab', CapsLock: 'Maj', Shift: 'Shift', ShiftRight: 'Shift', Ctrl: 'Ctrl', CtrlRight: 'Ctrl', Alt: 'Alt', AltRight: 'AltGr', Meta: 'Win', MetaRight: 'Win',
  Space: 'Espace', Enter: 'Entrée', Backspace: 'Suppr', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/',
  ArrowLeft: '◀', ArrowRight: '▶', ArrowUp: '▲', ArrowDown: '▼', Insert: 'Ins', Delete: 'Del', Home: 'Début', End: 'Fin', PageUp: 'PgUp', PageDown: 'PgDn',
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4', Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9', NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/', NumpadDecimal: '.', NumpadEnter: 'Entr', NumLock: 'Num',
};

const k = (name, w = 1) => ({ name, w });
const g = (w = 1) => ({ gap: true, w });
const row = (s) => s.split(' ').map((x) => {
  const [n, w] = x.split(':');
  return n === '_' ? g(Number(w) || 1) : k(n, Number(w) || 1);
});

const MAIN = [
  row('Backquote 1 2 3 4 5 6 7 8 9 0 Minus Equal Backspace:2'),
  row('Tab:1.5 Q W E R T Y U I O P BracketLeft BracketRight Backslash:1.5'),
  row('CapsLock:1.75 A S D F G H J K L Semicolon Quote Enter:2.25'),
  row('Shift:2.25 Z X C V B N M Comma Period Slash ShiftRight:2.75'),
  row('Ctrl:1.25 Meta:1.25 Alt:1.25 Space:6.25 AltRight:1.25 MetaRight:1.25 _:1.25 CtrlRight:1.25'),
];
const NAV = [row('Insert Home PageUp'), row('Delete End PageDown'), row('_ _ _'), row('_ ArrowUp _'), row('ArrowLeft ArrowDown ArrowRight')];
const NUM = [row('NumLock NumpadDivide NumpadMultiply NumpadSubtract'), row('Numpad7 Numpad8 Numpad9 NumpadAdd'), row('Numpad4 Numpad5 Numpad6 _'), row('Numpad1 Numpad2 Numpad3 NumpadEnter'), row('Numpad0:2 NumpadDecimal _')];
const join = (...blocks) => blocks[0].map((_, i) => blocks.flatMap((b, j) => (j ? [g(0.4), ...b[i]] : b[i])));

const LAYOUTS = {
  wasd: [row('Escape 1 2 3 4 5'), row('Tab:1.5 Q W E R T'), row('CapsLock:1.75 A S D F G'), row('Shift:2.25 Z X C V'), row('Ctrl:1.25 Alt:1.25 Space:3.5')],
  tkl: join(MAIN, NAV),
  full: join(MAIN, NAV, NUM),
};

export function mount(root) {
  let s = {};
  const box = el('div', 'kb scaled');
  root.append(box);
  let built = '';
  let keys = {};

  function label(name) {
    if (s.lang === 'azerty' && AZ[name] !== undefined) return AZ[name].toUpperCase();
    return LABEL[name] ?? name;
  }

  function build() {
    box.textContent = '';
    keys = {};
    for (const r of LAYOUTS[s.layout] || LAYOUTS.wasd) {
      const line = el('div', 'kb-row');
      for (const key of r) {
        const n = el('div', key.gap ? 'k gap' : 'k', key.gap ? undefined : label(key.name));
        n.style.setProperty('--w', key.w);
        if (!key.gap) (keys[key.name] = keys[key.name] || []).push(n);
        line.append(n);
      }
      box.append(line);
    }
    built = `${s.layout}|${s.lang}`;
  }

  function fit() {
    const cols = (LAYOUTS[s.layout] || LAYOUTS.wasd).reduce((m, r) => Math.max(m, r.reduce((n, x) => n + x.w, 0)), 0);
    const u = s.layout === 'wasd' ? 52 : Math.max(22, Math.min(46, ((innerWidth - 40) / (s.scale / 100)) / (cols * 1.1)));
    box.style.setProperty('--u', `${u}px`);
  }

  if (isPreview) {
    const seq = ['W', 'A', 'S', 'D', 'Space', 'Shift', 'E', 'R'];
    let i = 0;
    setInterval(() => {
      Object.values(keys).flat().forEach((n) => n.classList.remove('on'));
      (keys[seq[i % seq.length]] || []).forEach((n) => n.classList.add('on'));
      i += 1;
    }, 480);
  }
  addEventListener('resize', fit);

  return {
    update(settings) {
      s = settings;
      for (const [a, b] of Object.entries({ key: s.key, pressed: s.pressed, legend: s.legend, legendOn: s.legendPressed, radius: `${s.radius}px`, glow: s.glow / 100 })) box.style.setProperty(`--${a}`, b);
      if (built !== `${s.layout}|${s.lang}`) build();
      fit();
    },
    on(msg) {
      if (msg.t === 'key') (keys[msg.name] || []).forEach((n) => n.classList.toggle('on', msg.down));
    },
  };
}
