import { html, preactRender, useStore, useEffect, useState, useRef, setState, getState, reload, act, toast, clock, fmt } from './store.js';
import { ICONS, Btn } from './ui.js';
import { Dashboard, Journal } from './views/dashboard.js';
import { Overlays } from './views/overlays.js';
import { Builder } from './views/builder.js';
import { Shop } from './views/shop.js';
import { Scenes } from './views/scenes.js';
import { Alerts } from './views/alerts.js';
import { Goals } from './views/goals.js';
import { Battles } from './views/battles.js';
import { SpotifyView } from './views/spotify.js';
import { Commands } from './views/commands.js';
import { TtsView } from './views/tts.js';
import { Tools } from './views/tools.js';
import { Gifts } from './views/gifts.js';
import { Ranks } from './views/ranks.js';
import { Games } from './views/games.js';
import { Connections } from './views/connections.js';
import { DockView } from './views/dock.js';
import { Automations } from './views/automations.js';
import { MiniGamesView } from './views/minigames.js';
import { AssistantView } from './views/assistant.js';
import { Sounds } from './views/sounds.js';
import { Deck } from './views/deck.js';
import { Clips } from './views/clips.js';
import { Stats } from './views/stats.js';
import { Settings } from './views/settings.js';
import { Admin } from './views/admin.js';
import { Onboarding } from './views/onboarding.js';

