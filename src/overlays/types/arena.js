import { el, tag, clock, avatar, isPreview } from '../lib.js';

const DEMO = {
  status: 'fight', title: 'Bataille du chat', joinWord: '!fight', attackWord: '!attaque', endsAt: 0, winner: null,
  fighters: [['Lena', 'twitch', 72], ['kenza.live', 'tiktok', 48], ['Nolan', 'youtube', 100], ['Sofia', 'twitch', 0], ['Yanis', 'tiktok', 22], ['Maya', 'youtube', 64]].map(([name, platform, hp], i) => ({ key: String(i), name, platform, hp, maxHp: 100, alive: hp > 0, kills: i % 3 })),
  log: [{ a: 'Lena', t: 'Sofia', d: 31, ko: true }, { a: 'Nolan', t: 'Yanis', d: 18 }],
};

export function mount(root) {
  const box = el('div', 'ar scaled');
  root.append(box);
  let a = null;
  let last = 0;

  const render = () => {
    const d = a && a.status !== 'idle' ? a : isPreview ? DEMO : null;
    box.hidden = !d;
    box.textContent = '';
    if (!d) return;
    const head = el('div', 'ar-head');
    head.append(el('h1', '', d.title));
    if (d.status === 'lobby') {
      const t = el('b', 'ar-clock', clock((d.endsAt - Date.now()) / 1000));
      t.dataset.clock = '1';
      head.append(t);
    }
    box.append(head);
    if (d.status === 'lobby') box.append(el('div', 'ar-call', `Écris ${d.joinWord} pour entrer dans l'arène`));
    const grid = el('div', 'ar-grid');
    const lastHit = d.log[d.log.length - 1];
    for (const f of d.fighters) {
      const t = el('div', `ar-f${f.alive ? '' : ' ko'}${lastHit?.t === f.name && d.log.length !== last ? ' hit' : ''}`);
      const top = el('div', 'ar-top');
      top.append(avatar(f.avatar, f.name), el('b', '', f.name), tag(f.platform));
      const bar = el('div', 'ar-hp');
      const fill = el('i');
      fill.style.width = `${(f.hp / f.maxHp) * 100}%`;
      fill.className = f.hp < 30 ? 'low' : '';
      bar.append(fill);
      t.append(top, bar);
      if (lastHit?.t === f.name && d.log.length !== last) t.append(el('span', `ar-dmg${lastHit.crit ? ' crit' : ''}`, `-${lastHit.d}`));
      grid.append(t);
    }
    box.append(grid);
    last = d.log.length;
    if (d.status === 'fight') {
      const log = el('div', 'ar-log');
      for (const l of d.log.slice(-3).reverse()) if (l.a) log.append(el('div', '', `${l.a} frappe ${l.t}, ${l.d} dégâts${l.crit ? ', coup critique' : ''}${l.ko ? ', K.O.' : ''}`));
      box.append(log, el('div', 'ar-call small', `${d.attackWord} pour charger ton prochain coup. Un cadeau te soigne.`));
    }
    if (d.status === 'ended' && d.winner) {
      const w = el('div', 'ar-win');
      w.append(el('span', '', 'Vainqueur'), el('b', '', d.winner.name));
      box.append(w);
    }
  };

  setInterval(() => {
    const c = box.querySelector('[data-clock]');
    if (c && a?.endsAt) c.textContent = clock((a.endsAt - Date.now()) / 1000);
  }, 500);

  return {
    update(s, data) {
      root.className = `type-arena th-${s.theme}`;
      if (data?.arena) a = data.arena;
      render();
    },
    on(msg) { if (msg.t === 'arena') { a = msg.arena; render(); } },
  };
}
