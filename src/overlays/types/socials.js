// Réseaux sociaux : les pseudos du streamer qui défilent, avec les vrais logos.
import { el, isPreview } from '../lib.js';
import { brandSvg, BRANDS } from '../brands.js';

const ORDER = ['tiktok', 'twitch', 'youtube', 'kick', 'instagram', 'x', 'discord'];
const DEMO = { tiktok: '@ton.pseudo', twitch: 'tonpseudo', instagram: '@tonpseudo', discord: 'discord.gg/tonserveur' };

export function mount(root) {
  let s = {};
  let timer = null;
  let i = 0;
  const box = el('div', 'so scaled');
  root.append(box);

  const handles = () => {
    const own = ORDER.filter((k) => String(s[k] || '').trim()).map((k) => [k, String(s[k]).trim()]);
    return own.length ? own : isPreview ? Object.entries(DEMO) : [];
  };

  const item = (k, v) => {
    const n = el('div', 'so-item');
    const logo = el('span', 'so-logo');
    logo.innerHTML = brandSvg(k, 40);
    n.append(logo, el('span', 'so-text', v));
    n.title = BRANDS[k]?.label || k;
    return n;
  };

  function show() {
    const list = handles();
    box.textContent = '';
    box.dataset.style = s.style || 'pill';
    box.style.setProperty('--bg', s.bg || '#10131A');
    box.style.setProperty('--text', s.text || '#F2F5F9');
    if (!list.length) return;
    if (s.style === 'all') { for (const [k, v] of list) box.append(item(k, v)); return; }
    const [k, v] = list[i % list.length];
    const n = item(k, v);
    n.classList.add('so-in');
    box.append(n);
  }

  function loop() {
    clearInterval(timer);
    show();
    timer = setInterval(() => {
      const cur = box.firstChild;
      if (s.style === 'all' || !cur) return;
      cur.classList.add('so-out');
      setTimeout(() => { i += 1; show(); }, 380);
    }, Math.max(2, s.seconds || 6) * 1000);
  }

  return { update(settings) { s = settings; loop(); } };
}
