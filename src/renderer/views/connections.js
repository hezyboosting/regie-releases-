// Connexions : un seul endroit pour relier ses chaînes et ses logiciels, sans mot de passe stocké.
import { html, useState, useEffect, useRef, act, reload, setState, copy, toast, PLATFORM } from '../store.js';
import { Btn, Bay, Field, Text, PageHead } from '../ui.js';
import { brandSvg } from '../../overlays/brands.js';

const STATE = { live: 'Connecté', connecting: 'Connexion en cours', offline: 'Hors ligne', error: 'À vérifier', stopped: 'En pause', locked: 'Réservé à PRO' };

function Account({ c }) {
  return html`<li class="cx-acc">
    <i class="led ${c.status.state}"></i>
    <b>${c.label}</b>
    <span>${c.status.detail || STATE[c.status.state] || ''}</span>
    <button type="button" class="mini danger" onClick=${async () => { if (await act('removeAccount', c.id)) { await reload(); toast('Chaîne retirée'); } }}>Retirer</button>
  </li>`;
}

function Service({ s, platform, children }) {
  const list = s.channels.filter((c) => c.platform === platform);
  return html`<section class="cx-row">
    <header><span class="cx-logo" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: brandSvg(platform, 24) }}></span><h3>${PLATFORM[platform].label}</h3></header>
    <div class="cx-body">
      ${list.length > 0 && html`<ul class="cx-list">${list.map((c) => html`<${Account} key=${c.id} c=${c} />`)}</ul>`}
      ${children}
    </div>
  </section>`;
}

function Pseudo({ platform, label, placeholder, build = (username) => ({ platform, username }) }) {
  const [v, set] = useState('');
  return html`<form class="cx-form" onSubmit=${async (e) => { e.preventDefault(); if (await act('addAccount', build(v))) { set(''); await reload(); toast('Chaîne ajoutée'); } }}>
    <${Field} label=${label}><${Text} value=${v} onChange=${set} placeholder=${placeholder} /><//>
    <${Btn} type="submit" disabled=${!v.trim()}>Ajouter<//>
  </form>`;
}

// Écrire dans le chat avec son propre compte, connecté une fois dans une fenêtre de Régie.
function WriteChat({ s, site, name }) {
  const on = Boolean(s.webChat?.[site]);
  const chans = s.channels.filter((c) => c.platform === site);
  const [busy, setBusy] = useState(false);
  const login = async () => { setBusy(true); const r = await act('webChatLogin', site); setBusy(false); if (r) { setState({ webChat: r.status }); toast(r.ok ? `${name} : tu peux écrire dans le chat` : 'Connexion non terminée'); } };
  const logout = async () => { const st = await act('webChatLogout', site); if (st) { setState({ webChat: st }); toast('Déconnecté'); } };
  const test = async () => { if (!chans[0]) return; setBusy(true); const r = await act('sendChat', '👋 Test depuis Régie', chans[0].id); setBusy(false); if (r?.sent?.length) toast('Message envoyé'); };
  return html`<div class="cx-write ${on ? 'on' : ''}">
    <i class="led ${on ? 'live' : 'stopped'}"></i>
    <div class="cx-write-txt">
      <b>${`Écrire dans le chat ${name}`}</b>
      <span>${on ? 'Ton compte est connecté dans Régie : le chat unifié, les réponses du bot et les commandes écrivent sur ton live.' : 'Connecte ton compte une fois : Régie pourra écrire dans ton chat, sans abonnement. Ton live doit être lancé.'}</span>
    </div>
    ${on ? html`<div class="row tight">
      <${Btn} disabled=${busy || !chans.length} onClick=${test}>${busy ? 'Envoi…' : 'Essayer'}<//>
      ${chans[0] && html`<${Btn} kind="ghost" onClick=${() => act('webChatShow', chans[0].id)}>Voir la fenêtre<//>`}
      <${Btn} kind="ghost" onClick=${logout}>Déconnecter<//>
    </div>` : html`<${Btn} kind="primary" disabled=${busy} onClick=${login}>${busy ? 'Connexion…' : 'Se connecter pour écrire'}<//>`}
  </div>`;
}

function TikTok({ s }) {
  const [typed, setTyped] = useState(false);
  return html`<${Service} s=${s} platform="tiktok">
    <div class="row tight">
      <${Btn} kind="primary" onClick=${async () => { if (await act('tiktokLogin')) { await reload(); toast('TikTok connecté'); } }}>Se connecter avec TikTok<//>
      <button type="button" class="linkish" onClick=${() => setTyped(!typed)}>Entrer mon pseudo</button>
    </div>
    ${typed && html`<${Pseudo} platform="tiktok" label="Pseudo TikTok" placeholder="@tonpseudo" />`}
    <p class="note">Tu te connectes sur la vraie page TikTok. Régie garde uniquement ton pseudo public.</p>
    ${s.channels.some((c) => c.platform === 'tiktok') && html`<${WriteChat} s=${s} site="tiktok" name="TikTok" />`}
    ${s.channels.some((c) => c.platform === 'tiktok' && /limite|service de connexion/i.test(c.status?.detail || '')) && html`<div class="code-box">
      <p>TikTok passe par un service de connexion gratuit, limité par réseau. Les autres applis TikTok ouvertes chez toi, comme TikFinity, Social Stream ou Bubbly, utilisent la même limite.</p>
      <p>Une clé Euler Stream gratuite, à ton nom, te donne ta propre limite.</p>
      <div class="row tight">
        <${Btn} kind="primary" onClick=${() => act('openExternal', 'https://www.eulerstream.com')}>Créer ma clé gratuite<//>
        <${Btn} onClick=${() => setState({ view: 'settings', settingsTab: 'connexions' })}>Coller ma clé<//>
      </div>
    </div>`}
  <//>`;
}

