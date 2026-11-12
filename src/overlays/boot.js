// Chargeur commun : connexion au serveur local, puis délégation au module du type d'overlay.
import { query, setFont, confetti, playSound } from './lib.js';

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

function applyCommon(msg) {
  const s = msg.overlay.settings;
  mark.hidden = !msg.watermark;
  // Un overlay désactivé garde son lien mais n'affiche plus rien.
  root.hidden = msg.overlay.enabled === false && !query.get('preview');
  custom.textContent = s.customCss || '';
  setFont(s.font);
  const css = document.documentElement.style;
  css.setProperty('--scale', (s.scale || 100) / 100);
  root.style.transform = s.offsetX || s.offsetY ? `translate(${s.offsetX || 0}px, ${s.offsetY || 0}px)` : '';
  root.style.filter = s.fxGlow ? `drop-shadow(0 0 ${s.fxGlow}px ${s.fxGlowColor})` : '';
  confettiOn = Boolean(s.fxConfetti);
}

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
