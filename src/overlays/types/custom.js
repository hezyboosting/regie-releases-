import { el as dom, media as mediaUrl, isPreview, confetti } from '../lib.js';
import { renderElement, sampleVars } from '../custom-render.js';

export function mount(root) {
  let s = {};
  let vars = {};
  const stage = dom('div', 'cstage');
  root.append(stage);
  const paint = () => {
    stage.textContent = '';
    const portrait = s.format === '9:16';
    stage.style.width = portrait ? '1080px' : '1920px';
    stage.style.height = portrait ? '1920px' : '1080px';
    stage.style.transform = `scale(${innerWidth / (portrait ? 1080 : 1920)})`;
    const data = isPreview && !vars.viewers ? { ...sampleVars(), ...vars } : vars;
    for (const e of s.elements || []) stage.append(renderElement(e, data, mediaUrl));
  };
  addEventListener('resize', paint);
  return {
    update(settings, data) { s = settings; if (data?.vars) vars = data.vars; paint(); },
    on(msg) {
      if (msg.t === 'vars') { vars = msg.vars; paint(); }
      if (msg.t === 'alert' && s.confetti) confetti();
    },
  };
}
