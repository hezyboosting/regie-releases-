import { el, clock, setVars } from '../lib.js';

export function mount(root) {
  let s = {};
  let timers = [];
  const box = el('div', 'tm scaled');
  const name = el('div', 'tm-name');
  const value = el('div', 'tm-v');
  box.append(name, value);
  root.append(box);
  const render = () => {
    const t = timers.find((x) => x.id === s.timerId) || timers[0];
    box.hidden = !t;
    if (!t) return;
    name.textContent = t.name;
    value.textContent = clock(t.remaining);
  };
  return {
    update(settings, data) {
      s = settings;
      box.className = `tm scaled ${s.style}`;
      setVars(root, { text: s.text, accent: s.accent });
      if (data?.timers) timers = data.timers;
      render();
    },
    on(msg) { if (msg.t === 'timers') { timers = msg.timers; render(); } },
  };
}
