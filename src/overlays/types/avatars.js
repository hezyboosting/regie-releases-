// Avatars des viewers : chaque viewer actif devient un petit personnage. Il se balade en bas de l'écran,
// parle dans une bulle quand il écrit, saute sur un cadeau ou sur !saute, et s'en va après un moment de calme.
import { el, avatar, isPreview, PLATFORM, playSound } from '../lib.js';

const DEMO = [
  { name: 'Léna', platform: 'tiktok', text: 'Trop fort ce live !' }, { name: 'Marius', platform: 'twitch', text: 'GG' },
  { name: 'kenza.live', platform: 'tiktok', gift: true }, { name: 'Yanis', platform: 'youtube', text: 'Salut tout le monde' },
  { name: 'Inès', platform: 'tiktok', like: true }, { name: 'Théo', platform: 'kick', text: '!saute' }, { name: 'Sofia', platform: 'tiktok', like: true },
];
const JUMP = ['!saute', '!jump', '!hop'];

export function mount(root) {
  let s = {};
  const crowd = new Map();
  const box = el('div', 'va-box');
  const ground = el('div', 'va-ground');
  box.append(ground);
  root.append(box);
  let last = performance.now();
  let demoTimer = null;
  let demoIndex = 0;

  const mode = () => s.mode || 'marche';
  const size = () => s.size || 72;
  const width = () => box.clientWidth || 1920;

  function remove(v) {
    v.node.classList.add('bye');
    setTimeout(() => v.node.remove(), 600);
    crowd.delete(v.key);
    if (mode() === 'mur') layoutWall();
  }

  function spawn(user, platform) {
    const key = `${platform}:${user.id || user.name || user.display}`;
    let v = crowd.get(key);
    if (v) { v.seen = Date.now(); return v; }
    if (crowd.size >= (s.max || 30)) {
      const oldest = [...crowd.values()].sort((a, b) => a.seen - b.seen)[0];
      if (oldest) remove(oldest);
    }
    const node = el('div', 'va');
    node.style.setProperty('--ring', PLATFORM[platform]?.color || '#8FD3FF');
    const bubble = el('div', 'va-bubble');
    bubble.setAttribute('translate', 'no');
    const body = el('div', 'va-body');
    const feet = el('div', 'va-feet');
    feet.append(el('i'), el('i'));
    body.append(avatar(user.avatar, user.display || user.name, 'va-av'), feet);
    const name = el('span', 'va-name', user.display || user.name || '?');
    name.setAttribute('translate', 'no');
    name.hidden = s.names === false;
    const fx = el('div', 'va-fx');
    node.append(bubble, fx, body, name);
    box.append(node);
    v = { key, node, bubble, fx, name, x: Math.random() * Math.max(100, width() - size()), y: 0, dir: Math.random() < 0.5 ? -1 : 1, speed: 40 + Math.random() * 50, pause: 0, seen: Date.now(), vy: 0, bornAt: Date.now() };
    crowd.set(key, v);
    if (mode() === 'flotte') { v.y = -40; v.x = 40 + Math.random() * (width() - 140); }
    if (mode() === 'mur') layoutWall();
    node.classList.add('hello');
    return v;
  }

  function say(v, text) {
    if (s.bubbles === false || !text) return;
    v.bubble.textContent = text.length > 70 ? `${text.slice(0, 68)}…` : text;
    v.bubble.classList.remove('on'); void v.bubble.offsetWidth; v.bubble.classList.add('on');
    clearTimeout(v.bubbleTimer);
    v.bubbleTimer = setTimeout(() => v.bubble.classList.remove('on'), 5000);
  }

  function pop(v, content, cls = '') {
    const p = el('span', `va-pop ${cls}`);
    if (content instanceof Node) p.append(content); else p.textContent = content;
    v.fx.append(p);
    setTimeout(() => p.remove(), 1600);
  }

  function jump(v, high = false) {
    if (mode() === 'marche' && v.y === 0) v.vy = high ? 820 : 560;
    v.node.classList.remove('boing'); void v.node.offsetWidth; v.node.classList.add('boing');
  }

  function onEvent(ev) {
    if (!ev?.user) return;
    const t = ev.type;
    const want = (t === 'chat' && s.onChat !== false) || (t === 'like' && s.onLike !== false) || (t === 'gift' && s.onGift !== false)
      || (t === 'follow' && s.onFollow !== false) || (t === 'join' && s.onJoin === true) || ['sub', 'resub', 'giftsub', 'member', 'superchat', 'bits', 'share'].includes(t);
    const known = crowd.get(`${ev.platform}:${ev.user.id || ev.user.name || ev.user.display}`);
    if (!want && !known) return;
    const v = known || spawn(ev.user, ev.platform);
    v.seen = Date.now();
    if (t === 'chat') {
      const text = String(ev.text || '').trim();
      if (JUMP.includes(text.toLowerCase())) jump(v, true); else say(v, text);
    } else if (t === 'like') pop(v, '❤', 'heart');
    else if (t === 'gift') {
      const img = ev.gift?.image ? Object.assign(new Image(), { src: ev.gift.image, referrerPolicy: 'no-referrer', className: 'va-gift' }) : '🎁';
      pop(v, img, 'gift'); jump(v, true);
    } else if (t === 'follow') pop(v, '＋', 'follow');
    else if (['sub', 'resub', 'giftsub', 'member'].includes(t)) { pop(v, '★', 'star'); jump(v, true); }
    else if (t === 'share') pop(v, '↗', 'share');
  }

  function layoutWall() {
    const list = [...crowd.values()].sort((a, b) => b.seen - a.seen);
    const sz = size() + 34;
    const perRow = Math.max(1, Math.floor(width() / sz));
    list.forEach((v, i) => {
      v.node.style.translate = `${(i % perRow) * sz + 10}px ${Math.floor(i / perRow) * (sz + 10) + 10}px`;
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const m = mode();
    const sp = (s.speed || 100) / 100;
    const w = width();
    const h = box.clientHeight || 420;
    const idleMs = (s.idle || 5) * 60000;
    for (const v of [...crowd.values()]) {
      if (!isPreview && Date.now() - v.seen > idleMs) { remove(v); continue; }
      if (m === 'marche') {
        if (v.pause > 0) v.pause -= dt;
        else {
          v.x += v.dir * v.speed * sp * dt;
          if (v.x < 0) { v.x = 0; v.dir = 1; }
          if (v.x > w - size()) { v.x = w - size(); v.dir = -1; }
          if (Math.random() < dt * 0.25) { v.pause = 0.6 + Math.random() * 2.2; if (Math.random() < 0.5) v.dir *= -1; }
        }
        if (v.vy || v.y > 0) { v.y += v.vy * dt; v.vy -= 1900 * dt; if (v.y <= 0) { v.y = 0; v.vy = 0; } }
        v.node.style.translate = `${v.x}px ${-v.y}px`;
        const edge = v.x < 130 ? 'l' : v.x > w - size() - 130 ? 'r' : '';
        if (v.node.dataset.edge !== edge) v.node.dataset.edge = edge;
        v.node.classList.toggle('left', v.dir < 0);
        v.node.classList.toggle('walk', v.pause <= 0 && v.y === 0);
      } else if (m === 'flotte') {
        v.y += 38 * sp * dt;
        const sway = Math.sin((now / 1000) * 1.3 + v.bornAt) * 18;
        v.node.style.translate = `${v.x + sway}px ${-v.y}px`;
        if (v.y > h - 40) { v.y = -40; v.x = 40 + Math.random() * (w - 140); }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function demo() {
    clearInterval(demoTimer);
    if (!isPreview) return;
    const step = () => {
      const d = DEMO[demoIndex % DEMO.length];
      demoIndex += 1;
      const user = { id: `demo-${d.name}`, name: d.name, display: d.name, avatar: '' };
      const type = d.text ? 'chat' : d.gift ? 'gift' : 'like';
      onEvent({ type, platform: d.platform, user, text: d.text, amount: 5, gift: d.gift ? { name: 'Rose' } : null });
    };
    for (let i = 0; i < 5; i += 1) step();
    demoTimer = setInterval(step, 1600);
  }

  function apply() {
    box.dataset.mode = mode();
    box.style.setProperty('--va', `${size()}px`);
    box.style.setProperty('--accent', s.accent || '#8FD3FF');
    box.style.setProperty('--bubble', s.bubble || '#FFFFFF');
    box.style.setProperty('--text', s.text || '#F2F5F9');
    for (const v of crowd.values()) v.name.hidden = s.names === false;
    if (mode() === 'mur') layoutWall();
  }

  return {
    update(settings) {
      const changed = s.mode !== settings.mode;
      s = settings;
      if (changed) for (const v of crowd.values()) { v.y = mode() === 'flotte' ? Math.random() * 200 : 0; v.vy = 0; }
      apply();
      if (isPreview && !demoTimer) demo();
    },
    on(msg) {
      if (msg.t !== 'ev') return;
      if (isPreview && demoTimer) { clearInterval(demoTimer); demoTimer = null; for (const v of [...crowd.values()]) remove(v); }
      onEvent(msg.ev);
      if (msg.ev.type === 'gift' && s.sound) playSound(s.sound, 60);
    },
  };
}
