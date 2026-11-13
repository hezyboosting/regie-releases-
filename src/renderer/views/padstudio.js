// Atelier manette : choix du modèle, coloris, finitions zone par zone et réglages du direct.
// L'aperçu à gauche est l'overlay lui-même : chaque réglage s'y voit aussitôt.
import { html, useState, act, setState } from '../store.js';
import { ICONS, Bay, Lamp, Fader, Color, Segments, Pro } from '../ui.js';

// Modèles proposés. Le troisième champ est la vignette (pads/<nom>.png), partagée entre manettes de même forme.
const MODELS = [
  { value: 'auto', label: 'Suit ma manette', thumb: null },
  { value: 'ps5', label: 'DualSense', sub: 'PS5', thumb: 'ps5' },
  { value: 'ps5_edge', label: 'DualSense Edge', sub: 'PS5', thumb: 'ps5' },
  { value: 'ps4', label: 'DualShock 4', sub: 'PS4', thumb: 'ps4' },
  { value: 'xbox', label: 'Series X|S', sub: 'Xbox', thumb: 'xbox' },
  { value: 'xbox_one', label: 'One', sub: 'Xbox', thumb: 'xbox' },
  { value: 'xbox_elite', label: 'Elite', sub: 'Xbox', thumb: 'xbox' },
  { value: 'xbox_360', label: '360', sub: 'Xbox', thumb: 'xbox_360' },
  { value: 'switch_pro', label: 'Pro Controller', sub: 'Switch', thumb: 'switch_pro' },
  { value: '8bitdo', label: '8BitDo', sub: 'Pro 2', thumb: 'switch_pro' },
  { value: 'gamesir', label: 'GameSir', sub: 'G7', thumb: 'xbox' },
  { value: 'regie', label: 'Régie', sub: 'Dessin', thumb: null },
  { value: 'arcade', label: 'Stick arcade', sub: 'Dessin', thumb: null },
];
const COLORWAY_NAMES = {
  blanc: 'Blanc', minuit: 'Minuit', carmin: 'Carmin', cobalt: 'Cobalt',
  fume: 'Fumé', encre: 'Encre', verre: 'Verre', bleu: 'Bleu', lilas: 'Lilas', rose: 'Rose', ambre: 'Ambre', menthe: 'Menthe', rouge: 'Rouge',
};
const FALLBACK = { fill: 'solid', c1: '#FFFFFF', c2: '#FFFFFF', shine: 40, alpha: 100 };

// Réglages pris en charge ici ; les autres restent dans le formulaire commun.
export const STUDIO_KEYS = ['model', 'layout', 'pad', 'source', 'finish', 'colorway', 'pressed', 'legend', 'labels', 'trail', 'triggers', 'idleFade', 'pack', 'packGain', 'skin', 'skinPs'];

