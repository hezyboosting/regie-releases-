import { html, useState, act, reload, setState, clock, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Lamp, Lazy, Num, Select, PageHead, Pro, Upsell } from '../ui.js';
import { OverlayEditor } from './overlays.js';

// Option réservée aux comptes Premium : Spotify impose ces règles à toute appli qui touche à la file.
function Link({ s }) {
  const [id, setId] = useState(s.keys.spotifyClientId || '');
  const save = async () => { await act('setKey', 'spotifyClientId', id); reload(); };
  return html`<details class="more">
    <summary>Option : envoyer les demandes directement dans ta file Spotify</summary>
    <p class="note">Tu n'en as pas besoin pour l'overlay. Spotify réserve cette partie aux comptes Premium et demande une appli à ton nom.</p>
    <ol class="steps">
      <li>Ouvre le <button class="linkish" onClick=${() => act('openExternal', 'https://developer.spotify.com/dashboard')}>tableau de bord Spotify for Developers</button> et crée une appli.</li>
      <li>Dans Redirect URIs, ajoute exactement cette adresse : <code>${s.brand.spotifyRedirect}</code></li>
      <li>Coche Web API, enregistre, puis copie le Client ID ici.</li>
    </ol>
    <div class="row">
      <${Field} label="Client ID Spotify"><input class="in" value=${id} onInput=${(e) => setId(e.target.value)} onBlur=${save} spellcheck=${false} /><//>
      <${Btn} disabled=${!id} onClick=${async () => { await save(); if (await act('spotifyLogin') !== undefined) { await reload(); toast('Spotify connecté'); } }}>Se connecter à Spotify<//>
    </div>
  </details>`;
}

function Player({ s }) {
  const st = s.spotify.state;
  const t = st?.track;
  const linked = s.spotify.connected;
  const up = async (patch) => { const out = await act('updateSpotify', patch); if (out) setState({ spotify: { ...s.spotify, ...out, connected: linked, state: s.spotify.state } }); };
  return html`<${Bay} title="Morceau en cours" aside=${linked ? html`<${Btn} onClick=${async () => { await act('spotifyLogout'); reload(); }}>Déconnecter<//>` : null}>
    <div class="player">
      ${t?.cover && html`<img src=${t.cover} alt="" />`}
      <div class="pl-txt">
        <b>${t?.title || 'Rien en lecture'}</b><span>${t?.artist || 'Lance un morceau, il apparaît ici tout seul.'}</span>
        ${t?.duration > 0 && html`<small>${clock(st.progress / 1000)} sur ${clock(t.duration / 1000)}${st.device ? `, sur ${st.device}` : ''}</small>`}
        ${st?.requester && html`<small>Demandé par ${st.requester}</small>`}
      </div>
      <div class="pl-keys">
        <button class="icon" aria-label="Morceau précédent" onClick=${() => act('spotifyControl', 'previous')}>${ICONS.prev}</button>
        <button class="icon" aria-label=${st?.playing ? 'Pause' : 'Lecture'} onClick=${() => act('spotifyControl', st?.playing ? 'pause' : 'play')}>${st?.playing ? ICONS.pause : ICONS.play}</button>
        <button class="icon" aria-label="Morceau suivant" onClick=${() => act('spotifyControl', 'next')}>${ICONS.next}</button>
      </div>
    </div>
    ${st?.queue?.length > 0 && html`<p class="note">Ensuite : ${st.queue[0].title}, ${st.queue[0].artist}</p>`}
    ${!linked && html`
      <div class="row wrap" style=${{ maxWidth: '320px' }}>
        <${Field} label="Lire depuis"><${Select} value=${s.spotify.source || 'spotify'} onChange=${(v) => up({ source: v })} options=${[{ value: 'spotify', label: 'Spotify' }, { value: 'any', label: 'Toute la musique du PC' }]} /><//>
      </div>
      <p class="note">Aucune connexion ni Premium : Régie lit le morceau affiché par Windows, y compris avec Spotify gratuit. Garde l'appli Spotify ouverte sur ce PC.</p>
      <${Link} s=${s} />`}
  <//>`;
}

