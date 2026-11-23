import { RankConfig } from './ranks.js';
// Galerie d'overlays : chaque carte montre l'overlay en vrai, avec activer, personnaliser, tester et copier.
// Le formulaire de réglages est généré depuis src/shared/overlay-schema.js.
import { html, useState, useEffect, useRef, act, reload, setState, copy, toast, PLATFORM } from '../store.js';
import { brandSvg } from '../../overlays/brands.js';
import { ICONS, Btn, Bay, Lamp, Field, Select, Fader, Color, Segments, Lazy, Num, Pro, PageHead, Upsell } from '../ui.js';
import { PadStudio, LiveBadge, STUDIO_KEYS } from './padstudio.js';
import { SceneEditor } from './scene.js';
import { Inspector } from './builder.js';
import { newElement, SHAPES } from '../../overlays/custom-render.js';

const GROUP_ORDER = ['Mes overlays', 'Alertes et live', 'Cadeaux et classements', 'Jeux avec le chat', 'Objectifs et outils', 'Mon jeu et manette'];
// Catégories de la galerie : quelques familles claires plutôt que les groupes techniques des overlays.
const SHELF = { Direct: 'Alertes et live', Musique: 'Alertes et live', Interactions: 'Jeux avec le chat', Objectifs: 'Objectifs et outils', Outils: 'Objectifs et outils', Gaming: 'Mon jeu et manette', 'Entrées': 'Mon jeu et manette' };

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

