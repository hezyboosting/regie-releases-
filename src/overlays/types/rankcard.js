import { el, tag, setVars, emblem, isPreview, playSound } from '../lib.js';

// Follow = Rank : carte directe, ou roulette qui fait défiler les rangs avant de révéler le bon.
export function mount(root) {
  let s = {};
  let timer = null;
  let busy = false;
  const queue = [];

  const card = (c, keep) => {
    root.querySelector('.rc')?.remove();
    const box = el('div', 'rc scaled');
    box.style.setProperty('--r', c.rank.color);
    const text = el('div', 'rc-txt');
    const who = el('div', 'rc-who');
    who.append(el('b', '', c.user), tag(c.platform));
    text.append(el('span', 'rc-title', c.game ? `${s.title} · ${c.game}` : s.title), who, el('span', 'rc-rank', c.rank.name));
    box.append(emblem(c.rank, 104, c.rank.image), text);
    root.append(box);
    clearTimeout(timer);
    if (keep) { busy = false; return; }
    timer = setTimeout(() => {
      box.classList.add('out');
      setTimeout(() => { box.remove(); busy = false; next(); }, 400);
    }, s.stay * 1000);
  };

  function roulette(c) {
    root.querySelector('.rc')?.remove();
    const box = el('div', 'rr scaled');
    const strip = el('div', 'rr-strip');
    const pool = c.pool?.length ? c.pool : [c.rank];
    const items = [];
    for (let i = 0; i < 34; i += 1) items.push(pool[Math.floor(Math.random() * pool.length)]);
    items[30] = c.rank;
    const w = 150;
    for (const it of items) {
      const cell = el('div', 'rr-cell');
      cell.style.setProperty('--r', it.color);
      cell.append(emblem(it, 64, it.image), el('span', '', it.name));
      strip.append(cell);
    }
    box.append(strip, el('div', 'rr-pin'), el('div', 'rr-who', c.user));
    root.append(box);
    const offset = -(30 * w) + (520 / 2) - (w / 2) + (Math.random() * 60 - 30);
    const start = performance.now();
    const duration = 4800;
    let lastIndex = -1;
    const frame = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - (1 - p) ** 4;
      const x = offset * e;
      strip.style.transform = `translate3d(${x}px,0,0)`;
      const idx = Math.floor((-x + 260) / w);
      if (idx !== lastIndex) { lastIndex = idx; if (s.volume) playSound('tally', s.volume * 0.4); }
      if (p < 1) requestAnimationFrame(frame);
      else {
        playSound('fanfare', s.volume);
        setTimeout(() => { box.remove(); card(c); }, 500);
      }
    };
    requestAnimationFrame(frame);
  }

  function next() {
    if (busy || !queue.length) return;
    busy = true;
    const c = queue.shift();
    if (c.roulette) roulette(c); else card(c);
  }

  return {
    update(settings) {
      s = settings;
      setVars(root, { bg: s.bg, text: s.text });
      if (isPreview && !root.querySelector('.rc')) card({ user: 'Lena', platform: 'twitch', rank: { name: 'Diamant', color: '#57B8FF' } }, true);
    },
    on(msg) {
      if (msg.t !== 'rank') return;
      queue.push(msg.card);
      next();
    },
  };
}