function Wishes({ s }) {
  const list = s.spotify.wishlist || [];
  if (!list.length) return null;
  const done = async (id) => { const out = await act('wishDone', id); if (out) setState({ spotify: { ...s.spotify, wishlist: out } }); };
  const open = (q) => {
    const m = q.match(/track[/:]([A-Za-z0-9]{22})/);
    act('openExternal', m ? `https://open.spotify.com/track/${m[1]}` : `https://open.spotify.com/search/${encodeURIComponent(q)}`);
  };
  return html`<ul class="tool-list">${list.map((w) => html`<li key=${w.id}>
    <b>${w.query}</b><span class="tagline">${w.user}</span>
    <button type="button" class="mini" onClick=${() => open(w.query)}>Ouvrir dans Spotify</button>
    <button type="button" class="mini" onClick=${() => done(w.id)}>Fait</button>
  </li>`)}</ul>`;
}

function Requests({ s }) {
  const r = s.spotify.requests;
  const locked = !s.features.songRequests;
  const up = async (patch) => { const out = await act('updateSpotify', { requests: patch }); if (out) setState({ spotify: { ...s.spotify, ...out, connected: s.spotify.connected, state: s.spotify.state } }); };
  return html`<${Bay} title=${html`Demandes du chat ${locked ? html`<${Pro} />` : ''}`}>
    <div class="row wrap">
      <${Lamp} on=${r.enabled && !locked} locked=${locked} onChange=${(v) => up({ enabled: v })} label="Accepter les demandes" />
      <${Field} label="Commande"><${Lazy} value=${r.command} onSave=${(v) => up({ command: v })} disabled=${locked} /><//>
      <${Field} label="Qui peut demander"><${Select} value=${r.perm} onChange=${(v) => up({ perm: v })} disabled=${locked} options=${[{ value: 'all', label: 'Tout le monde' }, { value: 'sub', label: 'Abonnés' }, { value: 'vip', label: 'VIP' }, { value: 'mod', label: 'Modérateurs' }]} /><//>
      <${Field} label="Attente par spectateur (s)"><${Num} value=${r.cooldown} min="0" onSave=${(v) => up({ cooldown: v })} disabled=${locked} /><//>
      <${Field} label="Durée max (min)"><${Num} value=${r.maxLengthMin} min="1" onSave=${(v) => up({ maxLengthMin: v })} disabled=${locked} /><//>
    </div>
    <p class="note">${s.spotify.connected ? 'Un spectateur écrit la commande suivie d\'un titre ou d\'un lien, sur n\'importe quelle chaîne. Le morceau part dans ta file Spotify.' : 'Un spectateur écrit la commande suivie d\'un titre, sur n\'importe quelle chaîne. La demande arrive ici et tu la lances d\'un clic.'}</p>
    <${Wishes} s=${s} />
  <//>`;
}

export function SpotifyView({ s }) {
  const overlays = s.overlays.filter((o) => o.type === 'spotify');
  const current = overlays.find((o) => o.id === s.spotifyOverlay) || overlays[0];
  return html`<div class="page">
    <${PageHead} title="Spotify">
      ${overlays.length > 1 && html`<${Select} label="Overlay Spotify" value=${current?.id} onChange=${(v) => setState({ spotifyOverlay: v })} options=${overlays.map((o) => ({ value: o.id, label: o.name }))} />`}
      ${!current && html`<${Btn} kind="primary" onClick=${async () => { const o = await act('addOverlay', 'spotify'); if (o) reload(); }}>Créer l'overlay<//>`}
    <//>
    <${Player} s=${s} />
    ${current && html`<${Bay} title="Overlay"><${OverlayEditor} key=${current.id} s=${s} overlay=${current} compact /><//>`}
    <${Requests} s=${s} />
    ${s.spotifyHistory?.length > 0 && html`<${Bay} title="Morceaux passés"><ul class="tool-list">${s.spotifyHistory.slice(0, 20).map((h, i) => html`<li key=${i}><b>${h.title}</b><span class="tagline">${h.artist}</span></li>`)}</ul><//>`}
    <${Upsell}>FREE : le thème Capsule. PRO : Platine, Cassette, VU-mètres, Bandeau, réaction au son du PC et demandes du chat.<//>
  </div>`;
}
