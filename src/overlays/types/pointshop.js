// Boutique de points : le catalogue numéroté (« !acheter 2 ») et chaque achat qui s'affiche en direct.
import { el, avatar, fmt, isPreview } from '../lib.js';

const DEMO = {
  shopCmd: '!boutique', buyCmd: '!acheter',
  items: [
    { n: 1, emoji: '🎉', name: 'Confettis', cost: 300, left: null }, { n: 2, emoji: '🎡', name: 'Tour de roue', cost: 500, left: null },
    { n: 3, emoji: '💬', name: 'Message à l\'écran', cost: 400, left: null }, { n: 4, emoji: '🥁', name: 'Roulement de tambour', cost: 200, left: null },
    { n: 5, emoji: '🔥', name: 'Défi pour le streamer', cost: 1000, left: 3 },
  ],
};
const BUYERS = ['Léna', 'Marius', 'kenza.live', 'Yanis'];

export function mount(root) {
  let s = {};
  let shop = null;
  let demoTimer = null;
  const box = el('div', 'ps scaled');
  const head = el('div', 'ps-head');
  const title = el('b', 'ps-title');
  const hint = el('span', 'ps-hint');
  head.append(title, hint);
  const list = el('ol', 'ps-list');
  const buys = el('div', 'ps-buys');
  box.append(head, list, buys);
  root.append(box);

  const data = () => (shop && (shop.items.length || !isPreview) ? shop : DEMO);

  function render() {
    const d = data();
    box.style.setProperty('--accent', s.accent || '#FFD24A');
    box.style.setProperty('--text', s.text || '#F2F5F9');
    box.dataset.style = s.style || 'liste';
    title.textContent = s.title || 'Boutique';
    title.hidden = s.showTitle === false;
    hint.textContent = '';
    if (s.showHint !== false && d.buyCmd) hint.append(el('b', '', `${d.buyCmd} 1`), document.createTextNode(` · ${d.shopCmd}`));
    list.textContent = '';
    for (const it of d.items.slice(0, s.max || 6)) {
      const li = el('li', `ps-item ${it.left === 0 ? 'out' : ''}`);
      li.append(el('span', 'ps-n', String(it.n)), el('span', 'ps-emoji', it.emoji), el('span', 'ps-name', it.name), el('span', 'ps-cost', fmt(it.cost)));
      if (it.left !== null && it.left !== undefined) li.append(el('small', 'ps-left', it.left === 0 ? 'Épuisé' : `${it.left} restant${it.left > 1 ? 's' : ''}`));
      list.append(li);
    }
    list.hidden = s.style === 'achats';
    head.hidden = s.style === 'achats' && s.showTitle === false;
  }

  function bought(p) {
    if (s.showBuys === false || !p) return;
    const card = el('div', 'ps-buy');
    const who = el('div', 'ps-buy-who');
    who.append(avatar(p.avatar, p.user, 'ps-av'));
    const txt = el('div', 'ps-buy-txt');
    const name = el('b', '', p.user);
    name.setAttribute('translate', 'no');
    txt.append(name, el('span', '', `achète ${p.emoji} ${p.reward}`));
    if (p.text) { const t = el('em', 'txt', `« ${p.text} »`); txt.append(t); }
    who.append(txt);
    card.append(who);
    buys.prepend(card);
    while (buys.children.length > 3) buys.lastChild.remove();
    setTimeout(() => { card.classList.add('bye'); setTimeout(() => card.remove(), 500); }, 7000);
  }

  function demo() {
    if (!isPreview || demoTimer) return;
    let i = 0;
    demoTimer = setInterval(() => {
      if (shop?.items.length) { clearInterval(demoTimer); demoTimer = null; return; }
      const it = DEMO.items[i % DEMO.items.length];
      bought({ user: BUYERS[i % BUYERS.length], reward: it.name, emoji: it.emoji, cost: it.cost, avatar: '' });
      i += 1;
    }, 3500);
  }

  return {
    update(settings, d) { s = settings; if (d?.shop) shop = d.shop; render(); demo(); },
    on(msg) { if (msg.t !== 'shop') return; shop = msg.shop; render(); bought(msg.purchase); },
  };
}
