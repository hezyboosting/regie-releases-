import { RankConfig } from './ranks.js';
// Galerie d'overlays : chaque carte montre l'overlay en vrai, avec activer, personnaliser, tester et copier.
// Le formulaire de réglages est généré depuis src/shared/overlay-schema.js.
import { html, useState, useEffect, useRef, act, reload, setState, copy, toast } from '../store.js';
import { ICONS, Btn, Bay, Lamp, Field, Select, Fader, Color, Segments, Lazy, Pro, PageHead, Upsell } from '../ui.js';
import { PadStudio, LiveBadge, STUDIO_KEYS } from './padstudio.js';
import { SceneEditor } from './scene.js';

const GROUP_ORDER = ['Mes overlays', 'Direct', 'Gaming', 'Entrées', 'Cadeaux et classements', 'Objectifs', 'Interactions', 'Musique', 'Outils'];

// Photo de la manette du streamer : on pose chaque zone sur le vrai bouton, à la souris.
function SkinField({ s, label, value, set, locked }) {
  const [sel, setSel] = useState('0');
  const [zones, setZones] = useState(value?.zones || s.padZones);
  const box = useRef(null);
  const drag = useRef(null);
  const pos = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(620, ((e.clientX - r.left) / r.width) * 620))), y: Math.round(Math.max(0, Math.min(420, ((e.clientY - r.top) / r.height) * 420))) };
  };
  const down = (k) => (e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = k; setSel(k); };
  const move = (e) => { if (drag.current) setZones({ ...zones, [drag.current]: { ...zones[drag.current], ...pos(e) } }); };
  const up = () => { if (drag.current) { drag.current = null; set({ ...value, zones }); } };
  const pick = async () => {
    const m = await act('importMedia', 'image');
    if (m) { setState({ media: m.media }); set({ image: m.name, zones }); }
  };
  const img = value?.image ? `http://127.0.0.1:${s.port}/media/${encodeURIComponent(value.image)}?k=${encodeURIComponent(s.overlayToken)}` : '';
  return html`<div class="field wide">
    <span class="f-label">${label}${locked ? html` <${Pro} />` : ''}</span>
    <p class="note">${label === 'Photo de ta manette' ? 'Prends ta manette en photo, vue de face, puis place chaque point sur son bouton. Ta photo reste sur ton PC.' : 'Utilisée quand Régie détecte ce type de manette.'}</p>
    <div class="row tight">
      <${Btn} disabled=${locked} onClick=${pick}>${value?.image ? 'Changer la photo' : 'Importer ma photo'}<//>
      ${value?.image && html`<${Btn} onClick=${() => set(null)}>Revenir au dessin Régie<//>`}
    </div>
    ${img && html`<div class="skin" ref=${box} onPointerMove=${move} onPointerUp=${up}>
      <img src=${img} alt="" draggable="false" />
      ${Object.entries(zones).map(([k, z]) => html`<button type="button" key=${k} class="zone ${sel === k ? 'on' : ''}" title=${s.padZoneNames[k]} aria-label=${s.padZoneNames[k]} style=${{ left: `${(z.x / 620) * 100}%`, top: `${(z.y / 420) * 100}%`, width: `${(z.r * 2 / 620) * 100}%` }} onPointerDown=${down(k)}></button>`)}
    </div>
    <div class="row tight">
      <b class="count">${s.padZoneNames[sel]}</b>
      <${Fader} value=${zones[sel].r} min="6" max="60" step="1" unit=" px" onChange=${(r) => { const next = { ...zones, [sel]: { ...zones[sel], r } }; setZones(next); set({ ...value, zones: next }); }} />
    </div>`}
  </div>`;
}

// Bibliothèque de modèles en calques : association des pièces, couleurs et suivi des droits.
function PackField({ s, overlay, value, set, locked }) {
  const pack = (s.padPacks || []).find((p) => p.id === value);
  const colors = overlay.settings.packColors || {};
  const add = async (kind) => {
    const p = await act('importPadPack', kind);
    if (!p) return;
    setState({ padPacks: [...(s.padPacks || []), p] });
    await set(p.id);
    const found = Object.keys(p.map).length;
    toast(`${found} pièce${found > 1 ? 's' : ''} reconnue${found > 1 ? 's' : ''}`);
  };
  const up = async (patch) => {
    const p = await act('updatePadPack', pack.id, patch);
    if (p) setState({ padPacks: s.padPacks.map((x) => (x.id === p.id ? p : x)) });
  };
  const paint = async (part, color) => {
    const next = { ...colors, [part]: color };
    if (!color) delete next[part];
    const r = await act('updateOverlay', overlay.id, { packColors: next });
    if (r) setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) });
  };
  const remove = async () => {
    const list = await act('removePadPack', pack.id);
    if (list) { setState({ padPacks: list }); await set(''); }
  };
  const options = [{ value: '', label: 'Dessin Régie' }, ...(s.padPacks || []).map((p) => ({ value: p.id, label: p.name }))];
  return html`<div class="field wide pack ${locked ? 'off' : ''}">
    <span class="f-label">Modèle de la bibliothèque${locked ? html` <${Pro} />` : ''}</span>
    <${Select} value=${value || ''} onChange=${set} options=${options} disabled=${locked} />
    <div class="row tight">
      <${Btn} disabled=${locked} onClick=${() => add('svg')}>Ajouter un SVG en calques<//>
      <${Btn} disabled=${locked} onClick=${() => add('png')}>Ajouter un dossier de PNG<//>
    </div>
    ${!pack && html`<p class="note">Chaque pièce doit être un calque nommé, par exemple coque, a, b, stick_l ou dpad_up. Les modèles restent sur ce PC.</p>`}
    ${pack && html`
      <span class="f-label">Droits sur ce modèle</span>
      <${Select} value=${pack.rights.status} onChange=${(status) => up({ rights: { status } })} options=${s.packRights} />
      <${Field} label="Origine ou fournisseur"><${Lazy} value=${pack.rights.source} onSave=${(source) => up({ rights: { source } })} /><//>
      <${Field} label="Référence de la licence ou de l'accord"><${Lazy} value=${pack.rights.note} onSave=${(note) => up({ rights: { note } })} /><//>
      ${pack.rights.status === 'unverified' && html`<p class="note warn">Droits à vérifier : garde ce modèle pour tes tests et ne le diffuse pas.</p>`}
      <span class="f-label">Pièces et couleurs</span>
      <div class="pack-parts">${s.packParts.map((part) => html`<div class="pack-part" key=${part.key}>
        <span>${part.label}</span>
        <${Select} aria-label=${`Calque pour ${part.label}`} value=${pack.map[part.key] || ''} onChange=${(name) => up({ map: { ...pack.map, [part.key]: name } })} options=${[{ value: '', label: 'Aucun calque' }, ...pack.names.map((n) => ({ value: n, label: n }))]} />
        ${pack.map[part.key] && html`<${Color} value=${colors[part.key] || '#FFFFFF'} onChange=${(c) => paint(part.key, c)} />`}
        ${pack.map[part.key] && colors[part.key] && html`<button type="button" class="linkish" onClick=${() => paint(part.key, '')}>Couleur d'origine</button>`}
      </div>`)}</div>
      <button type="button" class="linkish" onClick=${remove}>Retirer ce modèle</button>`}
  </div>`;
}

function FieldInput({ f, value, set, s, overlay }) {
  const locked = f.feature && !s.features[f.feature];
  if (f.type === 'padpack') return html`<${PackField} s=${s} overlay=${overlay} value=${value} set=${set} locked=${locked} />`;
  // Suivi = Rang : jeu, rangs qui sortent, chances et révélation, réglés depuis l'overlay lui-même.
  if (f.type === 'rankconfig') return html`<div class="field wide rank-inline"><${RankConfig} s=${s} compact /></div>`;
  if (f.type === 'toggle') return html`<${Lamp} on=${value} onChange=${set} label=${f.label} locked=${locked} />`;
  if (f.type === 'padskin') return html`<${SkinField} s=${s} label=${f.label} value=${value} set=${set} locked=${locked} />`;
  let body;
  if (f.type === 'color') body = html`<${Color} value=${value} onChange=${set} disabled=${locked} />`;
  else if (f.type === 'range') body = html`<${Fader} value=${value} onChange=${set} min=${f.min} max=${f.max} step=${f.step} unit=${f.unit} disabled=${locked} />`;
  else if (f.type === 'select') {
    // Choix illustrés (modèles de souris…) : mêmes cartes que l'atelier manette.
    if (f.options.some((o) => o.thumb)) {
      return html`<div class="field wide"><span class="f-label">${f.label}</span><div class="pad-models" role="radiogroup" aria-label=${f.label}>
        ${f.options.map((o) => html`<button type="button" key=${o.value} role="radio" aria-checked=${value === o.value} class="pad-model ${value === o.value ? 'on' : ''}" disabled=${locked} onClick=${() => set(o.value)}>
          <span class="pad-thumb"><img src=${o.thumb} alt="" draggable="false" /></span><b>${o.label}</b>${o.sub && html`<small>${o.sub}</small>`}
        </button>`)}
      </div></div>`;
    }
    if ((f.options.length <= 5 && f.options.some((o) => o.premium)) || f.key === 'theme') return html`<div class="field wide"><span class="f-label">${f.label}</span><${Segments} value=${value} options=${f.options} onChange=${set} locked=${locked} /></div>`;
    body = html`<${Select} value=${value} onChange=${set} options=${f.options.map((o) => ({ ...o, disabled: locked && o.premium }))} disabled=${locked && !f.options.some((o) => o.premium)} />`;
  } else if (f.type === 'goal') body = html`<${Select} value=${value} onChange=${set} options=${[{ value: '', label: 'Premier objectif' }, ...s.goals.map((g) => ({ value: g.id, label: g.title }))]} />`;
  else if (f.type === 'timer') body = html`<${Select} value=${value} onChange=${set} options=${[{ value: '', label: 'Premier minuteur' }, ...s.tools.timers.map((t) => ({ value: t.id, label: t.name }))]} />`;
  else if (f.type === 'counter') body = html`<${Select} value=${value} onChange=${set} options=${[{ value: '', label: 'Premier compteur' }, ...s.tools.counters.map((c) => ({ value: c.id, label: c.name }))]} />`;
  else if (f.type === 'gift') {
    const known = new Map([...(s.session?.byGift || []), ...s.gifts].map((g) => [g.id, g.name]));
    body = html`<${Select} value=${value} onChange=${set} options=${[{ value: '', label: 'Le plus envoyé' }, ...[...known].map(([id, name]) => ({ value: id, label: name }))]} />`;
  } else if (f.type === 'code') body = html`<${Lazy} area rows="4" value=${value} onSave=${set} disabled=${locked} spellcheck=${false} placeholder=".al-title { letter-spacing: 1px; }" />`;
  else if (f.type === 'media') {
    return html`<div class="field wide"><span class="f-label">${f.label}${locked && html` <${Pro} />`}</span><div class="row tight">
      <${Btn} disabled=${locked} onClick=${async () => { const r = await act('importMedia', f.accept); if (r) { set(r.name); setState({ media: r.media }); } }}>Importer une image<//>
      ${value && html`<${Btn} onClick=${() => set('')}>Retirer<//>`}
    </div></div>`;
  } else body = html`<${Lazy} value=${value} onSave=${set} disabled=${locked} />`;
  return html`<${Field} label=${html`${f.label}${locked && html` <${Pro} />`}`} wide=${f.type === 'code'}>${body}<//>`;
}

