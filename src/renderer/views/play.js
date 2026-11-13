// Le chat joue et Paris : deux pages de la section « Jeux avec le chat » et « Communauté ».
import { html, useState, useEffect, act, setState, toast, fmt, tr } from '../store.js';
import { ICONS, Btn, Bay, Field, Num, Lazy, Lamp, PageHead, Segments, Select, Text, go } from '../ui.js';
import { Actions } from './commands.js';

const uid = () => Math.random().toString(36).slice(2, 10);

function openOverlay(s, type) {
  const o = s.overlays.find((x) => x.type === type);
  if (o) setState({ view: 'overlays', overlayId: o.id, sceneOpen: false });
  else toast('Ajoute cet overlay depuis la page Overlays.');
}

// ---------- Le chat joue ----------
const key = (k, hold = 500) => [{ type: 'key', key: k, hold }];
const pad = (input, hold = 400) => [{ type: 'pad', input, hold }];
const PRESETS = [
  { name: 'Déplacements', emoji: '🧭', commands: [
    ['avance', 'z,w,haut', 'Avancer', '⬆️', key('W', 700)], ['recule', 's,bas', 'Reculer', '⬇️', key('S', 700)],
    ['gauche', 'q,a', 'Gauche', '⬅️', key('A', 500)], ['droite', 'd', 'Droite', '➡️', key('D', 500)], ['saute', 'jump,espace', 'Sauter', '🦘', key('Space', 80)],
  ] },
  { name: 'Jeu de tir', emoji: '🎯', commands: [
    ['avance', 'z,w', 'Avancer', '⬆️', key('W', 800)], ['recule', 's', 'Reculer', '⬇️', key('S', 800)], ['gauche', 'q,a', 'Gauche', '⬅️', key('A', 500)],
    ['droite', 'd', 'Droite', '➡️', key('D', 500)], ['saute', 'jump', 'Sauter', '🦘', key('Space', 80)], ['accroupi', 'crouch', "S'accroupir", '🧎', key('Ctrl', 1200)],
    ['recharge', 'reload,r', 'Recharger', '🔄', key('R', 80)], ['utilise', 'e,use', 'Utiliser', '✋', key('E', 80)],
  ] },
  { name: 'Minecraft', emoji: '⛏️', commands: [
    ['avance', 'z,w', 'Avancer', '⬆️', key('W', 1000)], ['recule', 's', 'Reculer', '⬇️', key('S', 800)], ['gauche', 'q,a', 'Gauche', '⬅️', key('A', 600)],
    ['droite', 'd', 'Droite', '➡️', key('D', 600)], ['saute', 'jump', 'Sauter', '🦘', key('Space', 80)], ['sprint', 'cours', 'Sprinter', '💨', key('Ctrl', 1500)],
    ['sneak', 'accroupi', "S'accroupir", '🧎', key('Shift', 1500)], ['jette', 'drop', "Jeter l'objet", '🗑️', key('Q', 80)],
  ] },
  { name: 'Manette', emoji: '🎮', commands: [
    ['haut', 'avance', 'Haut', '⬆️', pad('ls-haut', 700)], ['bas', 'recule', 'Bas', '⬇️', pad('ls-bas', 700)], ['gauche', '', 'Gauche', '⬅️', pad('ls-gauche', 500)],
    ['droite', '', 'Droite', '➡️', pad('ls-droite', 500)], ['a', 'saute', 'Bouton A', '🅰️', pad('a', 120)], ['b', '', 'Bouton B', '🅱️', pad('b', 120)], ['tire', 'rt', 'Gâchette', '🔫', pad('rt', 400)],
  ] },
];