// ---------- Couleurs : hexadécimal ⇄ teinte, saturation, luminosité ----------
function toHsl(hex) {
  const n = parseInt(String(hex || '#FFFFFF').slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function toHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

// Un curseur à piste colorée : la couleur bouge pendant le glissement, l'overlay suit au relâché.
function Track({ label, value, min, max, unit, track, onInput, onCommit, disabled, ends }) {
  return html`<div class="tune-row">
    <div class="tune-top"><span>${label}</span><output>${value}${unit}</output></div>
    <input type="range" min=${min} max=${max} value=${value} disabled=${disabled} style=${{ '--track': track }}
      onInput=${(e) => onInput(Number(e.target.value))} onChange=${(e) => onCommit(Number(e.target.value))} aria-label=${label} />
    ${ends && html`<div class="tune-ends">${ends.map((t) => html`<span key=${t}>${t}</span>`)}</div>`}
  </div>`;
}

function Tune({ value, onChange, disabled, title }) {
  const [hsl, setHsl] = useState(toHsl(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); const next = toHsl(value); setHsl(next[1] === 0 ? [hsl[0], next[1], next[2]] : next); }
  const [h, s, l] = hsl;
  const live = toHex(h, s, l);
  const set = (i) => (v) => { const n = [...hsl]; n[i] = v; setHsl(n); };
  const commit = (i) => (v) => { const n = [...hsl]; n[i] = v; setHsl(n); onChange(toHex(...n)); };
  return html`<div class="tune">
    <div class="tune-head">
      ${title && html`<b>${title}</b>`}
      <${Color} value=${live} disabled=${disabled} onChange=${onChange} />
    </div>
    <${Track} label="Teinte" value=${h} min="0" max="359" unit="°" disabled=${disabled} onInput=${set(0)} onCommit=${commit(0)}
      track="linear-gradient(90deg, #f33, #fc3, #3f6, #3cf, #36f, #c3f, #f33)" />
    <${Track} label="Saturation" value=${s} min="0" max="100" unit=" %" disabled=${disabled} onInput=${set(1)} onCommit=${commit(1)}
      track=${`linear-gradient(90deg, hsl(${h} 0% ${l}%), hsl(${h} 100% ${Math.min(Math.max(l, 25), 75)}%))`} />
    <${Track} label="Luminosité" value=${l} min="0" max="100" unit=" %" disabled=${disabled} onInput=${set(2)} onCommit=${commit(2)}
      track=${`linear-gradient(90deg, #000, hsl(${h} ${s}% 50%), #fff)`} ends=${['Noir', 'Couleur pure', 'Blanc']} />
  </div>`;
}

// ---------- Blocs ----------
function ModelPicker({ s, value, set }) {
  const detected = s.pads?.[0];
  return html`<div class="pad-models" role="radiogroup" aria-label="Modèle de manette">
    ${MODELS.map((m) => html`<button type="button" key=${m.value} role="radio" aria-checked=${value === m.value} class="pad-model ${value === m.value ? 'on' : ''}" onClick=${() => set(m.value)}>
      <span class="pad-thumb">${m.thumb ? html`<img src=${`pads/${m.thumb}.png`} alt="" draggable="false" />` : html`<i>${m.value === 'auto' ? ICONS.spark : ICONS.gaming}</i>`}</span>
      <b>${m.label}</b>
      <small>${m.value === 'auto' ? (detected ? detected.name : 'Aucune branchée') : m.sub}</small>
    </button>`)}
  </div>`;
}

function Colorways({ s, overlay, locked }) {
  const current = overlay.settings.colorway || 'fume';
  const apply = async (name) => {
    const r = await act('applyColorway', overlay.id, name);
    if (r) setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) });
  };
  return html`<div class="pad-ways">
    ${Object.entries(s.colorways).map(([name, tint]) => html`<button type="button" key=${name} class="pad-way ${current === name ? 'on' : ''}" disabled=${locked} onClick=${() => apply(name)}>
      <i style=${{ background: tint }}></i><span>${COLORWAY_NAMES[name] || name}</span>
    </button>`)}
  </div>`;
}

function Finish({ s, value, set, locked }) {
  const [zone, setZone] = useState('shell');
  const c = { ...FALLBACK, ...(value?.[zone] || {}) };
  const up = (patch) => set({ ...(value || {}), [zone]: { ...c, ...patch } });
  const copyAll = () => set(Object.fromEntries(s.finishGroups.map(([k]) => [k, k === 'light' ? (value?.light || c) : { ...c }])));
  return html`<div class="pad-finish ${locked ? 'off' : ''}">
    <div class="chips">${s.finishGroups.map(([k, l]) => html`<button type="button" key=${k} class="chip ${zone === k ? 'on' : ''}" onClick=${() => setZone(k)}>
      <i class="chip-dot" style=${{ background: value?.[k]?.c1 || '#FFFFFF' }}></i>${l}
    </button>`)}</div>
    <div class="pad-zone">
      <div class="pad-zone-head">
        <b>${s.finishGroups.find(([k]) => k === zone)?.[1]}</b>
        <${Segments} value=${c.fill} onChange=${(fill) => up({ fill, c2: c.c2 || c.c1 })} options=${[{ value: 'solid', label: 'Uni' }, { value: 'gradient', label: 'Dégradé' }]} />
      </div>
      <${Tune} title=${c.fill === 'gradient' ? 'Haut' : ''} value=${c.c1} disabled=${locked} onChange=${(c1) => up({ c1 })} />
      ${c.fill === 'gradient' && html`<${Tune} title="Bas" value=${c.c2 || c.c1} disabled=${locked} onChange=${(c2) => up({ c2 })} />`}
      <div class="tune-row"><div class="tune-top"><span>Opacité</span></div><${Fader} value=${c.alpha ?? 100} min="0" max="100" step="2" unit=" %" disabled=${locked} onChange=${(alpha) => up({ alpha })} /></div>
      <div class="tune-row"><div class="tune-top"><span>Brillance</span></div><${Fader} value=${c.shine ?? 40} min="0" max="100" step="5" unit=" %" disabled=${locked} onChange=${(shine) => up({ shine })} /></div>
      ${zone !== 'light' && html`<button type="button" class="linkish" disabled=${locked} onClick=${copyAll}>Appliquer cette finition à toute la manette</button>`}
    </div>
  </div>`;
}

export function PadStudio({ s, overlay, save, FieldInput }) {
  const v = (k) => overlay.settings[k] ?? s.overlayTypes.gamepad.fields.find((f) => f.key === k)?.default;
  const locked = !s.features.gamepadCustom;
  const model = v('model') || 'auto';
  const drawn = model === 'regie' || model === 'arcade';
  const [own, setOwn] = useState(Boolean(overlay.settings.pack || overlay.settings.skin?.image || overlay.settings.skinPs?.image));
  const field = (k) => s.overlayTypes.gamepad.fields.find((f) => f.key === k);
  return html`<div class="pad-studio">
    <${Bay} title="Manette">
      <${ModelPicker} s=${s} value=${model} set=${(m) => save('model', m)} />
    <//>
    <${Bay} title=${html`Coloris${locked ? html` <${Pro} />` : ''}`}>
      <${Colorways} s=${s} overlay=${overlay} locked=${locked} />
    <//>
    <${Bay} title=${html`Finitions${locked ? html` <${Pro} />` : ''}`} aside=${html`<span class="f-hint">Zone par zone</span>`}>
      <${Finish} s=${s} value=${overlay.settings.finish} set=${(f) => save('finish', f)} locked=${locked} />
    <//>
    <${Bay} title="En direct">
      <div class="pad-live">
        <div class="tune-row"><div class="tune-top"><span>Couleur à l'appui</span></div><${Color} value=${v('pressed')} disabled=${locked} onChange=${(c) => save('pressed', c)} /></div>
        ${drawn && html`<div class="tune-row"><div class="tune-top"><span>Inscriptions</span></div><${Color} value=${v('legend')} disabled=${locked} onChange=${(c) => save('legend', c)} /></div>`}
        <div class="pad-lamps">
          <${Lamp} on=${v('labels') !== false} onChange=${(on) => save('labels', on)} label="Symboles des boutons" />
          <${Lamp} on=${v('triggers') !== false} onChange=${(on) => save('triggers', on)} label="Jauges L2 et R2" />
          <${Lamp} on=${v('trail') !== false} onChange=${(on) => save('trail', on)} label="Trace des sticks" />
        </div>
        <div class="tune-row"><div class="tune-top"><span>Fondu quand la manette ne bouge plus</span></div><${Fader} value=${v('idleFade')} min="0" max="30" step="1" unit=" s" onChange=${(n) => save('idleFade', n)} /></div>
        <div class="pad-two">
          <div class="tune-row"><div class="tune-top"><span>Manette n°</span></div><${Segments} value=${String(v('pad'))} onChange=${(n) => save('pad', Number(n))} options=${[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} /></div>
          <div class="tune-row"><div class="tune-top"><span>Lecture</span></div><${Segments} value=${v('source')} onChange=${(src) => save('source', src)} options=${field('source').options} /></div>
        </div>
      </div>
    <//>
    <${Bay} class="pad-own" title="Ta manette à toi" aside=${html`<button type="button" class="icon ${own ? 'open' : ''}" aria-expanded=${own} aria-label=${own ? 'Replier' : 'Déplier'} onClick=${() => setOwn(!own)}>${ICONS.chevron}</button>`}>
      ${!own && html`<p class="note">Importe un modèle en calques ou une photo de ta manette, si tu préfères ton propre visuel.</p>`}
      ${own && html`<form class="ed-form" onSubmit=${(e) => e.preventDefault()}>
        ${['pack', 'packGain', 'skin', 'skinPs'].map((k) => html`<${FieldInput} key=${k} f=${field(k)} value=${v(k)} set=${(x) => save(k, x)} s=${s} overlay=${overlay} />`)}
      </form>`}
    <//>
  </div>`;
}

// Pastille posée sur l'aperçu : la manette lue en ce moment, ou la démo.
export function LiveBadge({ s, overlay }) {
  const n = (overlay.settings.pad || 1) - 1;
  const pad = s.pads?.find((p) => p.pad === n) || s.pads?.[0];
  return html`<span class="pad-live-badge ${pad ? 'on' : ''}"><i></i>${pad ? `${pad.name} · en direct` : 'Démo · branche une manette'}</span>`;
}
