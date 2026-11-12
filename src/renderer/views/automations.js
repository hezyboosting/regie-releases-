// Automatisations : SI un événement, ET des conditions, ALORS des actions, avec délais et combos.
import { html, useState, useEffect, act, setState, toast, copy, reload } from '../store.js';
import { ICONS, Btn, Bay, Field, Select, Num, Text, Platforms, Lamp, PageHead, Empty, Pro, Upsell } from '../ui.js';
import { Actions } from './commands.js';

const FIELDS = [{ value: 'amount', label: 'Le montant' }, { value: 'count', label: 'Le nombre' }, { value: 'months', label: 'Les mois d\'abonnement' }, { value: 'user', label: 'Le pseudo' }, { value: 'platform', label: 'La plateforme' }, { value: 'text', label: 'Le message' }, { value: 'gift', label: 'Le cadeau' }, { value: 'role', label: 'Le rôle' }];
const OPS = [{ value: '>=', label: 'au moins' }, { value: '<=', label: 'au plus' }, { value: '==', label: 'égal à' }, { value: '!=', label: 'différent de' }, { value: 'contains', label: 'contient' }];
const GAME_KINDS = [{ value: '', label: 'Tout événement de jeu' }, { value: 'win', label: 'Victoire' }, { value: 'loss', label: 'Défaite' }, { value: 'kill', label: 'Kill' }, { value: 'death', label: 'Mort' }, { value: 'goal', label: 'But' }, { value: 'save', label: 'Arrêt' }, { value: 'mvp', label: 'MVP' }, { value: 'start', label: 'Début de partie' }, { value: 'end', label: 'Fin de partie' }];

export const EVENTS = (s) => [
  ...Object.entries(s.eventTypes).filter(([k]) => k !== 'goal').map(([value, d]) => ({ value, label: d.label })),
  { value: 'goalReached', label: 'Goal atteint' }, { value: 'game', label: 'Événement de jeu' }, { value: 'custom', label: 'Événement personnalisé' },
  { value: 'interval', label: 'Toutes les X minutes' }, { value: 'manual', label: 'Lancement manuel' }, { value: 'webhook', label: 'Appel d\'un webhook', disabled: !s.features.webhooks },
];

const TEMPLATES = [
  { name: 'Merci à chaque follow', on: { type: 'follow' }, actions: [{ type: 'chat', text: 'Merci {user} !' }] },
  { name: 'Gros cadeau', on: { type: 'gift', minAmount: 1000 }, actions: [{ type: 'overlayFx' }, { type: 'sound', sound: 'fanfare' }] },
  { name: 'Victoire', on: { type: 'game', kind: 'win' }, actions: [{ type: 'sound', sound: 'fanfare' }, { type: 'chat', text: 'Victoire ! Record : {record}' }] },
  { name: 'Rappel Discord', on: { type: 'interval', minutes: 20 }, actions: [{ type: 'chat', text: 'Rejoins le Discord !' }] },
  { name: 'Cinq follows en une minute', on: { type: 'follow', count: 5, seconds: 60 }, actions: [{ type: 'overlayFx' }, { type: 'alert', text: 'Vous êtes en feu !' }] },
];

function Conditions({ list = [], onChange, adv }) {
  const up = (i, patch) => onChange(list.map((c, j) => (i === j ? { ...c, ...patch } : c)));
  return html`<div class="field wide"><span class="f-label">ET si</span>
    ${list.map((c, i) => html`<div class="action" key=${i}>
      <${Select} value=${c.field} options=${FIELDS} onChange=${(field) => up(i, { field })} />
      <${Select} value=${c.op} options=${OPS} onChange=${(op) => up(i, { op })} />
      <${Text} value=${c.value} onChange=${(value) => up(i, { value })} placeholder="Valeur" />
      <button type="button" class="icon" aria-label="Retirer cette condition" onClick=${() => onChange(list.filter((_, j) => j !== i))}>${ICONS.x}</button>
    </div>`)}
    <div class="row tight">
      <${Btn} disabled=${!adv && list.length >= 1} onClick=${() => onChange([...list, { field: 'amount', op: '>=', value: '' }])}>Ajouter une condition<//>
      ${!adv && html`<span class="note">Une condition en FREE. <${Pro} /></span>`}
    </div>
  </div>`;
}

