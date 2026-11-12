import { el, tag, fmt, setVars, isPreview, avatar } from '../lib.js';

export function mount(root) {
  let s = {};
  let g = null;
  const box = el('div', 'tg scaled');
  root.append(box);
  const render = () => {
    const t = g?.topStreak || (isPreview ? { user: 'kenza.live', platform: 'tiktok', name: 'Rose', count: 188 } : null);
    box.textContent = '';
    box.hidden = !t;
    if (!t) return;
    const text = el('div', 'tg-txt');
    const line = el('div', 'tg-who');
    line.append(el('b', '', t.user), tag(t.platform));
    text.append(el('span', 'tg-title', s.title), line, el('span', 'tg-what', t.name));
    box.append(avatar(t.avatar, t.user, 'tg-av'), text, el('b', 'tg-val', `×${fmt(t.count)}`));
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.gifts) g = data.gifts; render(); },
    on(msg) { if (msg.t === 'gifts') { g = msg.gifts; render(); } },
  };
}
