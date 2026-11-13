// Éditeur de scène : on pose chaque overlay à la souris sur une scène 1920 × 1080, on le déplace,
// on le redimensionne, et toute la scène sort dans une seule source navigateur (overlay « scene »).
import { html, useState, useEffect, useRef, act, setState, copy, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Num, PageHead, Select } from '../ui.js';

const SNAP = 12;
const sizeOf = (s, o) => (o.type === 'custom' && o.settings.format === '9:16' ? [1080, 1920] : s.overlayTypes[o.type]?.size || [1920, 1080]);
const media = (s, file) => (file ? `http://127.0.0.1:${s.port}/media/${encodeURIComponent(file)}?k=${encodeURIComponent(s.overlayToken)}` : '');

export function SceneEditor({ s, scene, onBack }) {
  // Scène horizontale 1920 × 1080 ou verticale 1080 × 1920 (TikTok LIVE Studio).
  const vertical = scene.type === 'scenev';
  const [SW, SH] = vertical ? [1080, 1920] : [1920, 1080];
  const other = s.overlays.find((o) => o.type === (vertical ? 'scene' : 'scenev'));
  // Disposition éditée : celle par défaut (''), ou celle d'un jeu, qui s'affiche quand ce jeu est détecté.
  const [layout, setLayout] = useState(() => s.sceneLayout || '');
  const layouts = scene.settings.layouts || {};
  const itemsFor = (g) => ((g && layouts[g]) || scene.settings.items || []).filter((it) => s.overlays.some((o) => o.id === it.id));
  const [items, setItems] = useState(() => itemsFor(s.sceneLayout || ''));
  useEffect(() => { if (s.sceneLayout) setState({ sceneLayout: '' }); }, []);
  const [sel, setSel] = useState(items[0]?.id || null);
  const [ratio, setRatio] = useState(0.4);
  const [guides, setGuides] = useState([]);
  const stage = useRef(null);
  const drag = useRef(null);
  const latest = useRef(items);
  latest.current = items;

  useEffect(() => {
    const ro = new ResizeObserver(() => { if (stage.current) setRatio(stage.current.clientWidth / SW); });
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, []);

  const persist = async (next) => {
    const patch = layout ? { layouts: { ...layouts, [layout]: next } } : { items: next };
    const r = await act('updateOverlay', scene.id, patch);
    if (r) setState({ overlays: s.overlays.map((o) => (o.id === scene.id ? { ...o, settings: r.settings } : o)) });
  };
  const update = (id, patch, save = true) => {
    const next = latest.current.map((it) => (it.id === id ? { ...it, ...patch } : it));
    setItems(next);
    if (save) persist(next);
  };
  const byId = (id) => s.overlays.find((o) => o.id === id);
  const boxOf = (it) => { const [w, h] = sizeOf(s, byId(it.id)); return { w: w * (it.k || 1), h: h * (it.k || 1) }; };

  const add = (o) => {
    const [w, h] = sizeOf(s, o);
    const k = Math.min(1, (SW * 0.6) / w, (SH * 0.7) / h);
    const it = { id: o.id, x: Math.round((SW - w * k) / 2), y: Math.round((SH - h * k) / 2), k: Math.round(k * 100) / 100, z: latest.current.length + 1 };
    const next = [...latest.current, it];
    setItems(next); setSel(o.id); persist(next);
  };
  const remove = (id) => { const next = latest.current.filter((it) => it.id !== id); setItems(next); if (sel === id) setSel(next[0]?.id || null); persist(next); };
  const layer = (id, dir) => {
    const sorted = [...latest.current].sort((a, b) => (a.z || 0) - (b.z || 0));
    const i = sorted.findIndex((it) => it.id === id);
    const j = dir > 0 ? Math.min(sorted.length - 1, i + 1) : Math.max(0, i - 1);
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const next = sorted.map((it, n) => ({ ...it, z: n + 1 }));
    setItems(next); persist(next);
  };

  // Aimantation aux bords et au centre de la scène.
  const snap = (x, y, w, h) => {
    const g = [];
    const tryAxis = (v, size, total, axis) => {
      for (const [target, edge] of [[0, 0], [total / 2, size / 2], [total, size]]) {
        if (Math.abs(v + edge - target) < SNAP) { g.push({ axis, at: target }); return target - edge; }
      }
      return v;
    };
    const nx = tryAxis(x, w, SW, 'x');
    const ny = tryAxis(y, h, SH, 'y');
    setGuides(g);
    return [Math.round(nx), Math.round(ny)];
  };

  const down = (it, mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSel(it.id);
    drag.current = { id: it.id, mode, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, k: it.k || 1, ...boxOf(it) };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / ratio, dy = (e.clientY - d.sy) / ratio;
    if (d.mode === 'move') {
      const [x, y] = snap(d.x + dx, d.y + dy, d.w, d.h);
      update(d.id, { x, y }, false);
    } else {
      const k = Math.max(0.1, Math.min(3, d.k * ((d.w + dx) / d.w)));
      update(d.id, { k: Math.round(k * 100) / 100 }, false);
    }
  };
  const up = () => { if (drag.current) { drag.current = null; setGuides([]); persist(latest.current); } };

  const key = (e) => {
    if (!sel || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const it = latest.current.find((x) => x.id === sel);
    if (!it) return;
    const step = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); update(sel, { x: it.x + moves[e.key][0], y: it.y + moves[e.key][1] }); }
    if (e.key === 'Delete') remove(sel);
  };

  const pickBackdrop = async () => {
    const m = await act('importMedia', 'image');
    if (m) { setState({ media: m.media }); const r = await act('updateOverlay', scene.id, { backdrop: m.name }); if (r) setState({ overlays: s.overlays.map((o) => (o.id === scene.id ? { ...o, settings: r.settings } : o)) }); }
  };

  const pickLayout = (g) => { setLayout(g); const list = itemsFor(g); setItems(list); setSel(list[0]?.id || null); };
  const dropLayout = async () => {
    const rest = { ...layouts };
    delete rest[layout];
    const r = await act('updateOverlay', scene.id, { layouts: rest });
    if (r) { setState({ overlays: s.overlays.map((o) => (o.id === scene.id ? { ...o, settings: r.settings } : o)) }); setItems((scene.settings.items || []).filter((it) => s.overlays.some((o) => o.id === it.id))); toast('Disposition par défaut rétablie'); }
  };
  const active = s.gameCatalog.find((g) => g.id === s.gaming.active);
  const layoutOpts = [{ value: '', label: 'Par défaut, pour tous les jeux' }, ...s.gameCatalog.filter((g) => g.id !== 'custom').map((g) => ({ value: g.id, label: layouts[g.id] ? `${g.name} · disposition propre` : g.name }))];
  const current = items.find((it) => it.id === sel);
  const placeable = s.overlays.filter((o) => o.type !== 'scene' && o.type !== 'scenev');
  const connected = s.obs.state === 'connected';
  const bg = media(s, scene.settings.backdrop);

  return html`<div class="page overlays" tabindex="-1" onKeyDown=${key}>
    <${PageHead} title="Scène complète">
      <button type="button" class="icon back" aria-label="Retour aux overlays" onClick=${onBack}>${ICONS.prev}</button>
    <//>
    <div class="row tight wrap sc-format">
      <div class="segs" role="radiogroup" aria-label="Format">
        <button type="button" role="radio" aria-checked=${!vertical} class="seg ${!vertical ? 'on' : ''}" onClick=${() => { if (vertical && other) setState({ overlayId: other.id, sceneOpen: false }); }}>Horizontale 16:9</button>
        <button type="button" role="radio" aria-checked=${vertical} class="seg ${vertical ? 'on' : ''}" onClick=${async () => { if (vertical) return; if (other) setState({ overlayId: other.id, sceneOpen: false }); else { const v = await act('autoVertical', ''); if (v) setState({ overlayId: v.id, sceneOpen: false }); } }}>Verticale 9:16</button>
      </div>
      ${vertical && html`<${Btn} onClick=${async () => { const v = await act('autoVertical', layout); if (v) { const list = ((layout && v.settings.layouts?.[layout]) || v.settings.items || []); setItems(list); setSel(list[0]?.id || null); toast('Disposition verticale générée'); } }}>Générer depuis la scène horizontale<//>`}
    </div>
    <div class="sc-layout">
      <${Field} label="Disposition"><${Select} value=${layout} onChange=${pickLayout} options=${layoutOpts} /><//>
      <p class="note">${layout ? (layouts[layout] ? 'Cette disposition s\'affiche toute seule quand ce jeu est lancé.' : 'Ce jeu reprend la disposition par défaut. Déplace ou ajoute un overlay pour lui créer la sienne.') : 'Chaque jeu peut avoir sa propre disposition, choisie toute seule quand Régie détecte le jeu.'}${active ? ` Jeu actif : ${active.name}.` : ''}</p>
      ${layout && layouts[layout] && html`<${Btn} onClick=${dropLayout}>Revenir à la disposition par défaut<//>`}
    </div>
    <p class="note sc-intro">Pose tes overlays à la souris : glisse pour déplacer, tire le coin pour agrandir, flèches du clavier pour ajuster au pixel. Dans OBS ou TikTok LIVE Studio, une seule source navigateur en ${vertical ? '1080 × 1920' : '1920 × 1080'} suffit pour tout afficher.</p>
    <div class="sc-edit">
      <div class="sc-col">
        <div class="sc-stage ${vertical ? 'vertical' : ''}" ref=${stage} style=${{ backgroundImage: bg ? `url("${bg}")` : '' }} onPointerMove=${move} onPointerUp=${up} onPointerDown=${() => setSel(null)}>
          ${items.slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map((it) => {
    const o = byId(it.id);
    if (!o) return null;
    const [w, h] = sizeOf(s, o);
    const k = it.k || 1;
    return html`<div key=${it.id} class="sc-box ${sel === it.id ? 'on' : ''} ${it.hidden ? 'off' : ''}" style=${{ left: `${it.x * ratio}px`, top: `${it.y * ratio}px`, width: `${w * k * ratio}px`, height: `${h * k * ratio}px`, zIndex: it.z || 1 }} onPointerDown=${down(it, 'move')}>
              <iframe title=${o.name} tabindex="-1" src=${`${o.link}&preview=1&bare=1`} style=${{ width: `${w}px`, height: `${h}px`, transform: `scale(${k * ratio})` }}></iframe>
              <span class="sc-name">${o.name}</span>
              <i class="sc-handle" onPointerDown=${down(it, 'scale')}></i>
            </div>`;
  })}
          ${guides.map((g) => html`<i key=${`${g.axis}${g.at}`} class="sc-guide ${g.axis}" style=${g.axis === 'x' ? { left: `${g.at * ratio}px` } : { top: `${g.at * ratio}px` }}></i>`)}
        </div>
        <div class="linkbar">
          <span class="link-size">${vertical ? '1080 × 1920' : '1920 × 1080'}</span>
          <input class="in" readOnly value=${scene.link} aria-label="Lien de la scène" onFocus=${(e) => e.target.select()} />
          <${Btn} kind="primary" icon=${ICONS.copy} onClick=${() => copy(scene.link)}>Copier le lien<//>
        </div>
        <div class="row tight">
          ${connected && html`<${Btn} onClick=${async () => { if (await act('obsAddOverlay', scene.id) !== undefined) toast('Scène ajoutée à OBS'); }}>Ajouter à OBS<//>`}
          <${Btn} onClick=${pickBackdrop}>${bg ? 'Changer le fond' : 'Fond : capture de mon jeu'}<//>
          ${bg && html`<${Btn} onClick=${async () => { const r = await act('updateOverlay', scene.id, { backdrop: '' }); if (r) setState({ overlays: s.overlays.map((o) => (o.id === scene.id ? { ...o, settings: r.settings } : o)) }); }}>Retirer le fond<//>`}
          <span class="note">Le fond sert seulement à placer, il n'apparaît pas en direct.</span>
        </div>
      </div>
      <div class="ed-side">
        ${current && html`<${Bay} title=${byId(current.id)?.name || 'Overlay'}>
          <div class="row wrap">
            <${Field} label="X"><${Num} value=${current.x} min="-1920" max="3840" onSave=${(x) => update(current.id, { x })} /><//>
            <${Field} label="Y"><${Num} value=${current.y} min="-1080" max="2160" onSave=${(y) => update(current.id, { y })} /><//>
            <${Field} label="Taille (%)"><${Num} value=${Math.round((current.k || 1) * 100)} min="10" max="300" onSave=${(v) => update(current.id, { k: v / 100 })} /><//>
          </div>
          <div class="row tight wrap">
            <${Btn} onClick=${() => { const b = boxOf(current); update(current.id, { x: Math.round((SW - b.w) / 2), y: Math.round((SH - b.h) / 2) }); }}>Centrer<//>
            <${Btn} onClick=${() => layer(current.id, 1)}>Devant<//>
            <${Btn} onClick=${() => layer(current.id, -1)}>Derrière<//>
            <${Btn} onClick=${() => update(current.id, { hidden: !current.hidden })}>${current.hidden ? 'Afficher' : 'Masquer'}<//>
            <${Btn} kind="danger" onClick=${() => remove(current.id)}>Retirer<//>
          </div>
          <button type="button" class="linkish" onClick=${() => setState({ sceneOpen: false, overlayId: current.id })}>Personnaliser cet overlay</button>
        <//>`}
        <${Bay} title="Overlays sur la scène">
          <div class="sc-list">
            ${placeable.map((o) => {
    const on = items.some((it) => it.id === o.id);
    return html`<div key=${o.id} class="sc-li ${sel === o.id ? 'on' : ''}">
                <button type="button" class="sc-li-name" disabled=${!on} onClick=${() => setSel(o.id)}>${o.name}<small>${s.overlayTypes[o.type]?.name || ''}</small></button>
                <button type="button" role="switch" aria-checked=${on} aria-label=${`${on ? 'Retirer' : 'Ajouter'} ${o.name}`} class="mini-sw ${on ? 'on' : ''}" onClick=${() => (on ? remove(o.id) : add(o))}><i></i></button>
              </div>`;
  })}
          </div>
        <//>
      </div>
    </div>
  </div>`;
}
