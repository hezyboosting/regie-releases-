// Aide au quotidien : « Quoi de neuf » après une mise à jour, « Prêt pour le live » sur le tableau de bord,
// le rapport de problème et l'état des mises à jour.
import { html, useState, act, setState, toast } from '../store.js';
import { ICONS, Btn, Bay, Lamp } from '../ui.js';

export function WhatsNew({ s, list, onClose }) {
  const items = list?.length ? list : (s.changelog || []).slice(0, 2);
  const close = () => { act('markSeen'); onClose(); };
  return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick=${(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class="wn">
      <header class="wn-head">
        <span class="wn-badge">${ICONS.spark}</span>
        <div><h1 id="wn-title">Quoi de neuf</h1><p>${`Tu utilises Régie ${s.brand.version}.`}</p></div>
        <button type="button" class="icon" aria-label="Fermer" onClick=${close}>${ICONS.x}</button>
      </header>
      <div class="wn-body">
        ${items.map((c) => html`<section class="wn-ver" key=${c.version}>
          <h2><span>${c.version}</span>${c.title}</h2>
          <ul>${c.items.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul>
        </section>`)}
      </div>
      <footer class="wn-foot"><${Btn} kind="primary" onClick=${close}>C'est parti<//></footer>
    </div>
  </div>`;
}

// Chaque point : ok (vert), warn (à regarder, facultatif) ou bad (à corriger avant le live).
function checks(s) {
  const out = [];
  const chans = s.channels || [];
  const tiktok = chans.some((c) => c.platform === 'tiktok');
  out.push(chans.length
    ? { id: 'chan', level: 'ok', label: chans.length > 1 ? `${chans.length} chaînes ajoutées` : '1 chaîne ajoutée' }
    : { id: 'chan', level: 'bad', label: 'Aucune chaîne ajoutée', hint: 'Ajoute ton compte TikTok, Twitch, YouTube ou Kick.', fix: ['Ajouter', () => setState({ view: 'connections' })] });
  const broken = chans.filter((c) => c.status.state === 'error');
  if (chans.length) {
    out.push(broken.length
      ? { id: 'err', level: 'bad', label: broken.length > 1 ? `${broken.length} chaînes en erreur` : `${broken[0].label} en erreur`, hint: broken[0].status.detail || '', fix: ['Voir', () => setState({ view: 'connections' })] }
      : { id: 'err', level: 'ok', label: 'Connexions sans erreur' });
  }
  const mute = chans.filter((c) => c.enabled !== false && !c.canSend);
  if (chans.length) {
    out.push(!mute.length
      ? { id: 'write', level: 'ok', label: 'Le chat unifié peut écrire sur toutes tes chaînes' }
      : { id: 'write', level: 'warn', label: `Pas encore d'écriture sur : ${[...new Set(mute.map((c) => c.label))].join(', ')}`, hint: mute[0].sendHint || '', fix: ['Connecter', () => setState({ view: 'connections' })] });
  }
  out.push(s.obs.state === 'connected'
    ? { id: 'obs', level: 'ok', label: 'OBS connecté' }
    : { id: 'obs', level: 'warn', label: 'OBS pas connecté', hint: 'Facultatif avec TikTok LIVE Studio. Avec OBS, active le serveur WebSocket (Outils › Paramètres WebSocket).', fix: ['Connecter', () => setState({ view: 'settings', settingsTab: 'connexions' })] });
  const on = s.overlays.filter((o) => o.enabled !== false);
  const live = on.filter((o) => (o.connected || 0) > 0);
  out.push(live.length
    ? { id: 'ov', level: 'ok', label: live.length > 1 ? `${live.length} overlays ouverts dans OBS` : '1 overlay ouvert dans OBS' }
    : { id: 'ov', level: 'bad', label: 'Aucun overlay ouvert', hint: 'Copie le lien d\'un overlay et colle-le en source navigateur dans OBS ou LIVE Studio.', fix: ['Overlays', () => setState({ view: 'overlays' })] });
  if (tiktok) {
    out.push(s.gifts?.length
      ? { id: 'gifts', level: 'ok', label: `${s.gifts.length} cadeaux TikTok chargés` }
      : { id: 'gifts', level: 'warn', label: 'Catalogue des cadeaux pas encore chargé', hint: 'Pour afficher les vraies images des cadeaux.', fix: ['Charger', async () => { const l = await act('loadGifts'); if (l) { setState({ gifts: l }); toast(`${l.length} cadeaux officiels chargés`); } }] });
  }
  out.push(!s.alerts.paused
    ? { id: 'al', level: 'ok', label: 'Alertes actives' }
    : { id: 'al', level: 'bad', label: 'Alertes en pause', fix: ['Réactiver', async () => { const a = await act('setAlertsPaused', false); if (a) setState({ alerts: a }); }] });
  const up = s.updater || {};
  if (up.state === 'ready') out.push({ id: 'up', level: 'warn', label: `Version ${up.version} prête`, hint: 'Elle s\'installe quand tu fermes Régie.', fix: ['Redémarrer', () => act('installUpdate')] });
  return out;
}

export function ReadyCheck({ s }) {
  const list = checks(s);
  const bad = list.filter((c) => c.level === 'bad').length;
  const warn = list.filter((c) => c.level === 'warn').length;
  const ok = list.length - bad - warn;
  const [open, setOpen] = useState(bad > 0);
  const title = bad ? (bad > 1 ? `${bad} choses à régler avant le live` : '1 chose à régler avant le live') : warn ? 'Presque prêt pour le live' : 'Prêt pour le live';
  return html`<section class="ready ${bad ? 'bad' : warn ? 'warn' : 'ok'}" aria-label="Prêt pour le live">
    <button type="button" class="ready-head" aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="ready-ring" style=${{ '--p': `${(ok / list.length) * 100}%` }}><b>${ok}/${list.length}</b></span>
      <span class="ready-title"><b>${title}</b><small>${open ? 'Clique pour replier' : 'Clique pour voir le détail'}</small></span>
      <${Btn} onClick=${(e) => { e.stopPropagation(); act('simulateLive', !s.simulating, 60); }}>${s.simulating ? 'Arrêter la simulation' : 'Simuler un live'}<//>
    </button>
    ${open && html`<ul class="ready-list">${list.map((c) => html`<li key=${c.id} class=${`lv-${c.level}`}>
      <i aria-hidden="true">${c.level === 'ok' ? '✓' : '!'}</i>
      <div><b>${c.label}</b>${c.hint && html`<small>${c.hint}</small>`}</div>
      ${c.fix && c.level !== 'ok' && html`<${Btn} onClick=${c.fix[1]}>${c.fix[0]}<//>`}
    </li>`)}</ul>`}
  </section>`;
}

export function BugReport() {
  const [note, setNote] = useState('');
  const [path, setPath] = useState('');
  const save = async () => { const p = await act('bugReport', note); if (p) { setPath(p); toast('Rapport enregistré'); } };
  return html`<${Bay} title="Signaler un problème">
    <p class="note">Régie prépare un fichier avec le journal, la version et tes réglages, sans mots de passe, jetons, clés ni liens privés. Envoie-le avec une phrase qui explique ce qui ne marche pas.</p>
    <textarea class="in" rows="3" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="Ce qui se passe, et ce que tu faisais juste avant"></textarea>
    <div class="row tight"><${Btn} kind="primary" onClick=${save}>Créer le rapport<//></div>
    ${path && html`<p class="note">${`Enregistré : ${path}`}</p>`}
  <//>`;
}

export function UpdaterPanel({ s }) {
  const st = s.updater || { state: 'idle' };
  const check = async () => { const r = await act('checkUpdate'); if (r) setState({ updater: r }); };
  const when = st.checkedAt ? new Date(st.checkedAt).toLocaleTimeString(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  const label = st.mode === 'portable' ? 'Version Portable : elle ne se met pas à jour toute seule. Installe Régie avec l\'installateur pour avoir les mises à jour automatiques.'
    : st.mode === 'dev' ? 'Mode développement : pas de mise à jour automatique.'
      : { idle: when ? `Régie est à jour (vérifié à ${when}).` : 'Régie vérifie les mises à jour toutes les deux heures.', checking: 'Vérification…', downloading: `Téléchargement de la version ${st.version} : ${st.progress || 0} %`, ready: `La version ${st.version} est prête. Elle s'installe quand tu fermes Régie.`, error: st.error || 'Erreur' }[st.state];
  return html`<div class="col tight">
    <div class="kv"><span>Version installée</span><b>${s.brand.version}</b></div>
    <p class="note">${label}</p>
    ${st.state === 'downloading' && html`<div class="thin"><i style=${{ width: `${st.progress || 0}%` }}></i></div>`}
    <div class="row wrap tight">
      ${st.state === 'ready' ? html`<${Btn} kind="primary" onClick=${() => act('installUpdate')}>Redémarrer et mettre à jour<//>` : html`<${Btn} disabled=${st.mode === 'portable' || st.state === 'checking' || st.state === 'downloading'} onClick=${check}>Vérifier maintenant<//>`}
      <${Btn} onClick=${() => setState({ whatsNewOpen: true })}>Quoi de neuf<//>
    </div>
    <${Lamp} on=${Boolean(s.settings.betaUpdates)} label="Recevoir les versions bêta" hint="Les nouveautés avant tout le monde, parfois moins stables." onChange=${async (v) => { const r = await act('setBetaUpdates', v); if (r) setState({ settings: r }); }} />
  </div>`;
}

// Petite pastille dans la barre du haut : téléchargement en cours ou mise à jour prête.
export function UpdatePill({ s }) {
  const st = s.updater || {};
  if (st.state === 'ready') return html`<button type="button" class="up-pill ready" title="Installer la nouvelle version maintenant" onClick=${() => act('installUpdate')}>${ICONS.spark}<span>${`Version ${st.version} prête · Redémarrer`}</span></button>`;
  if (st.state === 'downloading') return html`<span class="up-pill" title="Mise à jour en cours de téléchargement">${`Mise à jour ${st.progress || 0} %`}</span>`;
  return null;
}
