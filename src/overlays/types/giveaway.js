import { el, tag, fmt, setVars, isPreview } from '../lib.js';

const DEMO = { status: 'open', title: 'Tirage au sort', keyword: '!participe', entrants: [{ name: 'Lena', platform: 'twitch' }, { name: 'kenza.live', platform: 'tiktok' }, { name: 'Nolan', platform: 'youtube' }], winner: null };

export function mount(root) {
  const box = el('div', 'panel scaled');
  root.append(box);
  const render = (g) => {
    const data = g && g.status !== 'idle' ? g : isPreview ? DEMO : null;
    box.hidden = !data;
    box.textContent = '';
    if (!data) return;
    box.append(el('h1', '', data.title));
    if (data.winner) { box.append(el('div', 'gw-win', data.winner.name)); return; }
    const names = el('div', 'gw-names');
    for (const e of data.entrants.slice(-24)) { const s = el('span'); s.append(tag(e.platform), document.createTextNode(e.name)); names.append(s); }
    box.append(names, el('div', 'pl-foot', data.status === 'open' ? `Écris ${data.keyword} pour participer. ${fmt(data.entrants.length)} inscrits` : `${fmt(data.entrants.length)} inscrits`));
  };
  return {
    update(s, data) { setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); render(data?.giveaway); },
    on(msg) { if (msg.t === 'giveaway') render(msg.giveaway); },
  };
}
