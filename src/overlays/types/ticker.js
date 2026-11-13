import { el, tag, setVars, fmt, isPreview, gxIcon } from '../lib.js';

const line = (e) => {
  const u = e.user?.display || '';
  switch (e.type) {
    case 'follow': return [u, 'suit la chaîne'];
    case 'sub': return [u, 's\'abonne'];
    case 'resub': return [u, `${e.months} mois d'abonnement`];
    case 'giftsub': return [u, `offre ${e.amount} abonnements`];
    case 'bits': return [u, `${fmt(e.amount)} bits`];
    case 'raid': return [u, `raid de ${e.amount}`];
    case 'gift': return [u, `${e.amount} × ${e.gift?.name}`];
    case 'superchat': case 'supersticker': return [u, e.money];
    case 'member': return [u, 'devient membre'];
    default: return null;
  }
};

export function mount(root) {
  let s = {};
  let items = [];
  const box = el('div', 'tick gx');
  const rail = el('div', 'tick-rail');
  box.append(rail);
  root.append(box);
  let x = 0;
  let last = performance.now();

  const render = () => {
    rail.textContent = '';
    for (const e of items) {
      const l = line(e);
      if (!l) continue;
      const span = el('span', 'tk-item');
      if (e.type === 'gift' && e.gift?.image) { const g = el('img', 'tk-gift'); g.src = e.gift.image; g.alt = ''; g.referrerPolicy = 'no-referrer'; span.append(g); } else span.append(gxIcon(e.type === 'resub' || e.type === 'giftsub' ? 'sub' : e.type));
      if (e.platform) span.append(tag(e.platform));
      span.append(el('b', '', l[0]), el('span', 'tk-what', l[1]));
      rail.append(span, el('i', 'tk-sep'));
    }
  };

  function step(t) {
    requestAnimationFrame(step);
    const dt = (t - last) / 1000;
    last = t;
    x -= (s.speed || 60) * dt;
    if (rail.offsetWidth && -x > rail.offsetWidth) x = 0;
    rail.style.transform = `translateX(${x}px)`;
  }
  requestAnimationFrame(step);

  return {
    update(settings, data) {
      s = settings;
      setVars(root, { bg: s.bg, text: s.text, accent: s.accent });
      if (data?.backlog) items = data.backlog.filter((e) => line(e)).slice(-s.count);
      if (isPreview && !items.length) items = [{ type: 'follow', platform: 'twitch', user: { display: 'Lena' } }, { type: 'gift', platform: 'tiktok', amount: 3, gift: { name: 'Rose' }, user: { display: 'kenza.live' } }, { type: 'superchat', platform: 'youtube', money: '10,00 €', user: { display: 'Nolan' } }];
      render();
    },
    on(msg) {
      if (msg.t !== 'ev' || !line(msg.ev)) return;
      items.push(msg.ev);
      items = items.slice(-(s.count || 15));
      render();
    },
  };
}
