// Composants de base de la console.
import { html, useState, useEffect, useRef, useStore, PLATFORM, setState, preactRender } from './store.js';
import { crest } from '../overlays/crest.js';
import { brandSvg } from '../overlays/brands.js';

const I = (d) => html`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d} /></svg>`;
export const ICONS = {
  dash: I('M3 13h7V3H3v10Zm11 8h7V11h-7v10ZM3 21h7v-4H3v4ZM14 3v4h7V3h-7Z'),
  overlays: I('M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.500 12 22l9-4.500'),
  editor: I('M4 20h4L19 9l-4-4L4 16v4ZM13.500 6.500l4 4'),
  shop: I('M5 8h14l1 13H4L5 8Zm3 2V7a4 4 0 0 1 8 0v3'),
  scenes: I('M3 5h18v12H3V5Zm5 16h8M12 17v4'),
  alerts: I('M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 21h4'),
  goals: I('M4 21V4l7 3 7-3v11l-7 3-7-3'),
  battles: I('m14.500 17.500-8-8V5h4.500l8 8M13 19l6-6M16 16l4 4M5 14l-1.500 1.500M9 18l-5-5'),
  spotify: I('M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'),
  commands: I('M4 6h16v10H9l-5 4V6ZM8 10h8M8 13h5'),
  tts: I('M4 10v4h3l5 4V6L7 10H4ZM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12'),
  tools: I('M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'),
  gifts: I('M4 11h16v10H4V11ZM3 7h18v4H3V7ZM12 7v14M12 7S10 3 7.500 3C5 3 5 7 8 7h4Zm0 0s2-4 4.500-4C19 3 19 7 16 7h-4Z'),
  ranks: I('M8 4h8v6a4 4 0 0 1-8 0V4ZM8 6H4c0 3 1.500 5 4 5M16 6h4c0 3-1.500 5-4 5M12 14v4M8 21h8l-1-3H9l-1 3Z'),
  gaming: I('M7 8h10a5 5 0 0 1 4.900 6l-.5 2.500a2.500 2.500 0 0 1-4.400 1.100L15 15H9l-2 2.600a2.500 2.500 0 0 1-4.400-1.100L2.100 14A5 5 0 0 1 7 8ZM7 11v3M5.500 12.500h3M15 12h.01M18 13h.01'),
  sounds: I('M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M22 12h-1'),
  deck: I('M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z'),
  clips: I('M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.100 7.100 20 18M20 6 8.100 16.900'),
  stats: I('M4 4v16h16M8 15l4-5 3 3 5-6'),
  settings: I('M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4'),
  admin: I('M12 3 4 6v6c0 5 3.400 8 8 9 4.600-1 8-4 8-9V6l-8-3ZM9 12l2 2 4-4'),
  lock: I('M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z'),
  plus: I('M12 5v14M5 12h14'),
  x: I('M6 6l12 12M18 6 6 18'),
  copy: I('M9 9h11v11H9V9ZM5 15H4V4h11v1'),
  play: I('M7 4l13 8-13 8V4Z'),
  pause: I('M8 5v14M16 5v14'),
  next: I('M5 4l10 8-10 8V4ZM19 5v14'),
  prev: I('M19 20 9 12l10-8v16ZM5 19V5'),
  search: I('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.300-4.300'),
  chevron: I('m9 6 6 6-6 6'),
  panel: I('M3 5h18v14H3V5Zm12 0v14'),
  up: I('M12 19V5M6 11l6-6 6 6'),
  down: I('M12 5v14M6 13l6 6 6-6'),
  trash: I('M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14'),
  dup: I('M9 9h11v11H9V9ZM5 15H4V4h11v1'),
  link: I('M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1'),
  game: I('M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 9v4M6 11h4M15 10h.01M17 13h.01'),
  auto: I('M13 3 5 14h6l-1 7 8-11h-6l1-7Z'),
  dice: I('M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.500 8.500h.01M15.500 15.500h.01M12 12h.01M15.500 8.500h.01M8.500 15.500h.01'),
  assist: I('M12 3a7 7 0 0 0-4 12.700V18h8v-2.300A7 7 0 0 0 12 3ZM9 21h6'),
  side: I('M4 5h16v14H4V5Zm5 0v14'),
  spark: I('M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3'),
};

export function Tag({ platform }) {
  const p = PLATFORM[platform];
  if (!p) return html`<span class="pf neutral">Test</span>`;
  return html`<span class="pf pf-icon" title=${p.label} aria-label=${p.label} dangerouslySetInnerHTML=${{ __html: brandSvg(platform) }}></span>`;
}

