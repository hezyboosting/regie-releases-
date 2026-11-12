import { el, fmt, setVars } from '../lib.js';

export function mount(root) {
  let s = {};
  let counters = [];
  const box = el('div', 'ct scaled');
  const n = el('div', 'ct-n');
  const l = el('div', 'ct-l');
  box.append(n, l);
  root.append(box);
  const render = (hit) => {
    const c = counters.find((x) => x.id === s.counterId) || counters[0];
    box.hidden = !c;
    if (!c) return;
    n.textContent = fmt(c.value);
    l.textContent = c.name;
    if (hit) { n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit'); }
  };
  return {
    update(settings, data) { s = settings; setVars(root, { text: s.text, accent: s.accent }); if (data?.counters) counters = data.counters; render(); },
    on(msg) {
      if (msg.t !== 'counter') return;
      const i = counters.findIndex((c) => c.id === msg.counter.id);
      if (i >= 0) counters[i] = msg.counter; else counters.push(msg.counter);
      render(true);
    },
  };
}
