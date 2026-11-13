import { html, useState, act, setState, clock, fmt, reload, copy } from '../store.js';
import { ICONS, Btn, Bay, Field, Lazy, Num, Lamp, Text, Select, PageHead, Pro, Upsell } from '../ui.js';

const linkOf = (s, type, match = () => true) => s.overlays.find((o) => o.type === type && match(o));

function OverlayLink({ s, type }) {
  const o = linkOf(s, type);
  if (o) return html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(o.link)}>Copier le lien<//>`;
  return html`<${Btn} onClick=${async () => { const r = await act('addOverlay', type); if (r) reload(); }}>Créer l'overlay<//>`;
}

function Counters({ s }) {
  const set = (r) => r && setState({ tools: r });
  return html`<${Bay} title="Compteurs" aside=${html`<div class="row tight"><${OverlayLink} s=${s} type="counter" /><${Btn} icon=${ICONS.plus} onClick=${async () => set(await act('addCounter', 'Compteur'))}>Ajouter<//></div>`}>
    <ul class="tool-list">
      ${s.tools.counters.map((c) => html`<li key=${c.id}>
        <${Lazy} value=${c.name} aria-label="Nom du compteur" onSave=${async (name) => set(await act('updateCounter', c.id, { name }))} />
        <div class="stepper">
          <button class="mini" aria-label="Retirer un" onClick=${() => act('setCounter', c.id, c.value - 1)}>-</button>
          <b>${fmt(c.value)}</b>
          <button class="mini" aria-label="Ajouter un" onClick=${() => act('setCounter', c.id, c.value + 1)}>+</button>
        </div>
        <${Btn} onClick=${() => act('setCounter', c.id, 0)}>Zéro<//>
        <button class="icon" aria-label="Supprimer" onClick=${async () => set(await act('removeCounter', c.id))}>${ICONS.x}</button>
      </li>`)}
    </ul>
  <//>`;
}

function Timers({ s }) {
  const set = (r) => r && setState({ tools: r });
  const locked = !s.features.subathon;
  return html`<${Bay} title="Minuteurs" aside=${html`<div class="row tight"><${OverlayLink} s=${s} type="timer" /><${Btn} icon=${ICONS.plus} onClick=${async () => set(await act('addTimer', 'Minuteur', 'countdown'))}>Ajouter<//></div>`}>
    <ul class="tool-list col-list">
      ${s.tools.timers.map((t) => {
    const v = s.timers.find((x) => x.id === t.id) || { remaining: t.remaining, running: t.running };
    const sub = t.subathon || {};
    return html`<li key=${t.id}>
        <div class="tm-row">
          <${Lazy} value=${t.name} aria-label="Nom du minuteur" onSave=${async (name) => set(await act('updateTimer', t.id, { name }))} />
          <b class="tm-read">${clock(v.remaining)}</b>
          <${Btn} kind=${v.running ? '' : 'primary'} onClick=${() => act('timerControl', t.id, v.running ? 'pause' : 'start')}>${v.running ? 'Pause' : 'Lancer'}<//>
          <${Btn} onClick=${() => act('timerControl', t.id, 'reset')}>Remettre<//>
          <${Btn} onClick=${() => act('timerAdd', t.id, 60)}>+1 min<//>
          <button class="icon" aria-label="Supprimer" onClick=${async () => set(await act('removeTimer', t.id))}>${ICONS.x}</button>
        </div>
        <div class="row wrap">
          <${Field} label="Durée (secondes)"><${Num} value=${t.seconds} min="1" onSave=${(sec) => act('timerControl', t.id, 'set', sec)} /><//>
          <${Field} label="Type"><${Select} value=${t.mode} onChange=${async (mode) => set(await act('updateTimer', t.id, { mode }))} options=${[{ value: 'countdown', label: 'Compte à rebours' }, { value: 'stopwatch', label: 'Chronomètre' }]} /><//>
          <${Lamp} on=${sub.enabled && !locked} locked=${locked} label="Marathon de cadeaux" onChange=${async (enabled) => set(await act('updateTimer', t.id, { subathon: { enabled } }))} />
        </div>
        ${sub.enabled && !locked && html`<div class="row wrap">
          ${[['follow', 'Secondes par suivi'], ['sub', 'Par abonnement'], ['coins', 'Par pièce TikTok'], ['like', 'Par like'], ['bits', 'Par bit'], ['money', 'Par euro en Super Chat']].map(([k, l]) => html`<${Field} key=${k} label=${l}><${Num} value=${sub[k]} min="0" step="0.1" onSave=${async (v2) => set(await act('updateTimer', t.id, { subathon: { [k]: v2 } }))} /><//>`)}
        </div>`}
      </li>`;
  })}
    </ul>
  <//>`;
}