export function Bay({ title, aside, children, class: cls = '' }) {
  return html`<section class="bay ${cls}">
    ${title && html`<header class="bay-head"><h3>${title}</h3>${aside}</header>`}
    ${children}
  </section>`;
}

export const Btn = ({ children, kind = '', onClick, disabled, title, type = 'button', icon }) => html`<button type=${type} class="key ${kind}" onClick=${onClick} disabled=${disabled} title=${title}>${icon}${children}</button>`;

// Interrupteur.
export function Lamp({ on, onChange, label, disabled, locked, hint, 'aria-label': aria }) {
  return html`<button type="button" role="switch" aria-checked=${Boolean(on)} aria-label=${aria || undefined} class="sw ${on ? 'on' : ''}" disabled=${disabled || locked} onClick=${() => onChange(!on)} title=${locked ? 'Réservé à une offre supérieure' : hint}>
    <i aria-hidden="true"></i><span>${label}</span>${locked && html`<${Pro} />`}
  </button>`;
}

// Blason Régie, ou image importée pour ce rang.
let gemId = 0;
const mix = (hex, to, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k)).join(',')})`; };
export function Gem({ src, size = 42, ...rank }) {
  const box = { width: `${size}px`, height: `${size}px` };
  if (src) return html`<img class="gem" src=${src} alt="" style=${{ ...box, objectFit: 'contain' }} />`;
  return html`<span class="gem" style=${box} dangerouslySetInnerHTML=${{ __html: crest({ ...rank, size }) }}></span>`;
}

export const Pro = ({ tier = 'PRO' }) => html`<span class="pro">${tier}</span>`;

export const Field = ({ label, hint, children, wide }) => html`<label class="field ${wide ? 'wide' : ''}"><span class="f-label">${label}</span>${children}${hint && html`<span class="f-hint">${hint}</span>`}</label>`;

export function Text({ value, onChange, ...rest }) {
  return html`<input class="in" type=${rest.type || 'text'} value=${value ?? ''} onInput=${(e) => onChange(e.target.value)} ...${rest} />`;
}

// Le champ garde sa valeur locale pendant la frappe et enregistre à la sortie.
export function Lazy({ value, onSave, area, ...rest }) {
  const [v, set] = useState(value ?? '');
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); set(value ?? ''); }
  const commit = () => { if (v !== (value ?? '')) onSave(v); };
  if (area) return html`<textarea class="in" rows=${rest.rows || 3} value=${v} onInput=${(e) => set(e.target.value)} onBlur=${commit} ...${rest}></textarea>`;
  return html`<input class="in" value=${v} onInput=${(e) => set(e.target.value)} onBlur=${commit} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} ...${rest} />`;
}

export function Num({ value, onSave, min, max, step = 1, ...rest }) {
  return html`<${Lazy} type="number" value=${value} min=${min} max=${max} step=${step} onSave=${(v) => onSave(Number(v))} ...${rest} />`;
}

// Menu déroulant maison : la liste native de Windows ignorait le thème (texte illisible).
// Le menu s'ouvre dans un calque posé sur la page, au-dessus ou au-dessous selon la place.
export function Select({ value, onChange, options, disabled, label }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const host = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const list = options || [];
  const idx = Math.max(0, list.findIndex((o) => String(o.value) === String(value)));
  const cur = list[idx];

  const place = () => {
    const r = btn.current.getBoundingClientRect();
    const below = innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const want = Math.min(340, list.length * 38 + 12);
    const up = below < want && above > below;
    setPos({ left: r.left, width: Math.max(r.width, 180), top: up ? null : r.bottom + 6, bottom: up ? innerHeight - r.top + 6 : null, max: Math.max(140, Math.min(340, up ? above : below)) });
  };
  const openIt = () => { if (disabled || !list.length) return; place(); setHi(idx); setOpen(true); };
  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };
  const choose = (o) => {
    if (!o || o.disabled) return;
    close();
    if (String(o.value) !== String(value)) onChange(String(o.value));
  };
  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < list.length; i += dir) if (!list[i].disabled) return i;
    return from;
  };

  const onKey = (e) => {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openIt(); return; }
    if (!open) return;
    if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => step(h, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => step(h, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(step(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setHi(step(list.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(list[hi]); }
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const found = list.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(typed.current.text));
      if (found >= 0) setHi(found);
    }
  };

  // Fermeture au clic dehors, au défilement de la page et au redimensionnement.
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!btn.current?.contains(e.target) && !host.current?.contains(e.target)) close(false); };
    const scroll = (e) => { if (!host.current?.contains(e.target)) close(false); };
    const resize = () => close(false);
    addEventListener('pointerdown', outside, true);
    addEventListener('scroll', scroll, true);
    addEventListener('resize', resize);
    return () => { removeEventListener('pointerdown', outside, true); removeEventListener('scroll', scroll, true); removeEventListener('resize', resize); };
  }, [open]);

  // Le calque vit dans <body> pour ne pas être coupé par les cartes en verre.
  useEffect(() => {
    if (!host.current) { host.current = document.createElement('div'); host.current.className = 'sel-host'; document.body.append(host.current); }
    if (!open || !pos) { preactRender(null, host.current); return; }
    preactRender(html`<div class="sel-pop" role="listbox" aria-label=${label || ''} style=${{ left: `${pos.left}px`, width: `${pos.width}px`, top: pos.top !== null ? `${pos.top}px` : 'auto', bottom: pos.bottom !== null ? `${pos.bottom}px` : 'auto', maxHeight: `${pos.max}px` }}>
      ${list.map((o, i) => html`<div key=${String(o.value)} role="option" aria-selected=${i === idx} aria-disabled=${Boolean(o.disabled)} class="sel-opt ${i === hi ? 'hi' : ''} ${i === idx ? 'on' : ''} ${o.disabled ? 'off' : ''}" onPointerEnter=${() => !o.disabled && setHi(i)} onClick=${() => choose(o)}>
        <span>${o.label}</span>${i === idx && html`<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
      </div>`)}
    </div>`, host.current);
    host.current.querySelector('.sel-opt.hi')?.scrollIntoView({ block: 'nearest' });
  });
  useEffect(() => () => { if (host.current) { preactRender(null, host.current); host.current.remove(); } }, []);

  return html`<button type="button" ref=${btn} class="in sel ${open ? 'open' : ''}" disabled=${disabled} aria-haspopup="listbox" aria-expanded=${open} aria-label=${label} onClick=${() => (open ? close() : openIt())} onKeyDown=${onKey}>
    <span class="sel-val">${cur ? cur.label : ''}</span>
    <svg class="sel-chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>`;
}

