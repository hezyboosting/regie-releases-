import { el, setVars, confetti, isPreview } from '../lib.js';
import { fillVars } from '../custom-render.js';

export function mount(root) {
  let s = {};
  let vars = {};
  const frame = el('div', 'wc');
  const label = el('div', 'wc-label');
  frame.append(label);
  root.append(frame);
  const paint = () => { label.textContent = fillVars(s.label || '', vars); label.hidden = !s.label; };
  const react = (big) => {
    if (!s.react) return;
    frame.classList.remove('pulse'); void frame.offsetWidth; frame.classList.add('pulse');
    if (big) confetti([s.accent, s.accent2, '#FFFFFF'], 60);
  };
  return {
    update(settings, data) {
      s = settings;
      frame.className = `wc ${s.style}`;
      setVars(root, { accent: s.accent, accent2: s.accent2, text: s.text, th: `${s.thickness}px`, rad: `${s.radius}px` });
      if (data?.vars) vars = data.vars;
      if (isPreview && !vars.viewers) vars = { viewers: 1284 };
      paint();
    },
    on(msg) {
      if (msg.t === 'vars') { vars = msg.vars; paint(); }
      if (msg.t === 'ev' && !['chat', 'join', 'like'].includes(msg.ev.type)) react(['gift', 'raid', 'giftsub', 'superchat'].includes(msg.ev.type));
    },
  };
}
