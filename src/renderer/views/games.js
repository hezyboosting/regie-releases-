// Mes jeux : un profil par jeu, ses rangs, sa session, ses données en direct et ses overlays.
import { html, useState, useEffect, act, setState, reload, copy, toast, fmt } from '../store.js';
import { ICONS, Btn, Bay, Field, Lazy, Num, Select, Lamp, PageHead, Pro, Gem } from '../ui.js';
import { ThemeBar } from './overlays.js';

const KIND = { wins: 'win', losses: 'loss', draws: 'draw', kills: 'kill', deaths: 'death', assists: 'assist', goals: 'goal', saves: 'save', demos: 'demo', mvps: 'mvp' };
const TOOLS = [['gamecard', 'Carte de jeu'], ['gamelive', 'Score en direct'], ['gamepad', 'Manette'], ['keyboard', 'Clavier'], ['mouse', 'Souris'], ['rankcard', 'Suivi = Rang']];

function Tile({ g, s, on, onPick }) {
  const running = s.gameRunning === g.id;
  return html`<button type="button" class="g-tile ${on ? 'on' : ''}" aria-pressed=${on} onClick=${onPick}>
    <b>${g.name}</b>
    <small>${running ? 'Lancé maintenant' : s.gaming.active === g.id ? 'Jeu actif' : g.genre}</small>
    ${running && html`<i class="led live"></i>`}
  </button>`;
}

const imgUrl = (s, file) => (file ? `http://127.0.0.1:${s.port}/media/${encodeURIComponent(file)}?k=${encodeURIComponent(s.overlayToken)}` : '');

// Images du streamer pour chaque rang de ce jeu.
const tierHas = (images, id) => Object.keys(images).some((k) => k === id || k.startsWith(`${id}:`));
const tierImage = (images, id) => images[id] || images[Object.keys(images).find((k) => k.startsWith(`${id}:`))];

// Jeux dont Régie sait récupérer les vrais emblèmes (voir src/shared/rank-sources.js).
const OFFICIAL = new Set(['valorant', 'rocketleague', 'lol', 'fortnite', 'apex', 'r6', 'rivals', 'dbd', 'overwatch', 'dota2', 'minecraft', 'cs2', 'cod']);

function OfficialRanks({ game, done }) {
  const [busy, setBusy] = useState('');
  const run = async (which) => {
    setBusy(which);
    try {
      const r = await act('installOfficialRanks', which);
      if (r) {
        setState({ gaming: { ...r.gaming } });
        toast(r.failed.length ? `${r.done} emblèmes installés, ${r.failed.length} introuvables (connexion ?)` : `${r.done} emblèmes officiels installés${r.games > 1 ? ` pour ${r.games} jeux` : ''}`);
      }
    } finally { setBusy(''); }
  };
  if (!OFFICIAL.has(game.id)) {
    return html`<p class="note">Pas d'emblème officiel disponible en ligne pour ${game.name} : importe tes images ci-dessous.</p>`;
  }
  return html`<div class="rk-official">
    <div><b>Vrais emblèmes de ${game.name}</b><small>Téléchargés en un clic depuis leur source officielle, rang par rang${game.id === 'cs2' ? ' (plaques de classement Premier)' : ''}.</small></div>
    <div class="row tight">
      <${Btn} kind="primary" disabled=${Boolean(busy)} onClick=${() => run(game.id)}>${busy === game.id ? 'Téléchargement…' : 'Installer'}<//>
      <${Btn} disabled=${Boolean(busy)} onClick=${() => run('all')}>${busy === 'all' ? 'Téléchargement…' : 'Tous les jeux'}<//>
    </div>
  </div>`;
}

