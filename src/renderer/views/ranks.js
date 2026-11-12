import { html, useState, useEffect, act, setState, fmt, copy, reload, toast } from '../store.js';
import { ICONS, Btn, Bay, Field, Lamp, Lazy, Num, Segments, Select, PageHead, Tag, Empty } from '../ui.js';
import { Actions } from './commands.js';

const METRICS = [{ value: 'coins', label: 'Cadeaux' }, { value: 'likes', label: 'Likes' }, { value: 'points', label: 'Points' }, { value: 'messages', label: 'Messages' }, { value: 'shares', label: 'Partages' }, { value: 'subs', label: 'Abonnements' }, { value: 'follows', label: 'Follows' }];
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

function RankConfig({ s }) {
  const r = s.ranks;
  const up = async (patch) => { const out = await act('updateRanks', patch); if (out) setState({ ranks: out }); };
  const upRow = (i, patch) => up({ list: r.list.map((x, j) => (i === j ? { ...x, ...patch } : x)) });
  const overlay = s.overlays.find((o) => o.type === 'rankcard');
  return html`<div class="col">
    <${Bay} title="Follow = Rank" aside=${overlay ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//>` : html`<${Btn} onClick=${async () => { if (await act('addOverlay', 'rankcard')) reload(); }}>Créer l'overlay<//>`}>
      <div class="row tight">
        <${Lamp} on=${r.enabled} label="Donner un rang aux nouveaux followers" onChange=${(enabled) => up({ enabled })} />
        <${Lamp} on=${r.announce} label="L'annoncer dans le chat" onChange=${(announce) => up({ announce })} />
        <${Btn} onClick=${() => act('testRank')}>Essayer<//>
      </div>
      <${Segments} value=${r.mode} onChange=${(mode) => up({ mode })} options=${[{ value: 'random', label: 'Rang au hasard' }, { value: 'points', label: 'Rang selon les points' }]} />
      <p class="note">${r.mode === 'random' ? 'Le poids règle la rareté : plus il est bas, plus le rang est rare.' : 'Le spectateur monte de rang quand ses points atteignent le seuil.'}</p>
      <div class="row wrap">
        <${Field} label="Rangs du jeu" hint="Blasons dessinés par Régie"><${Select} value=${r.game} onChange=${(game) => up({ game })} options=${[...s.gameCatalog.filter((g) => g.ranks.length).map((g) => ({ value: g.id, label: g.name })), { value: 'custom', label: 'Mes propres rangs' }]} /><//>
        <${Field} label="Message dans le chat" hint="Variables : {user} {rank}"><${Lazy} value=${r.message} onSave=${(message) => up({ message })} /><//>
      </div>
      <span class="f-label">Révélation</span>
      <${Segments} value=${r.reveal} locked=${!s.features.rankRoulette} onChange=${(reveal) => up({ reveal })} options=${[{ value: 'classic', label: 'Carte directe' }, { value: 'roulette', label: 'Roulette', premium: true }]} />
      <p class="note">${r.reveal === 'roulette' ? 'Trois rangs défilent derrière un repère avant de s\'arrêter sur le bon, puis des confettis. Les follows arrivent à la suite, sans se couper.' : 'La carte s\'affiche tout de suite.'}</p>
    <//>
    ${(r.game === 'custom' || r.mode === 'points') ? html`<${Bay} title="Rangs">
      <div class="col">
        ${r.list.map((x, i) => html`<div class="rank-row" key=${x.id}>
          <span class="emb" style=${{ background: x.color }}>${i + 1}</span>
          <input type="color" value=${x.color} aria-label="Couleur" onChange=${(e) => upRow(i, { color: e.target.value })} style=${{ width: '36px', height: '36px', border: 0, background: 'none' }} />
          <${Lazy} value=${x.name} aria-label="Nom du rang" onSave=${(name) => upRow(i, { name })} />
          <${Num} value=${x.weight} min="0" aria-label="Poids" onSave=${(weight) => upRow(i, { weight })} />
          <${Num} value=${x.min} min="0" aria-label="Seuil de points" onSave=${(min) => upRow(i, { min })} />
          <button class="icon" aria-label="Retirer" onClick=${() => up({ list: r.list.filter((_, j) => j !== i) })}>${ICONS.x}</button>
        </div>`)}
        <div class="row tight"><${Btn} icon=${ICONS.plus} onClick=${() => up({ list: [...r.list, { id: `r${Date.now()}`, name: 'Nouveau rang', color: '#FF3D71', weight: 1, min: 100000 }] })}>Ajouter un rang<//><span class="note">Colonnes : poids, puis seuil de points.</span></div>
      </div>
    <//>` : null}
  </div>`;
}

function Rewards({ s }) {
  const r = s.rewards;
  const up = async (patch) => { const out = await act('updateRewards', patch); if (out) setState({ rewards: out }); };
  const [edit, setEdit] = useState(null);
  const save = async () => {
    const out = await act('saveReward', edit);
    if (out) { setState({ rewards: out }); setEdit(null); toast('Récompense enregistrée'); }
  };
  const RATES = [['perMessage', 'Par message'], ['perLike', 'Par like'], ['perFollow', 'Par follow'], ['perShare', 'Par partage'], ['perSub', 'Par abonnement'], ['perCoin', 'Par pièce'], ['perBit', 'Par bit'], ['perEuro', 'Par euro de Super Chat']];
  return html`<div class="col">
    <${Bay} title="Points">
      <${Lamp} on=${r.enabled} label="Les spectateurs gagnent des points" onChange=${(enabled) => up({ enabled })} />
      <div class="row wrap">${RATES.map(([k, l]) => html`<${Field} key=${k} label=${l}><${Num} value=${r[k]} min="0" step="0.1" onSave=${(v) => up({ [k]: v })} /><//>`)}</div>
      <div class="row wrap">
        <${Field} label="Voir ses points"><${Lazy} value=${r.commandPoints} onSave=${(commandPoints) => up({ commandPoints })} /><//>
        <${Field} label="Voir le classement"><${Lazy} value=${r.commandTop} onSave=${(commandTop) => up({ commandTop })} /><//>
        <${Field} label="Voir son rang"><${Lazy} value=${r.commandRank} onSave=${(commandRank) => up({ commandRank })} /><//>
      </div>
    <//>
    <${Bay} title="Récompenses" aside=${html`<${Btn} icon=${ICONS.plus} onClick=${() => setEdit({ name: '', command: '!', cost: 100, actions: [{ type: 'sound', sound: 'fanfare' }] })}>Ajouter<//>`}>
      ${edit && html`<div class="form-grid">
        <${Field} label="Nom"><input class="in" value=${edit.name} onInput=${(e) => setEdit({ ...edit, name: e.target.value })} /><//>
        <${Field} label="Commande"><input class="in" value=${edit.command} onInput=${(e) => setEdit({ ...edit, command: e.target.value })} /><//>
        <${Field} label="Prix en points"><input class="in" type="number" value=${edit.cost} onInput=${(e) => setEdit({ ...edit, cost: Number(e.target.value) })} /><//>
        <${Actions} list=${edit.actions} s=${s} onChange=${(actions) => setEdit({ ...edit, actions })} />
        <div class="row tight wide"><${Btn} kind="primary" onClick=${save}>Enregistrer<//><${Btn} onClick=${() => setEdit(null)}>Annuler<//></div>
      </div>`}
      <ul class="rules">
        ${r.list.map((x) => html`<li class="rule" key=${x.id}><div class="rule-line"><b style=${{ flex: '0 0 180px' }}>${x.name}</b><p class="rule-msg">${x.command}, ${fmt(x.cost)} points</p><${Btn} onClick=${() => setEdit(x)}>Modifier<//><${Btn} kind="danger" onClick=${async () => { const o = await act('removeReward', x.id); if (o) setState({ rewards: o }); }}>Supprimer<//></div></li>`)}
      </ul>
      ${!r.list.length && !edit && html`<p class="note">Une récompense se paie en points depuis le chat, sur toutes les chaînes.</p>`}
    <//>
  </div>`;
}

export function Ranks({ s }) {
  const [tab, setTab] = useState('boards');
  return html`<div class="page">
    <${PageHead} title="Classements et rangs" />
    <${Segments} value=${tab} onChange=${setTab} options=${[{ value: 'boards', label: 'Classements' }, { value: 'ranks', label: 'Rangs' }, { value: 'rewards', label: 'Points et récompenses' }]} />
    ${tab === 'boards' && html`<${Boards} s=${s} />`}
    ${tab === 'ranks' && html`<${RankConfig} s=${s} />`}
    ${tab === 'rewards' && html`<${Rewards} s=${s} />`}
  </div>`;
}
void Select;
