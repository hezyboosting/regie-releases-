import { el, media, setVars, isPreview } from '../lib.js';

// Scène d'effets : textes, images et vidéos lancés par les automatisations, l'un après l'autre.
export function mount(root) {
  let s = {};
  let busy = false;
  const queue = [];
  const next = () => {
    if (busy || !queue.length) return;
    busy = true;
    const it = queue.shift();
    let node;
    if (it.kind === 'video') { node = el('video', 'st-media'); node.src = media(it.file); node.autoplay = true; node.playsInline = true; }
    else if (it.kind === 'image') { node = el('img', 'st-media'); node.src = media(it.file); node.alt = ''; }
    else node = el('div', 'st-text', it.text);
    root.append(node);
    const done = () => {
      node.classList.add('out');
      setTimeout(() => { node.remove(); busy = false; next(); }, 350);
    };
    if (it.kind === 'video') { node.onended = done; node.onerror = done; } else setTimeout(done, (it.seconds || 5) * 1000);
  };
  return {
    update(settings) {
      s = settings;
      root.className = `type-stage ${s.position}`;
      setVars(root, { text: s.text, size: `${s.size}px` });
      if (isPreview && !root.children.length) root.append(el('div', 'st-text', 'Ton texte ici'));
    },
    on(msg) { if (msg.t === 'show') { root.querySelector('.st-text')?.remove(); queue.push(msg.item); next(); } },
  };
}
