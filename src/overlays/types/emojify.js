// Émojis du chat : chaque émoji envoyé dans le chat s'envole sur l'écran (et les cadeaux aussi).
import { el, isPreview } from '../lib.js';

const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
const DEMO = ['😂', '🔥', '❤️', '😍', '👏', '🎉', '💀', '🤣', '😎', '🥶', '🚀', '💯'];

export function mount(root) {
  let s = {};
  const box = el('div', 'ej');
  root.append(box);

  const rnd = (a, b) => a + Math.random() * (b - a);

  function spawn(content, isImg) {
    const max = s.max || 80;
    while (box.children.length >= max) box.firstChild.remove();
    const size = (s.size || 64) * rnd(0.75, 1.25);
    const n = isImg ? Object.assign(el('img', 'ej-i'), { src: content, alt: '', referrerPolicy: 'no-referrer' }) : el('span', 'ej-i', content);
    n.style.width = isImg ? `${size}px` : '';
    n.style.fontSize = `${size}px`;
    box.append(n);
    const W = innerWidth, H = innerHeight;
    const mode = s.mode || 'monte';
    let frames, duration, easing = 'linear';
    if (mode === 'pluie') {
      const x = rnd(0, W - size);
      frames = [{ transform: `translate(${x}px, ${-size}px) rotate(${rnd(-30, 30)}deg)`, opacity: 1 }, { transform: `translate(${x + rnd(-80, 80)}px, ${H + size}px) rotate(${rnd(-200, 200)}deg)`, opacity: 1 }];
      duration = rnd(2600, 4200); easing = 'cubic-bezier(.4,0,.8,1)';
    } else if (mode === 'boom') {
      const cx = rnd(W * 0.2, W * 0.8), cy = rnd(H * 0.25, H * 0.7), a = rnd(0, Math.PI * 2), d = rnd(180, 520);
      frames = [{ transform: `translate(${cx}px, ${cy}px) scale(.2)`, opacity: 0 }, { transform: `translate(${cx}px, ${cy}px) scale(1.2)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${cx + Math.cos(a) * d}px, ${cy + Math.sin(a) * d}px) scale(.9) rotate(${rnd(-90, 90)}deg)`, opacity: 0 }];
      duration = rnd(1400, 2200); easing = 'cubic-bezier(.1,.7,.3,1)';
    } else if (mode === 'rebond') {
      const x = rnd(0, W - size), floor = H - size - 10;
      frames = [{ transform: `translate(${x}px, ${-size}px)`, opacity: 1 }, { transform: `translate(${x + 20}px, ${floor}px)`, offset: 0.35 },
        { transform: `translate(${x + 40}px, ${floor - 220}px)`, offset: 0.5 }, { transform: `translate(${x + 60}px, ${floor}px)`, offset: 0.65 },
        { transform: `translate(${x + 70}px, ${floor - 90}px)`, offset: 0.75 }, { transform: `translate(${x + 80}px, ${floor}px)`, opacity: 1, offset: 0.85 }, { transform: `translate(${x + 85}px, ${floor}px)`, opacity: 0 }];
      duration = rnd(3200, 4200);
    } else {
      const x = rnd(0, W - size), sway = rnd(40, 120) * (Math.random() < 0.5 ? -1 : 1);
      frames = [{ transform: `translate(${x}px, ${H + 10}px) scale(.6)`, opacity: 0 }, { transform: `translate(${x + sway * 0.3}px, ${H * 0.75}px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${x - sway * 0.4}px, ${H * 0.4}px)`, offset: 0.55 }, { transform: `translate(${x + sway}px, ${-size}px) scale(1.1)`, opacity: 0 }];
      duration = rnd(4200, 6800);
    }
    const anim = n.animate(frames, { duration, easing, fill: 'forwards' });
    anim.onfinish = () => n.remove();
  }

  function onEv(ev) {
    if (ev.type === 'chat') {
      const found = String(ev.text || '').match(EMOJI) || [];
      found.slice(0, s.perMessage || 6).forEach((e, k) => setTimeout(() => spawn(e), k * 90));
    } else if (ev.type === 'gift' && s.gifts !== false && ev.gift?.image) {
      const n = Math.min(8, Math.max(1, ev.amount || 1));
      for (let k = 0; k < n; k += 1) setTimeout(() => spawn(ev.gift.image, true), k * 110);
    }
  }

  if (isPreview) setInterval(() => spawn(DEMO[Math.floor(Math.random() * DEMO.length)]), 260);

  return {
    update(settings) { s = settings; },
    on(msg) { if (msg.t === 'ev') onEv(msg.ev); },
  };
}
