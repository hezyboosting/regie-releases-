// Onglet réservé à l'admin : clés, matrice FREE, PRO, ULTIMATE et diffusion.
import { html, useState, act, reload, setState, copy, toast } from '../store.js';
import { Btn, Bay, Field, Lazy, Text, Select, Segments, PageHead } from '../ui.js';

function Keys({ s }) {
  const [name, setName] = useState('');
  const [days, setDays] = useState(0);
  const [machine, setMachine] = useState('');
  const [last, setLast] = useState('');
  const [tier, setTier] = useState('pro');
  const create = async (e) => {
    e.preventDefault();
    const r = await act('createKey', { name, days, machine, tier });
    if (r) { setLast(r.key); setState({ admin: { ...s.admin, issued: r.issued } }); setName(''); setMachine(''); }
  };
  const revoke = async (id, v) => {
    const issued = await act('revokeKey', id, v);
    if (issued) { await reload(); toast(v ? 'Clé désactivée. Publie la configuration pour l\'appliquer.' : 'Clé réactivée'); }
  };
  const date = (t) => (t ? new Date(t).toLocaleDateString('fr-FR') : 'Sans fin');
  return html`<div class="col">
    <${Bay} title="Créer une clé">
      <form class="row wrap" onSubmit=${create}>
        <${Field} label="Offre"><${Select} value=${tier} onChange=${setTier} options=${[{ value: 'pro', label: 'PRO' }, { value: 'ultimate', label: 'ULTIMATE' }]} /><//>
        <${Field} label="Client"><${Text} value=${name} onChange=${setName} placeholder="Pseudo Discord" /><//>
        <${Field} label="Durée en jours" hint="0 pour une clé à vie"><${Text} type="number" value=${days} onChange=${(v) => setDays(Number(v))} /><//>
        <${Field} label="Lier à un PC (facultatif)" hint="L'identifiant visible dans ses Réglages"><${Text} value=${machine} onChange=${setMachine} /><//>
        <${Btn} kind="primary" type="submit">Créer la clé<//>
      </form>
      ${last && html`<div class="newkey"><code>${last}</code><${Btn} kind="amber" onClick=${() => copy(last, 'Clé copiée')}>Copier la clé<//></div>`}
    <//>
    <${Bay} title=${`Clés créées (${s.admin.issued.length})`}>
      <div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>Offre</th><th>Créée le</th><th>Fin</th><th>PC</th><th></th></tr></thead>
        <tbody>${s.admin.issued.map((k) => html`<tr key=${k.id} class=${k.revoked ? 'off' : ''}>
          <td>${k.name || 'Sans nom'}</td><td>${k.tier || 'PRO'}</td><td>${date(k.created)}</td><td>${date(k.expires)}</td><td>${k.machine || 'Libre'}</td>
          <td class="acts"><${Btn} onClick=${() => copy(k.key, 'Clé copiée')}>Copier<//><${Btn} kind=${k.revoked ? '' : 'danger'} onClick=${() => revoke(k.id, !k.revoked)}>${k.revoked ? 'Réactiver' : 'Désactiver'}<//></td>
        </tr>`)}</tbody>
      </table></div>
    <//>
  </div>`;
}

function Matrix({ s }) {
  const d = s.admin.draft;
  const groups = {};
  for (const [k, f] of Object.entries(s.featureDefs)) (groups[f.group] = groups[f.group] || []).push([k, f]);
  const save = (key, tier, value) => {
    const features = { ...d.features, [key]: { ...(d.features[key] || {}), [tier]: value } };
    act('saveAdminDraft', { features });
  };
  const cell = (k, f, tier) => {
    const v = d.features[k]?.[tier] ?? f[tier];
    if (typeof f[tier] === 'boolean') return html`<button type="button" role="switch" aria-checked=${v} aria-label=${`${f.label}, ${tier}`} class="mx ${v ? 'on' : ''}" onClick=${() => save(k, tier, !v)}>${v ? 'Oui' : 'Non'}</button>`;
    return html`<input class="in mx-num" type="number" min="-1" aria-label=${`${f.label}, ${tier}`} value=${v} onChange=${(e) => save(k, tier, Number(e.target.value))} />`;
  };
  return html`<${Bay} title="FREE, PRO et ULTIMATE">
    <p class="note">Change ce qui est inclus dans chaque version. -1 veut dire illimité. Les changements s'appliquent ici tout de suite, et chez les autres après publication.</p>
    <div class="table-wrap"><table class="matrix">
      <thead><tr><th>Fonction</th><th>FREE</th><th>PRO</th><th>ULTIMATE</th></tr></thead>
      ${Object.entries(groups).map(([g, items]) => html`<tbody key=${g}>
        <tr class="grp"><th colspan="4">${g}</th></tr>
        ${items.map(([k, f]) => html`<tr key=${k}><td>${f.label}</td><td>${cell(k, f, 'free')}</td><td>${cell(k, f, 'pro')}</td><td>${cell(k, f, 'ultimate')}</td></tr>`)}
      </tbody>`)}
    </table></div>
  <//>`;
}