function RankImages({ s, game }) {
  const images = s.gaming.rankImages?.[game.id] || {};
  const done = (r) => {
    if (!r) return;
    setState({ gaming: { ...r.gaming } });
    if (r.missed.length) toast(`${r.done} ajoutée${r.done > 1 ? 's' : ''}. Non reconnu : ${r.missed.slice(0, 3).join(', ')}${r.missed.length > 3 ? '…' : ''}`);
    else if (r.done) toast(`${r.done} image${r.done > 1 ? 's' : ''} ajoutée${r.done > 1 ? 's' : ''}`);
  };
  if (!game.ranks.length) return null;
  return html`<${Bay} title="Images des rangs" aside=${html`<div class="row tight"><${Btn} onClick=${async () => done(await act('importRankFolder', game.id))}>Importer un dossier<//><${Btn} onClick=${async () => done(await act('importRankImages', game.id))}>Choisir des images<//></div>`}>
    <${OfficialRanks} game=${game} done=${done} />
    <p class="note">Tu peux aussi mettre tes propres images : nomme chaque fichier comme le rang, avec la division si tu veux, par exemple diamant.png ou gold-2.png. Un dossier peut contenir un sous-dossier par jeu.</p>
    <div class="rk-grid">
      ${game.ranks.map((t, step) => html`<div class="rk" key=${t.id}>
        <button type="button" class="rk-pick" title="Choisir une image" aria-label=${`Choisir une image pour ${t.name}`} onClick=${async () => done(await act('importRankImages', game.id, t.id))}><${Gem} color=${t.color} step=${step} steps=${game.ranks.length} sides=${game.sides} src=${imgUrl(s, tierImage(images, t.id))} size=${54} /></button>
        <span>${t.name}</span>
        ${tierHas(images, t.id) && html`<button type="button" class="linkish" onClick=${async () => { const r = await act('removeRankImage', game.id, t.id); if (r) setState({ gaming: { ...r } }); }}>Retirer</button>`}
      </div>`)}
    </div>
  <//>`;
}

function Ranks({ s, game, view }) {
  const prof = s.gaming.profiles[game.id] || { modes: {} };
  const tiers = game.ranks.map((t) => ({ value: t.id, label: t.name }));
  const set = async (mode, patch) => { const r = await act('setRank', game.id, mode, patch); if (r) setState({ gaming: { ...r } }); };
  if (!game.ranks.length) return null;
  return html`<${Bay} title="Mes rangs">
    <div class="g-modes">
      ${view.modes.map((m) => {
    const p = prof.modes?.[m.id] || {};
    const tier = game.ranks.find((t) => t.id === p.tier) || game.ranks[0];
    return html`<div class="g-mode" key=${m.id} style=${{ '--r': m.color }}>
          <div class="g-mode-top"><${Gem} size=${56} color=${m.color} step=${m.step} steps=${m.steps} pips=${m.pips} divisions=${m.divisions} sides=${m.sides} src=${imgUrl(s, m.image)} /><div><small>${m.name}</small><b>${m.label}</b></div>
          ${m.bestLabel && html`<span class="tagline">Record : ${m.bestLabel}</span>`}</div>
          <div class="row wrap">
            <${Field} label="Rang"><${Select} value=${tier.id} options=${tiers} onChange=${(v) => set(m.id, { tier: v, division: 1 })} /><//>
            ${tier.divisions > 0 && html`<${Field} label="Division"><${Num} value=${p.division || 1} min="1" max=${tier.divisions} onSave=${(division) => set(m.id, { division })} /><//>`}
            <${Field} label=${game.metric}><${Num} value=${m.mmr} min="0" onSave=${(mmr) => set(m.id, { mmr })} /><//>
            <${Field} label="Objectif"><${Num} value=${m.target} min="0" onSave=${(target) => set(m.id, { target })} /><//>
          </div>
          ${m.target > 0 && html`<div class="thin"><i style=${{ width: `${m.progress}%`, background: 'var(--r)' }}></i></div>`}
        </div>`;
  })}
    </div>
    <p class="note">Tu peux aussi les changer depuis le chat. Un modo écrit par exemple ${s.gaming.command} ${view.modes[0]?.id} ${game.ranks[1]?.name || ''}.</p>
  <//>`;
}

