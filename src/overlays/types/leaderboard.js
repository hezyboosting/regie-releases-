import { el, tag, fmt, setVars, isPreview, avatar } from '../lib.js';

const DEMO = [{ name: 'Lena', platform: 'twitch', value: 4200 }, { name: 'kenza.live', platform: 'tiktok', value: 2950 }, { name: 'Nolan', platform: 'youtube', value: 1000 }];
const EMPTY = { coins: 'Le classement démarre au premier cadeau.', likes: 'Le classement démarre au premier like.', points: 'Le classement démarre avec les premiers points.', messages: 'Le classement démarre au premier message.' };

export function mount(root) {
  let s = {};
  let boards = {};
  const box = el('div', 'panel scaled');
  root.append(box);
  const render = () => {
    const rows = boards[`${s.metric}:${s.scope}`] || [];
    const list = rows.length ? rows : isPreview ? DEMO : [];
    box.textContent = '';
    box.append(el('h1', '', s.title));
    list.slice(0, s.count).forEach((p, i) => {
      const row = el('div', 'lb-row');
      row.append(el('span', 'lb-rank', i + 1), avatar(p.avatar, p.name), el('span', 'lb-name', p.name), tag(p.platform), el('span', 'lb-pts', fmt(p.value)));
      box.append(row);
    });
    if (!list.length) box.append(el('div', 'pl-foot', EMPTY[s.metric]));
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.boards) boards = data.boards; render(); },
    on(msg) { if (msg.t === 'boards') { boards = msg.boards; render(); } },
  };
}