const NAV = [
  { title: 'Accueil', icon: 'dash', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dash', view: Dashboard }] },
  { title: 'Connexions', icon: 'link', items: [{ id: 'connections', label: 'Connexions', icon: 'link', view: Connections }] },
  { title: 'Overlays', icon: 'overlays', items: [{ id: 'overlays', label: 'Galerie', icon: 'overlays', view: Overlays, wide: true }, { id: 'builder', label: 'Éditeur', icon: 'editor', view: Builder, wide: true }, { id: 'shop', label: 'Boutique', icon: 'shop', view: Shop, module: 'shop' }] },
  { title: 'Mes jeux', icon: 'gaming', items: [{ id: 'games', label: 'Mes jeux', icon: 'gaming', view: Games, module: 'gaming', wide: true }] },
  { title: 'Interactions', icon: 'alerts', items: [{ id: 'alerts', label: 'Alertes', icon: 'alerts', view: Alerts }, { id: 'gifts', label: 'Cadeaux', icon: 'gifts', view: Gifts, module: 'gifts' }, { id: 'ranks', label: 'Classements', icon: 'ranks', view: Ranks, module: 'ranks' }, { id: 'goals', label: 'Goals', icon: 'goals', view: Goals, module: 'goals' }, { id: 'battles', label: 'Battles', icon: 'battles', view: Battles, module: 'battles' }, { id: 'minigames', label: 'Mini-jeux', icon: 'dice', view: MiniGamesView, module: 'chatgames' }] },
  { title: 'Automatisation', icon: 'auto', items: [{ id: 'commands', label: 'Commandes', icon: 'commands', view: Commands }, { id: 'automations', label: 'Automatisations', icon: 'auto', view: Automations, module: 'automations' }, { id: 'deck', label: 'Stream Deck', icon: 'deck', view: Deck, module: 'deck' }] },
  { title: 'Audio', icon: 'sounds', items: [{ id: 'sounds', label: 'Sons', icon: 'sounds', view: Sounds, module: 'sounds' }, { id: 'tts', label: 'TTS', icon: 'tts', view: TtsView, module: 'tts' }, { id: 'spotify', label: 'Spotify', icon: 'spotify', view: SpotifyView, module: 'spotify' }] },
  { title: 'En direct', icon: 'scenes', items: [{ id: 'dock', label: 'Chat unifié', icon: 'commands', view: DockView }, { id: 'scenes', label: 'Scènes OBS', icon: 'scenes', view: Scenes, module: 'scenes' }, { id: 'tools', label: 'Outils', icon: 'tools', view: Tools }, { id: 'clips', label: 'Clips', icon: 'clips', view: Clips, module: 'clips' }, { id: 'stats', label: 'Stats', icon: 'stats', view: Stats }, { id: 'assistant', label: 'Assistant IA', icon: 'assist', view: AssistantView, module: 'assistant' }] },
];
const PINNED = [{ id: 'settings', label: 'Réglages', icon: 'settings', view: Settings }, { id: 'admin', label: 'Admin', icon: 'admin', view: Admin, admin: true }];
const FLAT = [...NAV.flatMap((g) => g.items), ...PINNED];

const ROLE = { free: ['FREE', 'Passer en PRO'], pro: ['PRO', 'Licence active'], ultimate: ['ULTIMATE', 'Licence active'], admin: ['Admin', 'Tous les accès'] };

const lastTab = {};
const isShown = (s, i) => (!i.admin || s.realRole === 'admin') && (!i.module || s.settings.modules?.[i.module] !== false);
const sectionOf = (view) => NAV.find((g) => g.items.some((i) => i.id === view));

export function LivePill({ s }) {
  const live = s.channels.filter((c) => c.status.state === 'live');
  const on = s.obs.streaming || live.length > 0;
  const since = Math.min(...live.map((c) => c.liveSince || Infinity));
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  return html`<span class="onair ${on ? 'on' : ''}" role="status"><i></i>${on ? 'En direct' : 'Hors ligne'}${on && Number.isFinite(since) ? ` ${clock((Date.now() - since) / 1000)}` : ''}</span>`;
}

const pickView = (id) => { const g = sectionOf(id); if (g) lastTab[g.title] = id; setState({ view: id, overlayId: null }); };

function Side({ s }) {
  const [label, sub] = ROLE[s.role] || ROLE.free;
  const mini = s.settings.navCollapsed === true;
  const active = sectionOf(s.view);
  const row = (key, icon, text, on, go) => html`<button type="button" key=${key} class="nav-item ${on ? 'on' : ''}" title=${mini ? text : undefined} aria-label=${text} aria-current=${on ? 'page' : undefined} onClick=${go}>${ICONS[icon]}<span>${text}</span></button>`;
  return html`<aside class="side ${mini ? 'mini' : ''}">
    <div class="logo"><span>${s.brand.name}</span>
      <button type="button" class="nav-fold" aria-label=${mini ? 'Déplier le menu' : 'Replier le menu'} title=${mini ? 'Déplier le menu' : 'Replier le menu'} onClick=${async () => { const r = await act('updateSettings', { navCollapsed: !mini }); if (r) setState({ settings: r }); }}>${ICONS.side}</button>
    </div>
    <nav class="nav" aria-label="Sections">
      ${NAV.map((g) => {
    const items = g.items.filter((i) => isShown(s, i));
    if (!items.length) return null;
    const target = items.find((i) => i.id === lastTab[g.title]) || items[0];
    return row(g.title, g.icon, g.title, active === g, () => pickView(target.id));
  })}
    </nav>
    <div class="side-foot">
      ${PINNED.filter((i) => isShown(s, i)).map((i) => row(i.id, i.icon, i.label, s.view === i.id, () => pickView(i.id)))}
      <button type="button" class="plan ${s.role}" title=${label} onClick=${() => setState({ view: 'settings', settingsTab: 'licence' })}>
        <span class="dot">${label[0]}</span>
        <span class="plan-txt"><b>${label}${s.role !== s.realRole ? ' (aperçu)' : ''}</b><small>${sub}</small></span>
      </button>
    </div>
  </aside>`;
}

function SubTabs({ s }) {
  const g = sectionOf(s.view);
  const items = g ? g.items.filter((i) => isShown(s, i)) : [];
  if (items.length < 2) return null;
  return html`<div class="subtabs" role="tablist" aria-label=${g.title}>${items.map((i) => html`<button type="button" role="tab" key=${i.id} aria-selected=${s.view === i.id} class="subtab ${s.view === i.id ? 'on' : ''}" onClick=${() => pickView(i.id)}>${i.label}</button>`)}</div>`;
}

function Palette({ s, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const go = (view) => () => setState({ view });
  const items = [
    ...FLAT.filter((i) => !i.admin || s.realRole === 'admin').map((i) => ({ label: i.label, icon: i.icon, hint: 'Ouvrir', run: go(i.id) })),
    { label: 'Tester une alerte follow', icon: 'alerts', hint: 'Action', run: () => act('simulate', 'follow', 'twitch') },
    { label: 'Tester un cadeau', icon: 'gifts', hint: 'Action', run: () => act('simulate', 'gift', 'tiktok') },
    { label: 'Passer l\'alerte en cours', icon: 'alerts', hint: 'Action', run: () => act('skipAlert') },
    { label: 'Passer le TTS', icon: 'tts', hint: 'Action', run: () => act('ttsSkip') },
    { label: 'Créer un clip', icon: 'clips', hint: 'Action', run: () => act('createClip') },
    { label: 'Lancer le Chat Battle', icon: 'battles', hint: 'Action', run: () => act('arena', 'open', {}) },
    { label: 'Lancer le Boss Battle', icon: 'battles', hint: 'Action', run: () => act('boss', 'start', {}) },
    { label: 'Remettre la session à zéro', icon: 'stats', hint: 'Action', run: () => act('resetSession') },
  ];
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = items.filter((i) => norm(i.label).includes(norm(q)));
  const run = (i) => { i?.run(); onClose(); };
  const keys = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((n) => Math.min(list.length - 1, n + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((n) => Math.max(0, n - 1)); }
    if (e.key === 'Enter') run(list[idx]);
    if (e.key === 'Escape') onClose();
  };
  return html`<div class="modal" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="palette" role="dialog" aria-label="Recherche">
      <input ref=${input} value=${q} onInput=${(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown=${keys} placeholder="Chercher une page ou une action" />
      <div class="pal-list">
        ${list.map((i, n) => html`<button type="button" key=${i.label} class="pal-item ${n === idx ? 'on' : ''}" onMouseEnter=${() => setIdx(n)} onClick=${() => run(i)}>${ICONS[i.icon]}${i.label}<small>${i.hint}</small></button>`)}
      </div>
    </div>
  </div>`;
}

function Titlebar({ s, journal, setJournal, wide, onSearch }) {
  return html`<header class="titlebar">
    <${SubTabs} s=${s} />
    <span class="tb-space"></span>
    <button type="button" class="search-btn" title="Rechercher (Ctrl K)" aria-label="Rechercher" onClick=${onSearch}>${ICONS.search}</button>
    <${LivePill} s=${s} />
    ${!wide && html`<button type="button" class="journal-toggle" title=${journal ? 'Masquer le journal' : 'Afficher le journal'} aria-pressed=${journal} onClick=${() => setJournal(!journal)}>${ICONS.panel}</button>`}
  </header>`;
}

function Banner({ s }) {
  const r = s.remote;
  if (!r.announcement && !r.updateAvailable) return null;
  return html`<div class="banner">
    ${r.announcement && html`<span>${r.announcement}</span>`}
    ${r.updateAvailable && html`<span>Version ${r.latestVersion} disponible.</span>`}
    ${r.updateAvailable && r.downloadUrl && html`<${Btn} kind="amber" onClick=${() => act('openExternal', r.downloadUrl)}>Télécharger<//>`}
  </div>`;
}

const Toasts = ({ list = [] }) => html`<div class="toasts" aria-live="polite">${list.map((t) => html`<div class="toast ${t.kind}" key=${t.id}>${t.text}</div>`)}</div>`;

const readPref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const writePref = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* préférence facultative */ } };

function App() {
  const s = useStore();
  const [journal, setJournalState] = useState(readPref('journal', false));
  const [palette, setPalette] = useState(false);
  const setJournal = (v) => { writePref('journal', v); setJournalState(v); };
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!s) return;
    const root = document.documentElement;
    root.dataset.theme = s.settings.theme || 'dark';
    for (const v of ['--hot', '--sky']) { if (s.settings.accent) root.style.setProperty(v, s.settings.accent); else root.style.removeProperty(v); }
  }, [s?.settings?.theme, s?.settings?.accent]);
  if (!s) return null;
  const current = FLAT.find((i) => i.id === s.view && (!i.admin || s.realRole === 'admin')) || FLAT[0];
  const View = current.view;
  const showJournal = !current.wide && journal;
  const live = s.channels.some((c) => c.status.state === 'live');
  return html`<div class="shell ${showJournal ? '' : 'nojournal'} ${s.settings.navCollapsed === true ? 'navmini' : ''} ${s.settings.economy ? 'eco' : ''}">
    <div class=${`aurora ${live ? 'live' : ''} ${s.pulse ? 'pulse' : ''}`} style=${{ '--hue': `${s.pulseHue || 0}deg` }}></div>
    <${Side} s=${s} />
    <${Titlebar} s=${s} journal=${journal} setJournal=${setJournal} wide=${current.wide} onSearch=${() => setPalette(true)} />
    <main class="view" key=${s.view}><${Banner} s=${s} /><${View} s=${s} /></main>
    ${showJournal && html`<${Journal} s=${s} />`}
    <${Toasts} list=${s.toasts} />
    ${palette && html`<${Palette} s=${s} onClose=${() => setPalette(false)} />`}
    ${!s.settings.onboarded && html`<${Onboarding} s=${s} />`}
  </div>`;
}

let pulseTimer = null;
const HUE = { tiktok: 0, twitch: -40, youtube: 20, kick: 60 };
function pulse(ev) {
  if (['chat', 'join', 'like'].includes(ev.type)) return;
  setState({ pulse: false, pulseHue: HUE[ev.platform] || 0 });
  requestAnimationFrame(() => setState({ pulse: true }));
  clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => setState({ pulse: false }), 1200);
}

async function start() {
  await reload();
  setState({ view: new URLSearchParams(location.search).get('view') || 'dashboard', toasts: [], settingsTab: 'licence' });
  const on = window.regie.on;
  on('snapshot', (snap) => setState(snap));
  on('channels', (channels) => setState({ channels }));
  on('event', (ev) => { setState({ feed: [...getState().feed.slice(-199), ev] }); pulse(ev); });
  on('session', (session) => setState({ session }));
  on('activity', ({ vars }) => setState({ vars }));
  on('goals', (goals) => setState({ goals }));
  on('alerts', (alerts) => setState({ alerts: { ...alerts } }));
  on('battle', (battle) => setState({ battle: { ...battle } }));
  on('arena', (arena) => setState({ arena: { ...arena } }));
  on('boss', (boss) => setState({ boss: { ...boss } }));
  on('gaming', (gaming) => setState({ gaming: { ...gaming } }));
  on('clips', (clips) => setState({ clips: { ...clips } }));
  on('tools', (tools) => setState({ tools: { ...tools } }));
  on('timers', (timers) => setState({ timers }));
  on('poll', (poll) => setState({ poll }));
  on('giveaway', (giveaway) => setState({ tools: { ...getState().tools, giveaway } }));
  on('spotify', (st) => setState({ spotify: { ...getState().spotify, state: st } }));
  on('wishlist', (list) => setState({ spotify: { ...getState().spotify, wishlist: list } }));
  on('obs', (o) => setState({ obs: { ...getState().obs, ...o } }));
  on('obsScene', (name) => setState({ obsCurrent: name }));
  on('obsScenesChanged', () => setState({ obsTick: Date.now() }));
  on('alertQueue', (alertQueue) => setState({ alertQueue }));
  on('ttsQueue', (ttsQueue) => setState({ ttsQueue }));
  on('voices', (voices) => setState({ voices }));
  on('overlayClients', ({ id, connected }) => setState({ overlays: getState().overlays.map((o) => (o.id === id ? { ...o, connected } : o)) }));
  on('botReply', ({ text }) => toast(`Réponse du bot : ${text}`));
  on('pads', (pads) => setState({ pads }));
  on('gameView', (gameView) => setState({ gameView }));
  on('gameLive', (gameLive) => setState({ gameLive }));
  on('gameRunning', (gameRunning) => setState({ gameRunning }));
  on('gameLinks', (gameLinks) => setState({ gameLinks }));
  on('gameSwitched', (name) => toast(`Jeu détecté : ${name}`));
  on('minigame', (minigame) => setState({ minigame }));
  on('triggers', (triggers) => setState({ triggers }));
  on('deckPage', (deckPage) => setState({ deckPage }));
  on('brb', (brb) => setState({ brb }));
  on('updater', (updater) => setState({ updater }));
  act('voices').then((voices) => setState({ voices: voices || [] }));
  window.addEventListener('gamepadconnected', pumpPads);
  preactRender(html`<${App} />`, document.getElementById('app'));
}

// Lecture des manettes hors XInput tant que l'appli reste visible.
let pumping = false;
function pumpPads() {
  if (pumping) return;
  pumping = true;
  const last = [];
  // setInterval et non requestAnimationFrame : la lecture continue quand un jeu passe devant l'appli.
  setInterval(() => {
    for (const p of navigator.getGamepads()) {
      if (!p || last[p.index] === p.timestamp) continue;
      last[p.index] = p.timestamp;
      window.regie.sendPad({
        pad: p.index, b: Array.from({ length: 18 }, (_, i) => Boolean(p.buttons[i]?.pressed)),
        a: [...p.axes].slice(0, 4).map((v) => (Math.abs(v) < 0.06 ? 0 : v)), lt: p.buttons[6]?.value || 0, rt: p.buttons[7]?.value || 0,
      });
    }
  }, 16);
}

start();
void fmt;