function KeyForm({ name, label, saved }) {
  const [v, set] = useState('');
  return html`<form class="cx-form" onSubmit=${async (e) => { e.preventDefault(); if (await act('setKey', name, v.trim()) !== undefined) { set(''); await reload(); toast(saved); } }}>
    <${Field} label=${label}><${Text} value=${v} onChange=${set} spellcheck=${false} /><//>
    <${Btn} type="submit" disabled=${!v.trim()}>Enregistrer<//>
  </form>`;
}

function Twitch({ s }) {
  const [info, setInfo] = useState(null);
  const timer = useRef(null);
  const ready = s.keys.twitchClientId || s.keys.provided.twitchClientId;
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = async () => {
    const d = await act('twitchDeviceStart');
    if (!d) return;
    setInfo(d);
    act('openExternal', d.url);
    const poll = async () => {
      const r = await act('twitchDevicePoll', d.deviceCode);
      if (r?.done) { setInfo(null); await reload(); toast('Twitch connecté'); return; }
      if (r) timer.current = setTimeout(poll, (d.interval + (r.slow ? 5 : 0)) * 1000);
    };
    timer.current = setTimeout(poll, d.interval * 1000);
  };
  return html`<${Service} s=${s} platform="twitch">
    ${ready && !info && html`<div class="row tight"><${Btn} kind="primary" onClick=${start}>Se connecter avec Twitch<//></div>
      <p class="note">Tu entres tes identifiants sur la vraie page Twitch. Régie ne voit jamais ton mot de passe.</p>`}
    ${info && html`<div class="code-box">
      <p>Connecte-toi sur la page Twitch qui vient de s'ouvrir, puis valide. Si elle demande un code :</p>
      <strong>${info.userCode}</strong>
      <div class="row tight"><${Btn} onClick=${() => copy(info.userCode, 'Code copié')}>Copier le code<//><${Btn} onClick=${() => act('openExternal', info.url)}>Rouvrir la page<//></div>
    </div>`}
    <${Pseudo} platform="twitch" label=${ready ? 'Ou juste ton pseudo, sans connexion' : 'Ton pseudo Twitch'} placeholder="tonpseudo" />
    <p class="note">Avec le pseudo : chat, abonnements, bits et raids. La connexion ajoute les suivis, les récompenses et les réponses du bot.</p>
    ${!ready && html`<details class="more"><summary>Tu publies l'appli ? Active le bouton Se connecter avec Twitch</summary>
      <p class="note">Twitch exige un Client ID par application. Il suffit d'en créer un seul : tous tes utilisateurs auront ensuite le bouton.</p>
      <ol class="steps">
        <li><button class="linkish" onClick=${() => act('openExternal', 'https://dev.twitch.tv/console/apps/create')}>Enregistre une application sur le site développeur Twitch.</button></li>
        <li>Mets l'adresse <code>http://localhost</code> et le type de client Public.</li>
        <li>Colle le Client ID ici pour ton PC, puis dans Admin, Diffusion pour tout le monde.</li>
      </ol>
      <${KeyForm} name="twitchClientId" label="Client ID Twitch" saved="Client ID enregistré" />
    </details>`}
  <//>`;
}

