import { html, useState, useEffect, act, setState, fmt, clock, copy, reload } from '../store.js';
import { ICONS, Btn, Bay, Field, Num, Lazy, Color, Platforms, Segments, PageHead, Lamp, Select, Tag } from '../ui.js';

const MODES = [
  { value: 'chat', label: 'Vote au chat' }, { value: 'teams', label: 'Équipes de spectateurs', premium: true }, { value: 'platforms', label: 'Plateforme contre plateforme', premium: true },
  { value: 'gifts', label: 'Cadeau contre cadeau', premium: true }, { value: 'tiktok', label: 'Match TikTok', premium: true },
];
const HELP = {
  chat: 'Chaque message avec le mot de l\'équipe ajoute un point.',
  teams: 'Les spectateurs rejoignent une équipe avec son mot. Ensuite, tous leurs soutiens comptent pour elle.',
  platforms: 'Chaque équipe représente des plateformes. Tout ce qui arrive sur elles rapporte des points.',
  gifts: 'Chaque équipe a ses cadeaux TikTok. Choisis-les dans l\'onglet Cadeaux.',
  tiktok: 'Reprend les scores de tes vrais matchs TikTok dès qu\'ils démarrent.',
};
const SCORES = [['chat', 'Message'], ['like', 'Like'], ['follow', 'Suivi'], ['share', 'Partage'], ['sub', 'Abonnement'], ['coin', 'Pièce TikTok'], ['bit', 'Bit'], ['money', '1 € en Super Chat']];

function OverlayBtn({ s, type }) {
  const o = s.overlays.find((x) => x.type === type);
  return o ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(o.link)}>Copier le lien<//>` : html`<${Btn} onClick=${async () => { if (await act('addOverlay', type)) reload(); }}>Créer l'overlay<//>`;
}

