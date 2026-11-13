// Discord : annonce du live et récap de fin dans un salon, par un webhook.
import { html, useState, act, setState, toast } from '../store.js';
import { Btn, Bay, Field, Lamp, Lazy, PageHead, Select } from '../ui.js';

export function DiscordView({ s }) {
  const d = s.discord;
  const [hook, setHook] = useState('');
  const [busy, setBusy] = useState('');
  const save = async (patch) => { const r = await act('updateDiscord', patch); if (r) setState({ discord: r }); return r; };
  const test = async (kind) => { setBusy(kind); const ok = await act('testDiscord', kind); setBusy(''); if (ok) toast('Message envoyé sur Discord'); };
  return html`<div class="page">
    <${PageHead} title="Discord" />
    <p class="lead">Régie poste un message dans ton salon Discord quand ton live commence, puis le récap à la fin : durée, cadeaux, nouveaux suivis et tes meilleurs soutiens.</p>
    <div class="cols2">
      <${Bay} title="Le salon">
        ${d.hasHook ? html`<div class="banner ok"><span>Webhook enregistré.</span><${Btn} onClick=${() => save({ webhook: '' })}>Retirer<//></div>` : html`<ol class="steps-mini">
          <li>Dans Discord, ouvre les paramètres du salon (la roue dentée).</li>
          <li>Intégrations › Webhooks › Nouveau webhook.</li>
          <li>Copier l'URL du webhook, puis colle-la ici.</li>
        </ol>`}
        <div class="row tight">
          <input class="in" type="password" value=${hook} onInput=${(e) => setHook(e.target.value)} placeholder=${d.hasHook ? 'Coller un autre webhook pour le remplacer' : 'https://discord.com/api/webhooks/…'} style="flex:1" />
          <${Btn} kind="primary" disabled=${!hook.trim()} onClick=${async () => { const r = await save({ webhook: hook }); if (r) { setHook(''); toast('Webhook enregistré'); } }}>Enregistrer<//>
        </div>
        <p class="note">Le lien est gardé chiffré sur ton PC. Ne le partage pas : il permet d'écrire dans ton salon.</p>
        <div class="row wrap tight">
          <${Btn} disabled=${!d.hasHook || busy} onClick=${() => test('live')}>${busy === 'live' ? 'Envoi…' : 'Essayer l\'annonce'}<//>
          <${Btn} disabled=${!d.hasHook || busy} onClick=${() => test('recap')}>${busy === 'recap' ? 'Envoi…' : 'Essayer le récap'}<//>
        </div>
      <//>
      <${Bay} title="Messages">
        <${Lamp} on=${d.enabled} label="Discord activé" onChange=${(enabled) => save({ enabled })} />
        <${Lamp} on=${d.onLive} label="Annoncer le début du live" onChange=${(onLive) => save({ onLive })} />
        <${Lamp} on=${d.onRecap} label="Poster le récap à la fin" onChange=${(onRecap) => save({ onRecap })} />
        <div class="form-grid top">
          <${Field} label="Prévenir"><${Select} value=${d.mention} onChange=${(mention) => save({ mention })} options=${[{ value: 'none', label: 'Personne' }, { value: 'here', label: '@here (membres en ligne)' }, { value: 'everyone', label: '@everyone (tout le serveur)' }, { value: 'role', label: 'Un rôle' }]} /><//>
          ${d.mention === 'role' && html`<${Field} label="Identifiant du rôle" hint="Clic droit sur le rôle › Copier l'identifiant (mode développeur)"><${Lazy} value=${d.roleId} onSave=${(roleId) => save({ roleId: roleId.trim() })} /><//>`}
          <${Field} label="Nom du bot"><${Lazy} value=${d.botName} onSave=${(botName) => save({ botName })} /><//>
        </div>
        <${Field} label="Texte de l'annonce" hint="{name} ton nom, {game} le jeu, {link} le lien du live" wide><${Lazy} area value=${d.liveText} onSave=${(liveText) => save({ liveText })} /><//>
        <${Field} label="Titre de la carte" hint="Vide : « Ton nom est en direct »" wide><${Lazy} value=${d.liveTitle} onSave=${(liveTitle) => save({ liveTitle })} /><//>
        <${Field} label="Texte avant le récap" hint="Facultatif. {top} : tes trois meilleurs soutiens" wide><${Lazy} value=${d.recapText} placeholder="Merci {top} pour ce live ❤️" onSave=${(recapText) => save({ recapText })} /><//>
        <p class="note">Pas plus d'une annonce par demi-heure : une coupure de connexion ne renvoie pas de message.</p>
      <//>
    </div>
  </div>`;
}
