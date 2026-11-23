// Chargeur commun : connexion au serveur local, puis délégation au module du type d'overlay.
import { query, setFont, confetti, playSound, media } from './lib.js';
import { setParticles } from './particles.js';
import { renderElement, sampleVars } from './custom-render.js';
import { skinCss, layoutCss } from './style-gen.js';

const root = document.getElementById('root');
const mark = document.getElementById('mark');
const custom = document.getElementById('custom');
const id = location.pathname.split('/').pop();
let mod = null;
let type = null;
let backoff = 500;
let confettiOn = false;
let lastBurst = 0;

if (query.get('preview') && !query.get('bare')) document.body.classList.add('preview');

// Décor : formes, textes et images posés par le streamer, derrière (back) ou devant (front) l'overlay.
const decorBack = document.createElement('div');
const decorFront = document.createElement('div');
decorBack.id = 'decor-back';
decorFront.id = 'decor-front';
root.before(decorBack);
root.after(decorFront);
let decor = [];
let decorVars = {};
const usesVars = () => decor.some((e) => e.kind === 'bar' || /\{[a-zA-Z]+\}/.test(e.text || ''));
function paintDecor() {
  decorBack.textContent = '';
  decorFront.textContent = '';
  const vars = query.get('preview') && !Object.keys(decorVars).length ? sampleVars() : decorVars;
  for (const e of decor) (e.layer === 'front' ? decorFront : decorBack).append(renderElement(e, vars, media));
}
// Aperçu dans l'éditeur : le décor suit la souris sans attendre l'enregistrement.
if (query.get('preview')) {
  addEventListener('message', (e) => {
    if (e.data?.regie === 'decor' && Array.isArray(e.data.decor)) { decor = e.data.decor; paintDecor(); }
  });
}

// Langue des textes de l'overlay : français, anglais ou les deux. Les textes posés par les modules sont
// traduits à la volée ; ce qu'écrivent les viewers (messages, TTS) n'est jamais touché.
let overlayLang = 'fr';
let translate = null;
const ORIG = new WeakMap();
const MINE = new WeakMap();
const RAW = '[translate="no"], .txt:not(.sys), .al-text, .tb, script, style';
const both = (base, en) => base.replace(base.trim(), `${base.trim()} · ${en.trim()}`);
function trNode(n) {
  const p = n.parentElement;
  if (!p || p.closest(RAW)) return;
  let base = n.data;
  if (MINE.has(n) && MINE.get(n) === base) base = ORIG.get(n) ?? base;
  ORIG.set(n, base);
  let out = base;
  if (overlayLang !== 'fr' && translate) {
    const en = translate(base);
    if (en !== base) out = overlayLang === 'both' ? both(base, en) : en;
  }
  if (out !== n.data) { MINE.set(n, out); n.data = out; }
}
function trTree(node) {
  if (node.nodeType === 3) { trNode(node); return; }
  if (node.nodeType !== 1) return;
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) trNode(t);
}
new MutationObserver((list) => {
  if (overlayLang === 'fr' && !translate) return;
  for (const m of list) {
    if (m.type === 'characterData') trNode(m.target);
    else for (const n of m.addedNodes) trTree(n);
  }
}).observe(root, { childList: true, subtree: true, characterData: true });
async function setOverlayLang(lang) {
  if (lang !== 'fr' && !translate) {
    const [{ EN }, { makeTranslator }] = await Promise.all([import('./i18n.js'), import('./translate.js')]);
    translate = makeTranslator(EN);
  }
  overlayLang = lang;
  document.documentElement.lang = lang === 'en' ? 'en' : 'fr';
  trTree(root);
  window.dispatchEvent(new Event('regie-lang'));
}
// Pour les modules qui découpent eux-mêmes un texte (roue) : traduire le texte entier d'abord.
window.regieTr = (text) => {
  if (overlayLang === 'fr' || !translate || typeof text !== 'string') return text;
  const en = translate(text);
  return en === text ? text : (overlayLang === 'both' ? both(text, en) : en);
};

