// Minuteur en verre : grands chiffres, barre de temps qui se vide, couleur qui change dans la dernière
// minute et pulsation dans les dix dernières secondes. Le temps ajouté (subathon) s'envole en « +30 s ».
import { el, clock, setVars, isPreview, replay } from '../lib.js';

export function mount(root) {
  let s = {};
  let timers = [];
  let base = null;
  const box = el('div', 'tm gx scaled');
  const head = el('div', 'tm-head');
  const name = el('div', 'gx-label tm-name');
  const state = el('span', 'tm-state');
  head.append(name, state);
  const value = el('div', 'tm-v');
  const rail = el('div', 'tm-rail');
  const fill = el('i');
  rail.append(fill);
  const fly = el('div', 'tm-fly');
  box.append(el('div', 'gx-shine'), head, value, rail, fly);
  root.append(box);

  const current = () => timers.find((x) => x.id === s.timerId) || timers[0] || null;

  // Entre deux nouvelles du moteur, le minuteur continue de tourner tout seul.
  function remainingNow() {
    if (!base) return 0;
    const t = base.t;
    if (!t.running) return t.remaining;
    const dt = (performance.now() - base.at) / 1000;
    return t.mode === 'stopwatch' ? t.remaining + dt : Math.max(0, t.remaining - dt);
  }

  function paint() {
    const t = base?.t;
    box.hidden = !t;
    if (!t) return;
    const r = remainingNow();
    name.textContent = t.name;
    state.textContent = t.running ? '' : 'En pause';
    value.textContent = clock(Math.ceil(r));
    const max = Math.max(base.max || 1, r);
    fill.style.width = `${t.mode === 'stopwatch' ? 100 : Math.max(0, Math.min(100, (r / max) * 100))}%`;
    box.classList.toggle('low', t.mode !== 'stopwatch' && r > 0 && r <= 60);
    box.classList.toggle('crit', t.mode !== 'stopwatch' && r > 0 && r <= 10);
    box.classList.toggle('over', t.mode !== 'stopwatch' && r <= 0);
    box.classList.toggle('paused', !t.running);
  }

  function take(t) {
    if (!t) { base = null; paint(); return; }
    const prev = base && base.t.id === t.id ? remainingNow() : null;
    const max = base && base.t.id === t.id ? Math.max(base.max, t.remaining) : Math.max(t.remaining, 60);
    base = { t, at: performance.now(), max };
    if (prev !== null && t.mode !== 'stopwatch' && t.remaining - prev > 2) {
      const f = el('span', '', `+${clock(Math.round(t.remaining - prev))}`);
      fly.append(f);
      setTimeout(() => f.remove(), 1400);
      replay(value, 'hit');
    }
    paint();
  }

  setInterval(paint, 250);

  return {
    update(settings, data) {
      s = settings;
      box.className = `tm gx scaled ${s.style || 'plein'}`;
      setVars(root, { text: s.text, accent: s.accent });
      if (data?.timers) timers = data.timers;
      if (isPreview && !timers.length) timers = [{ id: 'demo', name: 'Subathon', mode: 'countdown', running: true, remaining: 3725 }];
      take(current());
    },
    on(msg) { if (msg.t === 'timers') { timers = msg.timers; take(current()); } },
  };
}
