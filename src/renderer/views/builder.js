// Éditeur d'overlays personnalisés : glisser, redimensionner, effets, variables.
import { html, useState, useEffect, useRef, act, reload, setState, copy, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Select, Lamp, Lazy, Color, Fader, Num, PageHead, Empty, Pro, Upsell } from '../ui.js';
import { renderElement, newElement, sampleVars, VARIABLES } from '../../overlays/custom-render.js';

const KIND = { text: 'Texte', shape: 'Forme', image: 'Image', bar: 'Barre' };
const FONTS = [['geist', 'Geist'], ['syne', 'Syne'], ['archivo', 'Archivo'], ['system', 'Système'], ['serif', 'Sérif'], ['rounded', 'Arrondie'], ['impact', 'Impact']].map(([value, label]) => ({ value, label }));
const ANIMS = [['none', 'Aucune'], ['pulse', 'Pulsation'], ['float', 'Flottement'], ['breathe', 'Respiration'], ['slide', 'Entrée glissée']].map(([value, label]) => ({ value, label }));
const VAR_OPTS = VARIABLES.map(([value, label]) => ({ value, label }));

const clone = (x) => JSON.parse(JSON.stringify(x));

function Inspector({ el, up, s, insertVar }) {
  const n = (key, label, min, max, step = 1, unit = '') => html`<${Field} label=${label} wide><${Fader} value=${el[key] ?? 0} min=${min} max=${max} step=${step} unit=${unit} onChange=${(v) => up({ [key]: v })} /><//>`;
  return html`<div class="col">
    ${el.kind === 'text' && html`
      <${Field} label="Texte"><textarea class="in" rows="2" value=${el.text} onInput=${(e) => up({ text: e.target.value })}></textarea><//>
      <div class="vars">${VARIABLES.slice(0, 22).map(([k, l]) => html`<button type="button" key=${k} title=${l} onClick=${() => insertVar(k)}>${l}</button>`)}</div>
      <div class="two-in">
        <${Field} label="Police"><${Select} value=${el.font} options=${FONTS} onChange=${(font) => up({ font })} /><//>
        <${Field} label="Alignement"><${Select} value=${el.align} options=${[{ value: 'left', label: 'Gauche' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Droite' }]} onChange=${(align) => up({ align })} /><//>
      </div>
      ${n('size', 'Taille', 10, 240, 1, ' px')}${n('weight', 'Graisse', 300, 900, 100)}
      <${Field} label="Couleur"><${Color} value=${el.color} onChange=${(color) => up({ color })} /><//>
    `}
    ${(el.kind === 'shape' || el.kind === 'bar') && html`
      <div class="two-in">
        <${Field} label=${el.kind === 'bar' ? 'Rail' : 'Couleur'}><${Color} value=${el.fill === 'transparent' ? '#000000' : el.fill} onChange=${(fill) => up({ fill })} /><//>
        <${Field} label=${el.kind === 'bar' ? 'Remplissage' : 'Dégradé'}>${el.kind === 'bar' ? html`<${Color} value=${el.color} onChange=${(color) => up({ color })} />` : html`<${Color} value=${el.fill2 || el.fill} onChange=${(fill2) => up({ fill2 })} />`}<//>
      </div>
      ${el.kind === 'shape' && html`<${Lamp} on=${Boolean(el.fill2)} label="Utiliser un dégradé" onChange=${(on) => up({ fill2: on ? '#8B3DFF' : '' })} />`}
    `}
    ${el.kind === 'bar' && html`<${Field} label="Valeur"><${Select} value=${el.value} options=${VAR_OPTS} onChange=${(value) => up({ value })} /><//><${Field} label="Objectif"><${Select} value=${el.target} options=${VAR_OPTS} onChange=${(target) => up({ target })} /><//>`}
    ${el.kind === 'image' && html`<div class="row tight"><${Btn} onClick=${async () => { const r = await act('importMedia', 'visual'); if (r) { up({ src: r.name }); setState({ media: r.media }); } }}>${el.src ? 'Changer d\'image' : 'Importer une image'}<//></div>`}
    ${el.kind !== 'text' && n('radius', 'Arrondi', 0, 540, 1, ' px')}
    ${el.kind === 'shape' && n('stroke', 'Contour', 0, 30, 1, ' px')}
    ${n('opacity', 'Opacité', 0, 100, 1, ' %')}${n('rot', 'Rotation', -180, 180, 1, '°')}
    ${n('shadow', 'Ombre', 0, 60, 1, ' px')}
    ${el.shadow > 0 && html`<${Field} label="Couleur de l'ombre"><${Color} value=${el.shadowColor || '#000000'} onChange=${(shadowColor) => up({ shadowColor })} /><//>`}
    ${n('glow', 'Glow', 0, 60, 1, ' px')}
    ${el.glow > 0 && html`<${Field} label="Couleur du glow"><${Color} value=${el.glowColor} onChange=${(glowColor) => up({ glowColor })} /><//>`}
    ${n('blur', 'Blur', 0, 60, 1, ' px')}${n('backdrop', 'Flou derrière', 0, 30, 1, ' px')}
    <${Field} label="Animation"><${Select} value=${el.anim} options=${ANIMS} onChange=${(anim) => up({ anim })} /><//>
    <div class="two-in">
      <${Field} label="X"><${Num} value=${Math.round(el.x)} onSave=${(x) => up({ x })} /><//>
      <${Field} label="Y"><${Num} value=${Math.round(el.y)} onSave=${(y) => up({ y })} /><//>
      <${Field} label="Largeur"><${Num} value=${Math.round(el.w)} onSave=${(w) => up({ w })} /><//>
      <${Field} label="Hauteur"><${Num} value=${Math.round(el.h)} onSave=${(h) => up({ h })} /><//>
    </div>
  </div>`;
}

function Versions({ s, overlay, onRestore }) {
  const list = overlay.settings.versions || [];
  const on = s.features.overlayVersions;
  const sync = (o) => setState({ overlays: s.overlays.map((x) => (x.id === o.id ? { ...x, settings: o.settings } : x)) });
  return html`<${Bay} title=${html`Versions ${on ? '' : html`<${Pro} />`}`} aside=${html`<${Btn} disabled=${!on} onClick=${async () => { const o = await act('saveVersion', overlay.id); if (o) { sync(o); toast('Version enregistrée'); } }}>Enregistrer<//>`}>
    ${list.length ? html`<div class="layers">${list.map((v) => html`<button type="button" class="layer" key=${v.id} title="Revenir à cette version" onClick=${async () => { const o = await act('restoreVersion', overlay.id, v.id); if (o) { sync(o); onRestore(o.settings.elements); toast('Version restaurée'); } }}><span>${v.name}, ${new Date(v.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span></button>`)}</div>` : html`<p class="note">Garde une copie avant un gros changement.</p>`}
  <//>`;
}

function Stage({ overlay, s }) {
  const [els, setEls] = useState(overlay.settings.elements || []);
  const [sel, setSel] = useState(null);
  const [confetti, setConfetti] = useState(Boolean(overlay.settings.confetti));
  const [k, setK] = useState(0.4);
  const portrait = overlay.settings.format === '9:16';
  const W = portrait ? 1080 : 1920;
  const box = useRef(null);
  const host = useRef(null);
  const stack = useRef([]);
  const saveT = useRef(null);
  const live = useRef(els);
  live.current = els;

  const media = (v) => (/^https?:/.test(v) ? v : `http://127.0.0.1:${s.port}/media/${encodeURIComponent(v)}?k=${s.overlayToken}`);
  const persist = (next, conf = confetti) => { clearTimeout(saveT.current); saveT.current = setTimeout(() => act('saveCustom', overlay.id, next, conf), 350); };
  const commit = (next) => { stack.current.push(clone(live.current)); stack.current = stack.current.slice(-50); setEls(next); persist(next); };
  const undo = () => { const prev = stack.current.pop(); if (prev) { setEls(prev); persist(prev); } };
  const current = els.find((e) => e.id === sel);
  const up = (patch) => commit(els.map((e) => (e.id === sel ? { ...e, ...patch } : e)));
  const add = (kind) => { const e = newElement(kind); commit([...els, e]); setSel(e.id); };
  const remove = () => { commit(els.filter((e) => e.id !== sel)); setSel(null); };
  const dup = () => { const e = { ...clone(current), id: `e${Math.random().toString(36).slice(2, 9)}`, x: current.x + 30, y: current.y + 30 }; commit([...els, e]); setSel(e.id); };
  const move = (dir) => {
    const i = els.findIndex((e) => e.id === sel);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= els.length) return;
    const next = [...els];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  useEffect(() => {
    const ro = new ResizeObserver(() => { if (box.current) setK(box.current.clientWidth / W); });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const n = host.current;
    n.textContent = '';
    const vars = { ...sampleVars(), ...Object.fromEntries(Object.entries(s.vars || {}).filter(([, v]) => v)) };
    for (const e of els) n.append(renderElement(e, vars, media));
  }, [els, s.vars]);

  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (!sel) return;
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) { e.preventDefault(); const c = live.current.find((x) => x.id === sel); up({ x: c.x + d[0], y: c.y + d[1] }); }
      if (e.key === 'Delete') remove();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const drag = (e, id, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const el = els.find((x) => x.id === id);
    if (!el) return;
    setSel(id);
    if (el.lock) return;
    const start = { x: e.clientX, y: e.clientY };
    const o = { ...el };
    let moved = false;
    const before = clone(els);
    const onMove = (ev) => {
      const dx = (ev.clientX - start.x) / k;
      const dy = (ev.clientY - start.y) / k;
      moved = true;
      let p;
      if (mode === 'move') p = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
      else {
        const left = mode.includes('w');
        const top = mode.includes('n');
        const w = Math.max(20, o.w + (left ? -dx : dx));
        const h = Math.max(4, o.h + (top ? -dy : dy));
        p = { w: Math.round(w), h: Math.round(h), x: Math.round(left ? o.x + o.w - w : o.x), y: Math.round(top ? o.y + o.h - h : o.y) };
      }
      setEls((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      if (moved) { stack.current.push(before); persist(live.current); }
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  };

  const down = (e) => {
    const n = e.target.closest('.ce');
    if (n) drag(e, n.dataset.id, 'move'); else setSel(null);
  };

  const insertVar = (name) => up({ text: `${current.text}{${name}}` });
  const handles = current && html`<div class="bd-sel" style=${{ left: `${current.x * k}px`, top: `${current.y * k}px`, width: `${current.w * k}px`, height: `${current.h * k}px` }}>
    ${[['nw', 'nw'], ['ne', 'ne'], ['sw2', 'sw'], ['se', 'se']].map(([c, m]) => html`<i key=${c} class="bd-h ${c}" onPointerDown=${(e) => drag(e, current.id, m)}></i>`)}
  </div>`;

  return html`<div class="builder">
    <div class="bd-main">
      <div class="bd-tools">
        ${Object.entries(KIND).map(([kind, label]) => html`<${Btn} key=${kind} icon=${ICONS.plus} onClick=${() => add(kind)}>${label}<//>`)}
        <span style=${{ flex: 1 }}></span>
        <${Btn} onClick=${async () => { const o = await act('adaptCustom', overlay.id); if (o) { await reload(); setState({ customId: o.id }); toast('Copie adaptée créée'); } }}>Adapter en ${portrait ? '16:9' : '9:16'}<//>
        <${Btn} onClick=${undo} disabled=${!stack.current.length}>Annuler<//>
        <${Btn} kind="primary" icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//>
      </div>
      <div class="bd-stage ${portrait ? 'portrait' : ''}" ref=${box} onPointerDown=${down}>
        <div class="cstage" ref=${host} style=${{ transform: `scale(${k})`, width: `${W}px`, height: `${portrait ? 1920 : 1080}px` }}></div>
        ${handles}
      </div>
      <div class="row tight">
        <${Lamp} on=${confetti} label="Confettis à chaque alerte" onChange=${(v) => { setConfetti(v); persist(els, v); }} />
        <span class="note">Glisse les éléments, tire les coins pour redimensionner. Flèches pour ajuster, Suppr pour retirer, Ctrl Z pour annuler. Taille OBS : ${portrait ? '1080 × 1920' : '1920 × 1080'}.</span>
      </div>
    </div>
    <div class="bd-side">
      <${Bay} title="Calques">
        <div class="layers">
          ${[...els].reverse().map((e) => html`<button type="button" key=${e.id} class="layer ${sel === e.id ? 'on' : ''}" onClick=${() => setSel(e.id)}><span>${e.lock ? 'Verrouillé : ' : ''}${e.kind === 'text' ? e.text || 'Texte' : KIND[e.kind]}</span></button>`)}
          ${!els.length && html`<p class="note">Ajoute un premier élément.</p>`}
        </div>
        ${current && html`<div class="row tight">
          <button class="icon" aria-label="Monter" onClick=${() => move(1)}>${ICONS.up}</button>
          <button class="icon" aria-label="Descendre" onClick=${() => move(-1)}>${ICONS.down}</button>
          <button class="icon" aria-label="Dupliquer" onClick=${dup}>${ICONS.dup}</button>
          <button class="icon ${current.lock ? 'on' : ''}" aria-label=${current.lock ? 'Déverrouiller' : 'Verrouiller'} title=${current.lock ? 'Déverrouiller' : 'Verrouiller'} aria-pressed=${Boolean(current.lock)} onClick=${() => up({ lock: !current.lock })}>${ICONS.lock}</button>
          <button class="icon" aria-label="Supprimer" onClick=${remove}>${ICONS.trash}</button>
        </div>`}
      <//>
      <${Versions} s=${s} overlay=${overlay} onRestore=${(next) => { setEls(next); setSel(null); }} />
      ${current ? html`<${Bay} title=${KIND[current.kind]}><${Inspector} key=${current.id} el=${current} up=${up} s=${s} insertVar=${insertVar} /><//>` : html`<${Bay}><p class="note">Sélectionne un élément pour régler ses couleurs, son texte et ses effets.</p><//>`}
    </div>
  </div>`;
}

export function Builder({ s }) {
  const list = s.overlays.filter((o) => o.type === 'custom');
  const current = list.find((o) => o.id === s.customId) || list[0];
  const limit = s.features.customOverlays;
  const create = async (format) => {
    const o = await act('addCustomOverlay', 'Mon overlay', [], format);
    if (o) { await reload(); setState({ customId: o.id }); }
  };
  return html`<div class="page" style=${{ maxWidth: 'none' }}>
    <${PageHead} title="Éditeur">
      <span class="count">${limit === -1 ? `${list.length} overlays` : `${list.length} sur ${limit} emplacements`}</span>
      ${list.length > 0 && html`<select class="in" aria-label="Overlay à modifier" value=${current?.id} onChange=${(e) => setState({ customId: e.target.value })}>${list.map((o) => html`<option value=${o.id}>${o.name}</option>`)}</select>`}
      ${current && html`<${Btn} onClick=${() => act('exportOverlay', current.id)}>Exporter<//>`}
      ${current && html`<${Btn} kind="danger" onClick=${async () => { await act('removeOverlay', current.id); await reload(); setState({ customId: null }); }}>Supprimer<//>`}
      <${Btn} onClick=${() => setState({ view: 'shop' })}>Modèles<//>
      <${Btn} onClick=${() => create('9:16')}>Nouveau vertical<//>
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${() => create('16:9')}>Nouvel overlay<//>
    <//>
    ${current ? html`
      <div class="ov-title"><${Lazy} value=${current.name} aria-label="Nom de l'overlay" onSave=${async (v) => { await act('renameOverlay', current.id, v); reload(); }} /></div>
      <${Stage} key=${current.id} overlay=${current} s=${s} />
    ` : html`<${Bay}><${Empty} title="Compose ton propre overlay">Pars d'une page vide ou d'un modèle de la boutique. Textes, formes, images, barres et effets : tout se place à la souris.<//><div class="row tight" style=${{ justifyContent: 'center' }}><${Btn} kind="primary" onClick=${() => create('16:9')}>Créer un overlay<//><${Btn} onClick=${() => setState({ view: 'shop' })}>Voir les modèles<//></div><//>`}
    <${Upsell}>FREE : ${s.features.customOverlays} emplacements. PRO : sans limite, avec les versions et les modèles PRO. ULTIMATE ajoute la création par IA.<//>
  </div>`;
}
void toast; void Pro;