function PlayLive({ s, live }) {
  const v = live || {};
  const cmds = v.commands || [];
  const total = Object.values(v.tallies || {}).reduce((n, x) => n + x, 0);
  const [, tick] = useState(0);
  useEffect(() => { if (!v.round) return undefined; const t = setInterval(() => tick((n) => n + 1), 200); return () => clearInterval(t); }, [v.round?.endsAt]);
  const left = v.round ? Math.max(0, Math.ceil((v.round.endsAt - Date.now()) / 1000)) : 0;
  return html`<${Bay} title="En direct" aside=${v.mode === 'vote' ? (v.round ? html`<span class="badge">${left} s</span>` : html`<span class="tagline">En attente d'un vote</span>`) : html`<span class="tagline">Mode chaos</span>`}>
    ${!s.chatPlays.enabled && html`<p class="note">C'est coupé : active « Le chat contrôle le jeu » pour que les messages déclenchent les actions.</p>`}
    ${v.mode === 'vote' && html`<div class="cpl-bars">${cmds.map((c) => {
    const n = v.tallies?.[c.id] || 0;
    return html`<div class="cpl-bar" key=${c.id}><span class="cpl-emo">${c.emoji}</span><b>${c.label}</b><div class="cpl-track"><i style=${{ width: `${total ? (n / total) * 100 : 0}%` }}></i></div><span class="cpl-n">${n}</span></div>`;
  })}</div>`}
    <h4 class="fun-h">Dernières actions</h4>
    ${(v.recent || []).length ? html`<ul class="tool-list">${v.recent.map((r, i) => html`<li key=${i}><b>${r.emoji} ${r.label}</b><span class="tagline">${r.votes ? `${r.votes} ${r.votes > 1 ? 'votes' : 'vote'} sur ${r.total || r.votes}` : r.user}</span></li>`)}</ul>` : html`<p class="note">Rien pour l'instant. Tape un mot dans le chat ou clique sur Tester.</p>`}
  <//>`;
}

function PlayCommand({ c, i, s, up, remove }) {
  const [open, setOpen] = useState(false);
  return html`<div class="cp-card ${open ? 'open' : ''} ${c.enabled === false ? 'off' : ''}">
    <div class="cp-card-row">
      <${Lazy} class="cp-emoji" value=${c.emoji || ''} aria-label="Emoji" onSave=${(emoji) => up(i, { emoji })} />
      <div class="cp-card-txt"><b>${c.label || c.word}</b><span class="tagline">${s.chatPlays.prefix || ''}${c.word}${c.aliases ? `, ${c.aliases}` : ''}</span></div>
      <span class="cp-card-act">${(c.actions || []).map((a) => a.type === 'key' ? `Touche ${a.key || '?'}` : a.type === 'pad' ? `Manette ${a.input}` : a.type).join(' + ') || 'Aucune action'}</span>
      <${Lamp} on=${c.enabled !== false} aria-label="Activer" onChange=${(enabled) => up(i, { enabled })} />
      <${Btn} onClick=${() => act('playsControl', 'test', { id: c.id })}>Tester<//>
      <${Btn} kind="ghost" onClick=${() => setOpen(!open)}>${open ? 'Fermer' : 'Modifier'}<//>
    </div>
    ${open && html`<div class="cp-card-body">
      <div class="form-grid top">
        <${Field} label="Mot à écrire"><${Lazy} value=${c.word} onSave=${(word) => up(i, { word: word.trim().toLowerCase() })} /><//>
        <${Field} label="Autres mots acceptés" hint="Séparés par des virgules"><${Lazy} value=${c.aliases || ''} onSave=${(aliases) => up(i, { aliases })} /><//>
        <${Field} label="Nom affiché"><${Lazy} value=${c.label || ''} onSave=${(label) => up(i, { label })} /><//>
      </div>
      <${Actions} list=${c.actions || []} s=${s} onChange=${(actions) => up(i, { actions })} />
      <div class="row tight"><${Btn} kind="danger" icon=${ICONS.trash} onClick=${() => remove(i)}>Supprimer<//></div>
    </div>`}
  </div>`;
}