// Menu des pièces : lignes « prix : action » modifiables, avec des modèles pour démarrer.
const MENU_PRESETS = [
  { id: 'gaming', label: 'Défis gaming', rows: [[1, 'Je dis ton pseudo', '👋'], [10, 'Je joue sans viser', '🙈'], [30, 'Son au choix', '🎵'], [99, 'Partie contre toi', '🎮'], [199, 'Tu choisis mon arme', '🎯'], [299, 'Je change de perso', '🧢'], [500, 'Tournoi avec le chat', '🏆'], [1000, 'Je fais ton défi', '🔥']] },
  { id: 'irl', label: 'Discussion et IRL', rows: [[1, 'Merci en direct', '💖'], [5, 'Question au choix', '❓'], [30, 'Je raconte une anecdote', '📖'], [99, 'Je danse 15 secondes', '💃'], [299, 'Je lis ton message à voix haute', '📣'], [500, 'Défi de ton choix', '🔥'], [1000, '30 minutes de live en plus', '⏰']] },
  { id: 'musique', label: 'Musique', rows: [[1, 'Je dis ton pseudo', '🎤'], [10, 'Bruitage au choix', '🥁'], [30, 'Tu choisis le prochain son', '🎵'], [99, 'Je chante un refrain', '🎶'], [299, 'Dédicace', '💌'], [1000, 'Chanson entière', '🎙️']] },
];
const rowId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function MenuRows({ value, set, s }) {
  const rows = Array.isArray(value) ? value : [];
  const [undo, setUndo] = useState(null);
  const gifts = [...(s.gifts || [])].filter((g) => Number(g.cost) > 0).sort((a, b) => a.cost - b.cost || String(a.name).localeCompare(String(b.name)));
  const save = (next) => { setUndo(null); set(next); };
  const put = (i, patch) => save(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]; save(next); };
  const add = () => { const last = rows[rows.length - 1]; save([...rows, { id: rowId(), coins: last ? Math.max(1, last.coins * 2) : 1, text: 'Nouvelle action', emoji: '⭐', gift: '' }]); };
  const preset = (id) => {
    const p = MENU_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setUndo(rows);
    set(p.rows.map(([coins, text, emoji]) => ({ id: rowId(), coins, text, emoji, gift: '' })));
  };
  // Même choix que le moteur : le premier cadeau du catalogue TikTok à ce prix (la Rose pour 1 pièce).
  const giftLabel = (r) => {
    const auto = (s.gifts || []).find((g) => Number(g.cost) === Number(r.coins));
    return auto ? `Auto : ${auto.name}` : 'Auto : cadeau à ce prix';
  };
  return html`<div class="field wide"><span class="f-label">Lignes du menu</span>
    <div class="mr-list">
      <div class="mr-head" aria-hidden="true"><span>Pièces</span><span>Emoji</span><span>Action</span><span>Cadeau (image et détection)</span><span></span></div>
      ${rows.map((r, i) => html`<div class="mr-row" key=${r.id}>
        <span class="mr-coins"><${Num} value=${r.coins} min="0" max="10000000" aria-label="Prix en pièces" title="Prix en pièces" onSave=${(v) => put(i, { coins: Math.max(0, Math.round(v) || 0) })} /></span>
        <span class="mr-emoji"><${Lazy} value=${r.emoji || ''} maxLength="12" aria-label="Emoji" placeholder="🎵" onSave=${(v) => put(i, { emoji: v })} /></span>
        <span class="mr-text"><${Lazy} value=${r.text || ''} maxLength="90" aria-label="Action" placeholder="Ce que tu fais" onSave=${(v) => put(i, { text: v })} /></span>
        <span class="mr-gift"><${Select} value=${r.gift || ''} label="Cadeau" onChange=${(v) => { const g = gifts.find((x) => String(x.id) === String(v)); put(i, g ? { gift: String(g.id), coins: Number(g.cost) } : { gift: '' }); }}
          options=${[{ value: '', label: giftLabel(r) }, ...gifts.map((g) => ({ value: String(g.id), label: `${g.name} · ${g.cost}` }))]} /></span>
        <span class="mr-tools">
          <button type="button" class="icon-btn" title="Monter" aria-label="Monter" disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button>
          <button type="button" class="icon-btn" title="Descendre" aria-label="Descendre" disabled=${i === rows.length - 1} onClick=${() => move(i, 1)}>↓</button>
          <button type="button" class="icon-btn danger" title="Supprimer" aria-label="Supprimer la ligne" onClick=${() => save(rows.filter((_, j) => j !== i))}>✕</button>
        </span>
      </div>`)}
      ${!rows.length && html`<p class="note">Aucune ligne : ajoute-en une ou pars d'un modèle.</p>`}
    </div>
    <div class="row tight mr-actions">
      <${Btn} disabled=${rows.length >= 40} onClick=${add}>Ajouter une ligne<//>
      <span class="mr-preset"><${Select} value="" label="Modèle" onChange=${preset} options=${[{ value: '', label: 'Partir d\'un modèle…' }, ...MENU_PRESETS.map((p) => ({ value: p.id, label: p.label }))]} /></span>
      ${undo && html`<button type="button" class="linkish" onClick=${() => { set(undo); setUndo(null); }}>Annuler le modèle</button>`}
    </div>
    <p class="note">Choisis un cadeau pour afficher son image et n'allumer la ligne que pour lui. Sinon, Régie prend un cadeau TikTok du même prix.</p>
  </div>`;
}

// Choix multiple en pastilles (événements, plateformes). Rien de choisi = tout : toutes les pastilles
// sont allumées ; on éteint ce qu'on ne veut pas voir. Il en reste toujours au moins une.
function PickMany({ f, value, set }) {
  const all = f.options.map((o) => o.value);
  const cur = Array.isArray(value) && value.length ? value.filter((v) => all.includes(v)) : all;
  const toggle = (v) => {
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (!next.length) { toast('Garde au moins un choix'); return; }
    set(next.length === all.length ? [] : all.filter((x) => next.includes(x)));
  };
  const isPf = f.type === 'platforms';
  return html`<div class="field wide"><span class="f-label">${f.label}${cur.length < all.length ? html` <small class="pick-count">${`${cur.length} sur ${all.length}`}</small>` : ''}</span>
    <div class="pick-many ${isPf ? 'pf-pick' : ''}" role="group" aria-label=${f.label}>
      ${f.options.map((o) => {
        const on = cur.includes(o.value);
        return isPf
          ? html`<button type="button" key=${o.value} class="pf-key ${on ? 'on' : ''}" aria-pressed=${on} style=${{ '--p': PLATFORM[o.value]?.color || '#8FD3FF' }} onClick=${() => toggle(o.value)}><span class="pf-icon" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: brandSvg(o.value, 16) }}></span>${o.label}</button>`
          : html`<button type="button" key=${o.value} class="pick-chip ${on ? 'on' : ''}" aria-pressed=${on} onClick=${() => toggle(o.value)}>${o.label}</button>`;
      })}
      ${cur.length < all.length && html`<button type="button" class="linkish" onClick=${() => set([])}>Tout</button>`}
    </div>
  </div>`;
}

function FieldInput({ f, value, set, s, overlay }) {
  const locked = f.feature && !s.features[f.feature];
  if (f.type === 'platforms' || f.type === 'events') return html`<${PickMany} f=${f} value=${value} set=${set} />`;
  if (f.type === 'menurows') return html`<${MenuRows} value=${value} set=${set} s=${s} />`;
  if (f.type === 'heading') return html`<div class="field wide ed-sub"><b>${f.label}</b>${f.hint && html`<span>${f.hint}</span>`}</div>`;
  // Forme des cartes : on choisit en voyant la silhouette.
  if (f.key === 'skShape') {
    return html`<div class="field wide"><span class="f-label">${f.label}</span><div class="sk-pick" role="radiogroup" aria-label=${f.label}>
      ${f.options.map((o) => html`<button type="button" key=${o.value} role="radio" aria-checked=${value === o.value} class="sk-opt ${value === o.value ? 'on' : ''}" onClick=${() => set(o.value)}>
        <i class="sk-mini sk-${o.value}"></i><span>${o.label}</span>
      </button>`)}
    </div></div>`;
  }
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

// ---------- Décor : formes, textes et images libres autour de n'importe quel overlay ----------
const clonej = (x) => JSON.parse(JSON.stringify(x));
const KIND_LABEL = { text: 'Texte', shape: 'Forme', image: 'Image', bar: 'Barre' };
const decorId = () => `d${Math.random().toString(36).slice(2, 9)}`;
// Un nouvel élément se pose au milieu de l'overlay, à une taille qui lui va.
function decorElement(kind, w, h, over = {}) {
  const ew = Math.round(kind === 'text' ? Math.min(420, w * 0.7) : kind === 'bar' ? Math.min(420, w * 0.7) : Math.min(260, w * 0.45));
  const eh = Math.round(kind === 'text' ? Math.min(80, h * 0.14) : kind === 'bar' ? 28 : Math.min(160, h * 0.3));
  return { ...newElement(kind), id: decorId(), x: Math.round((w - ew) / 2), y: Math.round((h - eh) / 2), w: ew, h: eh, size: Math.round(Math.min(48, eh * 0.6)), layer: kind === 'text' ? 'front' : 'back', ...over };
}
const DECOR_PRESETS = [
  { id: 'fond', label: 'Fond derrière tout', make: (w, h) => decorElement('shape', w, h, { x: 0, y: 0, w, h, radius: 28, fill: '#141022', fill2: '#2A1B55', angle: 135, opacity: 85 }) },
  { id: 'cadre', label: 'Cadre', make: (w, h) => decorElement('shape', w, h, { x: 6, y: 6, w: w - 12, h: h - 12, radius: 24, fill: 'transparent', stroke: 4, strokeColor: '#8FD3FF', glow: 14, glowColor: '#8FD3FF', layer: 'front' }) },
  { id: 'bandeau', label: 'Bandeau en bas', make: (w, h) => decorElement('shape', w, h, { shape: 'banniere', x: Math.round(w * 0.1), y: h - Math.min(90, h * 0.2) - 10, w: Math.round(w * 0.8), h: Math.min(90, Math.round(h * 0.2)), fill: '#FF3D71', fill2: '#8B3DFF', angle: 90 }) },
  { id: 'etoile', label: 'Étoile qui brille', make: (w, h) => decorElement('shape', w, h, { shape: 'etoile', w: 90, h: 90, x: w - 110, y: 16, fill: '#FFD166', glow: 18, glowColor: '#FFD166', anim: 'pulse', layer: 'front' }) },
];

// Calque posé sur l'aperçu : on attrape, déplace et redimensionne les éléments du décor.
function DecorLayer({ w, h, els, sel, setSel, preview, commit }) {
  const node = useRef(null);
  const drag = (e, id, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const item = els.find((x) => x.id === id);
    if (!item) return;
    setSel(id);
    if (item.lock) return;
    const k = node.current.getBoundingClientRect().width / w || 1;
    const start = { x: e.clientX, y: e.clientY };
    const before = clonej(els);
    let list = els;
    const onMove = (ev) => {
      const dx = (ev.clientX - start.x) / k;
      const dy = (ev.clientY - start.y) / k;
      let p;
      if (mode === 'move') p = { x: Math.round(item.x + dx), y: Math.round(item.y + dy) };
      else {
        const left = mode.includes('w');
        const top = mode.includes('n');
        const nw = Math.max(8, item.w + (left ? -dx : dx));
        const nh = Math.max(4, item.h + (top ? -dy : dy));
        p = { w: Math.round(nw), h: Math.round(nh), x: Math.round(left ? item.x + item.w - nw : item.x), y: Math.round(top ? item.y + item.h - nh : item.y) };
      }
      list = els.map((x) => (x.id === id ? { ...x, ...p } : x));
      preview(list);
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      if (list !== els) commit(list, before);
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  };
  return html`<div class="dk-layer" ref=${(el) => { node.current = el; fit(el, w, h); }} style=${{ width: `${w}px`, height: `${h}px` }}
    onPointerDown=${(e) => { if (e.target === e.currentTarget) setSel(null); }}>
    ${els.map((x) => html`<div key=${x.id} class="dk-box ${sel === x.id ? 'on' : ''} ${x.lock ? 'locked' : ''}" title=${x.kind === 'text' ? x.text : KIND_LABEL[x.kind]}
      style=${{ left: `${x.x}px`, top: `${x.y}px`, width: `${x.w}px`, height: `${x.h}px`, transform: x.rot ? `rotate(${x.rot}deg)` : '' }}
      onPointerDown=${(e) => drag(e, x.id, 'move')}>
      ${sel === x.id && !x.lock && ['nw', 'ne', 'sw', 'se'].map((c) => html`<i key=${c} class="dk-h dk-${c}" onPointerDown=${(e) => drag(e, x.id, c)}></i>`)}
    </div>`)}
  </div>`;
}

function DecorPanel({ s, w, h, els, sel, setSel, commit, undo, canUndo }) {
  const current = els.find((x) => x.id === sel);
  const up = (patch) => commit(els.map((x) => (x.id === sel ? { ...x, ...patch } : x)));
  const add = (el) => { commit([...els, el]); setSel(el.id); };
  const move = (d) => {
    const i = els.findIndex((x) => x.id === sel);
    const j = i + d;
    if (i < 0 || j < 0 || j >= els.length) return;
    const next = [...els];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  return html`<div class="dk-panel">
    <p class="note">Ajoute des formes, des textes ou des images autour de l'overlay, puis attrape-les dans l'aperçu pour les placer. Tire les coins pour la taille.</p>
    <div class="dk-add">
      <${Btn} icon=${ICONS.plus} onClick=${() => add(decorElement('shape', w, h))}>Forme<//>
      <${Btn} icon=${ICONS.plus} onClick=${() => add(decorElement('text', w, h, { text: 'Ton texte' }))}>Texte<//>
      <${Btn} icon=${ICONS.plus} onClick=${async () => { const r = await act('importMedia', 'visual'); if (r) { setState({ media: r.media }); add(decorElement('image', w, h, { src: r.name })); } }}>Image<//>
      <${Btn} icon=${ICONS.plus} onClick=${() => add(decorElement('bar', w, h, { fill: '#171230', color: '#8FD3FF', radius: 14 }))}>Barre<//>
      <span class="dk-preset"><${Select} value="" label="Idées" onChange=${(id) => { const p = DECOR_PRESETS.find((x) => x.id === id); if (p) add(p.make(w, h)); }}
        options=${[{ value: '', label: 'Idées de décor…' }, ...DECOR_PRESETS.map((p) => ({ value: p.id, label: p.label }))]} /></span>
    </div>
    <div class="layers dk-layers">
      ${[...els].reverse().map((x) => html`<button type="button" key=${x.id} class="layer ${sel === x.id ? 'on' : ''}" onClick=${() => setSel(x.id)}>
        <span>${x.lock ? 'Verrouillé : ' : ''}${x.kind === 'text' ? (x.text || 'Texte') : x.kind === 'shape' ? (SHAPES.find(([k]) => k === (x.shape || 'rect'))?.[1] || 'Forme') : KIND_LABEL[x.kind]}</span>
        <small>${x.layer === 'front' ? 'Devant' : 'Derrière'}</small>
      </button>`)}
      ${!els.length && html`<p class="note">Pas encore de décor sur cet overlay.</p>`}
    </div>
    ${current && html`<div class="row tight dk-tools">
      <${Segments} value=${current.layer === 'front' ? 'front' : 'back'} options=${[{ value: 'back', label: 'Derrière l\'overlay' }, { value: 'front', label: 'Devant' }]} onChange=${(layer) => up({ layer })} />
      <button type="button" class="icon" aria-label="Monter" title="Monter" onClick=${() => move(1)}>${ICONS.up}</button>
      <button type="button" class="icon" aria-label="Descendre" title="Descendre" onClick=${() => move(-1)}>${ICONS.down}</button>
      <button type="button" class="icon" aria-label="Dupliquer" title="Dupliquer" onClick=${() => add({ ...clonej(current), id: decorId(), x: current.x + 20, y: current.y + 20 })}>${ICONS.dup}</button>
      <button type="button" class="icon ${current.lock ? 'on' : ''}" aria-pressed=${Boolean(current.lock)} aria-label=${current.lock ? 'Déverrouiller' : 'Verrouiller'} title=${current.lock ? 'Déverrouiller' : 'Verrouiller'} onClick=${() => up({ lock: !current.lock })}>${ICONS.lock}</button>
      <button type="button" class="icon" aria-label="Supprimer" title="Supprimer" onClick=${() => { commit(els.filter((x) => x.id !== sel)); setSel(null); }}>${ICONS.trash}</button>
    </div>`}
    ${canUndo && html`<button type="button" class="linkish" onClick=${undo}>Annuler la dernière modification</button>`}
    ${current && html`<div class="dk-inspector"><${Inspector} key=${current.id} el=${current} up=${up} s=${s} insertVar=${(k) => up({ text: `${current.text || ''}{${k}}` })} /></div>`}
  </div>`;
}

// Onglets de l'éditeur : chaque réglage va dans Contenu, Style, Animation ou Position.
const TABS = [['content', 'Contenu'], ['style', 'Style'], ['decor', 'Décor'], ['anim', 'Animation'], ['pos', 'Position']];
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

// Taille réelle de l'overlay : format choisi (onglet Position) ou celle prévue pour son type.
export function overlaySizeOf(overlay, def) {
  const st = overlay?.settings || {};
  if (overlay?.type === 'custom') return st.format === '9:16' ? [1080, 1920] : [1920, 1080];
  if (st.canvas === 'perso') return [Math.max(120, Math.min(3840, Number(st.canvasW) || 800)), Math.max(60, Math.min(2160, Number(st.canvasH) || 600))];
  const m = /^(\d+)x(\d+)$/.exec(st.canvas || '');
  return m ? [Number(m[1]), Number(m[2])] : (def?.size || [1920, 1080]);
}

export function OverlayEditor({ s, overlay, compact }) {
  const def = s.overlayTypes[overlay.type];
  const [w, h] = overlaySizeOf(overlay, def);
  const [tab, setTab] = useState('content');
  const [backdrop, setBackdrop] = useState(() => { try { return localStorage.getItem('regie.backdrop') || 'scene'; } catch { return 'scene'; } });
  const save = async (key, value) => {
    const r = await act('updateOverlay', overlay.id, { [key]: value });
    if (r) setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) });
  };
  const pickBackdrop = (b) => { setBackdrop(b); try { localStorage.setItem('regie.backdrop', b); } catch { /* aperçu seulement */ } };
  // Décor : état local pour que le glisser soit fluide ; l'aperçu le reçoit tout de suite, l'enregistrement suit.
  const [decor, setDecor] = useState(() => overlay.settings.decor || []);
  const [dsel, setDsel] = useState(null);
  const frame = useRef(null);
  const undoStack = useRef([]);
  const saveT = useRef(null);
  const decorSaved = useRef(overlay.settings.decor);
  if (decorSaved.current !== overlay.settings.decor && overlay.settings.decor !== undefined) {
    // Changé ailleurs (onglet remis par défaut, autre fenêtre) : on reprend la version enregistrée.
    decorSaved.current = overlay.settings.decor;
    if (JSON.stringify(overlay.settings.decor) !== JSON.stringify(decor)) setDecor(overlay.settings.decor || []);
  }
  const previewDecor = (list) => { try { frame.current?.contentWindow?.postMessage({ regie: 'decor', decor: list }, '*'); } catch { /* aperçu pas encore chargé */ } };
  const commitDecor = (next, before) => {
    undoStack.current.push(before || clonej(decor));
    undoStack.current = undoStack.current.slice(-60);
    setDecor(next);
    previewDecor(next);
    clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      const r = await act('updateOverlay', overlay.id, { decor: next });
      if (r) { decorSaved.current = r.settings.decor; setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) }); }
    }, 400);
  };
  const undoDecor = () => { const prev = undoStack.current.pop(); if (prev) { const keep = undoStack.current; commitDecor(prev); undoStack.current = keep; } };
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
    for (const f of byTab[current]) if (f.type !== 'heading') patch[f.key] = f.default;
    const r = await act('updateOverlay', overlay.id, patch);
    if (r) { setState({ overlays: s.overlays.map((o) => (o.id === overlay.id ? { ...o, settings: r.settings } : o)) }); toast('Réglages de l\'onglet remis par défaut'); }
  };
  // Flèches, Suppr et Ctrl Z sur le décor sélectionné (onglet Décor seulement).
  useEffect(() => {
    if (current !== 'decor') return undefined;
    const onKey = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoDecor(); return; }
      const it = decor.find((x) => x.id === dsel);
      if (!it) return;
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && !it.lock) { e.preventDefault(); commitDecor(decor.map((x) => (x.id === dsel ? { ...x, x: x.x + d[0], y: x.y + d[1] } : x))); }
      if (e.key === 'Delete') { commitDecor(decor.filter((x) => x.id !== dsel)); setDsel(null); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  const form = html`<div class="ed-tabs" role="tablist" aria-label="Réglages">
      ${tabs.map(([k, label]) => html`<button type="button" role="tab" key=${k} aria-selected=${current === k} class="ed-tab ${current === k ? 'on' : ''}" onClick=${() => setTab(k)}>${label}</button>`)}
    </div>
    ${current === 'style' && html`<div class="ed-looks"><span class="f-label">Styles prêts en 1 clic</span><${Looks} s=${s} overlay=${overlay} /></div>`}
    ${current === 'decor' ? html`<${DecorPanel} s=${s} w=${w} h=${h} els=${decor} sel=${dsel} setSel=${setDsel} commit=${commitDecor} undo=${undoDecor} canUndo=${undoStack.current.length > 0} />` : html`<form class="ed-form" onSubmit=${(e) => e.preventDefault()}>
      ${byTab[current].map((f) => html`<${FieldInput} key=${f.key} f=${f} value=${overlay.settings[f.key] ?? f.default} set=${(v) => save(f.key, v)} s=${s} overlay=${overlay} />`)}
    </form>`}
    ${byTab[current].length > 0 && html`<button type="button" class="linkish ed-reset" onClick=${reset}>Remettre cet onglet par défaut</button>`}`;
  return html`<div class="editor ${compact ? 'compact' : ''} ${studio ? 'pad-editor' : ''}">
    <div class="ed-stage">
      <div class="preview-frame bd-${backdrop} ${studio ? 'pad-stage' : ''}" style=${{ aspectRatio: `${w} / ${h}` }}>
        <iframe title=${`Aperçu de ${overlay.name}`} src=${src} class=${current === 'decor' ? 'decor-on' : ''} style=${{ width: `${w}px`, height: `${h}px`, '--w': w }} ref=${(el) => { frame.current = el; fit(el, w, h); }}></iframe>
        ${current === 'decor' && html`<${DecorLayer} w=${w} h=${h} els=${decor} sel=${dsel} setSel=${setDsel} preview=${previewDecor} commit=${commitDecor} />`}
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
    el.style.setProperty('--dk-inv', String(k ? 1 / k : 1));
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
  const size = overlaySizeOf(o, def);
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
  const [cat, setCat] = useState('all');
  const scene = s.overlays.find((o) => o.type === 'scene');
  const scenev = s.overlays.find((o) => o.type === 'scenev');
  if (scenev && s.overlayId === scenev.id) return html`<${SceneEditor} key=${scenev.id} s=${s} scene=${scenev} onBack=${() => setState({ sceneOpen: false, overlayId: null })} />`;
  if (scene && (s.sceneOpen || s.overlayId === scene.id)) return html`<${SceneEditor} key=${scene.id} s=${s} scene=${scene} onBack=${() => setState({ sceneOpen: false, overlayId: null })} />`;
  const current = s.overlays.find((o) => o.id === s.overlayId && o.type !== 'custom');
  if (current) return html`<div class="page overlays"><${Customize} s=${s} overlay=${current} /></div>`;
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const groups = {};
  const counts = {};
  for (const o of s.overlays) {
    const def = s.overlayTypes[o.type];
    if (!def) continue;
    const g = o.type === 'custom' ? 'Mes overlays' : (SHELF[def.group] || def.group);
    if (q && !norm(`${o.name} ${def.blurb} ${def.name}`).includes(norm(q))) continue;
    if (filter === 'on' && o.enabled === false) continue;
    if (filter === 'used' && !o.connected) continue;
    counts[g] = (counts[g] || 0) + 1;
    if (cat !== 'all' && cat !== g) continue;
    (groups[g] = groups[g] || []).push(o);
  }
  const order = (a, b) => ((GROUP_ORDER.indexOf(a) + 1) || 99) - ((GROUP_ORDER.indexOf(b) + 1) || 99);
  const names = Object.keys(groups).sort(order);
  const cats = Object.keys(counts).sort(order);
  const total = Object.values(counts).reduce((n, x) => n + x, 0);
  return html`<div class="page overlays">
    <${PageHead} title="Mes overlays">
      <input class="in gal-search" type="search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Chercher un overlay" aria-label="Chercher un overlay" />
      <${Btn} onClick=${() => setState({ sceneOpen: true })}>Placer sur la scène<//>
      <${Btn} onClick=${() => setThemes(!themes)}>Thème<//>
      <${Btn} onClick=${async () => { const o = await act('importOverlay'); if (o) { await reload(); toast('Overlay importé'); } }}>Importer<//>
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${() => setState({ view: 'builder' })}>Créer le mien<//>
    <//>
    <div class="gal-bar">
      <div class="chips" role="tablist" aria-label="Catégories">
        <button type="button" class="chip ${cat === 'all' ? 'on' : ''}" onClick=${() => setCat('all')}>Tout<small class="chip-n">${total}</small></button>
        ${cats.map((g) => html`<button type="button" key=${g} class="chip ${cat === g ? 'on' : ''}" onClick=${() => setCat(g)}>${g}<small class="chip-n">${counts[g]}</small></button>`)}
      </div>
      <${Segments} value=${filter} onChange=${setFilter} options=${[{ value: 'all', label: 'Tous' }, { value: 'on', label: 'Activés' }, { value: 'used', label: 'Ouverts dans OBS' }]} />
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
