import { html, useState, useEffect, act, setState, fmt, copy, reload, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Lamp, Lazy, Num, Segments, Select, PageHead, Tag, Empty, Gem } from '../ui.js';
import { Actions } from './commands.js';

const METRICS = [{ value: 'coins', label: 'Cadeaux' }, { value: 'likes', label: 'Likes' }, { value: 'points', label: 'Points' }, { value: 'messages', label: 'Messages' }, { value: 'shares', label: 'Partages' }, { value: 'subs', label: 'Abonnements' }, { value: 'follows', label: 'Suivis' }];
const SCOPES = [{ value: 'session', label: 'Ce live' }, { value: 'today', label: 'Aujourd\'hui' }, { value: 'week', label: '7 jours' }, { value: 'month', label: '30 jours' }, { value: 'all', label: 'Depuis le début' }];

function Boards({ s }) {
  const [metric, setMetric] = useState('coins');
  const [scope, setScope] = useState('session');
  const [boards, setBoards] = useState(s.boards);
  useEffect(() => { act('snapshot').then((x) => x && setBoards(x.boards)); }, [s.feed.length]);
  const rows = boards[`${metric}:${scope}`] || [];
  const overlay = s.overlays.find((o) => o.type === 'leaderboard' && o.settings.metric === metric) || s.overlays.find((o) => o.type === 'leaderboard');
  return html`<div class="col">
    <div class="row tight">
      <${Segments} value=${metric} options=${METRICS} onChange=${setMetric} />
      <${Segments} value=${scope} options=${SCOPES.map((o) => ({ ...o, premium: o.value !== 'session' && o.value !== 'all' }))} locked=${!s.features.leaderboardPeriods} onChange=${setScope} />
      <span style=${{ flex: 1 }}></span>
      ${overlay ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//>` : html`<${Btn} onClick=${async () => { const o = await act('addOverlay', 'leaderboard'); if (o) { await act('updateOverlay', o.id, { metric, scope }); reload(); toast('Overlay de classement créé'); } }}>Créer l'overlay<//>`}
      <${Btn} onClick=${() => act('resetSession').then(reload)}>Nouvelle session<//>
    </div>
    <${Bay}>
      ${rows.length ? html`<ol class="toplist">${rows.map((p, i) => html`<li key=${p.name + i}><span class="rank">${i + 1}</span>${p.avatar ? html`<img src=${p.avatar} alt="" referrerpolicy="no-referrer" />` : html`<span class="mono">${p.name.slice(0, 1).toUpperCase()}</span>`}<span class="nm">${p.name}</span><${Tag} platform=${p.platform} /><b>${fmt(p.value)}</b></li>`)}</ol>` : html`<${Empty} title="Classement vide">Il se remplit tout seul pendant ton live.<//>`}
    <//>
  </div>`;
}

const imgUrl = (s, file) => (file ? `http://127.0.0.1:${s.port}/media/${encodeURIComponent(file)}?k=${encodeURIComponent(s.overlayToken)}` : '');
const pct = (x) => `${(x * 100 >= 10 ? Math.round(x * 100) : (x * 100).toFixed(1)).toString().replace('.', ',')} %`;