function Session({ s, game, view }) {
  const active = s.gaming.active === game.id;
  const bump = (st, by) => {
    const p = s.gaming.profiles[game.id];
    const session = { ...p.session, [st]: Math.max(0, (p.session?.[st] || 0) + by) };
    return act('updateProfile', game.id, { session }).then((r) => r && setState({ gaming: { ...r } }));
  };
  const add = (st) => (active && KIND[st] ? act('gameManual', KIND[st]) : bump(st, 1));
  return html`<${Bay} title="Session" aside=${html`<${Btn} onClick=${() => act('resetGameSession', game.id)}>Remettre à zéro<//>`}>
    <div class="g-stats">
      ${view.stats.map((x) => html`<div class="g-stat" key=${x.key}>
        <b>${fmt(x.value)}</b><span>${x.label}</span>
        <div class="row tight"><button type="button" class="mini" aria-label=${`Retirer 1 à ${x.label}`} onClick=${() => bump(x.key, -1)}>−</button><button type="button" class="mini" aria-label=${`Ajouter 1 à ${x.label}`} onClick=${() => add(x.key)}>+</button></div>
      </div>`)}
    </div>
    ${active && html`<p class="note">Dans le chat, les modos ont !win, !lose, !kill et !death. Tout le monde a !record.</p>`}
  <//>`;
}

function LiveLink({ s, game }) {
  const [state, setStatus] = useState(null);
  const [out, setOut] = useState(null);
  const locked = !s.features.gameLive;
  const refresh = () => act('gameLinkStatus').then(setStatus);
  useEffect(() => { refresh(); }, [game.id]);
  const install = async (kind) => {
    const r = await act('installGameLink', kind);
    if (!r) return;
    setOut(r);
    if (r.ok) toast('Lien installé. Relance le jeu.');
    refresh();
  };
  const linked = s.gameLinks?.[game.live];
  const rc = s.gaming.rcon;
  const upRcon = async (patch) => { const r = await act('updateGaming', { rcon: { ...rc, ...patch } }); if (r) setState({ gaming: { ...r } }); };
  const Status = ({ on, text }) => html`<span class="badge ${on ? 'ok' : ''}"><i></i>${text}</span>`;
  const heading = html`Données en direct${locked ? html` <${Pro} />` : ''}`;
  if (game.live === 'rl') {
    return html`<${Bay} title=${heading}>
      <p class="note">Rocket League sait envoyer le score, tes buts, passes, arrêts et le résultat. Il ne donne ni ton rang ni ton MMR : ceux-là restent à régler plus haut.</p>
      <div class="row tight">
        <${Btn} kind="primary" disabled=${locked} onClick=${() => install('rl')}>${state?.rl ? 'Réinstaller le lien' : 'Installer le lien'}<//>
        <${Status} on=${linked} text=${linked ? 'Partie reçue' : state?.rl ? 'Lien installé' : state?.rlFound ? 'Jeu trouvé, lien absent' : 'Jeu non trouvé'} />
      </div>
      ${out && !out.ok && html`<div class="note warn"><p>${out.reason}</p><p>Crée le fichier ${out.file} avec ce contenu dans le dossier TAGame\\Config du jeu :</p><pre>${out.content}</pre><${Btn} onClick=${() => copy(out.content, 'Contenu copié')}>Copier le contenu<//></div>`}
    <//>`;
  }
  if (game.live === 'cs2') {
    return html`<${Bay} title=${heading}>
      <p class="note">Counter-Strike 2 envoie la carte, le score, tes kills, morts, assists et MVP. Il ne donne pas ton rang.</p>
      <div class="row tight">
        <${Btn} kind="primary" disabled=${locked} onClick=${() => install('cs2')}>${state?.cs2 ? 'Réinstaller le lien' : 'Installer le lien'}<//>
        <${Status} on=${linked} text=${linked ? 'Partie reçue' : state?.cs2 ? 'Lien installé' : state?.cs2Found ? 'Jeu trouvé, lien absent' : 'Jeu non trouvé'} />
      </div>
      ${out && !out.ok && html`<div class="note warn"><p>${out.reason}</p><p>Crée le fichier ${out.file} dans game\\csgo\\cfg avec ce contenu :</p><pre>${out.content}</pre><${Btn} onClick=${() => copy(out.content, 'Contenu copié')}>Copier le contenu<//></div>`}
    <//>`;
  }
  if (game.live === 'lol') {
    return html`<${Bay} title=${heading}>
      <p class="note">Rien à installer. Pendant une partie, Régie lit ton KDA, tes CS et ton niveau sur l'accès local prévu par le jeu. Le rang reste à régler plus haut.</p>
      <${Status} on=${linked} text=${linked ? 'Partie reçue' : 'En attente d\'une partie'} />
    <//>`;
  }
  if (game.id === 'minecraft') {
    return html`<${Bay} title=${html`Actions dans Minecraft${!s.features.rcon ? html` <${Pro} />` : ''}`}>
      <p class="note">Sur ton serveur, active RCON dans server.properties, puis indique les mêmes valeurs ici. Une automatisation peut alors lancer une commande du jeu à chaque cadeau.</p>
      <div class="row wrap">
        <${Field} label="Adresse"><${Lazy} value=${rc.host} onSave=${(host) => upRcon({ host })} /><//>
        <${Field} label="Port"><${Num} value=${rc.port} min="1" max="65535" onSave=${(port) => upRcon({ port })} /><//>
        <${Field} label="Mot de passe"><${Lazy} type="password" value=${rc.password} onSave=${(password) => upRcon({ password })} /><//>
        <${Btn} disabled=${!s.features.rcon} onClick=${async () => { const r = await act('testRcon'); if (r !== undefined) toast(`Réponse du serveur : ${r || 'OK'}`); }}>Tester la connexion<//>
      </div>
    <//>`;
  }
  return html`<${Bay} title="Données en direct"><p class="note">${game.name} ne donne pas ses rangs ou ses scores à des applis comme Régie. Mets-les à jour ici, ou laisse un modo le faire depuis le chat.</p><//>`;
}