function YouTube({ s }) {
  const ready = s.keys.youtubeClientId || s.keys.provided.youtubeClientId;
  return html`<${Service} s=${s} platform="youtube">
    ${ready && html`<div class="row tight"><${Btn} kind="primary" onClick=${async () => { if (await act('youtubeLogin')) { await reload(); toast('YouTube connecté'); } }}>Se connecter avec Google<//></div>`}
    <${Pseudo} platform="youtube" label=${ready ? 'Ou juste ta chaîne, sans connexion' : 'Ta chaîne YouTube'} placeholder="@tachaine" build=${(channel) => ({ platform: 'youtube', channel, mode: 'simple' })} />
    <p class="note">Avec le nom de ta chaîne, Régie lit le chat public de ton live sans compte Google.</p>
    ${!ready && html`<details class="more"><summary>Tu publies l'appli ? Active le bouton Se connecter avec Google</summary>
      <p class="note">Google demande un identifiant par application, et affiche un avertissement tant que l'appli n'a pas passé sa vérification.</p>
      <ol class="steps">
        <li><button class="linkish" onClick=${() => act('openExternal', 'https://console.cloud.google.com/apis/library/youtube.googleapis.com')}>Active YouTube Data API v3 sur Google Cloud.</button></li>
        <li>Crée un identifiant OAuth de type Application de bureau.</li>
        <li>Colle le Client ID et le secret ci-dessous.</li>
      </ol>
      <${KeyForm} name="youtubeClientId" label="Client ID Google" saved="Client ID enregistré" />
      <${KeyForm} name="youtubeClientSecret" label="Secret client" saved="Secret enregistré" />
    </details>`}
  <//>`;
}

function Kick({ s }) {
  return html`<${Service} s=${s} platform="kick">
    <${Pseudo} platform="kick" label="Ton pseudo Kick" placeholder="tonpseudo" />
    <p class="note">Chat, abonnements et raids, par un accès non officiel qui peut changer.</p>
    ${s.channels.some((c) => c.platform === 'kick') && html`<${WriteChat} s=${s} site="kick" name="Kick" />`}
  <//>`;
}

function ObsRow({ s }) {
  const [help, setHelp] = useState(false);
  const on = s.obs.state === 'connected';
  const auto = async () => {
    const r = await act('obsAuto');
    if (!r) return;
    setHelp(!r.connected);
    if (r.connected) toast('Connexion à OBS');
  };
  return html`<section class="cx-row">
    <header><i class="cx-dot"></i><h3>OBS Studio</h3></header>
    <div class="cx-body">
      <div class="row tight">
        ${on ? html`<span class="badge ok"><i></i>Connecté</span><${Btn} onClick=${() => act('obsDisconnect')}>Déconnecter<//>` : html`<${Btn} kind="primary" onClick=${auto}>Connecter OBS<//>${s.obs.state === 'connecting' ? html`<span class="tagline">Connexion en cours</span>` : s.obs.detail ? html`<span class="tagline">${s.obs.detail}</span>` : ''}`}
      </div>
      ${help ? html`<p class="note warn">Le serveur WebSocket d'OBS est coupé. Dans OBS, ouvre Outils, Paramètres du serveur WebSocket, coche Activer, puis clique de nouveau sur Connecter OBS.</p>` : html`<p class="note">Régie retrouve tout seul les réglages d'OBS sur ce PC. OBS doit être ouvert.</p>`}
    </div>
  </section>`;
}

function SpotifyRow({ s }) {
  const t = s.spotify.state?.track;
  return html`<section class="cx-row">
    <header><i class="cx-dot"></i><h3>Spotify</h3></header>
    <div class="cx-body">
      <div class="row tight">
        <span class="badge ok"><i></i>${s.spotify.connected ? 'Connecté' : 'Rien à connecter'}</span>
        <${Btn} onClick=${() => setState({ view: 'spotify' })}>Réglages<//>
      </div>
      <p class="note">${t ? `En cours : ${t.title}${t.artist ? `, ${t.artist}` : ''}` : 'Lance un morceau : Régie le lit depuis Windows, même avec Spotify gratuit.'}</p>
    </div>
  </section>`;
}

export function Connections({ s }) {
  return html`<div class="page cx">
    <${PageHead} title="Connexions" />
    <${Bay}>
      <${TikTok} s=${s} />
      <${Twitch} s=${s} />
      <${YouTube} s=${s} />
      <${Kick} s=${s} />
      <${ObsRow} s=${s} />
      <${SpotifyRow} s=${s} />
    <//>
  </div>`;
}
