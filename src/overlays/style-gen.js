// Règles CSS générées pour l'habillage des overlays (forme des cartes, disposition libre).
// Fonctions pures, testées dans test/ ; utilisées par overlays/boot.js.
const hexOk = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : d);
const rgbaHex = (v, a) => { const h = hexOk(v, '#000000'); return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`; };
const TEXTURE = {
  rayures: 'repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 6px, transparent 6px 14px)',
  points: 'radial-gradient(rgba(255,255,255,.16) 1.2px, transparent 1.8px) 0 0 / 12px 12px',
  grille: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px) 0 0 / 16px 16px, linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px) 0 0 / 16px 16px',
  lignes: 'repeating-linear-gradient(0deg, rgba(0,0,0,.2) 0 2px, transparent 2px 4px)',
};
export function skinCss(sel, s) {
  if (!sel) return '';
  const out = [];
  const c = `${Math.max(4, Math.min(60, Number(s.skCut) || 16))}px`;
  const clip = {
    coupe: `polygon(${c} 0, calc(100% - ${c}) 0, 100% ${c}, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, ${c} 100%, 0 calc(100% - ${c}), 0 ${c})`,
    biseau: `polygon(${c} 0, 100% 0, calc(100% - ${c}) 100%, 0 100%)`,
    fleche: `polygon(0 0, calc(100% - ${c}) 0, 100% 50%, calc(100% - ${c}) 100%, 0 100%, ${c} 50%)`,
    hexa: `polygon(${c} 0, calc(100% - ${c}) 0, 100% 50%, calc(100% - ${c}) 100%, ${c} 100%, 0 50%)`,
    onglet: `polygon(0 0, calc(100% - ${c}) 0, 100% ${c}, 100% 100%, 0 100%)`,
  }[s.skShape];
  if (s.skShape === 'carre') out.push('border-radius: 0');
  if (s.skShape === 'arrondi') out.push(`border-radius: ${Math.max(0, Math.min(60, Number(s.skRadius) || 0))}px`);
  if (s.skShape === 'pilule') out.push('border-radius: 999px');
  if (clip) {
    out.push('border-radius: 0', `clip-path: ${clip}`);
    if (['biseau', 'fleche', 'hexa'].includes(s.skShape)) out.push(`padding-left: calc(${c} + .5em)`, `padding-right: calc(${c} + .5em)`);
  }
  const a = Math.max(0, Math.min(100, s.skAlpha ?? 90)) / 100;
  const tex = TEXTURE[s.skTexture] ? `${TEXTURE[s.skTexture]}, ` : '';
  if (s.skFill === 'uni') out.push(`background: ${tex}${rgbaHex(s.skColor1, a)}`, 'backdrop-filter: none');
  if (s.skFill === 'degrade') out.push(`background: ${tex}linear-gradient(${Number(s.skAngle) || 0}deg, ${rgbaHex(s.skColor1, a)}, ${rgbaHex(s.skColor2, a)})`, 'backdrop-filter: none');
  if (s.skFill === 'verre') out.push(`background: ${tex}linear-gradient(150deg, rgba(255,255,255,.22), rgba(255,255,255,.05)), ${rgbaHex(s.skColor1, 0.38)}`, 'backdrop-filter: blur(14px) saturate(1.4)', 'box-shadow: inset 0 1px 0 rgba(255,255,255,.42), inset 0 0 0 1px rgba(255,255,255,.14), 0 8px 26px rgba(0,0,0,.3)');
  if (s.skFill === 'aucun') out.push('background: none', 'box-shadow: none', 'backdrop-filter: none');
  const bw = Math.max(0, Math.min(12, Number(s.skBorder) || 0));
  if (bw) out.push(`border: ${bw}px ${['solid', 'dashed', 'dotted', 'double'].includes(s.skBorderStyle) ? s.skBorderStyle : 'solid'} ${hexOk(s.skBorderColor, '#FFFFFF')}`);
  if (!out.length) return '';
  const list = sel.split(',').map((x) => `#root ${x.trim()}`).join(', ');
  return `${list} { ${out.map((r) => `${r} !important`).join('; ')}; }`;
}