function GameAuto({ s, game }) {
  const p = s.gaming.profiles[game.id] || {};
  const up = async (patch) => { const r = await act('updateProfile', game.id, patch); if (r) setState({ gaming: { ...r } }); };
  return html`<${Bay} title="Quand ce jeu démarre">
    <div class="row wrap">
      <${Field} label="Scène OBS" hint="Vide pour ne rien changer"><${Lazy} value=${p.scene} onSave=${(scene) => up({ scene })} placeholder="Nom de la scène" /><//>
      <${Field} label="Thème des overlays"><${Select} value=${p.theme || ''} onChange=${(theme) => up({ theme })} options=${[{ value: '', label: 'Ne rien changer' }, ...s.themes.map((t) => ({ value: t.id, label: t.name }))]} /><//>
      <${Field} label="Page de la télécommande"><${Select} value=${p.deckPage || ''} onChange=${(deckPage) => up({ deckPage })} options=${[{ value: '', label: 'Ne rien changer' }, ...s.deck.pages.map((x) => ({ value: x.id, label: x.name }))]} /><//>
      <${Field} label="Pseudo en jeu" hint=${game.live === 'rl' ? 'Sert à reconnaître tes buts' : ''}><${Lazy} value=${p.pseudo} onSave=${(pseudo) => up({ pseudo })} /><//>
    </div>
    <div class="row tight wrap">
      <${Btn} onClick=${() => setState({ view: 'overlays', overlayId: null, sceneOpen: true, sceneLayout: game.id })}>${s.overlays.find((o) => o.type === 'scene')?.settings?.layouts?.[game.id] ? 'Modifier la scène de ce jeu' : 'Créer la scène de ce jeu'}<//>
      <span class="note">Les overlays se placent autrement pour ce jeu, et la scène bascule toute seule quand il démarre.</span>
    </div>
  <//>`;
}