function Poll({ s }) {
  const p = s.poll;
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState('Oui\nNon');
  const [dur, setDur] = useState(120);
  const locked = !s.features.polls;
  return html`<${Bay} title=${html`Sondage ${locked ? html`<${Pro} />` : ''}`} aside=${html`<${OverlayLink} s=${s} type="poll" />`}>
    ${p.status === 'running' || p.status === 'ended' ? html`<div class="col">
      <b>${p.question}</b>
      ${p.options.map((o, i) => { const pct = p.total ? (p.counts[i] / p.total) * 100 : 0; return html`<div class="poll-row" key=${o}><span>${i + 1}. ${o}</span><div class="thin"><i style=${{ width: `${pct}%` }}></i></div><b>${p.counts[i]}</b></div>`; })}
      <div class="row tight">${p.status === 'running' ? html`<${Btn} kind="danger" onClick=${() => act('endPoll')}>Terminer<//>` : html`<${Btn} onClick=${() => setState({ poll: { ...p, status: 'idle' } })}>Nouveau sondage<//>`}</div>
    </div>` : html`<form class="col" onSubmit=${(e) => { e.preventDefault(); act('startPoll', { question: q, options: opts.split('\n'), duration: dur }); }}>
      <${Field} label="Question"><${Text} value=${q} onChange=${setQ} disabled=${locked} placeholder="On joue à quoi ensuite ?" /><//>
      <${Field} label="Réponses, une par ligne"><textarea class="in" rows="3" value=${opts} disabled=${locked} onInput=${(e) => setOpts(e.target.value)}></textarea><//>
      <${Field} label="Durée (secondes)"><${Text} type="number" value=${dur} disabled=${locked} onChange=${(v) => setDur(Number(v))} /><//>
      <${Btn} kind="primary" type="submit" disabled=${locked}>Lancer le sondage<//>
    </form>`}
  <//>`;
}

function Giveaway({ s }) {
  const g = s.tools.giveaway;
  const locked = !s.features.giveaway;
  const run = (action, cfg) => act('giveaway', action, cfg);
  const [keyword, setKeyword] = useState(g.keyword);
  const [title, setTitle] = useState(g.title);
  return html`<${Bay} title=${html`Tirage au sort ${locked ? html`<${Pro} />` : ''}`} aside=${html`<${OverlayLink} s=${s} type="giveaway" />`}>
    <div class="col">
      <div class="row wrap">
        <${Field} label="Titre"><${Text} value=${title} onChange=${setTitle} disabled=${locked} /><//>
        <${Field} label="Mot pour participer"><${Text} value=${keyword} onChange=${setKeyword} disabled=${locked} /><//>
      </div>
      <div class="kv"><span>Participants</span><b>${g.entrants.length}</b></div>
      ${g.winner && html`<div class="winner">${g.winner.name}</div>`}
      <div class="row tight">
        ${g.status === 'open' ? html`<${Btn} onClick=${() => run('close')}>Fermer les inscriptions<//>` : html`<${Btn} kind="primary" disabled=${locked} onClick=${() => run('open', { keyword, title })}>Ouvrir les inscriptions<//>`}
        <${Btn} disabled=${locked} onClick=${() => run('draw')}>Tirer au sort<//>
        <${Btn} disabled=${locked} onClick=${() => run('reset')}>Effacer<//>
      </div>
    </div>
  <//>`;
}

