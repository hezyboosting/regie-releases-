// Menu des pièces : la liste « prix en pièces : action » du streamer, dans le style choisi.
// Quand un cadeau arrive, sa ligne s'allume avec le pseudo de celui qui l'a envoyé.
import { el, avatar, fmt, isPreview, hexToRgb } from '../lib.js';

const DEMO_WHO = ['Léna', 'Marius', 'kenza.live', 'Yanis', 'Inès'];

const shade = (hex, k) => {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
};
const rgbaOf = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

export function mount(root) {
  let s = {};
  let gifts = {};
  let page = 0;
  let cycleTimer = null;
  let demoTimer = null;
  let sig = '';
  const lit = new Map(); // id de ligne → minuteur de mise en avant

  const box = el('div', 'cm scaled');
  const title = el('div', 'cm-title');
  title.setAttribute('translate', 'no');
  const hit = el('div', 'cm-hit');
  const list = el('ul', 'cm-list');
  box.append(title, hit, list);
  root.append(box);

  const rows = () => {
    const r = Array.isArray(s.rows) ? s.rows.filter((x) => x && (x.text || x.coins)) : [];
    if (s.sort === 'asc') return [...r].sort((a, b) => a.coins - b.coins);
    if (s.sort === 'desc') return [...r].sort((a, b) => b.coins - a.coins);
    return r;
  };

  function icon(r) {
    const wrap = el('span', 'cm-ic');
    const g = gifts[r.id];
    if (s.icon === 'gift' && g?.image) {
      const i = el('img');
      i.src = g.image; i.alt = ''; i.referrerPolicy = 'no-referrer';
      i.onerror = () => { i.replaceWith(el('span', 'cm-coin')); };
      wrap.append(i);
    } else wrap.append(el('span', 'cm-coin'));
    return wrap;
  }

  function rowNode(r, i) {
    const li = el('li', 'cm-row');
    li.dataset.id = r.id;
    li.style.setProperty('--i', String(i));
    if (r.color) li.style.setProperty('--cm-row-accent', r.color);
    const stub = el('span', 'cm-stub');
    if (s.icon !== 'none') stub.append(icon(r));
    const price = el('span', 'cm-price');
    price.append(el('b', 'cm-num', fmt(r.coins)));
    if (s.showUnit !== false) {
      const unit = el('span', 'cm-unit', r.coins > 1 ? (s.unitMany ?? 'pièces') : (s.unitOne ?? 'pièce'));
      unit.setAttribute('translate', 'no');
      price.append(unit);
    }
    stub.append(price);
    const txt = el('span', 'cm-txt', r.text || '');
    txt.setAttribute('translate', 'no');
    li.append(stub, el('span', 'cm-sep'), txt);
    if (s.emoji !== false && r.emoji) li.append(el('span', 'cm-emo', r.emoji));
    li.append(el('span', 'cm-shine'));
    if (lit.has(r.id)) li.classList.add('hit', `fx-${s.hit || 'pulse'}`);
    return li;
  }

  function shown() {
    const all = rows();
    if (s.layout !== 'cycle') return all;
    const per = Math.max(1, Number(s.visible) || 4);
    const pages = Math.max(1, Math.ceil(all.length / per));
    page %= pages;
    return all.slice(page * per, page * per + per);
  }

  function paint(animate) {
    list.textContent = '';
    box.dataset.enter = animate ? (s.enter || 'cascade') : 'none';
    shown().forEach((r, i) => list.append(rowNode(r, i)));
    notches();
  }

  // Tous les prix prennent la largeur du plus long : les actions commencent toutes au même endroit.
  // Style « Ticket » : les encoches se posent pile entre le talon (prix) et le texte.
  function notches() {
    box.style.removeProperty('--stub-w');
    requestAnimationFrame(() => {
      let w = 0;
      for (const stub of list.querySelectorAll('.cm-stub')) w = Math.max(w, stub.offsetWidth);
      if (!w) return;
      box.style.setProperty('--stub-w', `${Math.ceil(w)}px`);
      box.style.setProperty('--cut', `${Math.ceil(w) + 1}px`);
    });
  }

  function style() {
    const accent = s.accent || '#7C5CFF';
    const bg = s.rowBg || '#141022';
    const alpha = (s.bgAlpha ?? 88) / 100;
    const vars = {
      '--cm-accent': accent, '--cm-accent-2': shade(accent, 1.35), '--cm-accent-soft': rgbaOf(accent, 0.35),
      '--cm-bg': rgbaOf(bg, alpha), '--cm-bg-2': rgbaOf(shade(bg, 1.6), alpha),
      '--cm-price': s.priceColor || '#FFD166', '--cm-text': s.text || '#FFFFFF',
      '--cm-coin': s.coin || '#FFC93C', '--cm-coin-d': shade(s.coin || '#FFC93C', 0.62),
      '--cm-fs': `${s.fontSize || 24}px`, '--cm-gap': `${s.gap ?? 10}px`, '--cm-radius': `${s.radius ?? 16}px`, '--cm-glow': String((s.glow ?? 40) / 100),
    };
    for (const [k, v] of Object.entries(vars)) box.style.setProperty(k, v);
    box.dataset.theme = s.theme || 'pastille';
    box.dataset.layout = s.layout || 'column';
    box.classList.toggle('upper', s.upper !== false);
    box.classList.toggle('italic', Boolean(s.italic));
    box.classList.toggle('shine', s.shine !== false);
    title.textContent = s.title || '';
    title.hidden = s.showTitle === false || !s.title;
  }

  function render() {
    style();
    // On ne rejoue l'arrivée des lignes que si le contenu change (pas à chaque réglage de couleur).
    const next = JSON.stringify([rows(), s.icon, s.showUnit, s.unitOne, s.unitMany, s.emoji, s.layout, s.visible, s.sort]);
    const changed = next !== sig;
    sig = next;
    paint(changed);
    clearInterval(cycleTimer);
    cycleTimer = null;
    if (s.layout === 'cycle' && rows().length > (Number(s.visible) || 4)) {
      cycleTimer = setInterval(() => { page += 1; paint(true); }, Math.max(2, Number(s.cycleSec) || 6) * 1000);
    }
  }

  // Quelle ligne correspond à ce cadeau ?
  function find(ev) {
    const all = rows();
    const unit = Number(ev.gift?.cost) || (ev.value && ev.amount ? ev.value / ev.amount : 0);
    if ((s.match || 'exact') === 'exact') {
      return all.find((r) => (r.gift ? String(r.gift) === String(ev.gift?.id || '') : r.coins === unit)) || null;
    }
    const v = s.match === 'total' ? (Number(ev.value) || unit * (ev.amount || 1)) : unit;
    let best = null;
    for (const r of all) if (r.coins <= v && (!best || r.coins > best.coins)) best = r;
    return best;
  }

  function light(r, ev) {
    if (s.react === false || !r) return;
    const ms = Math.max(2, Number(s.reactSec) || 6) * 1000;
    clearTimeout(lit.get(r.id));
    lit.set(r.id, setTimeout(() => { lit.delete(r.id); list.querySelector(`[data-id="${CSS.escape(r.id)}"]`)?.classList.remove('hit', 'fx-pulse', 'fx-shake', 'fx-flash', 'fx-zoom'); }, ms));
    // En défilement, on saute à la page de la ligne allumée.
    if (s.layout === 'cycle') {
      const per = Math.max(1, Number(s.visible) || 4);
      const idx = rows().findIndex((x) => x.id === r.id);
      if (idx >= 0 && Math.floor(idx / per) !== page) { page = Math.floor(idx / per); paint(true); }
    }
    const node = list.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
    if (node) {
      node.classList.remove('hit', 'fx-pulse', 'fx-shake', 'fx-flash', 'fx-zoom');
      void node.offsetWidth;
      node.classList.add('hit', `fx-${s.hit || 'pulse'}`);
    }
    if (s.showWho === false) return;
    const card = el('div', 'cm-who');
    card.append(avatar(ev.user?.avatar, ev.user?.display, 'cm-av'));
    const name = el('b', '', ev.user?.display || 'Quelqu\'un');
    name.setAttribute('translate', 'no');
    const what = el('span', 'cm-what', r.text || '');
    what.setAttribute('translate', 'no');
    card.append(name, el('span', 'cm-arrow', '→'), what);
    if ((ev.amount || 1) > 1) card.append(el('span', 'cm-times', `×${ev.amount}`));
    hit.textContent = '';
    hit.append(card);
    clearTimeout(hit.timer);
    hit.timer = setTimeout(() => { card.classList.add('bye'); setTimeout(() => card.remove(), 450); }, ms);
  }

  function demo() {
    if (!isPreview || demoTimer) return;
    let n = 0;
    demoTimer = setInterval(() => {
      const all = rows();
      if (!all.length) return;
      const r = all[Math.floor(Math.random() * all.length)];
      light(r, { user: { display: DEMO_WHO[n % DEMO_WHO.length] }, amount: n % 3 === 2 ? 5 : 1 });
      n += 1;
    }, 4200);
  }

  document.fonts?.ready?.then(() => notches());

  return {
    update(settings, data) {
      s = settings;
      if (data?.gifts) gifts = data.gifts;
      render();
      demo();
    },
    on(msg) {
      if (msg.t !== 'ev' || msg.ev?.type !== 'gift') return;
      clearInterval(demoTimer);
      light(find(msg.ev), msg.ev);
    },
  };
}