// Forme des cartes (onglet Style) : silhouette, fond, motif et bordure posés par-dessus le style choisi.
const skinStyle = document.createElement('style');
skinStyle.id = 'skin';
custom.before(skinStyle); // le CSS personnalisé du streamer garde le dernier mot
// Disposition libre : chaque élément de la carte (image, pseudo, texte…) à la place choisie, par type d'alerte.
const layoutStyle = document.createElement('style');
layoutStyle.id = 'layout';
skinStyle.after(layoutStyle);
let partsDef = null;
let layoutNow = null;
let heldKind = null;
let rectsTimer = null;
const libre = () => Boolean(partsDef && layoutNow?.mode === 'libre' && layoutNow.all);
function applyLayout(layout) {
  layoutNow = layout;
  layoutStyle.textContent = layoutCss(partsDef, layout);
  document.documentElement.dataset.layout = libre() ? 'libre' : 'auto';
  scheduleCards();
  if (query.get('preview')) requestAnimationFrame(sendRects);
}
// Cartes en mode libre : enveloppes effacées (chaque élément se place par rapport à la carte),
// ajouts du streamer (formes, textes, images) posés dans chaque carte, hauteur qui suit le texte.
let cardsQueued = false;
function scheduleCards() {
  if (cardsQueued) return;
  cardsQueued = true;
  requestAnimationFrame(() => { cardsQueued = false; syncCards(); });
}
const layoutFor = (card) => { const k = card.dataset.kind; return (k && layoutNow.kinds?.[k]) || layoutNow.all; };
const partNodes = (card) => { const set = new Set(); for (const it of partsDef.items) for (const n of card.querySelectorAll(it.sel)) set.add(n); return set; };
function partText(card, key) {
  const it = partsDef.items.find((x) => x.key === key);
  const n = it && card.querySelector(it.sel);
  return n ? n.textContent.replace(/\s+/g, ' ').trim() : null;
}
function syncExtras(card, L) {
  const list = (L.extras || []).map((e) => (e.kind === 'text' ? { ...e, text: String(e.text || '').replace(/\{(\w+)\}/g, (m, k) => partText(card, k) ?? m) } : e));
  const vars = query.get('preview') && !Object.keys(decorVars).length ? sampleVars() : decorVars;
  const sig = JSON.stringify(list) + (list.some((e) => e.kind === 'bar' || /\{\w+\}/.test(e.text || '')) ? JSON.stringify(vars) : '');
  const have = card.querySelectorAll(':scope > .rg-x');
  if (card.rgSig === sig && have.length === list.length) return;
  have.forEach((n) => n.remove());
  card.rgSig = sig;
  for (const e of list) {
    const node = renderElement(e, vars, media);
    node.classList.add('rg-x');
    // Derrière les textes : sous les éléments de la carte ; devant : au-dessus.
    node.style.zIndex = e.layer === 'front' ? '6' : '0';
    if (e.layer === 'front') card.append(node); else card.prepend(node);
  }
}
function syncCards() {
  if (!partsDef) return;
  const on = libre();
  for (const card of root.querySelectorAll(partsDef.card)) {
    if (!on) {
      card.querySelectorAll(':scope > .rg-x').forEach((n) => n.remove());
      card.rgSig = '';
      card.style.removeProperty('min-height');
      continue;
    }
    const L = layoutFor(card);
    const set = partNodes(card);
    for (const n of set) {
      for (let p = n.parentElement; p && p !== card && !set.has(p); p = p.parentElement) if (!p.hasAttribute('data-lw')) p.setAttribute('data-lw', '');
    }
    syncExtras(card, L);
    if (partsDef.grow && !partsDef.noSize) {
      let bottom = 0;
      for (const n of set) if (n.offsetParent) bottom = Math.max(bottom, n.offsetTop + n.offsetHeight);
      const need = Math.max(Number(L.h) || 0, Math.ceil(bottom + 10));
      if (card.style.getPropertyValue('min-height') !== `${need}px`) card.style.setProperty('min-height', `${need}px`, 'important');
    }
  }
}
new MutationObserver(() => { if (partsDef) scheduleCards(); }).observe(root, { childList: true, subtree: true, characterData: true });

