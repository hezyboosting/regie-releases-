// Souris en direct — les souris gaming les plus connues, modélisées et rendues en 3D (Blender Cycles),
// vues de dessus, recolorables zone par zone comme les manettes (voir pad-real.js et tools/devices/).
// Clics (gauche, droit, molette, deux boutons de pouce), molette et mouvement.
import { el, isPreview } from '../lib.js';
import { cleanSvg } from '../svg-clean.js';
import { mountRealPad } from '../pad-real.js';

const MOUSE_H = 440;
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};
const hsl = (h) => `hsl(${Math.round(h) % 360} 95% 60%)`;

// Formes des souris connues, modélisées de zéro d'après leurs proportions (aucun logo).
export const MICE = ['superlight', 'deathadder', 'g502', 'viper', 'model_o', 'regie'];
const cache = {};
const loadSvg = (model) => (cache[model] ||= fetch(`/assets/devices/mouse_${model}.svg`).then((r) => (r.ok ? r.text() : '')).then((t) => (t ? cleanSvg(t) : null)).catch(() => null));

export function mount(root) {
  let s = {};
  const box = el('div', 'ms scaled');
  const stage = el('div', 'ms-stage');
  box.append(stage);
  root.append(box);

  let real = null, wheel = null, arrows = null, size = { w: 640, h: 1111 };
  const down = new Set();
  let lastClick = 0;

  let model = '';
  async function build(name) {
    model = name;
    const svgRoot = await loadSvg(name);
    if (!svgRoot || model !== name) return;
    const copy = svgRoot.cloneNode(true);
    stage.textContent = '';
    real = mountRealPad(copy);
    size = real.size;
    stage.append(real.el);
    const k = MOUSE_H / size.h;
    stage.style.width = `${size.w * k}px`; stage.style.height = `${MOUSE_H}px`;
    wheel = copy.querySelector('[data-wheel]');
    if (wheel) {
      const cx = +wheel.dataset.cx, cy = +wheel.dataset.cy, hw = +wheel.dataset.hw, hh = +wheel.dataset.hh;
      const a = hw * 1.1;
      const mk = (dir) => node('path', {
        d: `M${cx - a} ${cy + dir * a * 0.35} L${cx} ${cy - dir * a * 0.55} L${cx + a} ${cy + dir * a * 0.35}`,
        fill: 'none', 'stroke-width': hw * 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0, class: 'ms-arrow',
        transform: `translate(0 ${-dir * hh * 0.42})`,
      }, copy);
      arrows = { up: mk(1), down: mk(-1) };
    } else arrows = null;
    apply();
    paint();
  }

  function finish() {
    const shine = s.shine ?? 45;
    const z = (c1) => ({ fill: 'solid', c1, c2: c1, shine, alpha: 100 });
    return {
      shell: z(s.body || '#2A2E35'), grips: z(s.rim || '#15171C'), buttons: z(s.buttons || s.body || '#2A2E35'),
      sticks: { ...z(s.accent || '#3A3F47'), shine: Math.min(100, shine * 0.6) }, light: { ...z(s.light || '#8FD3FF'), shine: 70 },
    };
  }

  function apply() {
    if (!real) return;
    real.colors(finish(), { pressedColor: s.pressed || '#8FD3FF', labels: true, triggerBars: false, tintPressed: true });
    real.paint({ b: [0, ...[1, 2, 3, 4, 5].map((i) => (down.has(i) ? 1 : 0))] });
    if (arrows) for (const a of Object.values(arrows)) a.setAttribute('stroke', s.pressed || '#8FD3FF');
  }

  function paint() {
    if (!real) return;
    const b = [0, 0, 0, 0, 0, 0];
    for (const i of down) b[i] = 1;
    real.paint({ b });
  }

  function scroll(dir) {
    if (!wheel || !arrows) return;
    const hh = +wheel.dataset.hh;
    wheel.setAttribute('transform', `translate(0 ${(dir > 0 ? 1 : -1) * hh * 0.08})`);
    const a = dir > 0 ? arrows.down : arrows.up;
    a.setAttribute('opacity', 1);
    clearTimeout(a.t); clearTimeout(wheel.t);
    wheel.t = setTimeout(() => wheel.setAttribute('transform', ''), 90);
    a.t = setTimeout(() => a.setAttribute('opacity', 0), 220);
  }

  // La souris reste immobile : seuls les clics, la molette et la lumière bougent.
  let hue = 200, lightTick = 0;
  function step(t) {
    requestAnimationFrame(step);
    if (!real || t - lightTick < 66) return;     // lumière ≈ 15 images/s, c'est assez
    lightTick = t;
    const fx = s.lightFx || 'fixe';
    if (fx === 'rgb') { hue = (hue + 6) % 360; real.tint('light', hsl(hue), hsl(hue + 70)); }
    else if (fx === 'breath' || fx === 'click') {
      const base = s.light || '#8FD3FF';
      const k = fx === 'breath' ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 700)) : Math.max(0.25, 1 - (t - lastClick) / 600);
      real.tint('light', mix(base, k));
    }
  }
  requestAnimationFrame(step);

  function mix(hex, k) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
    return `rgb(${r},${g},${b})`;
  }

  // Aperçu : quelques clics de démo tant que la vraie souris ne fait rien. Au premier vrai clic ou
  // coup de molette, la démo s'arrête et ne reprend qu'après 8 secondes de calme.
  let lastReal = 0;
  let demoOn = false;
  if (isPreview) {
    let i = 0;
    setInterval(() => {
      if (Date.now() - lastReal < 8000) {
        if (demoOn) { demoOn = false; }
        return;
      }
      demoOn = true;
      down.clear();
      const k = i % 9;
      if (k < 5) { down.add([1, 2, 3, 4, 5][k]); lastClick = performance.now(); }
      if (k === 6) scroll(-1);
      if (k === 7) scroll(1);
      i += 1;
      paint();
    }, 700);
  }

  return {
    update(settings) {
      const prevFx = s.lightFx;
      s = settings;
      const want = MICE.includes(s.model) ? s.model : 'superlight';
      if (want !== model) build(want);
      apply();
      if (prevFx !== s.lightFx && real && (s.lightFx || 'fixe') === 'fixe') real.tint('light', s.light || '#8FD3FF');
    },
    on(msg) {
      if (msg.t !== 'mouse') return;
      // Tout signe de la vraie souris (clic, molette, mouvement) coupe la démo.
      if (demoOn) { demoOn = false; down.clear(); paint(); }
      lastReal = Date.now();
      if (msg.k === 'btn') {
        if (msg.down) { down.add(msg.button); lastClick = performance.now(); } else down.delete(msg.button);
        paint();
      }
      if (msg.k === 'wheel') scroll(msg.dir);
    },
  };
}