function TriggerForm({ initial, s, onClose }) {
  const [t, set] = useState(initial);
  const up = (patch) => set({ ...t, ...patch });
  const on = (patch) => up({ on: { ...t.on, ...patch } });
  const adv = s.features.automationAdvanced;
  const type = t.on.type;
  const noFilter = ['interval', 'manual', 'webhook', 'custom', 'game', 'goalReached'].includes(type);
  const save = async (e) => {
    e.preventDefault();
    const r = await act('saveTrigger', t);
    if (r) { setState({ triggers: r }); toast('Automatisation enregistrée'); onClose(); }
  };
  return html`<${Bay} title=${t.name || 'Nouvelle automatisation'} aside=${html`<button class="icon" aria-label="Fermer" onClick=${onClose}>${ICONS.x}</button>`}>
    <form class="form-grid auto-form" onSubmit=${save}>
      <${Field} label="Nom"><${Text} value=${t.name} onChange=${(name) => up({ name })} /><//>
      <${Field} label="Attente entre deux lancements (s)"><${Num} value=${t.cooldown} min="0" onSave=${(cooldown) => up({ cooldown })} /><//>
      <div class="auto-step si"><b>SI</b>
        <${Field} label="Événement"><${Select} value=${type} onChange=${(v) => on({ type: v })} options=${EVENTS(s)} /><//>
        ${type === 'interval' && html`<${Field} label="Toutes les (minutes)"><${Num} value=${t.on.minutes || 10} min="1" onSave=${(minutes) => on({ minutes })} /><//>`}
        ${type === 'game' && html`<${Field} label="Dans le jeu"><${Select} value=${t.on.kind || ''} options=${GAME_KINDS} onChange=${(kind) => on({ kind })} /><//>`}
        ${type === 'custom' && html`<${Field} label="Nom de l'événement"><${Text} value=${t.on.name} onChange=${(name) => on({ name })} /><//>`}
        ${type === 'chat' && html`<${Field} label="Le message commence par"><${Text} value=${t.on.word} onChange=${(word) => on({ word })} placeholder="!mot" /><//>`}
        ${!noFilter && html`<${Field} label="Montant minimum"><${Num} value=${t.on.minAmount || 0} min="0" onSave=${(minAmount) => on({ minAmount })} /><//>`}
        ${type === 'gift' && html`<${Field} label=${html`Cadeau précis ${!s.features.giftTriggers ? html`<${Pro} />` : ''}`}><${Select} value=${t.on.giftId || ''} disabled=${!s.features.giftTriggers} onChange=${(giftId) => on({ giftId })} options=${[{ value: '', label: 'Tous les cadeaux' }, ...s.gifts.map((g) => ({ value: g.id, label: `${g.name} (${g.cost})` }))]} /><//>`}
        ${!noFilter && html`<${Field} label=${html`Combo : répété ${!adv ? html`<${Pro} />` : ''}`} hint="0 pour une seule fois"><${Num} value=${t.on.count || 0} min="0" disabled=${!adv} onSave=${(count) => on({ count })} /><//>`}
        ${!noFilter && t.on.count > 1 && html`<${Field} label="En (secondes)"><${Num} value=${t.on.seconds || 30} min="1" onSave=${(seconds) => on({ seconds })} /><//>`}
        ${!noFilter && html`<div class="field wide"><span class="f-label">Plateformes (toutes si vide)</span><${Platforms} value=${t.on.platforms} onChange=${(platforms) => on({ platforms })} /></div>`}
        ${type === 'webhook' && t.id && html`<div class="field wide"><span class="f-label">Adresse à appeler</span><${Btn} onClick=${async () => { const l = await act('hookLink', t.id); if (l) copy(l, 'Adresse copiée'); }}>Copier l'adresse du webhook<//></div>`}
      </div>
      <div class="auto-step et"><${Conditions} list=${t.conditions} adv=${adv} onChange=${(conditions) => up({ conditions })} /></div>
      <div class="auto-step alors"><b>ALORS</b><${Actions} list=${t.actions} s=${s} delays onChange=${(actions) => up({ actions })} /></div>
      <div class="row tight wide"><${Btn} kind="primary" type="submit">Enregistrer l'automatisation<//></div>
    </form>
  <//>`;
}