export function ChatPlaysView({ s }) {
  const c = s.chatPlays;
  const [undo, setUndo] = useState(null);
  const [live, setLive] = useState(s.playsLive);
  useEffect(() => { act('playsView').then((v) => v && setLive(v)); }, []);
  useEffect(() => { if (s.playsLive) setLive(s.playsLive); }, [s.playsLive]);
  const save = async (patch) => { const o = await act('playsControl', 'config', patch); if (o) setState({ chatPlays: { ...o } }); };
  const up = (i, patch) => save({ commands: c.commands.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const remove = (i) => save({ commands: c.commands.filter((_, j) => j !== i) });
  const usePreset = (p) => {
    setUndo(c.commands);
    save({ commands: p.commands.map(([word, aliases, label, emoji, actions]) => ({ id: uid(), word, aliases, label, emoji, actions })) });
    toast(`Commandes « ${p.name} » chargées`);
  };
  const needsKeys = c.commands.some((x) => (x.actions || []).some((a) => a.type === 'key')) && !s.keysCfg?.enabled;
  const needsPad = c.commands.some((x) => (x.actions || []).some((a) => a.type === 'pad')) && !s.vpadCfg?.enabled;
  return html`<div class="page">
    <${PageHead} title="Le chat joue">
      <${Btn} onClick=${() => act('playsControl', 'test')}>Tester<//>
      <${Btn} onClick=${() => act('playsControl', 'reset')}>Remettre à zéro<//>
      <${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'chatplays')}>Overlay<//>
    <//>
    <p class="lead">${`Tes spectateurs écrivent « avance », « saute » ou « gauche » dans le chat et ton personnage le fait. En vote, le plus demandé gagne toutes les ${c.voteSeconds || 6} secondes. En chaos, chaque message compte.`}</p>
    ${(needsKeys || needsPad) && html`<div class="banner warn"><span>${needsKeys ? 'Active les touches simulées dans Mes jeux pour que Régie presse les touches.' : 'Active la manette virtuelle dans Mes jeux.'}</span><${Btn} onClick=${() => go('games')}>Ouvrir Mes jeux<//></div>`}
    <div class="cols2">
      <${Bay} title="Réglages">
        <div class="row wrap tight"><${Lamp} on=${c.enabled} label="Le chat contrôle le jeu" onChange=${(enabled) => save({ enabled })} /></div>
        <${Segments} value=${c.mode} onChange=${(mode) => save({ mode })} options=${[{ value: 'vote', label: 'Vote' }, { value: 'chaos', label: 'Chaos' }]} />
        <p class="note">${c.mode === 'vote' ? 'Le chat vote pendant quelques secondes, puis Régie lance la commande la plus demandée. Idéal pour les jeux où une mauvaise touche coûte cher.' : 'Chaque message lance son action tout de suite, dans la limite par seconde. Drôle et imprévisible.'}</p>
        <div class="form-grid top">
          ${c.mode === 'vote' ? html`<${Field} label="Durée d'un vote (s)"><${Num} value=${c.voteSeconds} min="2" max="60" onSave=${(voteSeconds) => save({ voteSeconds })} /><//>` : html`<${Field} label="Actions par seconde au maximum"><${Num} value=${c.maxPerSecond} min="1" max="20" onSave=${(maxPerSecond) => save({ maxPerSecond })} /><//>`}
          <${Field} label="Attente par spectateur (s)"><${Num} value=${c.userCooldown} min="0" max="60" onSave=${(userCooldown) => save({ userCooldown })} /><//>
          <${Field} label="Préfixe" hint="Vide : le mot seul suffit"><${Lazy} value=${c.prefix || ''} placeholder="!" onSave=${(prefix) => save({ prefix })} /><//>
        </div>
      <//>
      <${PlayLive} s=${s} live=${live} />
    </div>
    <${Bay} title="Commandes" aside=${html`<span class="tagline">${c.commands.length > 1 ? `${c.commands.length} commandes` : `${c.commands.length} commande`}</span>`}>
      <div class="row wrap tight">
        <span class="tagline">Modèles :</span>
        ${PRESETS.map((p) => html`<button type="button" class="chip" key=${p.name} onClick=${() => usePreset(p)}>${p.emoji} ${p.name}</button>`)}
        ${undo && html`<${Btn} kind="ghost" onClick=${() => { save({ commands: undo }); setUndo(null); }}>Annuler le modèle<//>`}
      </div>
      <div class="cp-list">${c.commands.map((x, i) => html`<${PlayCommand} key=${x.id} c=${x} i=${i} s=${s} up=${up} remove=${remove} />`)}</div>
      <div class="row tight"><${Btn} icon=${ICONS.plus} onClick=${() => save({ commands: [...c.commands, { id: uid(), word: 'action', aliases: '', label: 'Nouvelle action', emoji: '✨', actions: key('E', 80) }] })}>Ajouter une commande<//></div>
    <//>
  </div>`;
}

// ---------- Paris ----------
const TEMPLATES = [
  { q: 'On gagne cette partie ?', o: ['Oui', 'Non'] },
  { q: 'On finit dans le top 3 ?', o: ['Oui', 'Non'] },
  { q: 'Combien de kills cette partie ?', o: ['0 à 2', '3 à 5', '6 à 9', '10 ou plus'] },
  { q: 'Qui gagne le duel ?', o: ['Équipe rouge', 'Équipe bleue'] },
];

function Countdown({ at }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, [at]);
  const left = Math.max(0, Math.ceil((at - Date.now()) / 1000));
  return html`<span class="badge">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>`;
}

const COLORS = ['#57B8FF', '#FF5C8A', '#FFC53D', '#3DF0C2'];
const STATUS = { open: 'Paris ouverts', locked: 'Paris fermés', done: 'Terminé', cancelled: 'Annulé', idle: 'Aucun pari' };

function NewPrediction({ s }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [secs, setSecs] = useState(120);
  const open = async () => { const v = await act('predictionOpen', { question: q, options: opts, seconds: secs }); if (v) { setState({ predictionLive: v }); toast('Paris ouverts'); } };
  return html`<${Bay} title="Nouveau pari">
    <div class="row wrap tight"><span class="tagline">Idées :</span>${TEMPLATES.map((t) => html`<button type="button" class="chip" key=${t.q} onClick=${() => { setQ(tr(t.q)); setOpts(t.o.map(tr)); }}>${t.q}</button>`)}</div>
    <${Field} label="Question" wide><${Text} value=${q} onChange=${setQ} placeholder="On gagne cette partie ?" /><//>
    <div class="pr-form-opts">${opts.map((o, i) => html`<div class="pr-form-opt" key=${i} style=${{ '--c': COLORS[i] }}>
      <span class="pr-dot">${i + 1}</span><${Text} value=${o} onChange=${(v) => setOpts(opts.map((x, j) => (j === i ? v : x)))} placeholder=${`Réponse ${i + 1}`} />
      ${opts.length > 2 && html`<button type="button" class="icon-btn" aria-label="Retirer" onClick=${() => setOpts(opts.filter((_, j) => j !== i))}>${ICONS.x}</button>`}
    </div>`)}</div>
    <div class="row wrap tight">
      ${opts.length < 4 && html`<${Btn} icon=${ICONS.plus} onClick=${() => setOpts([...opts, ''])}>Ajouter une réponse<//>`}
      <${Field} label="Temps pour miser (s)" hint="0 : tu fermes toi-même"><${Num} value=${secs} min="0" max="3600" onSave=${setSecs} /><//>
    </div>
    <div class="row tight"><${Btn} kind="primary" onClick=${open}>Ouvrir les paris<//></div>
  <//>`;
}

function Running({ v }) {
  const set = (x) => x && setState({ predictionLive: x });
  return html`<${Bay} title=${v.question} aside=${html`<span class="pr-aside"><span class="pr-chip ${v.status}">${STATUS[v.status]}</span>${v.status === 'open' && v.closesAt ? html`<${Countdown} at=${v.closesAt} />` : ''}</span>`}>
    <div class="pr-live">${v.options.map((o, i) => html`<div class="pr-live-opt ${v.winner === i ? 'win' : ''}" key=${i} style=${{ '--c': COLORS[i] }}>
      <i class="pr-live-bar" style=${{ width: `${Math.max(1, o.pct * 100)}%` }}></i>
      <span class="pr-dot">${i + 1}</span>
      <div class="pr-live-txt"><b>${o.label}</b><span class="tagline">${`${fmt(o.count)} ${o.count > 1 ? 'parieurs' : 'parieur'} · ${fmt(o.total)} points · cote ×${o.ratio ? o.ratio.toFixed(2) : '—'}`}</span></div>
      ${(v.status === 'open' || v.status === 'locked') && html`<${Btn} onClick=${async () => set(await act('predictionResolve', i))}>C'est la bonne réponse<//>`}
    </div>`)}</div>
    <p class="note">${`${fmt(v.total)} points en jeu, ${fmt(v.count)} ${v.count > 1 ? 'parieurs' : 'parieur'}. Les gagnants se partagent toute la cagnotte au prorata de leur mise.`}</p>
    <div class="row wrap tight">
      ${v.status === 'open' && html`<${Btn} onClick=${async () => set(await act('predictionLock'))}>Fermer les mises<//>`}
      ${v.status === 'open' && html`<${Btn} kind="ghost" onClick=${async () => set(await act('predictionSimulate'))}>Simuler des mises<//>`}
      <${Btn} kind="danger" onClick=${async () => { set(await act('predictionCancel')); toast('Pari annulé, tout le monde est remboursé'); }}>Annuler et rembourser<//>
    </div>
  <//>`;
}

export function PredictionView({ s }) {
  const [v, setV] = useState(s.predictionLive);
  useEffect(() => { act('predictionView').then((x) => x && setV(x)); }, []);
  useEffect(() => { if (s.predictionLive) setV(s.predictionLive); }, [s.predictionLive]);
  const r = s.rewards;
  const upR = async (patch) => { const o = await act('updateRewards', patch); if (o) setState({ rewards: o }); };
  const running = v && (v.status === 'open' || v.status === 'locked');
  const last = v?.history?.[0];
  return html`<div class="page">
    <${PageHead} title="Paris">
      <${Btn} onClick=${() => act('testOverlay', 'prediction')}>Tester l'overlay<//>
      <${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'prediction')}>Overlay<//>
    <//>
    <p class="lead">${`Pose une question, tes spectateurs misent leurs points avec ${r.commandBet || '!parier'} 1 100 (ou « tout »). Quand tu donnes la bonne réponse, les gagnants se partagent la cagnotte. Si personne n'a misé dessus, tout le monde est remboursé.`}</p>
    ${!r.enabled && html`<div class="banner warn"><span>Les points sont coupés : les spectateurs n'en gagnent pas.</span><${Btn} onClick=${() => go('pointshop')}>Boutique de points<//></div>`}
    ${running ? html`<${Running} v=${v} />` : html`<${NewPrediction} s=${s} />`}
    ${!running && v?.status === 'done' && last && html`<div class="pr-result"><span>🏆</span><div><b>${last.winner}</b><span class="tagline">${last.question}</span><span class="tagline">${last.winners > 1 ? `${fmt(last.total)} points partagés entre ${last.winners} gagnants` : `${fmt(last.total)} points pour ${last.winners} gagnant`}</span></div></div>`}
    <div class="cols2">
      <${Bay} title="Réglages">
        <div class="form-grid top">
          <${Field} label="Commande pour miser"><${Lazy} value=${r.commandBet || ''} placeholder="!parier" onSave=${(commandBet) => upR({ commandBet })} /><//>
          <${Field} label="Mise minimum"><${Num} value=${r.minBet ?? 10} min="1" onSave=${(minBet) => upR({ minBet })} /><//>
        </div>
        <p class="note">Les spectateurs gagnent leurs points en discutant, en likant et en offrant des cadeaux. Les taux se règlent dans la Boutique de points.</p>
      <//>
      <${Bay} title="Derniers paris">
        ${(v?.history || []).length ? html`<ul class="tool-list">${v.history.map((h, i) => html`<li key=${i}><b>${h.question}</b><span class="tagline">${h.winner}</span><span class="tagline">${h.winners > 1 ? `${fmt(h.total)} points, ${h.winners} gagnants` : `${fmt(h.total)} points, ${h.winners} gagnant`}</span></li>`)}</ul>` : html`<p class="note">Aucun pari terminé pour l'instant.</p>`}
      <//>
    </div>
  </div>`;
}

// ---------- Plinko ----------
const PK_PRESETS = [{ id: 'doux', label: 'Petits gains sûrs' }, { id: 'equilibre', label: 'Équilibré' }, { id: 'gros', label: 'Gros gains rares' }];
const binomial = (rows) => { const out = []; let c = 1; for (let k = 0; k <= rows; k += 1) { out.push(c / 2 ** rows); c = (c * (rows - k)) / (k + 1); } return out; };
const pct = (p) => (p >= 0.1 ? `${Math.round(p * 100)} %` : p >= 0.001 ? `${(p * 100).toFixed(1).replace('.', ',')} %` : '< 0,1 %');

function PlinkoBin({ b, i, odds, mode, up, s, open, setOpen }) {
  return html`<button type="button" class="pkb ${open ? 'on' : ''}" style=${{ '--c': b.color }} onClick=${() => setOpen(open ? -1 : i)} title=${`Case ${i + 1}`}>
    <b>${b.label}</b><small>${pct(odds[i] || 0)}</small>${b.actions?.length ? html`<i class="pkb-dot" aria-label="Avec des actions"></i>` : ''}
  </button>`;
}

export function PlinkoView({ s }) {
  const c = s.plinko;
  const [open, setOpen] = useState(-1);
  const [recent, setRecent] = useState([]);
  useEffect(() => { act('plinkoView').then((v) => v && setRecent(v.recent || [])); }, []);
  useEffect(() => { if (s.plinkoLand) setRecent((r) => [s.plinkoLand, ...r.filter((x) => x.id !== s.plinkoLand.id)].slice(0, 8)); }, [s.plinkoLand]);
  const save = async (patch) => { const o = await act('plinkoControl', 'config', patch); if (o) setState({ plinko: { ...o } }); };
  const odds = c.mode === 'weights' ? (() => { const t = c.bins.reduce((n, b) => n + Math.max(0, Number(b.weight) || 0), 0) || 1; return c.bins.map((b) => Math.max(0, Number(b.weight) || 0) / t); })() : binomial(c.rows);
  const ev = c.bins.reduce((n, b, i) => n + (Number(b.mult) || 0) * (odds[i] || 0), 0);
  const upBin = (i, patch) => save({ bins: c.bins.map((b, j) => (j === i || (patch.mirror !== false && j === c.bins.length - 1 - i) ? { ...b, ...patch, mirror: undefined } : b)) });
  const b = c.bins[open];
  const giftOpts = [{ value: '', label: 'Tous les cadeaux' }, ...(s.gifts || []).slice().sort((x, y) => x.cost - y.cost).map((g) => ({ value: String(g.id), label: `${g.name} (${g.cost})` }))];
  return html`<div class="page">
    <${PageHead} title="Plinko">
      <${Btn} onClick=${() => act('plinkoTest', 1)}>Lâcher une balle<//>
      <${Btn} onClick=${() => act('plinkoTest', 8)}>Lâcher 8 balles<//>
      <${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'plinko')}>Overlay<//>
    <//>
    <p class="lead">${`Chaque cadeau tombe avec sa vraie image TikTok et rebondit jusqu'à une case. La case donne des points au spectateur, et peut jouer un son ou lancer une action dans ton jeu. Les spectateurs peuvent aussi miser leurs points avec ${c.bet.command || '!plinko'} 100 : la case multiplie leur mise.`}</p>
    <div class="cols2">
      <${Bay} title="Réglages">
        <div class="row wrap tight"><${Lamp} on=${c.enabled} label="Plinko activé" onChange=${(enabled) => save({ enabled })} /></div>
        <div class="form-grid top">
          <${Field} label="Rangées de clous" hint="De 6 à 16. Changer recrée les cases."><${Num} value=${c.rows} min="6" max="16" onSave=${(rows) => save({ rows })} /><//>
          <${Field} label="Balles en même temps"><${Num} value=${c.maxBalls} min="1" max="60" onSave=${(maxBalls) => save({ maxBalls })} /><//>
        </div>
        <${Segments} value=${c.mode} onChange=${(mode) => save({ mode })} options=${[{ value: 'natural', label: 'Comme une vraie planche' }, { value: 'weights', label: 'Chances choisies' }]} />
        <p class="note">${c.mode === 'natural' ? 'Chaque rebond part à gauche ou à droite au hasard : les cases du centre tombent bien plus souvent que celles des bords.' : 'Tu choisis la chance de chaque case ; la balle prend un chemin qui y mène.'}</p>
      <//>
      <${Bay} title="Cadeaux et mises">
        <div class="row wrap tight"><${Lamp} on=${c.gifts.enabled} label="Les cadeaux lâchent des balles" onChange=${(enabled) => save({ gifts: { enabled } })} /></div>
        <div class="form-grid top">
          <${Field} label="Cadeau"><${Select} value=${c.gifts.giftId || ''} onChange=${(giftId) => save({ gifts: { giftId } })} options=${giftOpts} /><//>
          <${Field} label="Prix minimum (pièces)"><${Num} value=${c.gifts.minCoins} min="1" onSave=${(minCoins) => save({ gifts: { minCoins } })} /><//>
          <${Field} label="Balles par cadeau"><${Num} value=${c.gifts.perGift} min="1" max="10" onSave=${(perGift) => save({ gifts: { perGift } })} /><//>
          <${Field} label="Balles max par envoi" hint="Pour les combos"><${Num} value=${c.gifts.maxPerGift} min="1" max="50" onSave=${(maxPerGift) => save({ gifts: { maxPerGift } })} /><//>
        </div>
        <div class="row wrap tight"><${Lamp} on=${c.bet.enabled} label="Mise en points dans le chat" onChange=${(enabled) => save({ bet: { enabled } })} /></div>
        ${c.bet.enabled && html`<div class="form-grid top">
          <${Field} label="Commande"><${Lazy} value=${c.bet.command} onSave=${(command) => save({ bet: { command: command.trim() || '!plinko' } })} /><//>
          <${Field} label="Mise minimum"><${Num} value=${c.bet.min} min="1" onSave=${(min) => save({ bet: { min } })} /><//>
          <${Field} label="Mise maximum" hint="0 : sans limite"><${Num} value=${c.bet.max} min="0" onSave=${(max) => save({ bet: { max } })} /><//>
          <${Field} label="Attente entre deux mises (s)"><${Num} value=${c.bet.cooldown} min="0" max="120" onSave=${(cooldown) => save({ bet: { cooldown } })} /><//>
        </div>
        <${Lamp} on=${c.bet.announce} label="Annoncer le résultat dans le chat" onChange=${(announce) => save({ bet: { announce } })} />`}
      <//>
    </div>
    <${Bay} title="Cases" aside=${html`<span class="tagline">${`La planche rend ${Math.round(ev * 100)} % des mises en moyenne`}</span>`}>
      <div class="row wrap tight"><span class="tagline">Modèles :</span>${PK_PRESETS.map((p) => html`<button type="button" class="chip" key=${p.id} onClick=${() => { save({ preset: p.id }); setOpen(-1); }}>${p.label}</button>`)}</div>
      <div class="pkb-row">${c.bins.map((x, i) => html`<${PlinkoBin} key=${i} b=${x} i=${i} odds=${odds} mode=${c.mode} s=${s} open=${open === i} setOpen=${setOpen} />`)}</div>
      ${b ? html`<div class="pkb-edit">
        <div class="form-grid top">
          <${Field} label="Texte de la case"><${Lazy} value=${b.label} onSave=${(label) => upBin(open, { label })} /><//>
          <${Field} label="Multiplicateur" hint="Pour les mises en points"><${Num} value=${b.mult} min="0" step="0.1" onSave=${(mult) => upBin(open, { mult })} /><//>
          <${Field} label="Points pour un cadeau"><${Num} value=${b.points} min="0" onSave=${(points) => upBin(open, { points })} /><//>
          ${c.mode === 'weights' && html`<${Field} label="Chance (poids)"><${Num} value=${b.weight} min="0" step="0.1" onSave=${(weight) => upBin(open, { weight })} /><//>`}
          <${Field} label="Couleur"><input type="color" class="in" value=${b.color} onChange=${(e) => upBin(open, { color: e.target.value })} /><//>
        </div>
        <p class="note">La case symétrique change en même temps. Les actions se lancent à chaque balle qui tombe ici.</p>
        <${Actions} list=${b.actions || []} s=${s} onChange=${(actions) => upBin(open, { actions })} />
      </div>` : html`<p class="note">Clique sur une case pour changer son texte, ses gains ou lui donner une action (son, touche dans le jeu, scène OBS…).</p>`}
    <//>
    <${Bay} title="Derniers gains">
      ${recent.length ? html`<ul class="tool-list">${recent.map((r) => html`<li key=${r.id}><b>${r.user || '—'}</b><span class="tagline">${r.bet ? `${r.label} · mise ${fmt(r.bet)} → ${fmt(r.payout)} points` : `${r.label} · ${fmt(r.payout)} points`}</span></li>`)}</ul>` : html`<p class="note">Aucune balle pour l'instant. Clique sur « Lâcher une balle » pour essayer.</p>`}
    <//>
  </div>`;
}