// Onglets de l'éditeur : chaque réglage va dans Contenu, Style, Animation ou Position.
const TABS = [['content', 'Contenu'], ['style', 'Style'], ['anim', 'Animation'], ['pos', 'Position']];
const STYLE_KEYS = new Set(['font', 'fontSize', 'bgAlpha', 'radius', 'shine', 'glow', 'theme', 'style', 'autoColor', 'showCase', 'lightFx']);
const tabOf = (f) => f.tab || (f.key === 'scale' ? 'pos' : f.key === 'customCss' ? 'style' : (f.type === 'color' || STYLE_KEYS.has(f.key)) ? 'style' : 'content');
const BACKDROPS = [['scene', 'Scène'], ['dark', 'Sombre'], ['light', 'Clair'], ['check', 'Transparent'], ['green', 'Fond vert']];

// Looks prêts : un clic pose couleurs, police et effets sur cet overlay.
// Thème de saison : celui dont la période contient le mois en cours passe en tête, avec un badge.
const inSeason = (t, m = new Date().getMonth() + 1) => Boolean(t.season) && (t.season[0] <= t.season[1] ? m >= t.season[0] && m <= t.season[1] : m >= t.season[0] || m <= t.season[1]);
const seasonFirst = (list) => [...list].sort((a, b) => inSeason(b) - inSeason(a));

