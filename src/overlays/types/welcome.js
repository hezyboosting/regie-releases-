// Bienvenue : quand quelqu'un arrive dans le live (TikTok) ou écrit son premier message, une bannière
// l'accueille avec sa photo. On choisit qui est accueilli : tout le monde, les habitués, les soutiens,
// les abonnés ou le top 10. Une fois par live et par personne, et une file pour ne rien couper.
import { el, avatar, tag, isPreview, playSound, confetti } from '../lib.js';

const DEMO = [
  { name: 'Kenza', platform: 'tiktok', coins: 5400, messages: 320, top: true, sub: true },
  { name: 'Marius', platform: 'tiktok', coins: 120, messages: 40 },
  { name: 'Lena', platform: 'twitch', messages: 0 },
];

export function mount(root) {
  let s = {};
  const queue = [];
  let busy = false;
  const stage = el('div', 'wc scaled');
  root.append(stage);

  function badge(w) {
    if (s.badges === false) return null;
    if (w.top) return ['top', 'Top soutien 👑'];
    if (w.mod) return ['mod', 'Modo'];
    if (w.sub) return ['sub', 'Abonné'];
    if (w.coins > 0) return ['fan', 'Soutien'];
    if (w.messages > 20) return ['regular', 'Habitué'];
    if (!w.messages && !w.coins) return ['new', 'Première visite'];
    return null;
  }

  function wanted(w, kind) {
    if (kind === 'join' && s.onJoin === false) return false;
    if (kind === 'chat' && s.onFirstChat === false) return false;
    switch (s.who || 'connus') {
      case 'tous': return true;
      case 'connus': return w.messages > 0 || w.coins > 0 || w.follows > 0 || w.sub;
      case 'soutiens': return w.coins >= Math.max(1, s.minCoins || 1);
      case 'abonnes': return w.sub;
      case 'top': return w.top;
      default: return true;
    }
  }

  function show(w) {
    busy = true;
    const b = el('div', 'wc-banner');
    const kind = badge(w);
    if (kind) b.dataset.badge = kind[0];
    if (s.avatars !== false) b.append(avatar(w.avatar, w.name, 'wc-av'));
    const txt = el('div', 'wc-txt');
    const line = el('div', 'wc-line');
    const tpl = s.template || 'Bienvenue {user} 👋';
    const [before, after = ''] = tpl.split('{user}');
    if (before) line.append(document.createTextNode(before));
    if (tpl.includes('{user}')) line.append(el('b', 'wc-name', w.name));
    if (after) line.append(document.createTextNode(after));
    txt.append(line);
    const sub = el('div', 'wc-sub');
    if (kind) sub.append(el('span', `wc-badge ${kind[0]}`, kind[1]));
    if (s.platform !== false && w.platform) sub.append(tag(w.platform));
    if (sub.childNodes.length) txt.append(sub);
    b.append(txt);
    stage.textContent = '';
    stage.append(b);
    if (s.volume) playSound(s.sound || 'chime', s.volume);
    if (w.top && s.confetti !== false) confetti([s.accent || '#FFD24A', '#FFFFFF', '#FE2C55'], 120);
    setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => { b.remove(); busy = false; next(); }, 420);
    }, Math.max(2, s.stay || 4) * 1000);
  }

  function next() {
    if (busy || !queue.length) return;
    show(queue.shift());
  }

  let demoTimer = null;
  return {
    update(settings) {
      s = settings;
      stage.dataset.style = s.style || 'pilule';
      stage.style.setProperty('--accent', s.accent || '#FFD24A');
      stage.style.setProperty('--bg', s.bg || '#10131A');
      stage.style.setProperty('--text', s.text || '#F2F5F9');
      clearInterval(demoTimer);
      if (isPreview) {
        let i = 0;
        const go = () => { queue.push(DEMO[i % DEMO.length]); i += 1; next(); };
        go();
        demoTimer = setInterval(go, Math.max(2, s.stay || 4) * 1000 + 700);
      }
    },
    on(msg) {
      if (msg.t !== 'welcome' || !wanted(msg.who, msg.kind)) return;
      if (queue.length >= (s.maxQueue || 5)) queue.shift();
      queue.push(msg.who);
      next();
    },
  };
}
