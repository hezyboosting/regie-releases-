import { html, useState, act, setState, toast, copy } from '../store.js';
import { ICONS, Btn, Bay, Field, Lazy, Num, Select, PageHead, Empty } from '../ui.js';

export function Clips({ s }) {
  const c = s.clips;
  const [busy, setBusy] = useState(false);
  const set = (r) => r && setState({ clips: r });
  const up = async (patch) => set(await act('updateClips', patch));
  const twitch = s.channels.some((x) => x.platform === 'twitch');
  const obs = s.obs.state === 'connected';
  const date = (t) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  return html`<div class="page">
    <${PageHead} title="Clips">
      <${Btn} disabled=${!obs || busy} onClick=${async () => { setBusy(true); const r = await act('saveReplay'); setBusy(false); if (r) { set(r); toast('Replay enregistré'); } }}>Enregistrer le replay OBS<//>
      <${Btn} kind="primary" disabled=${!twitch || busy} onClick=${async () => { setBusy(true); const r = await act('createClip'); setBusy(false); if (r) { set(r.clips); toast('Clip créé'); } }}>Créer un clip Twitch<//>
    <//>
    <${Bay}>
      ${c.list.length ? html`<ul class="rules">${c.list.map((x) => html`<li class="rule" key=${x.id}><div class="rule-line">
        <b style=${{ flex: '0 0 150px' }}>${date(x.at)}</b>
        <p class="rule-msg">${x.url || x.path}</p>
        <span class="tagline">${x.by}</span>
        ${x.url ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(x.url)}>Copier<//><${Btn} onClick=${() => act('openExternal', x.editUrl || x.url)}>Ouvrir<//>` : html`<${Btn} onClick=${() => act('showClip', x.path)}>Afficher le fichier<//>`}
        <button class="icon" aria-label="Retirer de la liste" onClick=${async () => set(await act('removeClip', x.id))}>${ICONS.x}</button>
      </div></li>`)}</ul>` : html`<${Empty} title="Aucun clip">Crée un clip Twitch pendant ton live, ou enregistre le replay d'OBS si le tampon de relecture est activé.<//>`}
    <//>
    <${Bay} title="Clips depuis le chat">
      <div class="row wrap">
        <${Field} label="Commande"><${Lazy} value=${c.command} onSave=${(command) => up({ command })} /><//>
        <${Field} label="Qui peut clipper"><${Select} value=${c.perm} onChange=${(perm) => up({ perm })} options=${[{ value: 'all', label: 'Tout le monde' }, { value: 'sub', label: 'Abonnés' }, { value: 'vip', label: 'VIP' }, { value: 'mod', label: 'Modérateurs' }]} /><//>
        <${Field} label="Attente (secondes)"><${Num} value=${c.cooldown} min="0" onSave=${(cooldown) => up({ cooldown })} /><//>
      </div>
      <p class="note">Si ta chaîne Twitch était déjà connectée, reconnecte-la une fois pour autoriser les clips.</p>
    <//>
  </div>`;
}