// File d'attente : !join dans le chat, le streamer appelle le suivant.
function Queue({ s }) {
  const q = s.tools.queue || { open: true, join: '!join', leave: '!quitter', max: 50, subsFirst: false, list: [], current: null };
  const run = async (action, arg) => { const r = await act('queue', action, arg); if (r) setState({ tools: { ...s.tools, queue: r } }); };
  return html`<${Bay} title="File d'attente" aside=${html`<${OverlayLink} s=${s} type="queue" />`}>
    <div class="col">
      <div class="row wrap">
        <${Field} label="Commande pour rejoindre"><${Lazy} value=${q.join} onSave=${(v) => run('config', { join: v.trim() || '!join' })} /><//>
        <${Field} label="Commande pour partir"><${Lazy} value=${q.leave} onSave=${(v) => run('config', { leave: v.trim() || '!quitter' })} /><//>
        <${Field} label="Places"><${Num} value=${q.max} min="1" max="500" onSave=${(max) => run('config', { max })} /><//>
      </div>
      <${Lamp} on=${q.subsFirst} onChange=${(v) => run('config', { subsFirst: v })} label="Les abonnés passent devant" />
      ${q.current && html`<div class="winner">À toi de jouer : ${q.current.name}</div>`}
      <div class="kv"><span>Dans la file</span><b>${q.list.length}</b></div>
      ${q.list.length > 0 && html`<ol class="q-list">${q.list.slice(0, 12).map((x, i) => html`<li key=${x.key}>
        <span class="q-n">${i + 1}</span><b>${x.name}</b>
        ${i > 0 && html`<button type="button" class="linkish" onClick=${() => run('up', x.key)}>Monter</button>`}
        <button type="button" class="linkish" onClick=${() => run('remove', x.key)}>Retirer</button>
      </li>`)}</ol>`}
      <div class="row tight">
        <${Btn} kind="primary" disabled=${!q.list.length} onClick=${() => run('next')}>Appeler le suivant<//>
        ${q.open ? html`<${Btn} onClick=${() => run('close')}>Fermer la file<//>` : html`<${Btn} onClick=${() => run('open')}>Ouvrir la file<//>`}
        <${Btn} onClick=${() => run('clear')}>Vider<//>
      </div>
    </div>
  <//>`;
}

function Brb({ s }) {
  const brb = s.brb || { active: false, startedAt: 0, elapsed: 0 };
  const [elapsed, setElapsed] = useState(0);
  const tick = () => { if (brb.active && brb.startedAt) setElapsed(Math.floor((Date.now() - brb.startedAt) / 1000)); };
  useState(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); });
  const toggle = async () => { const r = await act('toggleBrb'); if (r) setState({ brb: r }); };
  const display = brb.active ? clock(elapsed) : brb.elapsed ? clock(brb.elapsed) : '--:--';
  return html`<${Bay} title="Écran de pause" aside=${html`<${OverlayLink} s=${s} type="brb" />`}>
    <div class="row tight" style="align-items:center;gap:12px">
      <${Btn} kind=${brb.active ? 'danger' : 'primary'} onClick=${toggle}>${brb.active ? '⏹ Arrêter' : '⏸ Activer la pause'}<//>
      <b style="font-variant-numeric:tabular-nums">${display}</b>
      ${brb.active && html`<span class="note">En pause depuis ${display}</span>`}
    </div>
  <//>`;
}

export function Tools({ s }) {
  return html`<div class="page">
    <${PageHead} title="Outils du live" />
    <${Brb} s=${s} />
    <${Counters} s=${s} />
    <${Timers} s=${s} />
    <div class="two"><${Poll} s=${s} /><${Giveaway} s=${s} /></div>
    <${Queue} s=${s} />
    <${Upsell}>FREE : compteurs, minuteurs et Giftathon. PRO : sondages multi-chaînes et giveaways.<//>
  </div>`;
}
