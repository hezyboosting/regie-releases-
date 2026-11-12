import { el, setVars, isPreview, media } from '../lib.js';

export function mount(root) {
  let s = {};
  let bubble = null;
  const show = (user, text) => {
    bubble?.remove();
    bubble = el('div', 'tb scaled');
    bubble.append(el('b', '', user), document.createTextNode(text));
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
