import { html, useState, act, setState, toast } from '../store.js';
import { ICONS, Btn, Bay, Lamp, Field, Select, Num, Lazy, Platforms, PageHead, Pro, Upsell, go } from '../ui.js';
import { soundOptions } from './sounds.js';



const THEMES = [{ value: 'verre', label: 'Pastille de verre' }, { value: 'carte', label: 'Carte de verre' }, { value: 'minimal', label: 'Texte seul', premium: true }];
const POS = [{ value: 'top-left', label: 'Haut gauche' }, { value: 'top-center', label: 'Haut centre' }, { value: 'top-right', label: 'Haut droite' }, { value: 'center', label: 'Centre' }, { value: 'bottom-left', label: 'Bas gauche' }, { value: 'bottom-center', label: 'Bas centre' }, { value: 'bottom-right', label: 'Bas droite' }];

const VARS = {
  follow: '{user}', sub: '{user}', resub: '{user} {months} {tier}', giftsub: '{user} {amount}', bits: '{user} {amount} {text}', raid: '{user} {amount}', redeem: '{user} {reward} {text}',
  superchat: '{user} {money} {text}', supersticker: '{user} {money}', milestone: '{user} {months}', gift: '{user} {amount} {gift}', like: '{total}', goal: '{reward}',
};

function Rule({ r, s, def }) {
  const [open, setOpen] = useState(false);
  const up = async (patch) => { const a = await act('updateRule', r.id, patch); if (a) setState({ alerts: a }); };
  const custom = s.features.alertRulesCustom;
  const test = () => act('simulate', r.type === 'goal' ? 'follow' : r.type, r.platforms?.[0] || 'twitch');
  return html`<li class="rule ${r.enabled ? '' : 'off'}">
    <div class="rule-line">
      <${Lamp} on=${r.enabled} onChange=${(v) => up({ enabled: v })} label=${def?.label || r.type} />
      <p class="rule-msg">${r.message}</p>
      ${!r.base && html`<span class="tagline">dès ${r.minAmount}</span>`}
      <${Btn} onClick=${test}>Tester<//>
      <${Btn} onClick=${() => setOpen(!open)} title="Régler cette alerte">${open ? 'Fermer' : 'Régler'}<//>
    </div>
    ${open && html`<div class="rule-edit">
      <${Field} label="Message" wide hint=${`Variables : ${VARS[r.type] || '{user}'}`}><${Lazy} value=${r.message} onSave=${(v) => up({ message: v })} /><//>
      <${Field} label="Son"><${Select} value=${r.sound} onChange=${(v) => up({ sound: v })} options=${[...soundOptions(s), { value: 'none', label: 'Aucun son' }]} /><//>
      <${Field} label="Volume"><${Num} value=${r.volume} min="0" max="100" onSave=${(v) => up({ volume: v })} /><//>
      <${Field} label="Durée (secondes)"><${Num} value=${r.duration} min="2" max="60" onSave=${(v) => up({ duration: v })} /><//>
      ${r.type === 'like' ? html`<${Field} label="Tous les … likes"><${Num} value=${r.every} min="10" onSave=${(v) => up({ every: v })} /><//>` : html`<${Field} label="Montant minimum"><${Num} value=${r.minAmount} min="0" onSave=${(v) => up({ minAmount: v })} /><//>`}
      <div class="field"><span class="f-label">Plateformes</span><${Platforms} value=${r.platforms} onChange=${(v) => up({ platforms: v })} /></div>
      <${Lamp} on=${r.tts} onChange=${(v) => up({ tts: v })} label="Lire à voix haute" />
      <${Field} label="Thème de cette alerte"><${Select} value=${r.theme || ''} onChange=${(theme) => up({ theme })} options=${[{ value: '', label: 'Celui de l\'overlay' }, ...THEMES.map((o) => ({ ...o, disabled: o.premium && !s.features.overlayThemes }))]} /><//>
      <${Field} label="Position"><${Select} value=${r.position || ''} onChange=${(position) => up({ position })} options=${[{ value: '', label: 'Celle de l\'overlay' }, ...POS]} /><//>
      ${r.type !== 'like' && html`<${Field} label="Une alerte tous les" hint="1 pour toutes"><${Num} value=${r.every || 1} min="1" onSave=${(every) => up({ every })} /><//>`}
      ${s.features.alertVariants ? html`<${Field} label="Combo : si répété" hint="0 pour désactiver"><${Num} value=${r.comboCount || 0} min="0" onSave=${(comboCount) => up({ comboCount })} /><//>` : ''}
      ${r.comboCount > 0 && html`<${Field} label="En (secondes)"><${Num} value=${r.comboSeconds || 30} min="1" onSave=${(comboSeconds) => up({ comboSeconds })} /><//>`}
      <div class="field">
        <span class="f-label">Image, GIF ou vidéo${!s.features.customMedia && html` <${Pro} />`}</span>
        <div class="row tight">
          <${Btn} disabled=${!s.features.customMedia} onClick=${async () => { const m = await act('importMedia', 'visual'); if (m) { up({ image: m.name }); setState({ media: m.media }); } }}>Importer un fichier<//>
          ${r.image && html`<${Btn} onClick=${() => up({ image: '' })}>Retirer<//>`}
        </div>
      </div>
      <div class="row tight">
        <${Btn} disabled=${!custom} onClick=${async () => { const a = await act('addRule', r.type, r.id); if (a) { setState({ alerts: a }); toast('Alerte supplémentaire ajoutée'); } }}>Ajouter un palier${!custom ? html` <${Pro} />` : ''}<//>
        ${!r.base && html`<${Btn} kind="danger" onClick=${async () => { const a = await act('removeRule', r.id); if (a) setState({ alerts: a }); }}>Supprimer ce palier<//>`}
      </div>
    </div>`}
  </li>`;
}

export function Alerts({ s }) {
  const [filter, setFilter] = useState('all');
  const rules = s.alerts.rules.filter((r) => filter === 'all' || r.platforms?.includes(filter));
  const overlay = s.overlays.find((o) => o.type === 'alerts');
  return html`<div class="page">
    <${PageHead} title="Alertes">
      <${Lamp} on=${!s.alerts.paused} label="Alertes actives" onChange=${async (on) => { const a = await act('setAlertsPaused', !on); if (a) setState({ alerts: a }); }} />
      <${Btn} onClick=${() => { setState({ view: 'overlays', overlayId: overlay?.id }); }}>Apparence et lien<//>
    <//>
    <div class="segs">
      ${[['all', 'Toutes'], ['tiktok', 'TikTok'], ['twitch', 'Twitch'], ['youtube', 'YouTube'], ['kick', 'Kick']].map(([k, l]) => html`<button class="seg ${filter === k ? 'on' : ''}" onClick=${() => setFilter(k)}>${l}</button>`)}
    </div>
    <${Bay}>
      <ul class="rules">${rules.map((r) => html`<${Rule} key=${r.id} r=${r} s=${s} def=${s.eventTypes[r.type]} />`)}</ul>
    <//>
    <div class="row tight">
      <${Field} label="Pause entre deux alertes (secondes)"><${Num} value=${s.alerts.gap} min="0" max="30" onSave=${async (v) => { const a = await act('setAlertGap', v); if (a) setState({ alerts: a }); }} /><//>
    </div>
    <${Upsell}>FREE : une alerte par événement. PRO ajoute des paliers par montant et par cadeau, avec tes images, vidéos et sons.<//>
  </div>`;
}
void ICONS; void go;
