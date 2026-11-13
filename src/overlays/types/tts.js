import { el, setVars, isPreview, media } from '../lib.js';

export function mount(root) {
  let s = {};
  let bubble = null;
  // Bulle en verre avec un petit égaliseur qui bouge pendant la lecture.
  const show = (user, text) => {
    bubble?.remove();
    bubble = el('div', 'tb gx tb2 scaled');
    const eq = el('div', 'tb2-eq');
    for (let i = 0; i < 4; i += 1) eq.append(el('i'));
    const head = el('div', 'tb2-head');
    head.append(eq, el('b', '', user));
    bubble.append(el('div', 'gx-shine'), head, el('div', 'tb2-txt', text));
    root.append(bubble);
  };
  if (isPreview) show('Marius', 'Merci pour le live, à demain.');
  return {
    update(settings) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); },
    on(msg) {
      if (msg.t !== 'tts') return;
      if (msg.phase === 'start') show(msg.user, msg.text);
      if (msg.phase === 'end') { bubble?.remove(); bubble = null; }
      if (msg.phase === 'audio' && s.audio) {
        const a = new Audio(media(msg.url.replace('/media/', '')));
        a.volume = (msg.volume ?? 80) / 100;
        a.play().catch(() => {});
      }
    },
  };
}