function Tools({ s }) {
  const open = async (type) => {
    let o = s.overlays.find((x) => x.type === type);
    if (!o) { o = await act('addOverlay', type); if (!o) return; await reload(); }
    setState({ view: 'overlays', overlayId: o.id });
  };
  return html`<${Bay} title="Overlays de jeu">
    <div class="chips">${TOOLS.map(([type, name]) => html`<button type="button" class="chip" key=${type} onClick=${() => open(type)}>${name}</button>`)}</div>
  <//>`;
}

function Keys({ s }) {
  const on = s.keysCfg.enabled;
  return html`<${Bay} title="Touches simulées">
    <${Lamp} on=${on} label="Autoriser Régie à presser des touches" onChange=${async (v) => { const r = await act('setKeysEnabled', v); if (r) setState({ keysCfg: r }); }} />
    <p class="note">Une fois activé, un cadeau, une commande ou un bouton de la télécommande peut presser une touche dans ton jeu. Évite les touches qui peuvent gêner ta partie, et vérifie les règles du jeu en classé. Limite : dix par seconde.</p>
    <div class="row tight"><${Btn} disabled=${!on} onClick=${() => { act('testKey', 'F13'); toast('Touche F13 envoyée'); }}>Envoyer une touche d'essai<//></div>
  <//>`;
}

// Serveurs de jeu : Rust, ARK, Palworld, GMod, CS2… reçoivent des commandes à chaque cadeau ou case de roue.
function RconBay({ s }) {
  const list = s.gaming.servers || [];
  const presets = s.rconPresets || {};
  const save = async (next) => { const r = await act('saveServers', next); if (r) setState({ gaming: { ...r } }); };
  const up = (i, patch) => save(list.map((x, j) => (i === j ? { ...x, ...patch } : x)));
  const add = () => save([...list, { id: `srv${Date.now().toString(36)}`, preset: 'rust', name: presets.rust?.name || 'Rust', kind: 'webrcon', host: '127.0.0.1', port: presets.rust?.port || 28016, password: '' }]);
  return html`<${Bay} title=${html`Serveurs de jeu (RCON)${!s.features.rcon ? html` <${Pro} />` : ''}`}>
    <p class="note">Rust, ARK, Palworld, Garry's Mod, CS2, Squad, Conan Exiles, Factorio, 7 Days to Die… Un cadeau ou une case de la roue envoie une commande à ton serveur. Minecraft se règle dans sa propre fiche.</p>
    ${list.map((x, i) => html`<div class="srv" key=${x.id}>
      <div class="row wrap">
        <${Field} label="Jeu"><${Select} value=${x.preset} onChange=${(preset) => up(i, { preset, name: presets[preset]?.name || x.name, kind: presets[preset]?.kind || 'source', port: presets[preset]?.port || x.port })} options=${Object.entries(presets).filter(([k]) => k !== 'minecraft').map(([value, p]) => ({ value, label: p.name }))} /><//>
        <${Field} label="Adresse"><${Lazy} value=${x.host} onSave=${(host) => up(i, { host })} /><//>
        <${Field} label="Port"><${Num} value=${x.port} min="1" max="65535" onSave=${(port) => up(i, { port })} /><//>
        <${Field} label="Mot de passe"><${Lazy} type="password" value=${x.password} onSave=${(password) => up(i, { password })} /><//>
      </div>
      <div class="row tight wrap">
        <${Btn} disabled=${!s.features.rcon} onClick=${async () => { const r = await act('testServer', x.id); if (r !== undefined) toast(`Réponse du serveur : ${String(r || 'OK').slice(0, 120)}`); }}>Tester<//>
        <${Btn} kind="danger" onClick=${() => save(list.filter((_, j) => j !== i))}>Retirer<//>
        <span class="note">${x.kind === 'webrcon' ? 'WebRCON' : x.kind === 'telnet' ? 'Telnet' : 'RCON Source'}</span>
      </div>
      <p class="note">Exemples : ${(presets[x.preset]?.examples || []).map((e, k) => html`<code key=${k} class="ex" onClick=${() => copy(e, 'Commande copiée')}>${e}</code>`)}</p>
    </div>`)}
    <div class="row tight"><${Btn} icon=${ICONS.plus} disabled=${!s.features.rcon} onClick=${add}>Ajouter un serveur<//></div>
  <//>`;
}