function Arena({ s }) {
  const a = s.arena;
  const run = (action, cfg) => act('arena', action, cfg);
  const open = a.status === 'lobby';
  const busy = a.status === 'fight';
  const up = (patch) => run('config', patch);
  return html`<div class="col">
    <div class="row tight">
      ${!open && !busy && html`<${Btn} kind="primary" onClick=${() => run('open')}>Ouvrir les inscriptions<//>`}
      ${open && html`<${Btn} kind="primary" onClick=${() => run('start')}>Lancer le combat<//>`}
      ${open && html`<${Btn} onClick=${() => run('bots', { n: 4 })}>Ajouter 4 bots d'essai<//>`}
      ${a.status !== 'idle' && html`<${Btn} onClick=${() => run('reset')}>Terminer<//>`}
      <${OverlayBtn} s=${s} type="arena" />
    </div>
    <${Bay} title=${a.status === 'idle' ? 'Prêt' : a.status === 'lobby' ? `Inscriptions ouvertes, ${a.fighters.length} combattants` : a.status === 'fight' ? 'Combat en cours' : `Vainqueur : ${a.winner?.name || 'personne'}`}>
      ${a.fighters.length ? html`<ol class="toplist">${a.fighters.map((f) => html`<li key=${f.key} style=${{ opacity: f.alive ? 1 : 0.4 }}><span class="mono">${f.name.slice(0, 1).toUpperCase()}</span><span class="nm">${f.name}</span><${Tag} platform=${f.platform} /><div class="thin" style=${{ width: '120px' }}><i style=${{ width: `${(f.hp / f.maxHp) * 100}%` }}></i></div></li>`)}</ol>` : html`<p class="note">Les spectateurs écrivent ${a.joinWord} pour entrer. Pendant le combat, ${a.attackWord} charge leur prochain coup et un cadeau les soigne. Le dernier debout gagne ${a.prize} points.</p>`}
    <//>
    <${Bay} title="Réglages">
      <div class="row wrap">
        <${Field} label="Titre"><${Lazy} value=${a.title} onSave=${(title) => up({ title })} /><//>
        <${Field} label="Mot pour entrer"><${Lazy} value=${a.joinWord} onSave=${(joinWord) => up({ joinWord })} /><//>
        <${Field} label="Mot pour charger"><${Lazy} value=${a.attackWord} onSave=${(attackWord) => up({ attackWord })} /><//>
        <${Field} label="Inscriptions (s)"><${Num} value=${a.lobby} min="5" onSave=${(lobby) => up({ lobby })} /><//>
        <${Field} label="Combattants max"><${Num} value=${a.maxFighters} min="2" max="32" onSave=${(maxFighters) => up({ maxFighters })} /><//>
        <${Field} label="Points gagnés"><${Num} value=${a.prize} min="0" onSave=${(prize) => up({ prize })} /><//>
      </div>
    <//>
  </div>`;
}

function Boss({ s }) {
  const b = s.boss;
  const run = (action, cfg) => act('boss', action, cfg);
  const up = (patch) => run('config', patch);
  const fight = b.status === 'fight';
  const DMG = [['chat', 'Message'], ['hit', 'Mot de frappe'], ['like', 'Like'], ['follow', 'Suivi'], ['share', 'Partage'], ['sub', 'Abonnement'], ['coin', 'Pièce'], ['bit', 'Bit'], ['money', '1 € en Super Chat']];
  const pct = (b.hp / b.maxHp) * 100;
  return html`<div class="col">
    <div class="row tight">
      ${fight ? html`<${Btn} kind="danger" onClick=${() => run('stop')}>Arrêter le combat<//><${Btn} onClick=${() => run('hit', { amount: Math.ceil(b.maxHp / 10) })}>Frappe d'essai<//>` : html`<${Btn} kind="primary" onClick=${() => run('start')}>Lancer le boss<//>`}
      ${b.status !== 'idle' && !fight && html`<${Btn} onClick=${() => run('reset')}>Effacer<//>`}
      <${OverlayBtn} s=${s} type="boss" />
    </div>
    <${Bay} title=${`${b.name}, niveau ${b.level}`}>
      <div class="thin big"><i style=${{ width: `${pct}%` }}></i></div>
      <div class="kv"><span>Points de vie</span><b>${fmt(b.hp)} sur ${fmt(b.maxHp)}</b></div>
      ${b.players.length > 0 && html`<ol class="toplist">${b.players.slice(0, 5).map((p, i) => html`<li key=${p.key}><span class="rank">${i + 1}</span><span class="nm">${p.name}</span><b>${fmt(p.damage)}</b></li>`)}</ol>`}
      ${b.status === 'won' && html`<p class="winner">Boss vaincu</p>`}
      ${b.status === 'lost' && html`<p class="note warn">Le temps est écoulé, le boss gagne.</p>`}
    <//>
    <${Bay} title="Réglages">
      <div class="row wrap">
        <${Field} label="Boss"><${Select} value=${b.bossId} onChange=${(bossId) => up({ bossId, name: s.bosses.find((x) => x.id === bossId)?.name })} options=${s.bosses.map((x) => ({ value: x.id, label: x.name }))} /><//>
        <${Field} label="Points de vie"><${Num} value=${b.baseHp} min="100" onSave=${(baseHp) => up({ baseHp })} /><//>
        <${Field} label="Durée (s)" hint="0 pour un combat sans limite"><${Num} value=${b.duration} min="0" onSave=${(duration) => up({ duration })} /><//>
        <${Field} label="Soin du boss (% par s)"><${Num} value=${b.regen} min="0" max="5" step="0.1" onSave=${(regen) => up({ regen })} /><//>
        <${Field} label="Mot de frappe"><${Lazy} value=${b.hitWord} onSave=${(hitWord) => up({ hitWord })} /><//>
        <${Field} label="Points pour le top 3"><${Num} value=${b.prize} min="0" onSave=${(prize) => up({ prize })} /><//>
      </div>
      <${Lamp} on=${b.autoNext} label="Enchaîner sur un boss plus fort après la victoire" onChange=${(autoNext) => up({ autoNext })} />
      <h3 class="f-label">Dégâts par action</h3>
      <div class="row wrap">${DMG.map(([k, l]) => html`<${Field} key=${k} label=${l}><${Num} value=${b.damage[k]} min="0" onSave=${(v) => up({ damage: { ...b.damage, [k]: v } })} /><//>`)}</div>
    <//>
  </div>`;
}

export function Battles({ s }) {
  const [tab, setTab] = useState('teams');
  return html`<div class="page">
    <${PageHead} title="Duels" />
    <${Segments} value=${tab} onChange=${setTab} options=${[{ value: 'teams', label: 'Équipes' }, { value: 'arena', label: 'Bataille du chat' }, { value: 'boss', label: 'Combat de boss' }]} />
    ${tab === 'teams' && html`<${TeamBattle} s=${s} />`}
    ${tab === 'arena' && html`<${Arena} s=${s} />`}
    ${tab === 'boss' && html`<${Boss} s=${s} />`}
  </div>`;
}

function TeamBattle({ s }) {
  const b = s.battle;
  const up = async (patch) => { const r = await act('updateBattle', patch); if (r) setState({ battle: r }); };
  const upTeam = (i, patch) => up({ teams: b.teams.map((t, j) => (i === j ? { ...t, ...patch } : t)) });
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const running = b.status === 'running';
  const total = b.teams[0].score + b.teams[1].score;
  return html`<div class="col">
    <div class="row tight">
      ${running ? html`<${Btn} kind="danger" onClick=${() => act('endBattle')}>Terminer le duel<//>` : html`<${Btn} kind="primary" onClick=${() => act('startBattle', {})}>Lancer le duel<//>`}
      ${b.status === 'ended' && html`<${Btn} onClick=${() => act('resetBattle')}>Effacer<//>`}
      <${OverlayBtn} s=${s} type="battle" />
    </div>

    <div class="scoreboard" aria-live="polite">
      ${b.teams.slice(0, 2).map((t, i) => html`<div class="sb-team" key=${t.id} style=${{ '--t': t.color }}>
        <span>${t.name}</span><b>${fmt(t.score)}</b>
        <div class="row tight">
          <button class="mini" onClick=${() => act('addBattlePoints', t.id, 1)}>+1</button>
          <button class="mini" onClick=${() => act('addBattlePoints', t.id, 10)}>+10</button>
          <button class="mini" onClick=${() => act('addBattlePoints', t.id, -10)}>-10</button>
        </div>
        ${(t.top || []).slice(0, 2).map((x) => html`<small key=${x.name}>${x.name} ${fmt(x.points)}</small>`)}
        ${i === 0 ? '' : ''}
      </div>`)}
      <div class="sb-mid">
        <b>${running && b.endsAt ? clock((b.endsAt - Date.now()) / 1000) : b.status === 'ended' ? 'Fin' : 'Prête'}</b>
        <span>${b.status === 'ended' ? (b.winner === 'tie' ? 'Égalité' : `${b.teams.find((t) => t.id === b.winner)?.name} gagne`) : ''}</span>
      </div>
      <div class="sb-bar"><i style=${{ flexGrow: total ? b.teams[0].score : 1, background: b.teams[0].color }}></i><i style=${{ flexGrow: total ? b.teams[1].score : 1, background: b.teams[1].color }}></i></div>
    </div>

    <${Bay} title="Mode">
      <${Segments} value=${b.mode} options=${MODES} locked=${!s.features.battleAllModes} onChange=${(v) => up({ mode: v })} />
      <p class="note">${HELP[b.mode]}</p>
      <div class="row wrap">
        <${Field} label="Titre"><${Lazy} value=${b.title} onSave=${(v) => up({ title: v })} /><//>
        <${Field} label="Durée (secondes)" hint="0 pour un duel sans fin"><${Num} value=${b.duration} min="0" onSave=${(v) => up({ duration: v })} /><//>
      </div>
    <//>

    <div class="two">
      ${b.teams.slice(0, 2).map((t, i) => html`<${Bay} key=${t.id} title=${`Équipe ${i + 1}`}>
        <div class="col">
          <${Field} label="Nom"><${Lazy} value=${t.name} onSave=${(v) => upTeam(i, { name: v })} /><//>
          <${Field} label="Couleur"><${Color} value=${t.color} onChange=${(v) => upTeam(i, { color: v })} /><//>
          ${(b.mode === 'chat' || b.mode === 'teams') && html`<${Field} label="Mot à écrire"><${Lazy} value=${t.keyword} onSave=${(v) => upTeam(i, { keyword: v })} /><//>`}
          ${b.mode === 'platforms' && html`<div class="field"><span class="f-label">Plateformes</span><${Platforms} value=${t.platforms || []} onChange=${(v) => upTeam(i, { platforms: v })} /></div>`}
          ${b.mode === 'gifts' && html`<p class="note">${(t.giftIds || []).length} cadeaux choisis</p>`}
        </div>
      <//>`)}
    </div>

    ${b.mode !== 'chat' && b.mode !== 'tiktok' && html`<${Bay} title="Points par action">
      <div class="row wrap">${SCORES.map(([k, l]) => html`<${Field} key=${k} label=${l}><${Num} value=${b.scoring[k]} min="0" onSave=${(v) => up({ scoring: { ...b.scoring, [k]: v } })} /><//>`)}</div>
    <//>`}
  </div>`;
}
