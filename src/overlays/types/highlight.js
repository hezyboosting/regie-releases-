// Message à l'écran : le message choisi dans le chat unifié (⋯ › Afficher en live) s'affiche en grand,
// avec la photo, le pseudo et la plateforme. Il part tout seul après la durée choisie, ou reste
// jusqu'à ce que le streamer le retire. Un nouveau message remplace l'ancien.
import { el, avatar, tag, isPreview, playSound, richText } from '../lib.js';

const DEMO = {
  id: 'demo', at: 0, platform: 'twitch', color: '',
  text: 'Tu peux expliquer comment tu as passé le boss tout à l\'heure ? J\'ai essayé dix fois 😅',
  user: { display: 'Kenza', avatar: '', sub: true },
};

export function mount(root) {
  let s = {};
  let timer = null;
  let current = null;
  const stage = el('div', 'hl scaled');
  root.append(stage);

  function badge(u) {
    if (s.badges === false) return null;
    if (u.mod) return ['mod', 'Modo'];
    if (u.vip) return ['vip', 'VIP'];
    if (u.sub) return ['sub', 'Abonné'];
    return null;
  }

  function hide() {
    clearTimeout(timer);
    current = null;
    for (const old of stage.querySelectorAll('.hl-card:not(.out)')) {
      old.classList.add('out');
      setTimeout(() => old.remove(), 450);
    }
  }

  function show(item) {
    clearTimeout(timer);
    stage.querySelectorAll('.hl-card').forEach((n) => n.remove());
    current = item;
    if (!item) return;
    const u = item.user || {};
    const card = el('div', 'hl-card');
    card.dataset.id = item.id;
    card.dataset.enter = s.enter || 'pop';
    if (s.avatars !== false) card.append(avatar(u.avatar, u.display, 'hl-av'));
    const body = el('div', 'hl-body');
    if (s.label) body.append(el('div', 'hl-label', s.label));
    const head = el('div', 'hl-head');
    const name = el('b', 'hl-name', u.display || '');
    if (item.color) name.style.setProperty('--name', item.color);
    head.append(name);
    const meta = el('span', 'hl-meta');
    const b = badge(u);
    if (b) meta.append(el('span', `hl-badge ${b[0]}`, b[1]));
    if (s.platform !== false && item.platform) meta.append(tag(item.platform));
    if (meta.childNodes.length) head.append(meta);
    body.append(head);
    const x = s.showTr !== false && item.translation?.text ? item.translation : null;
    const txt = el('div', 'hl-text');
    txt.append(x ? document.createTextNode(x.text) : richText(item.text, item.emotes));
    body.append(txt);
    if (x) body.append(el('div', 'hl-orig', item.text));
    card.append(body);
    stage.append(card);
    if (s.volume && !isPreview) playSound(s.sound || 'chime', s.volume);
    // L'aperçu garde le message pour qu'on puisse le placer ; en direct, il part après la durée choisie.
    if (s.mode !== 'fixe' && !isPreview) {
      const left = Math.max(3, s.stay || 12) * 1000 - (item.at ? Date.now() - item.at : 0);
      timer = setTimeout(hide, Math.max(600, left));
    }
  }

  return {
    update(settings, data) {
      s = settings;
      stage.dataset.style = s.style || 'bulle';
      stage.style.setProperty('--accent', s.accent || '#FFB224');
      stage.style.setProperty('--bg', s.bg || '#14151A');
      stage.style.setProperty('--text', s.text || '#F4F2EC');
      stage.style.setProperty('--lines', String(Math.max(1, s.maxLines || 4)));
      if (isPreview) show({ ...(current?.id && current.id !== 'demo' ? current : DEMO), at: Date.now() });
      else if (data && 'spot' in data) show(data.spot);
      else if (current) show(current);
    },
    on(msg) {
      if (msg.t !== 'spotlight') return;
      if (msg.item) show(msg.item); else hide();
    },
  };
}