function Looks({ s, overlay }) {
  const apply = async (id) => {
    const list = await act('applyTheme', id, overlay.id);
    if (list) { setState({ overlays: list }); toast('Style appliqué'); }
  };
  return html`<div class="looks" role="list" aria-label="Styles prêts">
    ${seasonFirst(s.themes).map((t) => html`<button type="button" role="listitem" key=${t.id} class="look ${overlay.settings.look === t.id ? 'on' : ''} ${inSeason(t) ? 'season' : ''}" onClick=${() => apply(t.id)}>
      <span class="look-sw" style=${{ background: `linear-gradient(135deg, ${t.swatch[1]} 0 55%, ${t.swatch[0]} 55% 100%)`, boxShadow: t.fx?.fxGlow ? `0 0 12px ${t.fx.fxGlowColor || t.swatch[0]}` : '' }}><i style=${{ background: t.swatch[2] }}></i></span>
      <b>${t.name}</b>${inSeason(t) && html`<small class="look-season">De saison</small>`}
    </button>`)}
  </div>`;
}

export function OverlayEditor({ s, overlay, compact }) {
  const def = s.overlayTypes[overlay.type];
  const [w, h] = def.size;
  const [tab, setTab] = useState('content');
  const [backdrop, setBackdrop] = useState(() => { try { return localStorage.getItem('regie.backdrop') || 'scene'; } catch { return 'scene'; } });
  const save = async (key, value) => {
    const r = await act('updateOverlay', overlay.id, { [key]: value });
    if (r) setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) });
  };
  const pickBackdrop = (b) => { setBackdrop(b); try { localStorage.setItem('regie.backdrop', b); } catch { /* aperçu seulement */ } };
  const src = `${overlay.link}&preview=1`;
  const connected = s.obs.state === 'connected';
  const studio = overlay.type === 'gamepad';
  // Un réglage peut ne s'afficher que pour certains choix d'un autre (when: { style: ['neon'] }).
  const shown = (f) => !f.when || Object.entries(f.when).every(([k, v]) => { const cur = overlay.settings[k] ?? def.fields.find((x) => x.key === k)?.default; return Array.isArray(v) ? v.includes(cur) : cur === v; });
  const fields = def.fields.filter((f) => f.type !== 'hidden' && !(studio && STUDIO_KEYS.includes(f.key)) && shown(f));
  const byTab = Object.fromEntries(TABS.map(([k]) => [k, fields.filter((f) => tabOf(f) === k)]));
  const tabs = TABS.filter(([k]) => byTab[k].length || k === 'style');
  const current = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  const reset = async () => {
    const patch = {};
    for (const f of byTab[current]) patch[f.key] = f.default;
    const r = await act('updateOverlay', overlay.id, patch);
    if (r) { setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) }); toast('Réglages de l\'onglet remis par défaut'); }
  };
  const form = html`<div class="ed-tabs" role="tablist" aria-label="Réglages">
      ${tabs.map(([k, label]) => html`<button type="button" role="tab" key=${k} aria-selected=${current === k} class="ed-tab ${current === k ? 'on' : ''}" onClick=${() => setTab(k)}>${label}</button>`)}
    </div>
    ${current === 'style' && html`<div class="ed-looks"><span class="f-label">Styles prêts en 1 clic</span><${Looks} s=${s} overlay=${overlay} /></div>`}
    <form class="ed-form" onSubmit=${(e) => e.preventDefault()}>
      ${byTab[current].map((f) => html`<${FieldInput} key=${f.key} f=${f} value=${overlay.settings[f.key] ?? f.default} set=${(v) => save(f.key, v)} s=${s} overlay=${overlay} />`)}
    </form>
    ${byTab[current].length > 0 && html`<button type="button" class="linkish ed-reset" onClick=${reset}>Remettre cet onglet par défaut</button>`}`;
  return html`<div class="editor ${compact ? 'compact' : ''} ${studio ? 'pad-editor' : ''}">
    <div class="ed-stage">
      <div class="preview-frame bd-${backdrop} ${studio ? 'pad-stage' : ''}" style=${{ aspectRatio: `${w} / ${h}` }}>
        <iframe title=${`Aperçu de ${overlay.name}`} src=${src} style=${{ width: `${w}px`, height: `${h}px`, '--w': w }} ref=${(el) => fit(el, w, h)}></iframe>
        ${studio && html`<${LiveBadge} s=${s} overlay=${overlay} />`}
      </div>
      <div class="bd-pick" role="radiogroup" aria-label="Fond de l'aperçu">
        ${BACKDROPS.map(([k, label]) => html`<button type="button" role="radio" key=${k} aria-checked=${backdrop === k} class="bd-dot bd-${k} ${backdrop === k ? 'on' : ''}" title=${label} aria-label=${label} onClick=${() => pickBackdrop(k)}></button>`)}
        <span class="note">Fond de l'aperçu (n'apparaît pas dans OBS)</span>
      </div>
      <div class="linkbar">
        <span class="link-size">${w} × ${h}</span>
        <input class="in" readOnly value=${overlay.link} aria-label="Lien de l'overlay" onFocus=${(e) => e.target.select()} />
        <${Btn} kind="primary" icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//>
      </div>
      <div class="row tight">
        <${Btn} icon=${ICONS.play} onClick=${() => act('testOverlay', overlay.type)}>Tester<//>
        ${connected && html`<${Btn} onClick=${async () => { if (await act('obsAddOverlay', overlay.id) !== undefined) toast('Overlay ajouté à la scène OBS'); }}>Ajouter à OBS<//>`}
        ${s.settings.lan && html`<${Btn} onClick=${() => copy(overlay.lanLink)}>Copier le lien réseau<//>`}
        <${Btn} onClick=${() => setState({ overlayId: null, sceneOpen: true })}>Placer sur la scène<//>
      </div>
      <p class="note">Dans OBS : Source, Navigateur, colle ce lien, en ${w} × ${h}. Dans TikTok LIVE Studio : Lien web.</p>
    </div>
    ${studio ? html`<div class="ed-side">
      <${PadStudio} s=${s} overlay=${overlay} save=${save} FieldInput=${FieldInput} />
      <${Bay} title="Style, animation et position">${form}<//>
    </div>` : html`<${Bay}>${form}<//>`}
  </div>`;
}

// L'iframe garde la taille réelle de l'overlay et se réduit pour tenir dans son cadre.
// Les overlays plus hauts que larges (souris…) sont réduits à la hauteur du cadre et centrés.
function fit(el, w, h) {
  if (!el) return;
  const apply = () => {
    const box = el.parentElement;
    if (!box) return;
    const cw = box.clientWidth, ch = box.clientHeight;
    const k = Math.min(cw / w, ch / (h || w));
    el.style.transform = `translate(${((cw - w * k) / 2).toFixed(1)}px, ${((ch - (h || w) * k) / 2).toFixed(1)}px) scale(${k})`;
  };
  apply();
  if (!el.ro) { el.ro = new ResizeObserver(apply); el.ro.observe(el.parentElement); }
}

// Aperçu vivant, chargé seulement quand la carte est à l'écran.
// Les overlays plein écran sont montrés dans une scène plus petite, pour que leur contenu reste lisible.
function CardPreview({ overlay, size }) {
  const box = useRef(null);
  const [show, setShow] = useState(false);
  const [dim, setDim] = useState(null);
  const [w, h] = size;
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setShow(e.isIntersecting), { rootMargin: '160px' });
    io.observe(box.current);
    const ro = new ResizeObserver(() => {
      const b = box.current;
      if (!b) return;
      const [cw, ch] = [b.clientWidth, b.clientHeight];
      if (w >= 1000 && h >= 600 || h >= 600 || (w >= 1900 && h < 200)) setDim({ w: cw / 0.55, h: ch / 0.55, k: 0.55 });
      else { const k = Math.min(cw / w, ch / h); setDim({ w, h, k }); }
    });
    ro.observe(box.current);
    return () => { io.disconnect(); ro.disconnect(); };
  }, [w, h]);
  return html`<div class="card-prev" ref=${box}>
    ${show && dim && html`<iframe title=${`Aperçu de ${overlay.name}`} tabindex="-1" src=${`${overlay.link}&preview=1&bare=1`} style=${{ width: `${dim.w}px`, height: `${dim.h}px`, transform: `translate(-50%, -50%) scale(${dim.k})` }}></iframe>`}
  </div>`;
}

function Card({ s, o, def }) {
  const size = o.type === 'custom' && o.settings.format === '9:16' ? [1080, 1920] : def.size;
  const toggle = async (on) => {
    const r = await act('setOverlayEnabled', o.id, on);
    if (r) setState({ overlays: s.overlays.map((x) => (x.id === o.id ? { ...x, enabled: on } : x)) });
  };
  const open = () => (o.type === 'custom' ? setState({ view: 'builder', customId: o.id }) : setState({ overlayId: o.id }));
  return html`<article class="ov-card ${o.enabled === false ? 'off' : ''}">
    <button type="button" class="card-open" aria-label=${`Personnaliser ${o.name}`} onClick=${open}><${CardPreview} overlay=${o} size=${size} /></button>
    <div class="ov-card-body">
      <div class="ov-card-title">
        <i class="led ${o.connected > 0 ? 'live' : 'stopped'}" title=${o.connected > 0 ? 'Ouvert dans ton logiciel' : 'Pas encore ouvert dans OBS'}></i>
        <b>${o.name}</b>
        <button type="button" role="switch" aria-checked=${o.enabled !== false} aria-label=${`Activer ${o.name}`} class="mini-sw ${o.enabled !== false ? 'on' : ''}" onClick=${() => toggle(o.enabled === false)}><i></i></button>
      </div>
      <p>${def.blurb}</p>
      <div class="ov-card-acts">
        <${Btn} kind="primary" onClick=${open}>Personnaliser<//>
        <${Btn} onClick=${() => act('testOverlay', o.type)}>Tester<//>
        <button type="button" class="icon" aria-label="Copier le lien" title="Copier le lien" onClick=${() => copy(o.link)}>${ICONS.copy}</button>
      </div>
    </div>
  </article>`;
}

function Customize({ s, overlay }) {
  const back = () => setState({ overlayId: null });
  return html`<div class="ov-main">
    <div class="ov-title">
      <button type="button" class="icon back" aria-label="Retour à la galerie" onClick=${back}>${ICONS.prev}</button>
      <${Lazy} value=${overlay.name} aria-label="Nom de l'overlay" onSave=${async (v) => { await act('renameOverlay', overlay.id, v); reload(); }} />
      <${Btn} onClick=${() => act('exportOverlay', overlay.id)}>Exporter<//>
      <${Btn} onClick=${async () => { const o = await act('duplicateOverlay', overlay.id); if (o) { await reload(); setState({ overlayId: o.id }); toast('Copie créée'); } }}>Dupliquer<//>
      <${Btn} kind="danger" onClick=${async () => { await act('removeOverlay', overlay.id); await reload(); back(); }}>Supprimer<//>
    </div>
    <${OverlayEditor} key=${overlay.id} s=${s} overlay=${overlay} />
  </div>`;
}

export function ThemeBar({ s, onDone }) {
  return html`<${Bay} title="Appliquer un thème à tous les overlays" aside=${onDone && html`<button class="icon" aria-label="Fermer" onClick=${onDone}>${ICONS.x}</button>`}>
    <div class="pick-list">
      ${seasonFirst(s.themes).map((t) => html`<button type="button" class="pick" key=${t.id} onClick=${async () => { if (await act('applyTheme', t.id)) { await reload(); toast(`Thème ${t.name} appliqué`); onDone?.(); } }}>
        <b>${t.name}${inSeason(t) ? html` <small class="look-season">De saison</small>` : ''}</b>
        <span class="row tight">${t.swatch.map((c) => html`<i key=${c} style=${{ width: '16px', height: '16px', borderRadius: '50%', background: c, display: 'inline-block', border: '1px solid rgba(255,255,255,.2)' }}></i>`)}</span>
      </button>`)}
    </div>
  <//>`;
}

