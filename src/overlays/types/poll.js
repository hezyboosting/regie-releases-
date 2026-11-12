import { el, fmt, setVars, isPreview } from '../lib.js';

const DEMO = { status: 'running', question: 'On joue à quoi ensuite ?', options: ['Ranked', 'Avec les viewers'], counts: [34, 21], total: 55 };

export function mount(root) {
  const box = el('div', 'panel scaled');
  root.append(box);
  let bars = [];

  const render = (p) => {
    const data = p && p.status !== 'idle' ? p : isPreview ? DEMO : null;
    box.hidden = !data;
    if (!data) return;
    const same = bars.length === data.options.length && box.dataset.q === data.question;
    if (!same) {
      box.textContent = '';
      box.dataset.q = data.question;
      box.append(el('h1', '', data.question));
      bars = data.options.map((o, i) => {
        const row = el('div', 'pl-row');
        const fill = el('i');
        const label = el('span', '', `${i + 1}. ${o}`);
        const count = el('span');
        row.append(fill, label, count);
        box.append(row);
        return { fill, count };
      });
      box.foot = el('div', 'pl-foot');
      box.append(box.foot);
    }
    data.options.forEach((_, i) => {
      const pct = data.total ? (data.counts[i] / data.total) * 100 : 0;
      bars[i].fill.style.width = `${pct}%`;
      bars[i].count.textContent = `${Math.round(pct)} %`;
    });
    box.foot.textContent = data.status === 'running' ? `Écris le numéro de ton choix dans le chat. ${fmt(data.total)} votes` : `Sondage terminé. ${fmt(data.total)} votes`;
  };

  return {
    update(s, data) { setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); render(data?.poll); },
    on(msg) { if (msg.t === 'poll') render(msg.poll); },
  };
}