// Manette virtuelle : une manette Xbox branchée par logiciel, pour les jeux qui ignorent le clavier.
function VirtualPadBay({ s }) {
  const v = s.vpadCfg || { enabled: false, state: 'off' };
  const set = async (on) => { const r = await act('setVpadEnabled', on); if (r) setState({ vpadCfg: r }); };
  const label = v.state === 'on' ? 'Branchée' : v.state === 'error' ? 'Problème' : 'Débranchée';
  return html`<${Bay} title="Manette virtuelle">
    <${Lamp} on=${v.enabled} label="Autoriser Régie à piloter une manette virtuelle" onChange=${set} />
    <p class="note">Une manette Xbox apparaît dans Windows : le chat peut appuyer sur ses boutons, ses gâchettes et ses sticks. Idéal pour les jeux qui ignorent les touches du clavier. Il faut le pilote gratuit ViGEmBus, à installer une fois.</p>
    <div class="row tight wrap">
      <span class="badge ${v.state === 'on' ? 'ok' : ''}"><i></i>${label}</span>
      <${Btn} disabled=${!v.enabled} onClick=${async () => { if (await act('testPad', 'a')) toast('Bouton A envoyé'); }}>Appuyer sur A<//>
      <${Btn} onClick=${() => act('openExternal', 'https://github.com/nefarius/ViGEmBus/releases')}>Installer ViGEmBus<//>
    </div>
    ${v.error && html`<p class="note warn">${v.error}</p>`}
  <//>`;
}

export function Games({ s }) {
  const [id, setId] = useState(s.gaming.active);
  const [view, setView] = useState(null);
  const [themes, setThemes] = useState(false);
  const game = s.gameCatalog.find((g) => g.id === id) || s.gameCatalog[0];
  useEffect(() => { act('gameViewOf', id).then(setView); }, [id, s.gaming]);
  const active = s.gaming.active === game.id;
  return html`<div class="page">
    <${PageHead} title="Mes jeux">
      <${Lamp} on=${s.gaming.auto} label="Détecter le jeu lancé" onChange=${async (auto) => { const r = await act('updateGaming', { auto }); if (r) setState({ gaming: { ...r } }); }} />
      <${Btn} onClick=${() => setThemes(!themes)}>Thème<//>
    <//>
    ${themes && html`<${ThemeBar} s=${s} onDone=${() => setThemes(false)} />`}
    <div class="g-grid">${s.gameCatalog.map((g) => html`<${Tile} key=${g.id} g=${g} s=${s} on=${id === g.id} onPick=${() => setId(g.id)} />`)}</div>
    <div class="g-head">
      <div><h3>${game.name}</h3><small>${game.genre}</small></div>
      ${active ? html`<span class="badge ok"><i></i>Jeu actif</span>` : html`<${Btn} kind="primary" onClick=${async () => { const r = await act('setActiveGame', game.id); if (r) { setState({ gaming: { ...r } }); toast(`${game.name} est maintenant ton jeu actif`); } }}>Utiliser ce jeu<//>`}
    </div>
    ${view && view.id === game.id && html`
      <${Ranks} s=${s} game=${game} view=${view} />
      <${RankImages} s=${s} game=${game} />
      <div class="two">
        <${Session} s=${s} game=${game} view=${view} />
        <${LiveLink} s=${s} game=${game} />
      </div>
      <${GameAuto} s=${s} game=${game} />
    `}
    <div class="two"><${Tools} s=${s} /><${Keys} s=${s} /></div>
    <div class="two"><${VirtualPadBay} s=${s} /><${RconBay} s=${s} /></div>
  </div>`;
}