export function Overlays({ s }) {
  const [q, setQ] = useState('');
  const [themes, setThemes] = useState(false);
  const [filter, setFilter] = useState('all');
  const scene = s.overlays.find((o) => o.type === 'scene');
  const scenev = s.overlays.find((o) => o.type === 'scenev');
  if (scenev && s.overlayId === scenev.id) return html`<${SceneEditor} key=${scenev.id} s=${s} scene=${scenev} onBack=${() => setState({ sceneOpen: false, overlayId: null })} />`;
  if (scene && (s.sceneOpen || s.overlayId === scene.id)) return html`<${SceneEditor} key=${scene.id} s=${s} scene=${scene} onBack=${() => setState({ sceneOpen: false, overlayId: null })} />`;
  const current = s.overlays.find((o) => o.id === s.overlayId && o.type !== 'custom');
  if (current) return html`<div class="page overlays"><${Customize} s=${s} overlay=${current} /></div>`;
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const groups = {};
  for (const o of s.overlays) {
    const def = s.overlayTypes[o.type];
    if (!def) continue;
    const g = o.type === 'custom' ? 'Mes overlays' : def.group;
    if (q && !norm(`${o.name} ${def.blurb} ${def.name}`).includes(norm(q))) continue;
    if (filter === 'on' && o.enabled === false) continue;
    if (filter === 'used' && !o.connected) continue;
    (groups[g] = groups[g] || []).push(o);
  }
  const names = Object.keys(groups).sort((a, b) => ((GROUP_ORDER.indexOf(a) + 1) || 99) - ((GROUP_ORDER.indexOf(b) + 1) || 99));
  return html`<div class="page overlays">
    <${PageHead} title="Overlays">
      <input class="in gal-search" type="search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Chercher un overlay" aria-label="Chercher un overlay" />
      <${Btn} onClick=${() => setState({ sceneOpen: true })}>Placer sur la scène<//>
      <${Btn} onClick=${() => setThemes(!themes)}>Thème<//>
      <${Btn} onClick=${async () => { const o = await act('importOverlay'); if (o) { await reload(); toast('Overlay importé'); } }}>Importer<//>
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${() => setState({ view: 'builder' })}>Créer le mien<//>
    <//>
    <div class="chips">
      ${[['all', 'Tous'], ['on', 'Activés'], ['used', 'Ouverts dans OBS']].map(([k, l]) => html`<button type="button" key=${k} class="chip ${filter === k ? 'on' : ''}" onClick=${() => setFilter(k)}>${l}</button>`)}
    </div>
    ${themes && html`<${ThemeBar} s=${s} onDone=${() => setThemes(false)} />`}
    ${names.map((g) => html`<section class="gal-group" key=${g}>
      <h3>${g}<small>${groups[g].length}</small></h3>
      <div class="gallery">${groups[g].map((o) => html`<${Card} key=${o.id} s=${s} o=${o} def=${s.overlayTypes[o.type]} />`)}</div>
    </section>`)}
    ${!names.length && html`<p class="note">Aucun overlay ne correspond.</p>`}
    <${Upsell}>FREE : tous les overlays standards, avec la signature Régie. PRO retire la signature et débloque les finitions.<//>
  </div>`;
}
