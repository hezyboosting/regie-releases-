// Chargeur commun : connexion au serveur local, puis délégation au module du type d'overlay.
import { query, setFont, confetti, playSound } from './lib.js';
import { setParticles } from './particles.js';

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

function applyCommon(msg) {
  const s = msg.overlay.settings;
  const lang = s.lang && s.lang !== 'auto' ? s.lang : (msg.lang === 'en' ? 'en' : 'fr');
  if (lang !== overlayLang) setOverlayLang(lang);
  setParticles(s.fxParticles || 'none');
  mark.hidden = !msg.watermark;
  // Un overlay désactivé garde son lien mais n'affiche plus rien.
  root.hidden = msg.overlay.enabled === false && !query.get('preview');
  custom.textContent = s.customCss || '';
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
      if (n.nodeType !== 1 || n instanceof SVGElement || n.closest('[data-btn]')) continue;
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

async function onMessage(msg) {
  if (msg.t === 'init') {
    if (type !== msg.overlay.type) {
      type = msg.overlay.type;
      const loaded = await import(`./types/${type}.js`);
      root.className = `type-${type}`;
      mod = loaded.mount(root);
    }
    applyCommon(msg);
    mod.update?.(msg.overlay.settings, msg.data);
  } else {
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
