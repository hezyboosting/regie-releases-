// Dashboard : chaque chaîne est une tranche de console qu'on ajoute, coupe ou retire.
import { html, useState, useEffect, useRef, act, reload, setState, toast, fmt, PLATFORM, clock, copy } from '../store.js';
import { ICONS, Tag, Btn, Bay, Lamp, Text, Field, Select, go } from '../ui.js';

const STATE_LABEL = { live: 'En direct', connecting: 'Connexion', offline: 'Hors ligne', error: 'Erreur', stopped: 'À l\'arrêt', locked: 'Bloquée' };

function Chan({ c }) {
  const st = c.status;
  return html`<article class="chan ${st.state} ${c.muted ? 'muted' : ''}" aria-label=${c.label}>
    <div class="chan-pic">
      ${c.avatar ? html`<img src=${c.avatar} alt="" />` : html`<span class="chan-mono">${(c.label || '?').replace('@', '').slice(0, 1).toUpperCase()}</span>`}
      <${Tag} platform=${c.platform} />
    </div>
    <div class="chan-txt"><h4 title=${c.label}>${c.label}</h4><p title=${st.detail}>${c.muted ? 'En sourdine' : st.detail || STATE_LABEL[st.state] || ''}</p></div>
    <b class="chan-view">${fmt(c.viewers)}</b>
    <div class="chan-acts">
      <button type="button" class="mini" aria-pressed=${c.muted} onClick=${() => act('muteAccount', c.id)}>${c.muted ? 'Réactiver' : 'Sourdine'}</button>
      <button type="button" class="mini" onClick=${() => act('toggleAccount', c.id)}>${c.enabled ? 'Arrêter' : 'Démarrer'}</button>
      <button type="button" class="mini" onClick=${() => act('reconnectAccount', c.id)}>Relancer</button>
      <button type="button" class="mini danger" onClick=${() => act('removeAccount', c.id).then(reload)}>Retirer</button>
    </div>
  </article>`;
}

// Activité du live : les événements des dix dernières minutes.
function Spark({ feed }) {
  const N = 60;
  const now = Date.now();
  const span = 10 * 60000;
  const bins = new Array(N).fill(0);
  for (const e of feed) { const i = Math.floor(((e.ts - (now - span)) / span) * N); if (i >= 0 && i < N) bins[i] += 1; }
  const max = Math.max(4, ...bins);
  const pts = bins.map((v, i) => `${(i / (N - 1)) * 1000},${54 - (v / max) * 48}`);
  return html`<svg class="spark" viewBox="0 0 1000 56" preserveAspectRatio="none" role="img" aria-label="Activité des dix dernières minutes">
    <defs>
      <linearGradient id="spf" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#8FD3FF" stop-opacity=".22" /><stop offset="1" stop-color="#8FD3FF" stop-opacity="0" /></linearGradient>
    </defs>
    <polygon points=${`0,56 ${pts.join(' ')} 1000,56`} fill="url(#spf)" />
    <polyline points=${pts.join(' ')} fill="none" stroke="#8FD3FF" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
  </svg>`;
}

const TESTS = [
  ['follow', 'Follow', 'twitch'], ['sub', 'Sub', 'twitch'], ['resub', 'Resub', 'twitch'], ['giftsub', 'Subs offerts', 'twitch'], ['bits', 'Bits', 'twitch'], ['raid', 'Raid', 'twitch'],
  ['gift', 'Cadeau', 'tiktok'], ['follow', 'Follow', 'tiktok'], ['share', 'Partage', 'tiktok'], ['superfan', 'Super Fan', 'tiktok'], ['superchat', 'Super Chat', 'youtube'], ['member', 'Membre', 'youtube'],
];

