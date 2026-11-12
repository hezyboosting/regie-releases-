import { el, clock, setVars, isPreview } from '../lib.js';

export function mount(root) {
  let s = {};
  let active = false;
  let elapsed = 0;
  let startedAt = 0;
  let frame = 0;

  const box = el('div', 'brb scaled');
  const icon = el('div', 'brb-icon');
  const title = el('div', 'brb-title');
  const sub = el('div', 'brb-sub');
  const timer = el('div', 'brb-timer');

  // Particules flottantes pour l'ambiance.
  const particles = el('div', 'brb-particles');
  for (let i = 0; i < 12; i += 1) {
    const p = el('i', 'brb-dot');
    p.style.setProperty('--i', i);
    particles.append(p);
  }
  box.append(particles, icon, title, sub, timer);
  root.append(box);

  const render = () => {
    const show = active || isPreview;
    box.hidden = !show;
    if (!show) { cancelAnimationFrame(frame); return; }
    title.textContent = s.title || 'Je reviens';
    sub.textContent = s.subtitle || '';
    sub.hidden = !s.subtitle;
    icon.textContent = s.icon === 'coffee' ? '☕' : s.icon === 'controller' ? '🎮' : s.icon === 'moon' ? '🌙' : s.icon === 'clock' ? '⏰' : s.icon === 'none' ? '' : '⏸';
    if (s.showTimer !== false) {
      const t = active ? Math.floor((Date.now() - startedAt) / 1000) : elapsed;
      timer.textContent = `Parti depuis ${clock(t)}`;
      timer.hidden = false;
    } else {
      timer.hidden = true;
    }
    box.className = `brb scaled ${s.style || 'verre'}`;
    setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
  };

  const tick = () => { render(); if (active) frame = requestAnimationFrame(tick); };

  return {
    update(settings, data) {
      s = settings;
      if (data?.brb !== undefined) {
        active = data.brb.active;
        startedAt = data.brb.startedAt || Date.now();
        elapsed = data.brb.elapsed || 0;
      }
      render();
      if (active && !frame) tick();
    },
    on(msg) {
      if (msg.t === 'brb') {
        active = msg.active;
        startedAt = msg.startedAt || Date.now();
        elapsed = msg.elapsed || 0;
        render();
        if (active && !frame) tick();
      }
    },
  };
}