export function Fader({ value, onChange, min, max, step, unit = '', disabled }) {
  const [v, set] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); set(value); }
  const pct = ((Number(v) - Number(min)) / (Number(max) - Number(min))) * 100;
  return html`<span class="fader">
    <input type="range" min=${min} max=${max} step=${step} value=${v} disabled=${disabled} style=${{ '--p': `${pct}%` }} onInput=${(e) => set(Number(e.target.value))} onChange=${(e) => onChange(Number(e.target.value))} />
    <output>${v}${unit}</output>
  </span>`;
}

export function Color({ value, onChange, disabled }) {
  const [v, set] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); set(value); }
  return html`<span class="color">
    <input type="color" value=${v} disabled=${disabled} onInput=${(e) => set(e.target.value)} onChange=${(e) => onChange(e.target.value)} aria-label="Choisir une couleur" />
    <code>${v}</code>
  </span>`;
}

export function Platforms({ value = [], onChange }) {
  const toggle = (p) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return html`<span class="pf-pick">
    ${Object.entries(PLATFORM).map(([k, p]) => html`<button type="button" class="pf-key ${value.includes(k) ? 'on' : ''}" aria-pressed=${value.includes(k)} onClick=${() => toggle(k)} style=${{ '--p': p.color }}><span class="pf-icon" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: brandSvg(k, 16) }}></span>${p.label}</button>`)}
  </span>`;
}

export function Segments({ value, options, onChange, locked }) {
  return html`<div class="segs" role="radiogroup">
    ${options.map((o) => {
    const off = locked && o.premium;
    return html`<button type="button" role="radio" aria-checked=${value === o.value} class="seg ${value === o.value ? 'on' : ''}" disabled=${off} title=${off ? 'Réservé à PRO' : ''} onClick=${() => onChange(o.value)}>${o.label}${off && html`<${Pro} />`}</button>`;
  })}
  </div>`;
}

export const Empty = ({ title, children }) => html`<div class="empty"><strong>${title}</strong><p>${children}</p></div>`;

export const go = (view, extra = {}) => setState({ view, ...extra });

export function Upsell({ children }) {
  const s = useStore();
  if (s.role !== 'free') return null;
  return html`<div class="upsell"><span>${children}</span><${Btn} kind="amber" onClick=${() => go('settings', { settingsTab: 'licence' })}>Activer une clé<//></div>`;
}

export function PageHead({ title, children }) {
  return html`<header class="page-head"><h2>${title}</h2><div class="page-acts">${children}</div></header>`;
}