function Publish({ s }) {
  const d = s.admin.draft;
  const up = (patch) => act('saveAdminDraft', patch);
  const def = d.defaults || {};
  const publish = async () => {
    const r = await act('publishConfig');
    if (r?.saved) toast(`Configuration n°${r.rev} enregistrée. Envoie ce fichier sur ton hébergement.`);
  };
  return html`<div class="col">
    <${Bay} title="Message et mise à jour">
      <div class="col">
        <${Field} label="Annonce visible par tous" wide><${Lazy} value=${d.announcement} onSave=${(announcement) => up({ announcement })} /><//>
        <div class="row wrap">
          <${Field} label="Dernière version"><${Lazy} value=${d.latestVersion}  placeholder="2.0.0" onSave=${(latestVersion) => up({ latestVersion })} /><//>
          <${Field} label="Lien de téléchargement"><${Lazy} value=${d.downloadUrl} placeholder="https://" onSave=${(downloadUrl) => up({ downloadUrl })} /><//>
        </div>
      </div>
    <//>
    <${Bay} title="Identifiants fournis à tout le monde">
      <p class="note">Le fichier publié est public : n'y mets que le Client ID Twitch, jamais une clé secrète. Spotify et ElevenLabs restent propres à chaque streamer.</p>
      <div class="row wrap">
        <${Field} label="Client ID Twitch"><${Lazy} value=${def.twitchClientId} onSave=${(v) => up({ defaults: { ...def, twitchClientId: v } })} /><//>
      </div>
    <//>
    <${Bay} title="Boutique">
      <p class="note">Publie un de tes overlays personnalisés : il apparaîtra dans la boutique de tous les utilisateurs après la publication.</p>
      <div class="row tight">
        ${s.overlays.filter((o) => o.type === 'custom').map((o) => html`<${Btn} key=${o.id} onClick=${async () => { const t = await act('publishTemplate', o.id, false); if (t) toast(`${o.name} ajouté à la boutique`); }}>${o.name}<//>`)}
        ${!s.overlays.some((o) => o.type === 'custom') && html`<span class="note">Crée d'abord un overlay dans l'éditeur.</span>`}
      </div>
      ${(d.templates || []).length > 0 && html`<ul class="rules">${d.templates.map((t) => html`<li class="rule" key=${t.id}><div class="rule-line"><b style=${{ flex: 1 }}>${t.name}</b><${Btn} kind="danger" onClick=${() => up({ templates: d.templates.filter((x) => x.id !== t.id) })}>Retirer<//></div></li>`)}</ul>`}
    <//>
    <${Bay} title="Publier pour tous les utilisateurs">
      <ol class="steps">
        <li>Clique sur Publier : Régie crée un fichier signé avec ta clé admin.</li>
        <li>Envoie ce fichier sur ton hébergement, par exemple un dépôt GitHub public.</li>
        <li>Toutes les applis lisent ce fichier au démarrage, puis toutes les heures.</li>
      </ol>
      <${Field} label="Adresse du fichier publié" wide hint=${s.remote.fetchedAt ? `Dernière lecture : ${new Date(s.remote.fetchedAt).toLocaleString('fr-FR')}` : 'À graver dans le .exe avant de le distribuer'}>
        <${Lazy} value=${s.remote.url} placeholder="https://raw.githubusercontent.com/..." onSave=${async (v) => { await act('setRemoteUrl', v); reload(); }} />
      <//>
      <div class="row tight"><${Btn} kind="primary" onClick=${publish}>Publier la configuration<//><span class="note">Version actuelle : ${d.rev || 0}</span></div>
    <//>
  </div>`;
}

export function Admin({ s }) {
  const [tab, setTab] = useState('keys');
  if (!s.admin && s.realRole !== 'admin') return null;
  const view = s.role === 'admin' ? 'admin' : s.role;
  return html`<div class="page">
    <${PageHead} title="Admin">
      <span class="count">Voir l'appli comme</span>
      <${Segments} value=${view} onChange=${(v) => act('setViewAs', v)} options=${[{ value: 'free', label: 'FREE' }, { value: 'pro', label: 'PRO' }, { value: 'ultimate', label: 'ULTIMATE' }, { value: 'admin', label: 'Admin' }]} />
    <//>
    ${!s.admin ? html`<p class="note">Tu vois l'appli comme un utilisateur ${s.role.toUpperCase()}. Repasse en Admin pour retrouver les outils.</p>` : html`
      <${Segments} value=${tab} onChange=${setTab} options=${[{ value: 'keys', label: 'Clés' }, { value: 'matrix', label: 'Offres' }, { value: 'publish', label: 'Diffusion' }]} />
      ${tab === 'keys' && html`<${Keys} s=${s} />`}
      ${tab === 'matrix' && html`<${Matrix} s=${s} />`}
      ${tab === 'publish' && html`<${Publish} s=${s} />`}
    `}
  </div>`;
}
