// Compteur en verre : son nom en étiquette, un grand nombre qui défile, et un « +1 » qui s'envole à chaque ajout.
import { el, fmt, setVars, isPreview, countTo, replay } from '../lib.js';

export function mount(root) {
  let s = {};
  let counters = [];
  const box = el('div', 'ct gx scaled');
  const l = el('div', 'gx-label ct-l');
  const n = el('div', 'gx-num ct-n');
  const fly = el('div', 'ct-fly');
  box.append(el('div', 'gx-shine'), l, n, fly);
  root.append(box);
  let demo = null;
  let demoTimer = null;

  const render = (delta = 0) => {
    const c = counters.find((x) => x.id === s.counterId) || counters[0] || (isPreview ? (demo = demo || { name: 'Victoires', value: 7 }) : null);
    box.hidden = !c;
    if (!c) return;
    l.textContent = c.name;
    countTo(n, c.value, { ms: 500 });
    if (delta) {
      replay(n, 'hit');
      const f = el('span', delta > 0 ? 'up' : 'down', `${delta > 0 ? '+' : ''}${fmt(delta)}`);
      fly.append(f);
      setTimeout(() => f.remove(), 1200);
    }
  };
  return {
    update(settings, data) {
      s = settings;
      setVars(root, { text: s.text, accent: s.accent });
      if (data?.counters) counters = data.counters;
      render();
      clearInterval(demoTimer);
      if (isPreview && !counters.length) demoTimer = setInterval(() => { demo.value += 1; render(1); }, 1600);
    },
    on(msg) {
      if (msg.t !== 'counter') return;
      clearInterval(demoTimer);
      const i = counters.findIndex((c) => c.id === msg.counter.id);
      const before = i >= 0 ? counters[i].value : msg.counter.value;
      if (i >= 0) counters[i] = msg.counter; else counters.push(msg.counter);
      render(msg.counter.value - before);
    },
  };
}
