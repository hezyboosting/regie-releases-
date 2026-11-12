import { html, useState, act, reload, setState, fmt, copy, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Select, Text, Num, Lazy, Platforms, PageHead, Empty, Upsell } from '../ui.js';
import { Actions } from './commands.js';

const METRICS = [
  { value: 'follow', label: 'Follows' }, { value: 'sub', label: 'Abonnements et membres' }, { value: 'likes', label: 'Likes' }, { value: 'coins', label: 'Pièces TikTok' }, { value: 'gifts', label: 'Cadeaux TikTok' }, { value: 'onegift', label: 'Un cadeau précis' },
  { value: 'bits', label: 'Bits' }, { value: 'money', label: 'Super Chats (montant)' }, { value: 'shares', label: 'Partages' }, { value: 'chat', label: 'Messages' }, { value: 'viewers', label: 'Spectateurs en direct' }, { value: 'custom', label: 'Manuel' },
];

function Goal({ g, s }) {
  const up = async (patch) => { const r = await act('updateGoal', g.id, patch); if (r) setState({ goals: r }); };
  const overlay = s.overlays.find((o) => o.type === 'goal' && o.settings.goalId === g.id);
  const pct = Math.min(100, (g.current / Math.max(1, g.target)) * 100);
  return html`<li class="goal-card">
    <div class="goal-line">
      <${Lazy} value=${g.title} aria-label="Nom du goal" onSave=${(v) => up({ title: v })} />
      <b class="goal-val">${fmt(g.current)} / ${fmt(g.target)}</b>
    </div>
    <div class="thin big"><i style=${{ width: `${pct}%` }}></i></div>
    <div class="row wrap">
      <${Field} label="Compte"><${Select} value=${g.metric} onChange=${(v) => up({ metric: v })} options=${METRICS} /><//>
      <${Field} label="Valeur"><${Num} value=${g.current} min="0" onSave=${(v) => up({ current: v })} /><//>
      <${Field} label="Objectif"><${Num} value=${g.target} min="1" onSave=${(v) => up({ target: v })} /><//>
      <${Field} label="Relancer de +" hint="0 pour s'arrêter à l'objectif"><${Num} value=${g.autoStep} min="0" onSave=${(v) => up({ autoStep: v })} /><//>
      ${g.metric === 'onegift' && html`<${Field} label="Cadeau"><${Select} value=${g.giftId || ''} onChange=${(giftId) => up({ giftId })} options=${[{ value: '', label: 'Choisir' }, ...s.gifts.map((x) => ({ value: x.id, label: x.name }))]} /><//>`}
      <${Field} label="Remise à zéro"><${Select} value=${g.reset || ''} onChange=${(reset) => up({ reset })} options=${[{ value: '', label: 'Jamais' }, { value: 'live', label: 'À chaque live' }, { value: 'day', label: 'Chaque jour' }, { value: 'week', label: 'Chaque semaine' }]} /><//>
      <div class="field"><span class="f-label">Plateformes (toutes si vide)</span><${Platforms} value=${g.platforms} onChange=${(v) => up({ platforms: v })} /></div>
    </div>
    <details class="more"><summary>Récompense à l'arrivée</summary>
      <${Actions} list=${g.actions || []} s=${s} onChange=${(actions) => up({ actions })} />
    </details>
    <div class="row tight">
      <${Btn} onClick=${() => up({ current: g.current + 1 })}>Ajouter 1<//>
      <${Btn} onClick=${() => up({ current: 0 })}>Remettre à zéro<//>
      ${overlay && html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//>`}
      ${overlay && html`<${Btn} onClick=${() => setState({ view: 'overlays', overlayId: overlay.id })}>Apparence<//>`}
      <${Btn} kind="danger" onClick=${async () => { await act('removeGoal', g.id); reload(); }}>Supprimer<//>
    </div>
  </li>`;
}

export function Goals({ s }) {
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState('follow');
  const [target, setTarget] = useState(100);
  const add = async (e) => {
    e.preventDefault();
    const r = await act('addGoal', { title: title || 'Objectif', metric, target });
    if (r) { await reload(); setTitle(''); toast('Goal créé, avec son overlay'); }
  };
  const limit = s.features.goals;
  return html`<div class="page">
    <${PageHead} title="Goals"><span class="count">${s.goals.length}${limit !== -1 ? ` sur ${limit}` : ''}</span><//>
    <${Bay} title="Nouveau goal">
      <form class="row wrap" onSubmit=${add}>
        <${Field} label="Nom"><${Text} value=${title} onChange=${setTitle} placeholder="500 followers avant vendredi" /><//>
        <${Field} label="Compte"><${Select} value=${metric} onChange=${setMetric} options=${METRICS} /><//>
        <${Field} label="Objectif"><${Text} type="number" value=${target} onChange=${(v) => setTarget(Number(v))} /><//>
        <${Btn} kind="primary" type="submit">Créer le goal<//>
      </form>
    <//>
    ${s.goals.length ? html`<ul class="goals">${s.goals.map((g) => html`<${Goal} key=${g.id} g=${g} s=${s} />`)}</ul>` : html`<${Empty} title="Aucun goal">Crée un objectif : il avance tout seul avec les événements de tes chaînes.<//>`}
    ${s.goalHistory?.length > 0 && html`<${Bay} title="Goals atteints"><ul class="tool-list">${s.goalHistory.slice(0, 20).map((h, i) => html`<li key=${i}><b>${h.title}</b><span class="tagline">${fmt(h.target)}, le ${new Date(h.at).toLocaleDateString('fr-FR')}</span></li>`)}</ul><//>`}
    <${Upsell}>FREE : trois goals. PRO : autant que tu veux, avec les thèmes Anneau, Pile et Vumètre.<//>
  </div>`;
}
