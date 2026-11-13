import { html, useState, useEffect, act, reload, setState, copy, toast, getLang } from '../store.js';
import { Btn, Bay, Field, Lamp, Lazy, Segments, PageHead, Select } from '../ui.js';
import { UpdaterPanel, BugReport } from './help.js';

const ROLE_TEXT = { free: 'Offre FREE', pro: 'Offre PRO active', ultimate: 'Offre ULTIMATE active', admin: 'Admin' };

function Secret({ label, name, has, hint }) {
  const [v, set] = useState('');
  return html`<${Field} label=${label} hint=${hint}>
    <input class="in" type="password" value=${v} placeholder=${has ? 'Déjà enregistré' : ''} onInput=${(e) => set(e.target.value)} onBlur=${async () => { if (v) { await act('setKey', name, v); set(''); reload(); toast('Clé enregistrée'); } }} spellcheck=${false} />
  <//>`;
}

function Public({ label, name, value, hint }) {
  const [v, set] = useState(value || '');
  return html`<${Field} label=${label} hint=${hint}>
    <input class="in" value=${v} onInput=${(e) => set(e.target.value)} onBlur=${async () => { if (v !== (value || '')) { await act('setKey', name, v); reload(); toast('Enregistré'); } }} spellcheck=${false} />
  <//>`;
}