// Carte suivie par l'éditeur : celle du type d'alerte gardé à l'écran, sinon la première visible.
function editorCard() {
  if (!partsDef) return null;
  if (heldKind && heldKind !== 'all') { const c = root.querySelector(`${partsDef.card}[data-kind="${heldKind}"]`); if (c) return c; }
  const all = [...root.querySelectorAll(partsDef.card)];
  return all.find((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }) || all[0] || null;
}
// L'éditeur demande où sont les éléments pour pouvoir les attraper à la souris.
function sendRects() {
  if (!partsDef || window.parent === window) return;
  const card = editorCard();
  const rect = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return r.width || r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
  const rects = {};
  for (const it of partsDef.items) rects[it.key] = rect(card?.querySelector(it.sel));
  const cr = rect(card);
  // Échelle carte → écran : par la largeur choisie en Libre (zoom et transformations compris), sinon par sa largeur CSS.
  const lw = libre() && !partsDef.noSize && card ? Number(layoutFor(card)?.w) : 0;
  const k = card && cr ? cr.w / (lw || card.offsetWidth || cr.w) : 1;
  window.parent.postMessage({ regie: 'rects', card: cr, k, kind: card?.dataset.kind || '', rects }, '*');
}
// Passage en Libre : on relève où le style a placé chaque élément, pour partir de là.
function capture() {
  if (!partsDef) return null;
  const html = document.documentElement;
  const keep = [layoutStyle.textContent, html.dataset.layout];
  layoutStyle.textContent = '';
  html.dataset.layout = 'auto';
  const card = editorCard();
  const minH = card?.style.getPropertyValue('min-height');
  card?.style.removeProperty('min-height');
  const out = card ? measure(card) : null;
  // Éléments absents de cette carte (icône d'un message d'événement…) : relevés sur une autre carte.
  if (out) {
    for (const other of root.querySelectorAll(partsDef.card)) {
      if (other === card || partsDef.items.every((it) => out.parts[it.key])) continue;
      const more = measure(other);
      for (const [key, p] of Object.entries(more.parts)) if (!out.parts[key]) out.parts[key] = p;
    }
  }
  if (card && minH) card.style.setProperty('min-height', minH, 'important');
  [layoutStyle.textContent, html.dataset.layout] = keep;
  return out;
}
function measure(card) {
  const cr = card.getBoundingClientRect();
  const k = cr.width / (card.offsetWidth || cr.width) || 1;
  const ox = cr.left + card.clientLeft * k;
  const oy = cr.top + card.clientTop * k;
  const W = Math.round(card.clientWidth || cr.width / k);
  const H = Math.round(card.clientHeight || cr.height / k);
  const parts = {};
  for (const it of partsDef.items) {
    const n = card.querySelector(it.sel);
    if (!n) continue;
    const r = n.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let x = Math.round((r.left - ox) / k);
    const y = Math.round((r.top - oy) / k);
    let w = Math.max(4, Math.round(r.width / k));
    const p = { y, h: Math.max(2, Math.round(r.height / k)) };
    if (it.kind === 'text') {
      let align = cs.textAlign === 'center' ? 'center' : (['right', 'end'].includes(cs.textAlign) ? 'right' : 'left');
      // Rangée flexible centrée ou poussée à droite : c'est justify-content qui place le texte, pas text-align.
      if (/flex/.test(cs.display)) align = cs.justifyContent === 'center' ? 'center' : (/flex-end|end|right/.test(cs.justifyContent) ? 'right' : align);

      // Un texte relevé à sa largeur exacte passerait à la ligne avec un pseudo plus long : on lui laisse de la place.
      // Pas pour un texte qui a son propre fond (pastille) : il garderait une pastille étirée.
      const painted = cs.backgroundImage !== 'none' || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) || parseFloat(cs.borderLeftWidth) > 0;
      if (!painted) w += 2;
      if (painted) { /* largeur relevée telle quelle */ } else if (align === 'center') { x -= 40; w += 80; } else if (W - (x + w) < 40 && x > W / 2) { const right = x + w; w = Math.max(w, Math.round(right - W / 2)); x = right - w; align = 'right'; } else if (align === 'left') w = Math.max(w, W - x - 10);
      const size = Math.round(parseFloat(cs.fontSize) || 16);
      // Relevé sur une ligne : il y reste (un pseudo plus long déborde au lieu de passer à la ligne).
      const nowrap = !partsDef.grow && r.height / k < size * 1.6;
      const lhPx = parseFloat(cs.lineHeight);
      const lh = Number.isFinite(lhPx) && size ? Math.max(70, Math.min(250, Math.round((lhPx / size) * 100))) : 0;
      Object.assign(p, { size, weight: Number(cs.fontWeight) || 600, align, upper: cs.textTransform === 'uppercase' ? true : null, nowrap, lh });
    }
    parts[it.key] = { ...p, x, w };
  }
  return { w: W, h: H, parts };
}
if (query.get('preview')) {
  addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.regie === 'layout') { applyLayout(d.layout); mod?.relayout?.(d.layout); }
    if (d.regie === 'hold') {
      heldKind = d.kind || null;
      mod?.hold?.(heldKind);
      setTimeout(sendRects, 80);
      setTimeout(sendRects, 700);
      clearInterval(rectsTimer);
      // Les overlays qui bougent tout seuls (chat, défilement) : les cadres de l'éditeur suivent.
      if (heldKind) rectsTimer = setInterval(sendRects, 500);
    }
    if (d.regie === 'rects') sendRects();
    if (d.regie === 'capture') window.parent.postMessage({ regie: 'captured', id: d.id, layout: capture() }, '*');
  });
}