const NEW = { name: '', enabled: true, cooldown: 0, conditions: [], on: { type: 'follow', platforms: [], minAmount: 0, giftId: '' }, actions: [{ type: 'chat', text: 'Merci {user} !' }] };

export function Automations({ s }) {
  const [edit, setEdit] = useState(s.newTrigger ? { ...NEW, ...s.newTrigger } : null);
  const f = s.features;
  useEffect(() => { if (s.newTrigger) setState({ newTrigger: null }); }, []);
  const change = async (t) => { const r = await act('saveTrigger', t); if (r) setState({ triggers: r }); };
  const label = (t) => EVENTS(s).find((x) => x.value === t.on.type)?.label || 'Événement';
  return html`<div class="page">
    <${PageHead} title="Automatisations">
      <span class="count">${s.triggers.length}${f.triggers !== -1 ? ` sur ${f.triggers}` : ''}</span>
      <${Btn} onClick=${() => act('automationsExport')}>Exporter<//>
      <${Btn} onClick=${async () => { const r = await act('automationsImport'); if (r) { setState({ triggers: r }); toast('Automatisations importées'); await reload(); } }}>Importer<//>
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${() => setEdit({ ...NEW })}>Nouvelle automatisation<//>
    <//>
    ${edit && html`<${TriggerForm} key=${edit.id || edit.name || 'new'} initial=${edit} s=${s} onClose=${() => setEdit(null)} />`}
    ${!edit && html`<div class="chips">
      <span class="f-label">Partir d'un modèle</span>
      ${TEMPLATES.map((t) => html`<button type="button" class="chip" key=${t.name} onClick=${() => setEdit({ ...NEW, ...t, on: { ...NEW.on, ...t.on } })}>${t.name}</button>`)}
    </div>`}
    <${Bay}>
      ${s.triggers.length ? html`<ul class="rules">
        ${s.triggers.map((t) => html`<li class="rule ${t.enabled ? '' : 'off'}" key=${t.id}><div class="rule-line">
          <${Lamp} on=${t.enabled} onChange=${(enabled) => change({ ...t, enabled })} label=${t.name || label(t)} />
          <p class="rule-msg">SI ${label(t)}${t.conditions?.length ? `, ${t.conditions.length} condition${t.conditions.length > 1 ? 's' : ''}` : ''}, ALORS ${t.actions.length} action${t.actions.length > 1 ? 's' : ''}</p>
          ${t.on.type === 'manual' && html`<${Btn} onClick=${() => act('fireTrigger', t.id)}>Lancer<//>`}
          <${Btn} onClick=${() => setEdit(t)}>Modifier<//>
          <${Btn} kind="danger" onClick=${async () => { const r = await act('removeTrigger', t.id); if (r) setState({ triggers: r }); }}>Supprimer<//>
        </div></li>`)}
      </ul>` : html`<${Empty} title="Aucune automatisation">Fais réagir ton live tout seul : un son à chaque follow, une scène OBS sur un gros cadeau, un message après une victoire.<//>`}
    <//>
    <${Upsell}>FREE : ${f.triggers} automatisations avec une condition. PRO ajoute les délais, les combos et les conditions multiples.<//>
  </div>`;
}