function Licence({ s }) {
  const [key, setKey] = useState('');
  const info = s.licenseInfo;
  const activate = async (e) => {
    e.preventDefault();
    const r = await act('activateLicense', key);
    if (r) { toast('Clé activée'); setKey(''); }
  };
  const date = (t) => new Date(t).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR');
  return html`<div class="col">
    <${Bay} title=${ROLE_TEXT[s.realRole]}>
      ${info.active && html`<p>${info.name ? `Clé au nom de ${info.name}. ` : ''}${info.expires ? `Valable jusqu'au ${date(info.expires)}.` : 'Sans date de fin.'}</p>`}
      ${s.licenseInfo.reason && !info.active && s.settings && html`<p class="warn">${info.reason}</p>`}
      <form class="row" onSubmit=${activate}>
        <${Field} label="Clé de licence" wide><input class="in" value=${key} onInput=${(e) => setKey(e.target.value)} placeholder="RG1..." spellcheck=${false} /><//>
        <${Btn} kind="primary" type="submit" disabled=${!key.trim()}>Activer la clé<//>
      </form>
      ${info.active !== undefined && s.licenseInfo.id && html`<${Btn} onClick=${() => act('removeLicense')}>Retirer la clé<//>`}
    <//>
    <div class="three">
      <${Bay} title="FREE">
        <ul class="col note"><li>Overlays standards, avec signature</li><li>3 jeux et les rangs manuels</li><li>10 commandes, 5 automatisations</li><li>Une voix de synthèse par langue, 7 jours de stats</li></ul>
      <//>
      <${Bay} title="PRO">
        <ul class="col note"><li>Sans signature, finitions et photo de manette</li><li>Tous les jeux et les données en direct</li><li>Mini-jeux, roulette, automatisations avancées</li><li>Télécommande sur téléphone, 90 jours de stats</li></ul>
      <//>
      <${Bay} title="ULTIMATE">
        <ul class="col note"><li>Tout PRO, plusieurs chaînes par plateforme</li><li>Réponses sur toutes les chaînes, webhooks</li><li>Création d'overlays et assistant par IA</li><li>Comparaison des lives, stats sans limite</li></ul>
      <//>
    </div>
    <${Bay} title="Identifiant de ce PC">
      <div class="row tight"><code class="big-code">${s.machineId}</code><${Btn} onClick=${() => copy(s.machineId, 'Identifiant copié')}>Copier<//></div>
      <p class="note">Une clé peut être liée à ce PC. Donne cet identifiant au vendeur si on te le demande.</p>
    <//>
    <${Bay} title="Accès admin">
      ${s.realRole === 'admin' ? html`
        <p class="note">Ce PC détient la clé admin.</p>
        <${Btn} kind="danger" onClick=${() => act('removeAdminKey')}>Retirer l'accès admin de ce PC<//>
      ` : html`
        <p class="note">Le propriétaire de Régie ouvre ici son fichier de clé admin.</p>
        <${Btn} onClick=${async () => { const r = await act('importAdminKey'); if (r) toast('Accès admin activé'); }}>Ouvrir la clé admin<//>
      `}
    <//>
  </div>`;
}

function TikTokSession({ s }) {
  const list = s.channels.filter((c) => c.platform === 'tiktok');
  const [id, setId] = useState('');
  const [sid, setSid] = useState('');
  const [idc, setIdc] = useState('');
  if (!list.length) return null;
  const save = async (e) => {
    e.preventDefault();
    if (await act('setTikTokSession', id || list[0].id, sid, idc) === undefined) return;
    setSid(''); setIdc('');
    await act('reconnectAccount', id || list[0].id);
    toast('Session enregistrée');
  };
  return html`<form class="col" onSubmit=${save}>
    <p class="note warn">Pour répondre dans le chat TikTok, Régie a besoin des cookies de ton compte. Ils sont transmis à Euler Stream : ne remplis ces champs que si tu lui fais confiance.</p>
    <div class="row wrap">
      <${Field} label="Chaîne"><${Select} value=${id} onChange=${setId} options=${list.map((c) => ({ value: c.id, label: c.label }))} /><//>
      <${Field} label="Cookie sessionid"><input class="in" type="password" value=${sid} onInput=${(e) => setSid(e.target.value)} spellcheck=${false} /><//>
      <${Field} label="Cookie tt-target-idc"><input class="in" value=${idc} onInput=${(e) => setIdc(e.target.value)} spellcheck=${false} /><//>
      <${Btn} type="submit" disabled=${!sid || !idc}>Enregistrer la session<//>
    </div>
  </form>`;
}

function Connexions({ s }) {
  const k = s.keys;
  return html`<div class="col">
    <${Bay} title="Twitch">
      ${k.provided.twitchClientId ? html`<p class="note">Déjà configuré pour tout le monde. Rien à faire.</p>` : html`<${Public} label="Client ID Twitch" name="twitchClientId" value=${k.twitchClientId} hint="Sur dev.twitch.tv, crée une appli de type Public avec la redirection http://localhost" />`}
    <//>
    <${Bay} title="YouTube, mode API">
      <div class="row wrap">
        <${Public} label="Client ID Google" name="youtubeClientId" value=${k.youtubeClientId} hint="Google Cloud : YouTube Data API v3, identifiant de type Application de bureau" />
        <${Secret} label="Secret Google" name="youtubeClientSecret" has=${k.youtubeClientSecret} />
      </div>
      <p class="note">Utilisé aujourd'hui : ${s.quota.used} sur ${s.quota.max} unités. Le mode simple n'en a pas besoin.</p>
    <//>
    <${Bay} title="TikTok">
      <${Secret} label="Clé Euler Stream (facultative)" name="eulerKey" has=${k.eulerKey} hint="Augmente les limites de connexion, et sert à répondre dans le chat TikTok." />
      <p class="note">TikTok n'a pas d'API publique pour les lives : la connexion passe par une bibliothèque non officielle et peut parfois casser.</p>
      <${TikTokSession} s=${s} />
    <//>
    <${Bay} title="ElevenLabs">
      <${Secret} label="Clé ElevenLabs" name="elevenKey" has=${k.elevenKey}  hint="Pour les voix ElevenLabs de la synthèse vocale." />
    <//>
    <${Bay} title="Création par IA">
      <${Secret} label="Clé API Claude" name="anthropicKey" has=${k.anthropicKey}  hint="Pour créer des overlays par IA et pour l'assistant. Ils utilisent ton compte API." />
      <${Secret} label="Clé DeepL" name="deeplKey" has=${k.deeplKey} hint="Facultatif : traduction du chat avec DeepL (offre gratuite sur deepl.com)." />
    <//>
  </div>`;
}

function Apparence({ s }) {
  const up = async (patch) => { const r = await act('updateSettings', patch); if (r) setState({ settings: r }); };
  const ACCENTS = ['', '#B9A7FF', '#9FE3C4', '#F3D38A', '#FFB3A6'];
  return html`<div class="col">
    <${Bay} title="Thème">
      <${Lamp} on=${s.settings.acrylic !== false} label="Laisser transparaître le bureau" onChange=${(acrylic) => up({ acrylic })} hint="Windows 11" />
      <${Segments} value=${s.settings.theme || 'dark'} onChange=${(theme) => up({ theme })} options=${[{ value: 'dark', label: 'Sombre' }, { value: 'light', label: 'Clair' }]} />
      <span class="f-label">Couleur d'accent</span>
      <div class="swatches">${ACCENTS.map((c) => html`<button type="button" key=${c} class="swatch ${(s.settings.accent || '') === c ? 'on' : ''}" aria-label=${c ? `Accent ${c}` : 'Accent d\'origine'} style=${{ background: c || '#8FD3FF' }} onClick=${() => up({ accent: c })}></button>`)}</div>
    <//>
    <${Bay} title="Profil">
      <${Field} label="Nom affiché"><${Lazy} value=${s.settings.profileName} onSave=${(profileName) => up({ profileName })} placeholder="Ton pseudo" /><//>
    <//>
    <${Bay} title="Économie">
      <${Lamp} on=${s.settings.economy} label="Mode économie" onChange=${(economy) => up({ economy })} hint="Coupe les animations de fond de l'appli" />
      <p class="note">Coupe les animations de fond de l'appli. Tes overlays ne changent pas.</p>
    <//>
  </div>`;
}

function Modules({ s }) {
  const up = async (id, on) => { const r = await act('setModule', id, on); if (r) setState({ settings: r }); };
  return html`<${Bay} title="Modules">
    <p class="note">Coupe ce que tu n'utilises pas : l'onglet disparaît du menu et la fonction s'arrête. Tes réglages restent enregistrés.</p>
    <div class="mod-grid">${s.modules.map(([id, name]) => html`<${Lamp} key=${id} on=${s.settings.modules?.[id] !== false} label=${name} onChange=${(on) => up(id, on)} />`)}</div>
  <//>`;
}

