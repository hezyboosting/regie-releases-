// Boutique : modèles prêts à l'emploi, création par IA, import.
import { html, useState, useEffect, useRef, act, reload, setState, toast, tr } from '../store.js';
import { ICONS, Btn, Bay, PageHead, Pro, Segments, Upsell } from '../ui.js';
import { renderElement, sampleVars } from '../../overlays/custom-render.js';

function Mini({ elements, format }) {
  const W = format === '9:16' ? 1080 : 1920;
  const box = useRef(null);
  const host = useRef(null);
  useEffect(() => {
    const fit = () => { if (host.current && box.current) host.current.style.transform = `scale(${box.current.clientWidth / W})`; };
    fit();
    host.current.textContent = '';
    // En anglais, les textes du modèle et les valeurs d'exemple passent par le dictionnaire.
    const vars = Object.fromEntries(Object.entries(sampleVars()).map(([k, v]) => [k, typeof v === 'string' ? tr(v) : v]));
    for (const e of elements) host.current.append(renderElement(e.text ? { ...e, text: tr(e.text) } : e, vars));
    const ro = new ResizeObserver(fit);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  return html`<div class="tpl-prev ${format === '9:16' ? 'portrait' : ''}" ref=${box}><div class="cstage" style=${{ width: `${W}px`, height: `${W === 1080 ? 1920 : 1080}px` }} ref=${host}></div></div>`;
}

export function Shop({ s }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState('Tous');
  const [format, setFormat] = useState('16:9');
  const cats = ['Tous', ...new Set(s.templates.map((t) => t.cat || 'Communauté'))];
  const open = async (o) => { await reload(); setState({ view: 'builder', customId: o.id }); };
  const install = async (t) => { const o = await act('installTemplate', t.id); if (o) { toast(`${t.name} ajouté à tes overlays`); open(o); } };
  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    const o = await act('aiGenerate', prompt, format);
    setBusy(false);
    if (o) { setPrompt(''); open(o); }
  };
  const canAi = s.features.aiOverlays;
  return html`<div class="page">
    <${PageHead} title="Boutique de designs">
      <${Btn} onClick=${async () => { const o = await act('importOverlay'); if (o) open(o); }}>Importer un fichier<//>
    <//>
    <${Bay} title=${html`Créer avec l'IA ${canAi ? '' : html`<${Pro} tier="ULTIMATE" />`}`}>
      <form class="ai-box" onSubmit=${generate}>
        <input class="in" value=${prompt} disabled=${!canAi || busy} onInput=${(e) => setPrompt(e.target.value)} placeholder="Un bandeau néon violet en bas, avec les spectateurs et le dernier suivi" />
        <${Btn} kind="primary" type="submit" disabled=${!canAi || busy || !prompt.trim()} icon=${ICONS.spark}>${busy ? 'Création en cours' : 'Créer l\'overlay'}<//>
      </form>
      <${Segments} value=${format} onChange=${setFormat} options=${[{ value: '16:9', label: '16:9' }, { value: '9:16', label: 'Vertical 9:16' }]} />
      <p class="note">Utilise ta propre clé API Claude, à ajouter dans Réglages, Connexions. Le résultat s'ouvre dans l'éditeur.</p>
    <//>
    <div class="chips">${cats.map((c) => html`<button type="button" key=${c} class="chip ${cat === c ? 'on' : ''}" onClick=${() => setCat(c)}>${c}</button>`)}</div>
    <div class="shop">
      ${s.templates.filter((t) => cat === 'Tous' || (t.cat || 'Communauté') === cat).map((t) => {
    const locked = t.premium && !s.features.premiumTemplates;
    return html`<article class="tpl" key=${t.id}>
          <${Mini} key=${t.id} elements=${t.elements} format=${t.format} />
          <div class="tpl-info">
            <div><b>${t.name}${t.premium ? html`<${Pro} />` : ''}</b><span>${t.blurb}</span></div>
            <${Btn} disabled=${locked} onClick=${() => install(t)}>Ajouter<//>
          </div>
        </article>`;
  })}
    </div>
    <${Upsell}>Les modèles PRO sont inclus dans PRO. La création par IA est incluse dans ULTIMATE.<//>
  </div>`;
}