function applyCommon(msg) {
  const s = msg.overlay.settings;
  const lang = s.lang && s.lang !== 'auto' ? s.lang : (msg.lang === 'en' ? 'en' : 'fr');
  if (lang !== overlayLang) setOverlayLang(lang);
  setParticles(s.fxParticles || 'none');
  mark.hidden = !msg.watermark;
  // Un overlay désactivé garde son lien mais n'affiche plus rien.
  root.hidden = msg.overlay.enabled === false && !query.get('preview');
  decorBack.hidden = root.hidden;
  decorFront.hidden = root.hidden;
  decor = Array.isArray(s.decor) ? s.decor : [];
  if (msg.data?.vars) decorVars = msg.data.vars;
  paintDecor();
  custom.textContent = s.customCss || '';
  skinStyle.textContent = skinCss(msg.overlay.skin || '', s);
  partsDef = msg.overlay.parts || null;
  applyLayout(s.layout);
  setFont(s.font);
  const css = document.documentElement.style;
  css.setProperty('--scale', (s.scale || 100) / 100);
  // Position : décalage, rotation, miroir.
  const tf = [];
  if (s.offsetX || s.offsetY) tf.push(`translate(${s.offsetX || 0}px, ${s.offsetY || 0}px)`);
  if (s.fxRotate) tf.push(`rotate(${s.fxRotate}deg)`);
  if (s.fxFlip) tf.push('scaleX(-1)');
  root.style.transform = tf.join(' ');
  // Style : couleurs de tout l'overlay, contour, ombre, halo.
  const fl = [];
  if (s.fxHue) fl.push(`hue-rotate(${s.fxHue}deg)`);
  if (s.fxSat !== undefined && s.fxSat !== 100) fl.push(`saturate(${s.fxSat}%)`);
  if (s.fxBright !== undefined && s.fxBright !== 100) fl.push(`brightness(${s.fxBright}%)`);
  if (s.fxOutline) { const o = s.fxOutline, c = s.fxOutlineColor || '#000'; fl.push(`drop-shadow(${o}px 0 0 ${c}) drop-shadow(-${o}px 0 0 ${c}) drop-shadow(0 ${o}px 0 ${c}) drop-shadow(0 -${o}px 0 ${c})`); }
  if (s.fxShadow) fl.push(`drop-shadow(0 ${Math.round(s.fxShadow / 3)}px ${s.fxShadow}px ${s.fxShadowColor || '#000'})`);
  if (s.fxGlow) fl.push(`drop-shadow(0 0 ${s.fxGlow}px ${s.fxGlowColor})`);
  root.style.filter = fl.join(' ');
  root.style.opacity = s.fxOpacity !== undefined && s.fxOpacity < 100 ? String(s.fxOpacity / 100) : '';
  // Animation : vitesse, animation continue, apparition, nouveaux éléments.
  css.setProperty('--fx-speed', String(100 / Math.max(25, s.fxSpeed || 100)));
  css.setProperty('--fx-glow', s.fxGlowColor || '#8FD3FF');
  root.dataset.idle = s.fxIdle || 'none';
  root.dataset.items = s.fxItems ? (s.fxItemsAnim || 'pop') : '';
  const intro = s.fxIntro || 'none';
  const visible = !root.hidden;
  if (intro !== 'none' && visible && (!wasVisible || intro !== lastIntro)) playIntro(intro);
  wasVisible = visible;
  lastIntro = intro;
  confettiOn = Boolean(s.fxConfetti);
}