const LFONTS = { onest: '"Onest", sans-serif', geist: '"Geist", sans-serif', syne: '"Syne", sans-serif', archivo: '"Archivo", sans-serif', system: 'system-ui, "Segoe UI", sans-serif', serif: 'Georgia, serif', rounded: '"Nunito", "Arial Rounded MT Bold", sans-serif', impact: 'Impact, sans-serif' };
const SHADOW_TEXT = {
  douce: (c) => `0 2px 6px ${rgbaHex(c, 0.5)}`,
  forte: (c) => `0 2px 10px ${rgbaHex(c, 0.78)}, 0 0 2px ${rgbaHex(c, 0.6)}`,
  dure: (c) => `0.06em 0.06em 0 ${hexOk(c, '#000000')}`,
  halo: (c) => `0 0 8px ${hexOk(c, '#000000')}, 0 0 20px ${hexOk(c, '#000000')}`,
};
const SHADOW_BOX = {
  douce: (c) => `drop-shadow(0 4px 10px ${rgbaHex(c, 0.45)})`,
  forte: (c) => `drop-shadow(0 6px 18px ${rgbaHex(c, 0.8)})`,
  dure: (c) => `drop-shadow(4px 4px 0 ${hexOk(c, '#000000')})`,
  halo: (c) => `drop-shadow(0 0 10px ${hexOk(c, '#000000')}) drop-shadow(0 0 22px ${hexOk(c, '#000000')})`,
};
// Règles d'un élément placé à la main : position, taille, texte et boîte.
function partRules(it, p, n) {
  const r = ['position: absolute', `left: ${n(p.x)}px`, `top: ${n(p.y)}px`, 'right: auto', 'bottom: auto', 'margin: 0', 'min-width: 0', 'box-sizing: border-box'];
  // Pastille (détail) : elle garde sa taille, la largeur choisie n'est qu'un maximum.
  r.push(...(it.fit ? ['width: fit-content', `max-width: ${n(p.w, 200)}px`] : [`width: ${n(p.w, 200)}px`, 'max-width: none']));
  if (it.kind === 'box') r.push(`height: ${n(p.h, 40)}px`, 'max-height: none');
  const filters = [];
  if (it.kind === 'text') {
    const al = ['left', 'center', 'right'].includes(p.align) ? p.align : 'left';
    // justify-content : pour les éléments en ligne flexible (compteur, pseudo et badges), l'alignement passe par là.
    r.push(`font-size: ${n(p.size, 20)}px`, `font-weight: ${n(p.weight, 600)}`, `text-align: ${al}`, ...(al === 'left' ? [] : [`justify-content: ${al === 'center' ? 'center' : 'flex-end'}`]), `line-height: ${n(p.lh) ? n(p.lh) / 100 : 1.12}`, ...(p.nowrap ? ['white-space: nowrap'] : ['white-space: normal', 'overflow-wrap: anywhere']));
    if (/^#[0-9a-f]{3,8}$/i.test(p.color || '')) r.push(`color: ${p.color}`, '-webkit-text-fill-color: currentColor');
    if (LFONTS[p.font]) r.push(`font-family: ${LFONTS[p.font]}`);
    if (p.upper === true) r.push('text-transform: uppercase');
    if (p.upper === false) r.push('text-transform: none');
    if (p.italic) r.push('font-style: italic');
    if (n(p.spacing)) r.push(`letter-spacing: ${n(p.spacing) / 10}px`);
    if (n(p.lines) > 0) r.push('display: -webkit-box', `-webkit-line-clamp: ${n(p.lines)}`, '-webkit-box-orient: vertical', 'overflow: hidden');
    if (n(p.stroke)) r.push(`-webkit-text-stroke: ${n(p.stroke)}px ${hexOk(p.strokeColor, '#000000')}`, 'paint-order: stroke fill');
    if (SHADOW_TEXT[p.shadow]) r.push(`text-shadow: ${SHADOW_TEXT[p.shadow](p.shadowColor)}`);
    else if (p.shadow === true) r.push(`text-shadow: ${SHADOW_TEXT.forte('#000000')}`);
  } else if (SHADOW_BOX[p.shadow]) filters.push(SHADOW_BOX[p.shadow](p.shadowColor));
  if (/^#[0-9a-f]{6}$/i.test(p.bg || '')) {
    const a = n(p.bgAlpha, 100) / 100;
    r.push(`background: ${/^#[0-9a-f]{6}$/i.test(p.bg2 || '') ? `linear-gradient(135deg, ${rgbaHex(p.bg, a)}, ${rgbaHex(p.bg2, a)})` : rgbaHex(p.bg, a)}`);
  }
  if (n(p.radius)) r.push(`border-radius: ${n(p.radius)}px`, 'overflow: hidden');
  if (n(p.pad)) r.push(`padding: ${n(p.pad) * 0.5}px ${n(p.pad)}px`);
  if (n(p.border)) r.push(`border: ${n(p.border)}px solid ${hexOk(p.borderColor, '#FFFFFF')}`);
  if (p.opacity !== undefined && n(p.opacity, 100) < 100) r.push(`opacity: ${n(p.opacity, 100) / 100}`);
  if (n(p.z)) r.push(`z-index: ${n(p.z)}`);
  if (n(p.blur)) filters.push(`blur(${n(p.blur)}px)`);
  if (filters.length) r.push(`filter: ${filters.join(' ')}`);
  if (n(p.rot)) r.push(`rotate: ${n(p.rot)}deg`);
  return r;
}
export function layoutCss(def, layout) {
  if (!def || layout?.mode !== 'libre' || !layout.all) return '';
  const out = [];
  const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const blocks = [['', layout.all], ...Object.entries(layout.kinds || {}).map(([k, l]) => [`[data-kind="${String(k).replace(/[^a-z]/g, '')}"]`, l])];
  // Un élément masqué pour toutes les cartes mais affiché pour un type précis doit réapparaître.
  const hiddenInAll = new Set(def.items.filter((it) => layout.all.parts?.[it.key]?.show === false).map((it) => it.key));
  for (const [ks, L] of blocks) {
    if (!L) continue;
    const card = `#root ${def.card}${ks}`;
    const c = ['display: block', 'max-width: none', 'min-width: 0', 'padding: 0', 'gap: 0', 'isolation: isolate'];
    if (!def.keepPos) c.push('position: relative');
    if (!def.noSize) c.push(`width: ${n(L.w, 560)}px`, def.grow ? `min-height: ${n(L.h, 170)}px` : `height: ${n(L.h, 170)}px`, ...(def.grow ? ['height: auto'] : ['min-height: 0']));
    if (def.zoom) c.push('font-size: 16px', 'zoom: var(--scale)');
    out.push(`${card} { ${c.map((x) => `${x} !important`).join('; ')}; }`);
    for (const f of def.flatten || []) out.push(`${card} ${f} { display: contents !important; }`);
    for (const it of def.items) {
      const p = L.parts?.[it.key];
      if (!p) continue;
      if (p.show === false) { out.push(`${card} ${it.sel} { display: none !important; }`); continue; }
      const r = partRules(it, p, n);
      if (ks && hiddenInAll.has(it.key) && !n(p.lines)) r.push(it.kind === 'box' ? 'display: grid' : 'display: block');
      out.push(`${card} ${it.sel} { ${r.map((x) => `${x} !important`).join('; ')}; }`);
      if (it.fill) out.push(`${card} ${it.sel} :is(${it.fill}) { width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; }`);
    }
  }
  return out.join('\n');
}
