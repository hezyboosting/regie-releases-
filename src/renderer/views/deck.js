// Stream Deck intégré : des boutons qui lancent des actions, avec raccourcis clavier.
import { html, useState, useEffect, act, setState, toast, copy } from '../store.js';
import { ICONS, Btn, Bay, Field, Text, Color, PageHead, Segments, Select, Pro, Upsell } from '../ui.js';
import { Actions } from './commands.js';

const uid = () => Math.random().toString(36).slice(2, 10);

function captureHotkey(e) {
  e.preventDefault();
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key.replace(/^Arrow/, '');
  parts.push(key === ' ' ? 'Space' : key);
  return parts.join('+');
}

export function Deck({ s }) {
  const [pageId, setPageId] = useState(s.deck.pages[0]?.id);
  const [edit, setEdit] = useState(false);
  const [sel, setSel] = useState(null);
  const deck = s.deck;
  useEffect(() => { if (s.deckPage) { setPageId(s.deckPage); setState({ deckPage: null }); } }, [s.deckPage]);
  const page = deck.pages.find((p) => p.id === pageId) || deck.pages[0];
  const iconUrl = (b) => `http://127.0.0.1:${s.port}/media/${encodeURIComponent(b.icon)}?k=${encodeURIComponent(s.overlayToken)}`;
  const button = page.buttons.find((b) => b.id === sel);
  const save = async (next) => {
    const r = await act('saveDeck', next);
    if (!r) return;
    setState({ deck: r.deck });
    if (r.hotkeys?.length) toast(`Raccourci déjà pris par Windows : ${r.hotkeys.join(', ')}`, 'error');
  };
  const upPage = (patch) => save({ ...deck, pages: deck.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) });
  const upBtn = (patch) => upPage({ buttons: page.buttons.map((b) => (b.id === sel ? { ...b, ...patch } : b)) });
  const add = () => {
    const b = { id: uid(), label: 'Nouveau', color: '#2A3342', hotkey: '', actions: [{ type: 'sound', sound: 'pop' }] };
    upPage({ buttons: [...page.buttons, b] });
    setSel(b.id);
    setEdit(true);
  };
  const press = (b) => { if (edit) setSel(b.id); else act('deckPress', b.id); };
  return html`<div class="page">
    <${PageHead} title="Télécommande">
      <${Btn} onClick=${() => { setEdit(!edit); setSel(null); }}>${edit ? 'Terminer' : 'Modifier'}<//>
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${add}>Nouveau bouton<//>
    <//>
    <div class="row tight">
      <${Segments} value=${page.id} onChange=${(v) => { setPageId(v); setSel(null); }} options=${deck.pages.map((p) => ({ value: p.id, label: p.name }))} />
      ${edit && html`<${Btn} onClick=${() => { const p = { id: uid(), name: `Page ${deck.pages.length + 1}`, buttons: [] }; save({ ...deck, pages: [...deck.pages, p] }); setPageId(p.id); }}>Ajouter une page<//>`}
      ${edit && deck.pages.length > 1 && html`<${Btn} kind="danger" onClick=${() => { save({ ...deck, pages: deck.pages.filter((p) => p.id !== page.id) }); setPageId(deck.pages[0].id); }}>Supprimer cette page<//>`}
    </div>
    ${edit && html`<div class="row tight">
      <${Field} label="Nom de la page"><${Text} value=${page.name} onChange=${(name) => upPage({ name })} /><//>
      <${Field} label="Page d'un jeu" hint="S'ouvre quand ce jeu démarre"><${Select} value=${page.game || ''} onChange=${(game) => upPage({ game })} options=${[{ value: '', label: 'Aucun' }, ...s.gameCatalog.map((g) => ({ value: g.id, label: g.name }))]} /><//>
    </div>`}
    <div class="deck">
      ${page.buttons.map((b) => html`<button type="button" key=${b.id} class="dbtn ${sel === b.id ? 'sel' : ''}" style=${{ '--c': b.color }} onClick=${() => press(b)}>${b.icon ? html`<img src=${iconUrl(b)} alt="" />` : ''}${b.label}${b.hotkey ? html`<small>${b.hotkey}</small>` : ''}</button>`)}
      ${!page.buttons.length && html`<button type="button" class="dbtn add" onClick=${add}>Ajouter un bouton</button>`}
    </div>
    ${edit && button && html`<${Bay} title=${button.label} aside=${html`<${Btn} kind="danger" onClick=${() => { upPage({ buttons: page.buttons.filter((b) => b.id !== sel) }); setSel(null); }}>Supprimer<//>`}>
      <div class="form-grid">
        <${Field} label="Texte"><${Text} value=${button.label} onChange=${(label) => upBtn({ label })} /><//>
        <${Field} label="Couleur"><${Color} value=${button.color} onChange=${(color) => upBtn({ color })} /><//>
        <div class="field"><span class="f-label">Icône</span><div class="row tight">
          <${Btn} disabled=${!s.features.customMedia} onClick=${async () => { const m = await act('importMedia', 'image'); if (m) { upBtn({ icon: m.name }); setState({ media: m.media }); } }}>Importer une image<//>
          ${button.icon && html`<${Btn} onClick=${() => upBtn({ icon: '' })}>Retirer<//>`}
        </div></div>
        <${Field} label="Raccourci clavier" hint="Marche même quand le jeu a le focus"><input class="in" readOnly value=${button.hotkey} placeholder="Clique puis presse les touches" onKeyDown=${(e) => { const k = captureHotkey(e); if (k) upBtn({ hotkey: k === 'Escape' || k === 'Backspace' ? '' : k }); }} /><//>
        <${Actions} list=${button.actions} s=${s} onChange=${(actions) => upBtn({ actions })} />
      </div>
    <//>`}
    <${PhonePanel} s=${s} />
    <${Upsell}>FREE : ${s.features.deckButtons} boutons. PRO : sans limite, avec la télécommande sur téléphone.<//>
  </div>`;
}

// Sur le téléphone : un QR code à scanner, en Wi-Fi. Le serveur s'ouvre au réseau local sans redémarrer Régie.
export function PhonePanel({ s }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { act('phoneLinks').then((x) => x && setP(x)); }, []);
  const toggle = async (on) => { setBusy(true); const x = await act('setLanLive', on); setBusy(false); if (x) { setP(x); setState({ settings: { ...s.settings, lan: on } }); } };
  if (!s.features.deckPhone) return html`<${Bay} title="Sur ton téléphone" aside=${html`<${Pro} />`}><p class="note">Avec PRO, scanne un QR code et pilote Régie depuis ton téléphone : boutons de la télécommande et chat de tous tes lives.</p><//>`;
  return html`<${Bay} title="Sur ton téléphone">
    ${!p?.lan ? html`<div class="col tight">
      <p class="note">Ton téléphone doit être sur le même Wi-Fi que ce PC. Régie ouvre alors la télécommande et le chat au réseau de la maison (jamais à internet).</p>
      <div class="row tight"><${Btn} kind="primary" disabled=${busy} onClick=${() => toggle(true)}>${busy ? 'Ouverture…' : 'Autoriser le téléphone'}<//></div>
      <p class="note">Si Windows demande d'autoriser Régie sur le réseau, clique sur « Autoriser ».</p>
    </div>` : html`<div class="phone-qr">
      <figure><img src=${p.deckQr} alt="QR code de la télécommande" /><figcaption><b>Télécommande</b><span>Les boutons de cette page</span><button type="button" class="linkish" onClick=${() => copy(p.deck, 'Lien copié')}>Copier le lien</button></figcaption></figure>
      <figure><img src=${p.dockQr} alt="QR code du chat" /><figcaption><b>Chat unifié</b><span>Lis et réponds au chat</span><button type="button" class="linkish" onClick=${() => copy(p.dock, 'Lien copié')}>Copier le lien</button></figcaption></figure>
      <div class="phone-help">
        <p class="note">Ouvre l'appareil photo du téléphone et vise le code. Ajoute la page à l'écran d'accueil pour la retrouver en un geste.</p>
        <p class="note">${`Adresse du PC : ${p.host}`}</p>
        <${Btn} disabled=${busy} onClick=${() => toggle(false)}>Fermer l'accès au téléphone<//>
      </div>
    </div>`}
  <//>`;
}