// Rangs d'un jeu officiel : lesquels peuvent sortir et avec quelle chance (rang au hasard),
// ou à partir de combien de points (rang selon les points).
// Chaque changement s'affiche tout de suite, puis Régie l'enregistre rang par rang.
function RankPicks({ s, choices, setChoices, up, compact = false }) {
  const r = s.ranks;
  const points = r.mode === 'points';
  const on = choices.filter((x) => x.on && (points || x.weight > 0));
  const total = on.reduce((n, x) => n + x.weight, 0) || 1;
  const set = async (id, patch) => {
    setChoices((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const out = await act('updateRankPick', r.game, id, patch);
    if (out) setState({ ranks: out });
  };
  const all = (fn) => {
    setChoices((list) => list.map((x) => ({ ...x, ...fn(x) })));
    up({ picks: { ...(r.picks || {}), [r.game]: Object.fromEntries(choices.map((x) => [x.id, { ...(r.picks?.[r.game]?.[x.id] || {}), ...fn(x) }])) } });
  };
  const tools = html`<div class="row tight wrap">
      <${Btn} onClick=${() => all(() => ({ on: true }))}>Tous<//>
      <${Btn} onClick=${() => all(() => ({ on: false }))}>Aucun<//>
      ${!points && html`<${Btn} onClick=${() => all(() => ({ weight: 10 }))}>Chances égales<//>`}
      <${Btn} onClick=${() => up({ picks: { ...(r.picks || {}), [r.game]: {} } })}>${points ? 'Seuils d\'origine' : 'Chances d\'origine'}<//>
    </div>`;
  return html`<${Bay} title=${points ? 'Rangs et points à atteindre' : 'Rangs qui peuvent sortir'} aside=${compact ? null : tools}>
    ${compact && tools}
    <p class="note">${points ? 'Le spectateur monte de rang quand ses points atteignent le seuil. Décoche un rang pour le sauter.' : 'Décoche un rang pour qu\'il ne sorte jamais. La chance règle la rareté : plus elle est basse, plus le rang est rare.'}</p>
    ${!on.length && html`<p class="note warn">Aucun rang coché : Régie les laisse tous sortir. Coche ceux que tu veux.</p>`}
    <div class="rp-list">
      ${choices.map((x) => html`<div class="rp ${x.on ? '' : 'off'}" key=${x.id}>
        <${Gem} color=${x.color} step=${x.step} steps=${x.steps} sides=${x.sides} src=${imgUrl(s, x.image)} size=${40} />
        <b class="rp-name">${x.name}</b>
        <${Lamp} on=${x.on} label=${compact ? '' : (points ? 'Compte' : 'Peut sortir')} aria-label=${`${x.name} peut sortir`} onChange=${(v) => set(x.id, { on: v })} />
        ${points
    ? html`<label class="rp-w">${!compact && html`<span>Points</span>`}<${Num} value=${x.min} min="0" aria-label=${`Points pour ${x.name}`} onSave=${(min) => set(x.id, { min })} /></label><span class="rp-pct"></span>`
    : html`<label class="rp-w">${!compact && html`<span>Chance</span>`}<${Num} value=${x.weight} min="0" aria-label=${`Chance de ${x.name}`} onSave=${(weight) => set(x.id, { weight })} /></label>
        <span class="rp-pct">${x.on && x.weight > 0 ? pct(x.weight / total) : '—'}</span>`}
        ${!compact && html`<${Btn} onClick=${() => act('testRank', x.id)}>Essayer<//>`}
      </div>`)}
    </div>
  <//>`;
}

// Donner un rang précis à quelqu'un, depuis l'appli ou par une commande des modos.
function GiveRank({ s, choices, up }) {
  const r = s.ranks;
  const [who, setWho] = useState('');
  const [rank, setRank] = useState('');
  const pick = rank || choices[0]?.id || '';
  const give = async () => {
    const out = await act('giveRank', who, pick);
    if (out) { toast(`${who.replace(/^@/, '')} reçoit le rang ${out.name}`); setWho(''); }
  };
  return html`<${Bay} title="Donner un rang">
    <div class="give-rank">
      <input class="in" placeholder="Pseudo" aria-label="Pseudo" value=${who} onInput=${(e) => setWho(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && who.trim() && give()} />
      <${Select} value=${pick} onChange=${setRank} options=${choices.map((x) => ({ value: x.id, label: x.name }))} />
      <${Btn} kind="primary" disabled=${!who.trim() || !pick} onClick=${give}>Donner<//>
    </div>
    <div class="row wrap">
      <${Field} label="Commande des modos" hint="Exemple : !donnerang @pseudo Diamant"><${Lazy} value=${r.giveCommand || ''} placeholder="!donnerang" onSave=${(giveCommand) => up({ giveCommand })} /><//>
    </div>
  <//>`;
}

export function RankConfig({ s, compact = false }) {
  const r = s.ranks;
  const [choices, setChoices] = useState([]);
  const load = () => act('rankChoices').then((x) => x && setChoices(x));
  useEffect(() => { load(); }, [r.game, r.mode, JSON.stringify(r.picks || {}), JSON.stringify(r.list), JSON.stringify(s.gaming.rankImages?.[r.game] || {})]);
  const up = async (patch) => { const out = await act('updateRanks', patch); if (out) setState({ ranks: out }); };
  const upRow = (i, patch) => up({ list: r.list.map((x, j) => (i === j ? { ...x, ...patch } : x)) });
  const overlay = s.overlays.find((o) => o.type === 'rankcard');
  const official = r.game !== 'custom';
  return html`<div class="col">
    <${Bay} title=${compact ? 'Rangs et révélation' : 'Réglages'} aside=${compact ? null : overlay ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//>` : html`<${Btn} onClick=${async () => { if (await act('addOverlay', 'rankcard')) reload(); }}>Créer l'overlay<//>`}>
      <div class="row tight">
        <${Lamp} on=${r.enabled} label="Donner un rang à chaque nouveau suivi" onChange=${(enabled) => up({ enabled })} />
        <${Lamp} on=${r.announce} label="L'annoncer dans le chat" onChange=${(announce) => up({ announce })} />
        <${Btn} onClick=${() => act('testRank')}>Essayer<//>
      </div>
      <${Segments} value=${r.mode} onChange=${(mode) => up({ mode })} options=${[{ value: 'random', label: 'Rang au hasard' }, { value: 'points', label: 'Rang selon les points' }]} />
      <p class="note">${r.mode === 'random' ? 'Chaque nouveau suivi tire un rang parmi ceux que tu laisses sortir, selon leurs chances.' : 'Le spectateur reçoit le rang de ses points, puis monte quand il atteint le seuil suivant (messages, likes, cadeaux…).'}</p>
      <div class="form-grid top">
        <${Field} label="Rangs du jeu" hint="Les vrais emblèmes s'installent dans Mes jeux"><${Select} value=${r.game} onChange=${(game) => up({ game })} options=${[...s.gameCatalog.filter((g) => g.ranks.length).map((g) => ({ value: g.id, label: g.name })), { value: 'custom', label: 'Autre jeu (mes rangs)' }]} /><//>
        <${Field} label="Message dans le chat" hint="Variables : {user} {rank}"><${Lazy} value=${r.message} onSave=${(message) => up({ message })} /><//>
      </div>
      <span class="f-label">Révélation</span>
      <${Segments} value=${r.reveal} locked=${!s.features.rankRoulette} onChange=${(reveal) => up({ reveal })} options=${[{ value: 'classic', label: 'Carte directe' }, { value: 'roulette', label: 'Caisse façon CS2', premium: true }]} />
      <p class="note">${r.reveal === 'roulette' ? 'Une bande de rangs défile sous un repère doré, ralentit longtemps et s\'arrête sur le rang obtenu, puis confettis. Les rangs rares passent rarement dans la bande. Les suivis arrivent à la suite, sans se couper.' : 'La carte s\'affiche tout de suite.'}</p>
      <span class="f-label">Si la personne suit à nouveau</span>
      <${Segments} value=${r.again || 'keep'} onChange=${(again) => up({ again })} options=${[{ value: 'keep', label: 'Remontrer son rang' }, { value: 'new', label: 'Nouveau tirage' }, { value: 'off', label: 'Rien' }]} />
      <p class="note">Chaque jeu garde son propre rang : en changeant de jeu, le spectateur reçoit un rang du nouveau jeu au lieu de garder l'ancien.</p>
    <//>
    ${official && choices.length > 0 && html`<${RankPicks} s=${s} choices=${choices} setChoices=${setChoices} up=${up} compact=${compact} />`}
    ${r.game === 'custom' ? html`<${Bay} title="Mes rangs">
      <div class="col">
        <div class="rank-row rank-head"><span></span><span></span><span>Nom</span>${r.mode === 'points' ? html`<span>Points à atteindre</span>` : html`<span>Chance</span>`}<span></span><span></span></div>
        ${r.list.map((x, i) => html`<div class="rank-row" key=${x.id}>
          <span class="emb" style=${{ background: x.color }}>${i + 1}</span>
          <input type="color" value=${x.color} aria-label="Couleur" onChange=${(e) => upRow(i, { color: e.target.value })} style=${{ width: '36px', height: '36px', border: 0, background: 'none' }} />
          <${Lazy} value=${x.name} aria-label="Nom du rang" onSave=${(name) => upRow(i, { name })} />
          ${r.mode === 'points' ? html`<${Num} value=${x.min} min="0" aria-label="Points à atteindre" onSave=${(min) => upRow(i, { min })} />` : html`<${Num} value=${x.weight} min="0" aria-label="Chance" onSave=${(weight) => upRow(i, { weight })} />`}
          <${Btn} onClick=${() => act('testRank', x.id)}>Essayer<//>
          <button class="icon" aria-label="Retirer" disabled=${r.list.length <= 1} onClick=${() => up({ list: r.list.filter((_, j) => j !== i) })}>${ICONS.x}</button>
        </div>`)}
        <div class="row tight"><${Btn} icon=${ICONS.plus} onClick=${() => up({ list: [...r.list, { id: `r${Date.now()}`, name: 'Nouveau rang', color: '#FF3D71', weight: 1, min: (Math.max(0, ...r.list.map((x) => x.min || 0)) || 100) * 2 }] })}>Ajouter un rang<//></div>
      </div>
    <//>` : null}
    ${choices.length > 0 && !compact && html`<${GiveRank} s=${s} choices=${choices} up=${up} />`}
  </div>`;
}

// Points gagnés par message, like, cadeau… (montré dans la Boutique de points).
export function PointsRates({ s }) {
  const r = s.rewards;
  const up = async (patch) => { const out = await act('updateRewards', patch); if (out) setState({ rewards: out }); };
  const RATES = [['perMessage', 'Par message'], ['perLike', 'Par like'], ['perFollow', 'Par suivi'], ['perShare', 'Par partage'], ['perSub', 'Par abonnement'], ['perCoin', 'Par pièce'], ['perBit', 'Par bit'], ['perEuro', 'Par euro de Super Chat']];
  return html`<${Bay} title="Gagner des points">
    <${Lamp} on=${r.enabled} label="Les spectateurs gagnent des points" onChange=${(enabled) => up({ enabled })} />
    <div class="form-grid">${RATES.map(([k, l]) => html`<${Field} key=${k} label=${l}><${Num} value=${r[k]} min="0" step="0.1" onSave=${(v) => up({ [k]: v })} /><//>`)}</div>
    <div class="form-grid">
      <${Field} label="Voir le classement"><${Lazy} value=${r.commandTop} onSave=${(commandTop) => up({ commandTop })} /><//>
      <${Field} label="Voir son rang"><${Lazy} value=${r.commandRank} onSave=${(commandRank) => up({ commandRank })} /><//>
    </div>
  <//>`;
}

// Suivi = Rang : sa propre page.
export function RankPage({ s }) {
  return html`<div class="page">
    <${PageHead} title="Suivi = Rang" />
    <p class="lead">Chaque personne qui suit ta chaîne reçoit un rang de ton jeu, révélé à l'écran par une carte ou une ouverture de caisse façon CS2.</p>
    <${RankConfig} s=${s} />
  </div>`;
}

export function BoardsPage({ s }) {
  return html`<div class="page">
    <${PageHead} title="Classements" />
    <${Boards} s=${s} />
  </div>`;
}

// Ancienne page à onglets, gardée pour les liens existants.
export function Ranks({ s }) { return html`<${BoardsPage} s=${s} />`; }
void Select;
