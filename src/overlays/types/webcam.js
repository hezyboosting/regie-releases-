// Cadre webcam : un cadre posé autour de ta caméra dans OBS (l'intérieur reste transparent).
// Styles verre, néon, dégradé animé, coins de visée ou trait fin ; pastille LIVE, plaque avec ton
// texte, et le cadre qui réagit aux soutiens : éclat, bulle « Léna envoie Rose ×5 », confettis.
import { el, setVars, confetti, isPreview, fmt, replay } from '../lib.js';
import { fillVars } from '../custom-render.js';

const BIG = ['gift', 'raid', 'giftsub', 'superchat', 'bits', 'member'];
const DEMO = [
  { type: 'follow', user: { display: 'Léna' } },
  { type: 'gift', user: { display: 'Marius' }, gift: { name: 'Rose', image: '/img/rose.png' }, amount: 5, value: 5 },
  { type: 'sub', user: { display: 'Kenza' }, months: 3 },
  { type: 'share', user: { display: 'Yanis' } },
];

function line(ev) {
  const n = ev.user?.display || ev.user?.name || '';
  switch (ev.type) {
    case 'follow': return `${n} suit la chaîne`;
    case 'sub': return ev.months > 1 ? `${n} s'abonne, ${ev.months} mois` : `${n} s'abonne`;
    case 'resub': return ev.months ? `${n} se réabonne, ${ev.months} mois` : `${n} se réabonne`;
    case 'giftsub': return `${n} offre ${ev.amount || 1} abonnements`;
    case 'gift': return (ev.amount || 1) > 1 ? `${n} envoie ${ev.gift?.name || 'un cadeau'} ×${ev.amount}` : `${n} envoie ${ev.gift?.name || 'un cadeau'}`;
    case 'bits': return `${n} envoie ${fmt(ev.amount)} bits`;
    case 'raid': return `Raid de ${n}, ${fmt(ev.amount)} personnes`;
    case 'superchat': return `${n} envoie ${ev.money}`;
    case 'member': return `${n} devient membre`;
    case 'share': return `${n} partage le live`;
    case 'superfan': return `${n} devient Super Fan`;
    default: return '';
  }
}

export function mount(root) {
  let s = {};
  let vars = {};
  const cam = el('div', 'cam');
  const glow = el('div', 'cam-glow');
  const inner = el('div', 'cam-inner');
  const ring = el('div', 'cam-ring');
  const corners = el('div', 'cam-corners');
  for (const k of ['tl', 'tr', 'bl', 'br']) corners.append(el('i', `cc-${k}`));
  const live = el('div', 'cam-live');
  const liveDot = el('i');
  const liveTxt = el('b', '', 'LIVE');
  const liveNum = el('span');
  live.append(liveDot, liveTxt, liveNum);
  const plate = el('div', 'cam-plate');
  const plateTxt = el('span');
  plate.append(el('i'), plateTxt);
  const toast = el('div', 'cam-toast');
  cam.append(glow, inner, ring, corners, live, plate, toast);
  root.append(cam);

  const queue = [];
  let showing = false;

  function paint() {
    // Hors live, « {viewers} en direct » donnerait « en direct » tout court : on affiche « En direct ».
    const tpl = s.label || '';
    const empty = [...tpl.matchAll(/\{(\w+)\}/g)].some(([, k]) => vars[k] === undefined || vars[k] === '' || vars[k] === 0);
    const text = (empty ? 'En direct' : fillVars(tpl, vars)).trim();
    plateTxt.textContent = text;
    plate.hidden = !text || s.labelPos === 'aucun';
    live.hidden = s.showLive === false;
    liveNum.textContent = s.liveViewers !== false && Number(vars.viewers) > 0 ? fmt(vars.viewers) : '';
  }

  function next() {
    if (showing || !queue.length) return;
    const ev = queue.shift();
    const txt = line(ev);
    if (!txt) { next(); return; }
    showing = true;
    toast.textContent = '';
    if (ev.gift?.image) { const im = el('img'); im.src = ev.gift.image; im.referrerPolicy = 'no-referrer'; im.alt = ''; toast.append(im); } else toast.append(el('i', `cam-t-ic ${ev.type}`));
    toast.append(el('span', '', txt));
    replay(toast, 'on');
    setTimeout(() => { toast.classList.remove('on'); showing = false; setTimeout(next, 250); }, (s.toastSeconds || 4) * 1000);
  }

  function react(ev) {
    if (s.react === false) return;
    const big = BIG.includes(ev.type) && (ev.type !== 'gift' || (ev.value || 0) >= (s.bigCoins ?? 100));
    replay(cam, big ? 'big' : 'hit');
    if (big && s.confetti !== false) confetti([s.accent, s.accent2, '#FFFFFF'], 90);
    if (s.showEvents !== false) { queue.push(ev); if (queue.length > 6) queue.shift(); next(); }
  }

  let demo = null;
  return {
    update(settings, data) {
      s = settings;
      const style = ['verre', 'neon', 'degrade', 'coins', 'simple'].includes(s.style) ? s.style : s.style === 'bandes' ? 'degrade' : 'verre';
      cam.className = `cam ${style} plate-${s.labelPos || 'bas-centre'} live-${s.livePos || 'haut-gauche'}`;
      setVars(root, { accent: s.accent, accent2: s.accent2, text: s.text, bg: s.bg, th: `${s.thickness ?? 6}px`, rad: `${s.radius ?? 22}px`, glowk: (s.glow ?? 60) / 100, ts: `${s.toastSeconds || 4}s` });
      if (data?.vars) vars = data.vars;
      if (isPreview && !vars.viewers) vars = { ...vars, viewers: 1284, followers: 15200, name: 'Ma chaîne' };
      paint();
      if (isPreview && !demo) { let i = 0; demo = setInterval(() => react(DEMO[i++ % DEMO.length]), 3200); setTimeout(() => react(DEMO[0]), 600); }
    },
    on(msg) {
      if (msg.t === 'vars') { vars = msg.vars; paint(); }
      if (msg.t === 'ev' && !['chat', 'join', 'like'].includes(msg.ev.type)) react(msg.ev);
    },
  };
}