function Diagnostic({ s }) {
  const [rows, setRows] = useState(null);
  const [log, setLog] = useState([]);
  const run = async () => { setRows(await act('diagnostics')); setLog(await act('logs') || []); };
  useEffect(() => { run(); }, []);
  return html`<div class="col">
    <${Bay} title="Diagnostic" aside=${html`<${Btn} onClick=${run}>Relancer<//>`}>
      <ul class="diag">${(rows || []).map((r) => html`<li key=${r.name}><i class="led ${r.ok === null ? 'stopped' : r.ok ? 'live' : 'error'}"></i><b>${r.name}</b><span>${r.detail}</span></li>`)}</ul>
    <//>
    <${Bay} title="Journal" aside=${html`<${Btn} onClick=${() => copy(log.join('\n'), 'Journal copié')}>Copier<//>`}>
      <pre class="log">${log.join('\n') || 'Rien à signaler.'}</pre>
    <//>
  </div>`;
}

function AutoBackups() {
  const [list, setList] = useState(null);
  useEffect(() => { act('autoBackups').then((l) => setList(l || [])); }, []);
  if (!list) return null;
  return html`<${Bay} title="Copies automatiques">
    <p class="note">Régie garde une copie de ta config avant chaque pack installé ou restauration. Les dix dernières restent ici.</p>
    ${list.length === 0 ? html`<p class="note">Aucune copie pour l'instant.</p>` : html`<div class="list">
      ${list.map((b) => html`<div class="li" key=${b.file}><span>${new Date(b.at).toLocaleString(getLang() === 'en' ? 'en-GB' : 'fr-FR')}</span><span class="note">${b.why}</span><${Btn} onClick=${() => act('restoreAutoBackup', b.file)}>Revenir à cette copie<//></div>`)}
    </div>`}
  <//>`;
}

function Sauvegarde({ s }) {
  const [confirm, setConfirm] = useState(false);
  return html`<div class="col">
    <${AutoBackups} />
    <${Bay} title="Assistant de démarrage"><p class="note">Reprends les cinq questions : chaînes, jeu, style de live et thème. Tes réglages actuels sont copiés avant.</p><div class="row tight"><${Btn} onClick=${() => setState({ setupOpen: true })}>Relancer l'assistant<//></div><//>
    <${Bay} title="Sauvegarde">
      <p class="note">Un fichier avec tes overlays, commandes, automatisations, profils de jeux et stats. Les clés API et les connexions restent chiffrées sur ce PC : il faudra les remettre après une restauration.</p>
      <div class="row tight">
        <${Btn} kind="primary" onClick=${async () => { if (await act('backup')) toast('Sauvegarde enregistrée'); }}>Créer une sauvegarde<//>
        <${Btn} onClick=${() => act('restore')}>Restaurer une sauvegarde<//>
      </div>
    <//>
    <${Bay} title="Maintenance">
      <div class="row tight">
        <${Btn} onClick=${async () => { await act('clearCache'); toast('Cache vidé'); }}>Vider le cache<//>
        <${Lamp} on=${s.settings.devMode} label="Mode développeur" onChange=${async (devMode) => { const r = await act('updateSettings', { devMode }); if (r) setState({ settings: r }); }} />
      </div>
    <//>
    <${Bay} title="Réinitialiser">
      <p class="note warn">Efface overlays, réglages et stats de ce PC. Fais une sauvegarde avant.</p>
      ${confirm ? html`<div class="row tight"><${Btn} kind="danger" onClick=${() => act('resetAll')}>Tout effacer maintenant<//><${Btn} onClick=${() => setConfirm(false)}>Annuler<//></div>` : html`<${Btn} kind="danger" onClick=${() => setConfirm(true)}>Réinitialiser Régie<//>`}
    <//>
  </div>`;
}

function Serveur({ s }) {
  return html`<div class="col">
    <${Bay} title="Liens d'overlays">
      <div class="kv"><span>Port local</span><b>${s.port}</b></div>
      <${Lamp} on=${s.settings.lan} label="Accessible depuis un autre PC du réseau" onChange=${async (v) => { await act('setLan', v); reload(); toast('Redémarre Régie pour appliquer ce réglage'); }} hint="Utile avec un PC de stream séparé" />
      <div class="row tight"><${Btn} onClick=${async () => { await act('resetOverlayToken'); reload(); toast('Nouveaux liens créés. Recolle-les dans OBS.'); }}>Créer de nouveaux liens<//></div>
      <p class="note">Si un lien a fuité, crée de nouveaux liens : les anciens cessent de marcher.</p>
    <//>
    <${Bay} title="Clavier, souris et manette">
      <${Lamp} on=${!s.settings.inputPaused} label="Capture active" onChange=${async (on) => { await act('setInputPaused', !on); reload(); }} />
      <p class="note">La capture ne tourne que si un overlay Clavier, Souris ou Manette est ouvert. Rien n'est enregistré ni envoyé hors de ton PC. Coupe-la avant de taper un mot de passe en direct.</p>
    <//>
  </div>`;
}

export function Settings({ s }) {
  const tab = s.settingsTab || 'licence';
  return html`<div class="page">
    <${PageHead} title="Réglages" />
    <${Segments} value=${tab} onChange=${(settingsTab) => setState({ settingsTab })} options=${[{ value: 'licence', label: 'Licence' }, { value: 'apparence', label: 'Apparence' }, { value: 'modules', label: 'Modules' }, { value: 'connexions', label: 'Connexions' }, { value: 'serveur', label: 'Overlays et capture' }, { value: 'diagnostic', label: 'Diagnostic' }, { value: 'sauvegarde', label: 'Sauvegarde' }, { value: 'aide', label: 'Mises à jour et aide' }]} />
    ${tab === 'licence' && html`<${Licence} s=${s} />`}
    ${tab === 'connexions' && html`<${Connexions} s=${s} />`}
    ${tab === 'serveur' && html`<${Serveur} s=${s} />`}
    ${tab === 'apparence' && html`<${Apparence} s=${s} />`}
    ${tab === 'modules' && html`<${Modules} s=${s} />`}
    ${tab === 'diagnostic' && html`<${Diagnostic} s=${s} />`}
    ${tab === 'sauvegarde' && html`<${Sauvegarde} s=${s} />`}
    ${tab === 'aide' && html`<div class="cols2">
      <div class="col">
        <${Bay} title="Mises à jour"><${UpdaterPanel} s=${s} /><//>
        <${Bay} title="À propos">
          <div class="kv"><span>Version</span><b>${s.brand.version}</b></div>
          <div class="row wrap tight">
            <${Btn} kind="danger" onClick=${async () => { await act('statsReset'); toast('Stats effacées'); }}>Effacer les stats<//>
          </div>
        <//>
      </div>
      <${BugReport} />
    </div>`}
  </div>`;
}
