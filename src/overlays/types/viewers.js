import { el, tag, fmt, setVars, isPreview } from '../lib.js';

export function mount(root) {
  let s = {};
  const box = el('div', 'big scaled');
  root.append(box);
  const render = (total, per = {}) => {
    box.textContent = '';
    box.append(el('i', 'dot'), el('div', 'n', fmt(total)));
    if (s.split) {
      const sub = el('div', 'sub');
      for (const [p, v] of Object.entries(per)) { const w = el('span'); w.append(tag(p), document.createTextNode(fmt(v))); sub.append(w); }
      box.append(sub);
    }
  };
  return {
    update(settings, data) {
      s = settings;
      setVars(root, { text: s.text, accent: s.accent });
      if (isPreview && !data.total) render(1284, { tiktok: 620, twitch: 512, youtube: 152 }); else render(data.total || 0, data.perPlatform);
    },
    on(msg) { if (msg.t === 'viewers') render(msg.total, msg.perPlatform); },
  };
}
