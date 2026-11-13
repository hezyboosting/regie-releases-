// Classement en verre : podium pour les trois premiers (or, argent, bronze, avatars en grand),
// puis la liste. Une place qui change s'illumine.
import { el, tag, fmt, setVars, isPreview, avatar } from '../lib.js';

const DEMO = [
  { name: 'Lena', platform: 'tiktok', value: 4200 }, { name: 'kenza.live', platform: 'tiktok', value: 2950 }, { name: 'Nolan', platform: 'youtube', value: 1000 },
  { name: 'Marius', platform: 'twitch', value: 640 }, { name: 'Inès', platform: 'tiktok', value: 310 },
];
const EMPTY = { coins: 'Le classement démarre au premier cadeau.', likes: 'Le classement démarre au premier like.', points: 'Le classement démarre avec les premiers points.', messages: 'Le classement démarre au premier message.' };
const UNIT = { coins: 'pièces', likes: 'likes', points: 'points', messages: 'messages', shares: 'partages', subs: 'abos', follows: 'suivis' };
const MEDAL = ['or', 'argent', 'bronze'];

export function mount(root) {
  let s = {};
  let boards = {};
  let prev = new Map();
  const box = el('div', 'panel gx lb2 scaled');
  root.append(box);

  const render = () => {
    const rows = boards[`${s.metric}:${s.scope}`] || [];
    const list = (rows.length ? rows : isPreview ? DEMO : []).slice(0, s.count || 5);
    box.textContent = '';
    box.append(el('div', 'gx-shine'));
    const head = el('div', 'lb2-head');
    head.append(el('span', 'gx-label', s.title || 'Meilleurs soutiens'), el('span', 'lb2-unit', UNIT[s.metric] || ''));
    box.append(head);
    if (!list.length) { box.append(el('div', 'pl-foot', EMPTY[s.metric] || '')); return; }
    const now = new Map(list.map((p, i) => [p.name, i]));
    const podium = s.style !== 'liste' && list.length >= 3;
    if (podium) {
      const pod = el('div', 'lb2-pod');
      for (const i of [1, 0, 2]) {
        const p = list[i];
        const c = el('div', `lb2-step ${MEDAL[i]}`);
        if (prev.has(p.name) && prev.get(p.name) > i) c.classList.add('up');
        const av = el('div', 'lb2-avw');
        av.append(avatar(p.avatar, p.name, 'lb2-av'), el('span', 'lb2-medal', String(i + 1)));
        c.append(av, el('b', 'lb2-name', p.name), el('span', 'lb2-val', fmt(p.value)), el('i', 'lb2-base'));
        pod.append(c);
      }
      box.append(pod);
    }
    for (let i = podium ? 3 : 0; i < list.length; i += 1) {
      const p = list[i];
      const r = el('div', `lb2-row${prev.has(p.name) && prev.get(p.name) > i ? ' up' : ''}`);
      r.append(el('span', `lb2-rank ${i < 3 ? MEDAL[i] : ''}`, String(i + 1)), avatar(p.avatar, p.name, 'lb2-sav'), el('span', 'lb2-rn', p.name), tag(p.platform), el('b', 'lb2-pts', fmt(p.value)));
      box.append(r);
    }
    prev = now;
  };
  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.boards) boards = data.boards; render(); },
    on(msg) { if (msg.t === 'boards') { boards = msg.boards; render(); } },
  };
}
