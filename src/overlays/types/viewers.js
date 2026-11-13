// Spectateurs en verre : point « en direct » qui pulse, total qui défile, flèche de tendance,
// et le détail par plateforme avec les vrais logos.
import { el, tag, fmt, setVars, isPreview, countTo } from '../lib.js';

export function mount(root) {
  let s = {};
  const box = el('div', 'big gx scaled');
  const live = el('i', 'dot');
  const main = el('div', 'vw-main');
  const label = el('span', 'gx-label vw-label', 'Spectateurs');
  const n = el('div', 'gx-num n');
  const trend = el('span', 'vw-trend');
  const top = el('div', 'vw-top');
  top.append(n, trend);
  main.append(label, top);
  const sub = el('div', 'sub');
  box.append(el('div', 'gx-shine'), live, main, sub);
  root.append(box);
  let last = null;

  const render = (total, per = {}) => {
    countTo(n, total);
    if (last !== null && total !== last) { trend.textContent = total > last ? '▲' : '▼'; trend.className = `vw-trend ${total > last ? 'up' : 'down'}`; }
    last = total;
    sub.textContent = '';
    sub.hidden = !s.split || !Object.keys(per).length;
    if (s.split) for (const [p, v] of Object.entries(per)) { const w = el('span', 'vw-pf'); w.append(tag(p), el('b', '', fmt(v))); sub.append(w); }
  };
  let demoTimer = null;
  return {
    update(settings, data) {
      s = settings;
      setVars(root, { text: s.text, accent: s.accent });
      clearInterval(demoTimer);
      if (isPreview && !data?.total) {
        let t = 1284;
        render(t, { tiktok: 620, twitch: 512, youtube: 152 });
        demoTimer = setInterval(() => { t += Math.round((Math.random() - 0.35) * 40); render(t, { tiktok: Math.round(t * 0.48), twitch: Math.round(t * 0.4), youtube: t - Math.round(t * 0.48) - Math.round(t * 0.4) }); }, 2000);
      } else render(data?.total || 0, data?.perPlatform);
    },
    on(msg) { if (msg.t === 'viewers') { clearInterval(demoTimer); render(msg.total, msg.perPlatform); } },
  };
}
