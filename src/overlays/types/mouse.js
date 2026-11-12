import { el, svg, isPreview } from '../lib.js';

export function mount(root) {
  let s = {};
  const box = el('div', 'ms scaled');
  const v = svg('svg', { viewBox: '0 0 300 400', width: 300, height: 400 }, box);
  const body = svg('path', { d: 'M150 12 C222 12 262 66 262 152 L262 262 C262 344 214 388 150 388 C86 388 38 344 38 262 L38 152 C38 66 78 12 150 12 Z' }, v);
  const left = svg('path', { d: 'M144 20 C84 22 46 72 46 152 L46 176 L144 176 Z' }, v);
  const right = svg('path', { d: 'M156 20 C216 22 254 72 254 152 L254 176 L156 176 Z' }, v);
  const wheelBg = svg('rect', { x: 137, y: 62, width: 26, height: 72, rx: 13, fill: 'rgba(0,0,0,.55)' }, v);
  const wheel = svg('rect', { x: 142, y: 72, width: 16, height: 52, rx: 8 }, v);
  const up = svg('path', { d: 'M150 40 L162 54 H138 Z', opacity: 0 }, v);
  const down = svg('path', { d: 'M150 156 L162 142 H138 Z', opacity: 0 }, v);
  const side1 = svg('rect', { x: 28, y: 196, width: 12, height: 42, rx: 4 }, v);
  const side2 = svg('rect', { x: 28, y: 244, width: 12, height: 42, rx: 4 }, v);
  const canvas = el('canvas', 'ms-trail');
  canvas.width = 300; canvas.height = 400;
  box.append(canvas);
  root.append(box);
  const c = canvas.getContext('2d');
  let dot = { x: 150, y: 286 };
  const btn = { 1: left, 2: right, 3: wheel, 4: side1, 5: side2 };
  const on = new Set();

  function paint() {
    left.setAttribute('fill', on.has(1) ? s.pressed : 'rgba(255,255,255,.09)');
    right.setAttribute('fill', on.has(2) ? s.pressed : 'rgba(255,255,255,.09)');
    wheel.setAttribute('fill', on.has(3) ? s.pressed : s.accent);
    side1.setAttribute('fill', on.has(4) ? s.pressed : 'rgba(255,255,255,.3)');
    side2.setAttribute('fill', on.has(5) ? s.pressed : 'rgba(255,255,255,.3)');
    body.setAttribute('fill', s.body);
    up.setAttribute('fill', s.accent);
    down.setAttribute('fill', s.accent);
  }

  function nudge(n) {
    n.setAttribute('opacity', 1);
    clearTimeout(n.t);
    n.t = setTimeout(() => n.setAttribute('opacity', 0), 180);
  }

  function step() {
    requestAnimationFrame(step);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0,0,0,.08)';
    c.fillRect(0, 0, 300, 400);
    c.globalCompositeOperation = 'source-over';
    dot.x += (150 - dot.x) * 0.1;
    dot.y += (286 - dot.y) * 0.1;
    if (!s.trail) return;
    c.fillStyle = s.pressed;
    c.beginPath();
    c.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
    c.fill();
  }
  requestAnimationFrame(step);

  if (isPreview) {
    let i = 0;
    setInterval(() => {
      on.clear();
      on.add([1, 2, 3, 4, 5][i % 5]);
      i += 1;
      dot = { x: 150 + Math.sin(i) * 60, y: 286 + Math.cos(i) * 50 };
      paint();
    }, 600);
  }
  void wheelBg;

  return {
    update(settings) { s = settings; paint(); },
    on(msg) {
      if (msg.t !== 'mouse') return;
      if (msg.k === 'btn') { if (msg.down) on.add(msg.button); else on.delete(msg.button); paint(); }
      if (msg.k === 'wheel') nudge(msg.dir > 0 ? down : up);
      if (msg.k === 'move') {
        const f = (s.sensitivity || 50) / 400;
        dot.x = Math.max(70, Math.min(230, dot.x + msg.dx * f));
        dot.y = Math.max(210, Math.min(360, dot.y + msg.dy * f));
      }
      void btn;
    },
  };
}