export function Dashboard({ s }) {
  const limit = s.features.channelsPerPlatform;
  const goal = s.goals[0];
  const t = s.spotify.state?.track;
  const v = s.vars || {};
  const total = s.channels.reduce((n, c) => n + (c.viewers || 0), 0);
  const liveCount = s.channels.filter((c) => c.status.state === 'live').length;
  return html`<div class="dash">
    <section class="hero">
      <div class="hero-main">
        <div class="hero-num">${fmt(total)}</div>
        <div class="hero-sub">${liveCount ? `spectateurs sur ${liveCount} ${liveCount > 1 ? 'chaînes' : 'chaîne'} en direct` : 'spectateurs. Lance ton live pour voir le compteur bouger.'}</div>
      </div>
      <div class="hero-stats">
        <div class="stat"><b>${fmt(v.follows)}</b><span>Follows</span></div>
        <div class="stat"><b>${fmt(v.subs)}</b><span>Abonnements</span></div>
        <div class="stat"><b>${fmt(v.coins)}</b><span>Pièces</span></div>
        <div class="stat"><b>${fmt(v.likes)}</b><span>Likes</span></div>
      </div>
      <${Spark} feed=${s.feed} />
    </section>

    <div class="chans" role="group" aria-label="Chaînes connectées">
      ${s.channels.map((c) => html`<${Chan} key=${c.id} c=${c} />`)}
      <button type="button" class="add-chan" onClick=${() => setState({ view: 'connections' })}>${ICONS.plus}<span>Ajouter une chaîne</span>${limit !== -1 && html`<span class="chan-limit">${limit} par plateforme</span>`}</button>
    </div>

    <div class="dash-grid">
      <${Bay} title="Essayer une alerte">
        <div class="test-keys">${TESTS.map(([type, label, p]) => html`<button type="button" class="mini test" key=${type + p} onClick=${() => act('simulate', type, p)}><${Tag} platform=${p} />${label}</button>`)}</div>
        <p class="note">Les essais apparaissent dans tes overlays, jamais dans tes stats.</p>
      <//>
      <${Bay} title="En ce moment">
        <div class="col">
          <${Lamp} on=${!s.alerts.paused} label=${s.alertQueue ? `Alertes actives, ${s.alertQueue} en attente` : 'Alertes actives'} onChange=${async (on) => { const a = await act('setAlertsPaused', !on); if (a) setState({ alerts: a }); }} />
          <div class="kv"><span>Musique</span><b>${t ? t.title : 'Aucune'}</b></div>
          <div class="kv"><span>Goal</span><b>${goal ? `${fmt(goal.current)} sur ${fmt(goal.target)}` : 'Aucun'}</b></div>
          ${goal && html`<div class="thin"><i style=${{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}></i></div>`}
          <div class="kv"><span>Top don</span><b>${v.topGifter || 'Aucun'}</b></div>
          <div class="kv"><span>OBS</span><b>${s.obs.state === 'connected' ? (s.obs.streaming ? 'En direct' : 'Connecté') : 'Non connecté'}</b></div>
          <div class="row tight">
            <${Btn} onClick=${() => act('skipAlert')}>Passer l'alerte<//>
            <${Btn} onClick=${() => act('ttsSkip')}>Passer le TTS<//>
          </div>
        </div>
      <//>
    </div>

    <${Bay} title="Soutiens du live" aside=${html`<button class="linkish" onClick=${() => setState({ view: 'gifts' })}>Voir tout</button>`}>
      <div class="highlights">
        <${Mini} label="Top Gift" name=${s.session?.topGift?.user} sub=${s.session?.topGift?.name} value=${s.session?.topGift ? fmt(s.session.topGift.value) : ''} />
        <${Mini} label="Top Streak" name=${s.session?.topStreak?.user} sub=${s.session?.topStreak?.name} value=${s.session?.topStreak ? `×${fmt(s.session.topStreak.count)}` : ''} />
        <${Mini} label="Dernier follow" name=${v.lastFollower} sub="" value="" />
      </div>
    <//>
  </div>`;
}

const Mini = ({ label, name, sub, value }) => html`<div class="hl flat"><div class="hl-txt"><span>${label}</span><b>${name || 'Personne pour le moment'}</b>${sub && html`<span>${sub}</span>`}</div><span class="hl-val">${value}</span></div>`;

const FILTERS = [{ id: 'all', label: 'Tout' }, { id: 'chat', label: 'Chat' }, { id: 'events', label: 'Événements' }];

const describe = (e) => {
  const map = {
    follow: 'suit la chaîne', sub: 's\'abonne', resub: `se réabonne, ${e.months} mois`, giftsub: `offre ${e.amount} abonnements`, bits: `envoie ${fmt(e.amount)} bits`, raid: `lance un raid de ${e.amount}`,
    redeem: `utilise ${e.reward}`, hypetrain: 'lance un Hype Train', superchat: `envoie ${e.money}`, supersticker: `envoie un sticker à ${e.money}`, member: 'devient membre', milestone: `membre depuis ${e.months} mois`,
    gift: `envoie ${e.amount} × ${e.gift?.name}`, like: `envoie ${fmt(e.amount)} likes`, share: 'partage le live', join: 'arrive', superfan: 'devient Super Fan', goal: 'objectif atteint',
  };
  return map[e.type] || e.type;
};

export function Journal({ s }) {
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [target, setTarget] = useState('origin');
  const list = useRef(null);
  const items = s.feed.filter((e) => (filter === 'chat' ? e.type === 'chat' : filter === 'events' ? e.type !== 'chat' : !['join', 'like'].includes(e.type)));
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [s.feed.length, filter]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const ok = await act('sendChat', text.trim(), target === 'origin' ? senders[0]?.id : target);
    if (ok) setText('');
  };
  const senders = s.channels.filter((c) => c.canSend);
  return html`<aside class="journal" aria-label="Journal du direct">
    <header>
      <h3>En direct</h3>
      <div class="segs small">${FILTERS.map((f) => html`<button class="seg ${filter === f.id ? 'on' : ''}" onClick=${() => setFilter(f.id)}>${f.label}</button>`)}</div>
    </header>
    <ol class="feed" ref=${list}>
      ${items.slice(-120).map((e) => html`<li key=${e.id} class=${e.type === 'chat' ? 'chat' : 'ev'}>
        <div class="feed-pic">
          ${e.user?.avatar ? html`<img src=${e.user.avatar} alt="" referrerpolicy="no-referrer" />` : html`<span class="feed-mono">${(e.user?.display || '?').slice(0, 1).toUpperCase()}</span>`}
          <i class="dot" style=${{ background: PLATFORM[e.platform]?.color || '#8279A3' }} title=${PLATFORM[e.platform]?.label}></i>
        </div>
        <div class="txt"><span class="who">${e.user?.display}</span>${e.type === 'chat' ? e.text : describe(e)}${e.type !== 'chat' && e.text ? html`<em>${e.text}</em>` : ''}</div>
      </li>`)}
      ${!items.length && html`<li class="feed-empty">Les messages et soutiens de toutes tes chaînes arrivent ici.</li>`}
    </ol>
    <form class="composer" onSubmit=${send}>
      <select class="in" aria-label="Envoyer sur" value=${target} onChange=${(e) => setTarget(e.target.value)}>
        ${!senders.length && html`<option value="origin">Aucune chaîne ne peut écrire</option>`}
        ${s.features.replyAllChannels && senders.length > 1 && html`<option value="all">Toutes les chaînes</option>`}
        ${senders.map((c) => html`<option value=${c.id}>${c.label}</option>`)}
      </select>
      <input class="in" value=${text} onInput=${(e) => setText(e.target.value)} placeholder="Écrire dans le chat" aria-label="Message" disabled=${!senders.length} />
    </form>
  </aside>`;
}
