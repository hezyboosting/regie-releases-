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
    out.push(`${card} { display: block !important; position: relative !important; width: ${n(L.w, 560)}px !important; height: ${n(L.h, 170)}px !important; max-width: none !important; min-width: 0 !important; min-height: 0 !important; padding: 0 !important; gap: 0 !important; font-size: 16px !important; zoom: var(--scale); }`);
    for (const f of def.flatten || []) out.push(`${card} ${f} { display: contents !important; }`);
    for (const it of def.items) {
      const p = L.parts?.[it.key];
      if (!p) continue;
      if (p.show === false) { out.push(`${card} ${it.sel} { display: none !important; }`); continue; }
      const r = ['position: absolute', `left: ${n(p.x)}px`, `top: ${n(p.y)}px`, 'right: auto', 'bottom: auto', 'margin: 0', 'min-width: 0', 'box-sizing: border-box'];
      // Pastille (détail) : elle garde sa taille, la largeur choisie n'est qu'un maximum.
      r.push(...(it.fit ? ['width: fit-content', `max-width: ${n(p.w, 200)}px`] : [`width: ${n(p.w, 200)}px`, 'max-width: none']));
      if (it.kind === 'box') r.push(`height: ${n(p.h, 40)}px`);
      if (ks && hiddenInAll.has(it.key)) r.push(it.kind === 'box' ? 'display: grid' : 'display: block');
      if (it.kind === 'text') {
        r.push(`font-size: ${n(p.size, 20)}px`, `font-weight: ${n(p.weight, 600)}`, `text-align: ${['left', 'center', 'right'].includes(p.align) ? p.align : 'left'}`, 'line-height: 1.12', 'white-space: normal', 'overflow-wrap: anywhere');
        if (/^#[0-9a-f]{3,8}$/i.test(p.color || '')) r.push(`color: ${p.color}`);
        if (LFONTS[p.font]) r.push(`font-family: ${LFONTS[p.font]}`);
        if (p.upper) r.push('text-transform: uppercase');
        if (p.shadow) r.push('text-shadow: 0 2px 10px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.6)');
      }
      if (n(p.rot)) r.push(`rotate: ${n(p.rot)}deg`);
      out.push(`${card} ${it.sel} { ${r.map((x) => `${x} !important`).join('; ')}; }`);
      if (it.fill) out.push(`${card} ${it.sel} :is(${it.fill}) { width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; }`);
    }
  }
  return out.join('\n');
}
