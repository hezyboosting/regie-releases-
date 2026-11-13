import { html, preactRender, useStore, useEffect, useState, useRef, setState, getState, reload, act, toast, clock, fmt, getLang, setLang } from './store.js';
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
import { GiftActionsPage, GiftLivePage, GiftCatalogPage } from './views/gifts.js';
import { ChatPlaysView, PredictionView, PlinkoView } from './views/play.js';
import { RankPage, BoardsPage } from './views/ranks.js';
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
import { InteractiveView, PacksView, PointShopView } from './views/interactive.js';
import { RecapModal } from './views/recap.js';
import { Setup } from './views/setup.js';
import { DiscordView } from './views/discord.js';
import { WhatsNew, UpdatePill } from './views/help.js';

// Menu : chaque section montre directement ses pages. « flat » : pages affichées sans titre de section.
const NAV = [
  { title: 'Démarrer', icon: 'dash', flat: true, items: [{ id: 'dashboard', label: 'Tableau de bord', icon: 'dash', view: Dashboard }, { id: 'connections', label: 'Connexions', icon: 'link', view: Connections }] },
  { title: 'En direct', icon: 'scenes', items: [{ id: 'dock', label: 'Chat unifié', icon: 'commands', view: DockView }, { id: 'scenes', label: 'Scènes OBS', icon: 'scenes', view: Scenes, module: 'scenes' }, { id: 'tools', label: 'Outils du live', icon: 'tools', view: Tools }, { id: 'clips', label: 'Clips', icon: 'clips', view: Clips, module: 'clips' }, { id: 'stats', label: 'Stats', icon: 'stats', view: Stats }, { id: 'assistant', label: 'Assistant IA', icon: 'assist', view: AssistantView, module: 'assistant' }] },
  { title: 'Overlays', icon: 'overlays', items: [{ id: 'overlays', label: 'Galerie', icon: 'overlays', view: Overlays, wide: true }, { id: 'builder', label: 'Éditeur', icon: 'editor', view: Builder, wide: true }, { id: 'shop', label: 'Boutique de designs', icon: 'shop', view: Shop, module: 'shop' }] },
  { title: 'Alertes et sons', icon: 'alerts', items: [{ id: 'alerts', label: 'Alertes', icon: 'alerts', view: Alerts }, { id: 'sounds', label: 'Sons', icon: 'sounds', view: Sounds, module: 'sounds' }, { id: 'tts', label: 'Synthèse vocale', icon: 'tts', view: TtsView, module: 'tts' }, { id: 'spotify', label: 'Spotify', icon: 'spotify', view: SpotifyView, module: 'spotify' }] },
  { title: 'Cadeaux', icon: 'gifts', items: [{ id: 'giftcatalog', label: 'Catalogue TikTok', icon: 'gifts', view: GiftCatalogPage }, { id: 'gifts', label: 'Actions par cadeau', icon: 'spark', view: GiftActionsPage, module: 'gifts' }, { id: 'giftlive', label: 'Cadeaux du live', icon: 'stats', view: GiftLivePage }, { id: 'goals', label: 'Objectifs', icon: 'goals', view: Goals, module: 'goals' }] },
  { title: 'Communauté', icon: 'ranks', items: [{ id: 'rankfollow', label: 'Suivi = Rang', icon: 'ranks', view: RankPage, module: 'ranks' }, { id: 'ranks', label: 'Classements', icon: 'ranks', view: BoardsPage, module: 'ranks' }, { id: 'pointshop', label: 'Boutique de points', icon: 'shop', view: PointShopView }, { id: 'predictions', label: 'Paris', icon: 'battles', view: PredictionView }] },
  { title: 'Jeux avec le chat', icon: 'dice', items: [{ id: 'interactive', label: 'Roue et course', icon: 'dice', view: InteractiveView, module: 'interactive' }, { id: 'chatplays', label: 'Le chat joue', icon: 'gaming', view: ChatPlaysView }, { id: 'plinko', label: 'Plinko', icon: 'dice', view: PlinkoView }, { id: 'minigames', label: 'Mini-jeux', icon: 'dice', view: MiniGamesView, module: 'chatgames' }, { id: 'battles', label: 'Duels', icon: 'battles', view: Battles, module: 'battles' }, { id: 'games', label: 'Mes jeux', icon: 'gaming', view: Games, module: 'gaming', wide: true }] },
  { title: 'Automatisation', icon: 'auto', items: [{ id: 'commands', label: 'Commandes', icon: 'commands', view: Commands }, { id: 'automations', label: 'Automatisations', icon: 'auto', view: Automations, module: 'automations' }, { id: 'discord', label: 'Discord', icon: 'link', view: DiscordView }, { id: 'packs', label: 'Packs prêts', icon: 'spark', view: PacksView, module: 'interactive' }, { id: 'deck', label: 'Télécommande', icon: 'deck', view: Deck, module: 'deck' }] },
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

const pickView = (id, extra = {}) => { const g = sectionOf(id); if (g) lastTab[g.title] = id; setState({ view: id, overlayId: null, ...extra }); };

// Sections repliables : la section de la page ouverte est toujours dépliée, les autres restent comme on les a laissées.
const readOpen = () => { try { return JSON.parse(localStorage.getItem('navOpen') || '{}'); } catch { return {}; } };
function Side({ s }) {
  const [label, sub] = ROLE[s.role] || ROLE.free;
  const mini = s.settings.navCollapsed === true;
  const active = sectionOf(s.view);
  const [open, setOpen] = useState(readOpen);
  const toggle = (t, now) => { const next = { ...open, [t]: !now }; setOpen(next); try { localStorage.setItem('navOpen', JSON.stringify(next)); } catch { /* facultatif */ } };
  const row = (key, icon, text, on, go) => html`<button type="button" key=${key} class="nav-item ${on ? 'on' : ''}" title=${mini ? text : undefined} aria-label=${text} aria-current=${on ? 'page' : undefined} onClick=${go}>${ICONS[icon]}<span>${text}</span></button>`;
  return html`<aside class="side ${mini ? 'mini' : ''}">
    <div class="logo"><span>${s.brand.name}</span>
      <button type="button" class="nav-fold" aria-label=${mini ? 'Déplier le menu' : 'Replier le menu'} title=${mini ? 'Déplier le menu' : 'Replier le menu'} onClick=${async () => { const r = await act('updateSettings', { navCollapsed: !mini }); if (r) setState({ settings: r }); }}>${ICONS.panel}</button>
    </div>
    <nav class="nav nav2" aria-label="Sections">
      ${NAV.map((g) => {
    const items = g.items.filter((i) => isShown(s, i));
    if (!items.length) return null;
    if (mini) {
      const target = items.find((i) => i.id === lastTab[g.title]) || items[0];
      return row(g.title, g.icon, g.title, active === g, () => pickView(target.id));
    }
    if (g.flat) return html`<div class="nav-flat" key=${g.title}>${items.map((i) => row(i.id, i.icon, i.label, s.view === i.id, () => pickView(i.id)))}</div>`;
    const isOpen = active === g || open[g.title] === true;
    return html`<div class="nav-group ${isOpen ? 'open' : ''} ${active === g ? 'here' : ''}" key=${g.title}>
          <h4><button type="button" aria-expanded=${isOpen} onClick=${() => toggle(g.title, isOpen)}>${ICONS[g.icon]}<span>${g.title}</span><i aria-hidden="true">›</i></button></h4>
          ${isOpen && html`<div class="nav-items">${items.map((i) => row(i.id, i.icon, i.label, s.view === i.id, () => pickView(i.id)))}</div>`}
        </div>`;
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


// Mots qu'on tape souvent pour trouver une page, en plus de son nom.
const KEYWORDS = {
  dashboard: 'accueil pret live verifier', connections: 'tiktok twitch youtube kick compte chaine connecter', dock: 'chat messages repondre', scenes: 'obs scene camera',
  tools: 'minuteur timer chrono sondage outils', clips: 'clip replay video', stats: 'statistiques chiffres recap', assistant: 'ia intelligence', overlays: 'overlay source navigateur obs lien live studio',
  builder: 'creer dessiner personnaliser', shop: 'designs themes', alerts: 'alerte follow abonnement don suivi', sounds: 'son bruitage audio', tts: 'voix lire tts parole', spotify: 'musique',
  giftcatalog: 'galaxie lion rose univers cadeau image prix pieces tiktok', gifts: 'action cadeau combo touche', giftlive: 'cadeaux recus donateurs', goals: 'objectif barre',
  rankfollow: 'rang suivi follow cs2 caisse', ranks: 'classement top podium', pointshop: 'points boutique recompense acheter', predictions: 'pari paris prediction mise parier',
  interactive: 'roue course likes', chatplays: 'controle touches clavier manette jouer chat joue', plinko: 'plinko billes balles cadeaux tombent', minigames: 'jeu quiz devinette', battles: 'duel equipe battle',
  games: 'jeu rang minecraft fortnite valorant', commands: 'commande ! bot', automations: 'automatisation si alors regle', packs: 'pack pret installer', deck: 'telecommande telephone boutons stream deck qr',
  discord: 'discord webhook annonce serveur', settings: 'reglages parametres langue theme licence',
};
const SETTINGS_TABS = [['licence', 'Licence'], ['apparence', 'Apparence', 'theme couleur clair sombre'], ['modules', 'Modules'], ['connexions', 'Connexions', 'obs websocket mot de passe'], ['serveur', 'Overlays et capture', 'port reseau lan'], ['diagnostic', 'Diagnostic'], ['sauvegarde', 'Sauvegarde', 'export import copie'], ['aide', 'Mises à jour et aide', 'mise a jour version beta bug probleme rapport']];
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Palette({ s, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { listRef.current?.querySelector('.pal-item.on')?.scrollIntoView({ block: 'nearest' }); }, [idx]);
  const go = (view, extra = {}) => () => pickView(view, extra);
  const pages = NAV.flatMap((g) => g.items.filter((i) => isShown(s, i)).map((i) => ({ label: i.label, icon: i.icon, hint: g.flat ? 'Page' : g.title, keys: KEYWORDS[i.id], run: go(i.id) })));
  const actions = [
    { label: s.simulating ? 'Arrêter la simulation' : 'Simuler un live (1 min)', icon: 'spark', keys: 'tester essai faux', run: () => act('simulateLive', !s.simulating, 60) },
    { label: 'Tester une alerte de suivi', icon: 'alerts', run: () => act('simulate', 'follow', 'tiktok') },
    { label: 'Tester un cadeau', icon: 'gifts', run: () => act('simulate', 'gift', 'tiktok') },
    { label: 'Passer l\'alerte en cours', icon: 'alerts', run: () => act('skipAlert') },
    { label: 'Passer la synthèse vocale', icon: 'tts', run: () => act('ttsSkip') },
    { label: 'Créer un clip', icon: 'clips', run: () => act('createClip') },
    { label: 'Faire tourner la roue', icon: 'dice', run: () => act('wheelControl', 'spin') },
    { label: 'Lancer une balle de Plinko', icon: 'dice', keys: 'plinko', run: () => act('plinkoTest') },
    { label: 'Ouvrir un pari', icon: 'battles', keys: 'pari prediction', run: go('predictions') },
    { label: 'Nouvelle course aux likes', icon: 'dice', run: () => act('raceControl', 'start') },
    { label: 'Lancer la bataille du chat', icon: 'battles', run: () => act('arena', 'open', {}) },
    { label: 'Lancer le combat de boss', icon: 'battles', run: () => act('boss', 'start', {}) },
    { label: 'Mettre à jour le catalogue des cadeaux', icon: 'gifts', keys: 'tiktok galaxie images', run: async () => { const l = await act('loadGifts'); if (l) { setState({ gifts: l }); toast(`${l.length} cadeaux officiels chargés`); } } },
    { label: 'Télécommande sur téléphone', icon: 'deck', keys: 'qr code mobile wifi', run: go('deck') },
    { label: 'Signaler un problème', icon: 'settings', keys: 'bug rapport erreur aide', run: go('settings', { settingsTab: 'aide' }) },
    { label: 'Quoi de neuf', icon: 'spark', keys: 'nouveautes version mise a jour', run: () => setState({ whatsNewOpen: true }) },
    { label: 'Vérifier les mises à jour', icon: 'settings', keys: 'update version', run: async () => { const r = await act('checkUpdate'); if (r) setState({ updater: r }); go('settings', { settingsTab: 'aide' })(); } },
    { label: 'Assistant de démarrage', icon: 'spark', run: () => setState({ setupOpen: true }) },
    { label: 'Remettre la session à zéro', icon: 'stats', run: () => act('resetSession') },
  ].map((a) => ({ hint: 'Action', ...a }));
  const tabs = SETTINGS_TABS.map(([id, label, keys]) => ({ label: `Réglages › ${label}`, icon: 'settings', hint: 'Réglage', keys, run: go('settings', { settingsTab: id }) }));
  const overlays = s.overlays.map((o) => ({ label: o.name, icon: 'overlays', hint: 'Overlay', keys: `overlay ${o.type}`, run: () => setState({ view: 'overlays', overlayId: o.id }) }));
  const gifts = q.trim().length >= 2 ? (s.gifts || []).map((g) => ({ label: g.name, img: g.image, hint: `${fmt(g.cost)} pièces`, keys: 'cadeau', run: go('giftcatalog', { giftPick: g.id }) })) : [];
  const words = norm(q).split(/\s+/).filter(Boolean);
  const all = [...pages, ...actions, ...tabs, ...overlays, ...gifts];
  const list = (words.length ? all.filter((i) => { const hay = norm(`${i.label} ${i.hint} ${i.keys || ''}`); return words.every((w) => hay.includes(w)); })
    .sort((x, y) => (norm(y.label).startsWith(words[0]) ? 1 : 0) - (norm(x.label).startsWith(words[0]) ? 1 : 0)) : [...pages, ...actions.slice(0, 6)]).slice(0, 60);
  const run = (i) => { if (!i) return; i.run(); onClose(); };
  const keys = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((n) => Math.min(list.length - 1, n + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((n) => Math.max(0, n - 1)); }
    if (e.key === 'Enter') run(list[idx]);
    if (e.key === 'Escape') onClose();
  };
  return html`<div class="modal" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="palette" role="dialog" aria-label="Recherche">
      <div class="pal-in">${ICONS.search}<input ref=${input} value=${q} onInput=${(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown=${keys} placeholder="Chercher une page, un réglage, un overlay ou un cadeau" /><kbd>Échap</kbd></div>
      <div class="pal-list" ref=${listRef}>
        ${list.length ? list.map((i, n) => html`<button type="button" key=${`${i.hint}${i.label}`} class="pal-item ${n === idx ? 'on' : ''}" onMouseEnter=${() => setIdx(n)} onClick=${() => run(i)}>${i.img ? html`<img src=${i.img} alt="" referrerpolicy="no-referrer" />` : ICONS[i.icon]}<span>${i.label}</span><small>${i.hint}</small></button>`) : html`<p class="pal-empty">Rien trouvé. Essaie un autre mot.</p>`}
      </div>
      <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> ouvrir</span></div>
    </div>
  </div>`;
}

// Bascule de langue de l'interface, en haut à droite.
function LangSwitch() {
  const lang = getLang();
  return html`<div class="lang-sw" role="radiogroup" aria-label="Langue">
    ${[['fr', 'FR', 'Français'], ['en', 'EN', 'English']].map(([k, label, name]) => html`<button type="button" key=${k} role="radio" aria-checked=${lang === k} class=${lang === k ? 'on' : ''} title=${name} onClick=${() => setLang(k)}>${label}</button>`)}
  </div>`;
}

function Titlebar({ s, journal, setJournal, wide, onSearch }) {
  const g = sectionOf(s.view);
  const page = FLAT.find((i) => i.id === s.view);
  return html`<header class="titlebar">
    ${g && !g.flat && page && html`<div class="crumb"><span>${g.title}</span><i aria-hidden="true">›</i><b>${page.label}</b></div>`}
    <span class="tb-space"></span>
    <button type="button" class="search-pill" title="Rechercher (Ctrl K)" aria-label="Rechercher" onClick=${onSearch}>${ICONS.search}<span>Rechercher</span><kbd>Ctrl K</kbd></button>
    <${UpdatePill} s=${s} />
    <button type="button" class="sim-btn ${s.simulating ? 'on' : ''}" title="Envoie de faux suivis, cadeaux et messages pendant une minute pour tester tes overlays" onClick=${() => act('simulateLive', !s.simulating, 60)}>${s.simulating ? html`<i class="sim-dot"></i>` : ICONS.spark}<span>${s.simulating ? 'Simulation en cours' : 'Simuler un live'}</span></button>
    <${LangSwitch} />
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
    ${(s.whatsNewOpen || (s.whatsNew?.length > 0 && !s.setupOpen && !s.liveRecap)) && html`<${WhatsNew} s=${s} list=${s.whatsNewOpen ? null : s.whatsNew} onClose=${() => setState({ whatsNew: [], whatsNewOpen: false })} />`}
    ${(s.setupOpen || !s.settings.onboarded) && html`<${Setup} s=${s} />`}
    ${s.liveRecap && html`<${RecapModal} recap=${s.liveRecap} />`}
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
  if (getState().settings?.uiLang !== getLang()) window.regie.call('setUiLang', getLang()).catch(() => {});
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
  on('queue', (queue) => setState({ tools: { ...getState().tools, queue } }));
  on('wheel', (wheel) => setState({ wheel }));
  on('chatPlays', (playsLive) => setState({ playsLive }));
  on('prediction', (predictionLive) => setState({ predictionLive }));
  on('plinkoLand', (plinkoLand) => setState({ plinkoLand }));
  on('gifts', (gifts) => setState({ gifts, giftCacheAt: Date.now() }));
  on('simulating', (simulating) => setState({ simulating }));
  on('shop', (shop) => setState({ shop }));
  on('eventPatch', (p) => setState({ feed: getState().feed.map((e) => (e.id === p.id ? { ...e, translation: p.translation } : e)) }));
  on('liveRecap', (liveRecap) => { if (getState().recapCfg?.open !== false) setState({ liveRecap }); });
  on('likeRace', (likeRace) => setState({ likeRace }));
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
