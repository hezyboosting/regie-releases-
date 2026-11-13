import { html, useState, useEffect, act, setState, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Select, Lazy, Segments, PageHead, Empty } from '../ui.js';

const BUILTIN = [['chime', 'Carillon'], ['pop', 'Pop'], ['coins', 'Pièces'], ['fanfare', 'Fanfare'], ['horn', 'Corne'], ['tally', 'Top antenne'], ['drumroll', 'Roulement de tambour'], ['ding', 'Ding']];

export const soundOptions = (s) => [...BUILTIN.map(([value, label]) => ({ value, label })), ...s.sounds.library.map((x) => ({ value: x.file, label: x.name }))];

function AutoSound({ s }) {
  const [type, setType] = useState('gift');
  const [gift, setGift] = useState('');
  const [sound, setSound] = useState('fanfare');
  const types = Object.entries(s.eventTypes).filter(([k]) => k !== 'goal').map(([value, d]) => ({ value, label: d.label }));
  const add = async () => {
    const giftName = s.gifts.find((g) => g.id === gift)?.name;
    const label = s.eventTypes[type].label;
    const r = await act('saveTrigger', { name: `Son : ${giftName || label}`, on: { type, platforms: [], minAmount: 0, giftId: type === 'gift' ? gift : '' }, actions: [{ type: 'sound', sound, volume: 80 }] });
    if (r) { setState({ triggers: r }); toast('Son automatique ajouté'); }
  };
  const auto = s.triggers.filter((t) => t.actions.length === 1 && t.actions[0].type === 'sound');
  const label = (v) => soundOptions(s).find((o) => o.value === v)?.label || v;
  return html`<${Bay} title="Sons automatiques">
    <div class="row wrap">
      <${Field} label="Quand"><${Select} value=${type} options=${types} onChange=${setType} /><//>
      ${type === 'gift' && html`<${Field} label="Cadeau"><${Select} value=${gift} onChange=${setGift} options=${[{ value: '', label: 'Tous les cadeaux' }, ...s.gifts.map((g) => ({ value: g.id, label: g.name }))]} /><//>`}
      <${Field} label="Jouer"><${Select} value=${sound} options=${soundOptions(s)} onChange=${setSound} /><//>
      <${Btn} kind="primary" onClick=${add}>Ajouter<//>
    </div>
    <ul class="rules">
      ${auto.map((t) => html`<li class="rule" key=${t.id}><div class="rule-line"><b style=${{ flex: 1 }}>${t.name}</b><span class="tagline">${label(t.actions[0].sound)}</span><${Btn} kind="danger" onClick=${async () => { const r = await act('removeTrigger', t.id); if (r) setState({ triggers: r }); }}>Retirer<//></div></li>`)}
    </ul>
  <//>`;
}

export function Sounds({ s }) {
  const lib = s.sounds.library;
  const set = (r) => r && setState({ sounds: { ...r } });
  const [cat, setCat] = useState('');
  const [devices, setDevices] = useState([]);
  useEffect(() => { navigator.mediaDevices?.enumerateDevices().then((l) => setDevices(l.filter((d) => d.kind === 'audiooutput'))).catch(() => {}); }, []);
  const shown = lib.filter((x) => !cat || x.category === cat);
  return html`<div class="page">
    <${PageHead} title="Sons">
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${async () => set(await act('addSound'))}>Importer des sons<//>
    <//>
    <${AutoSound} s=${s} />
    <div class="two">
      <${Bay} title="Sons de Régie">
        <div class="row tight">${BUILTIN.map(([k, l]) => html`<${Btn} key=${k} icon=${ICONS.play} onClick=${() => act('playSound', k, 80)}>${l}<//>`)}</div>
      <//>
      <${Bay} title="Où jouer les sons">
        <${Segments} value=${s.sounds.output} onChange=${async (v) => set(await act('setSoundOutput', v))} options=${[{ value: 'app', label: 'Sortie du PC' }, { value: 'overlay', label: 'Overlay Alertes' }]} />
        <p class="note">${s.sounds.output === 'app' ? 'Le son sort de ton PC, comme un jeu. OBS le capte avec ton audio de bureau.' : 'Le son passe par l\'overlay Alertes, pour le régler à part dans OBS.'}</p>
        ${s.sounds.output === 'app' && devices.length > 1 && html`<${Field} label="Sortie audio"><${Select} value=${s.sounds.device || ''} onChange=${async (device) => set(await act('setSoundCfg', { device }))} options=${[{ value: '', label: 'Sortie par défaut' }, ...devices.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications').map((d) => ({ value: d.deviceId, label: d.label || 'Sortie audio' }))]} /><//>`}
      <//>
    </div>
    <${Bay} title="Ma bibliothèque">
      <div class="chips">
        <button type="button" class="chip ${cat === '' ? 'on' : ''}" onClick=${() => setCat('')}>Tous</button>
        ${s.sounds.categories.map((c) => html`<button type="button" key=${c} class="chip ${cat === c ? 'on' : ''}" onClick=${() => setCat(c)}>${c}</button>`)}
      </div>
      ${lib.length ? html`<ul class="tool-list">${shown.map((x) => html`<li key=${x.id}>
        <button class="icon" aria-label=${`Écouter ${x.name}`} onClick=${() => act('playSound', x.file, 80)}>${ICONS.play}</button>
        <${Lazy} value=${x.name} aria-label="Nom du son" onSave=${async (name) => set(await act('renameSound', x.id, name))} />
        <${Select} value=${x.category || ''} onChange=${async (category) => set(await act('setSoundField', x.id, { category }))} options=${[{ value: '', label: 'Sans catégorie' }, ...s.sounds.categories.map((c) => ({ value: c, label: c }))]} />
        <button class="icon" aria-label="Supprimer" onClick=${async () => set(await act('removeSound', x.id))}>${ICONS.trash}</button>
      </li>`)}</ul>` : html`<${Empty} title="Aucun son importé">Ajoute tes MP3 ou WAV : ils seront disponibles dans les alertes, les automatisations et la télécommande.<//>`}
    <//>
  </div>`;
}