let wasVisible = false;
let lastIntro = 'none';
function playIntro(kind) {
  root.dataset.intro = '';
  void root.offsetWidth;          // relance l'animation
  root.dataset.intro = kind;
}

// Les nouveaux éléments ajoutés par l'overlay (lignes de chat, alertes, cadeaux…) arrivent animés.
new MutationObserver((list) => {
  if (!root.dataset.items) return;
  for (const m of list) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1 || n instanceof SVGElement || n.closest('[data-btn]') || n.classList.contains('rg-x')) continue;
      if (!n.parentElement || n.parentElement === root) continue;
      n.classList.add('fx-item');
      n.addEventListener('animationend', () => n.classList.remove('fx-item'), { once: true });
    }
  }
}).observe(root, { childList: true, subtree: true });

// Les grands moments, quel que soit l'overlay qui les reçoit.
function bigMoment(msg) {
  if (msg.t === 'fx') return true;
  if (!confettiOn) return false;
  if (msg.t === 'alert') return true;
  if (msg.t === 'battle') return msg.battle.status === 'ended';
  if (msg.t === 'arena') return msg.arena.status === 'ended';
  if (msg.t === 'boss') return msg.boss.status === 'won';
  if (msg.t === 'goals') return msg.goals.some((g) => g.reached);
  return msg.t === 'rank';
}

// Filtres de l'overlay (Contenu › Événements affichés, Plateformes) : vide = tout.
let filters = { onlyPlatforms: [], onlyEvents: [] };
function passes(platform, type) {
  const pf = filters.onlyPlatforms || [];
  const ev = filters.onlyEvents || [];
  if (pf.length && platform && !pf.includes(platform)) return false;
  if (ev.length && type && type !== 'custom' && !ev.includes(type === 'giftstreak' ? 'gift' : type)) return false;
  return true;
}
function filtered(msg) {
  if (msg.t === 'ev' || msg.t === 'giftstreak') return !passes(msg.ev?.platform, msg.ev?.type);
  if (msg.t === 'alert') return !passes(msg.alert?.platform, msg.alert?.type);
  if (msg.t === 'welcome') return !passes(msg.who?.platform, null);
  return false;
}
window.regiePasses = passes;

async function onMessage(msg) {
  if (msg.t === 'init') {
    const st = msg.overlay.settings || {};
    filters = { onlyPlatforms: Array.isArray(st.onlyPlatforms) ? st.onlyPlatforms : [], onlyEvents: Array.isArray(st.onlyEvents) ? st.onlyEvents : [] };
    if (type !== msg.overlay.type) {
      type = msg.overlay.type;
      const loaded = await import(`./types/${type}.js`);
      root.className = `type-${type}`;
      mod = loaded.mount(root);
    }
    applyCommon(msg);
    mod.update?.(msg.overlay.settings, msg.data);
  } else {
    if (filtered(msg)) return;
    if (msg.t === 'vars') { decorVars = msg.vars || {}; if (usesVars()) paintDecor(); if (libre()) scheduleCards(); }
    mod?.on?.(msg);
    if (msg.t === 'sound') playSound(msg.sound, msg.volume);
    if (bigMoment(msg) && Date.now() - lastBurst > 2500) { lastBurst = Date.now(); confetti(); }
  }
}

function connect() {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${scheme}://${location.host}/ws?k=${encodeURIComponent(query.get('k'))}&o=${encodeURIComponent(id)}`);
  ws.onopen = () => { backoff = 500; };
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  ws.onclose = () => { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 5000); };
}
connect();
