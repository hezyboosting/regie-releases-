import { el, setVars, isPreview, query } from '../lib.js';

export function mount(root) {
  let s = {};
  const play = (style, ms) => {
    root.querySelector('.tr')?.remove();
    const box = el('div', `tr ${style}`);
    box.style.setProperty('--ms', `${ms}ms`);
    const count = style === 'bandes' ? 7 : 2;
    for (let i = 0; i < count; i += 1) { const b = el('i'); b.style.setProperty('--i', i); box.append(b); }
    if (s.label) box.append(el('b', 'tr-label', s.label));
    root.append(box);
    setTimeout(() => box.remove(), ms + 60);
  };
  if (isPreview && !query.get('still')) setInterval(() => play(['volet', 'diagonale', 'bandes', 'iris'][Math.floor(Date.now() / 2400) % 4], 1400), 2400);
  return {
    update(settings) { s = settings; setVars(root, { accent: s.accent, accent2: s.accent2 }); },
    on(msg) { if (msg.t === 'transition') play(msg.style, msg.ms); },
  };
}
