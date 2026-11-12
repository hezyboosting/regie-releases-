// Le coeur de l'appli : chaque événement de chaque chaîne passe ici, puis repart vers
// les alertes, goals, battles, commandes, TTS, outils et stats.
const crypto = require('crypto');
const { uid, EVENT_TYPES, defaultRules, makeOverlay } = require('../shared/defaults');
const { rankImage } = require('../shared/rank-files');
const { rankLook } = require('../shared/games');
const { OVERLAY_TYPES, overlayDefaults } = require('../shared/overlay-schema');
const { withinLimit } = require('../shared/features');
const { TikTokConnector } = require('./connectors/tiktok');
const { TwitchConnector } = require('./connectors/twitch');
const { YouTubeConnector } = require('./connectors/youtube');
const { renderTemplate } = require('./text');
const { Viewers } = require('./viewers');
const { Games, BOSSES, gameById, rankLabel, nextRank, rankScore, STAT_LABEL } = require('./games');
const { MiniGames } = require('./minigames');
const { KickConnector } = require('./connectors/kick');
const { TwitchIrc } = require('./connectors/twitch-irc');
const { rconSend } = require('./gamehub');
const { THEMES } = require('../shared/themes');

const RANK = { all: 0, sub: 1, vip: 2, mod: 3, owner: 4 };
const userRank = (u = {}) => (u.owner ? 4 : u.mod ? 3 : u.vip ? 2 : u.sub ? 1 : 0);
const PLATFORM_LABEL = { tiktok: 'TikTok', twitch: 'Twitch', youtube: 'YouTube', demo: 'Test' };

function duration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

class Engine {
  constructor({ file, vault, server, spotify, tts, stats, obs, license, push, log, viewers, input, audio }) {
    Object.assign(this, { file, vault, server, spotify, tts, stats, obs, license, push, log, viewers, input, audio });
    this.games = new Games(this);
    this.minigames = new MiniGames(this);
    this.keyStamps = [];
    this.recentTypes = {};
    this.gameLive = null;
    this.notify = null;
    this.migrate();
    this.connectors = new Map();
    this.status = {};
    this.liveCounts = {};
    this.liveSince = {};
    this.feed = [];
    this.alertQueue = [];
    this.alertBusy = false;
    this.cool = new Map();
    this.likeMarks = {};
    this.gifts = [];
    this.battleUsers = new Map();
    this.supporters = new Map();
    this.battleTimer = null;
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  get s() { return this.file.data; }

  save() { this.file.save(); }

  features() { return this.license.features(); }

  allowed(key) { return Boolean(this.features()[key]); }

  modOn(id) { return this.s.settings.modules?.[id] !== false; }

  // Anciennes données vers le nouveau format, et un overlay prêt pour chaque type (comme une galerie).
  migrate() {
    const s = this.s;
    for (const o of s.overlays) {
      if (o.type === 'rlrank') o.type = 'gamecard';
      if (o.enabled === undefined) o.enabled = true;
      o.settings = { ...overlayDefaults(o.type), ...o.settings };
    }
    for (const [type, def] of Object.entries(OVERLAY_TYPES)) {
      if (!def.hidden && !s.overlays.some((o) => o.type === type)) s.overlays.push(makeOverlay(type, def.name));
    }
    const rl = s.gaming?.rl;
    if (rl && !s.gaming.profiles.rocketleague) {
      const game = gameById('rocketleague');
      const map = { bronze: 'bronze', silver: 'argent', gold: 'or', platinum: 'platine', diamond: 'diamant', champion: 'champion', grand: 'grand-champion', legend: 'supersonic-legend' };
      const prof = this.profile(game.id);
      prof.pseudo = rl.pseudo || '';
      for (const m of rl.playlists || []) if (prof.modes[m.id]) Object.assign(prof.modes[m.id], { tier: map[m.tier] || m.tier, division: m.division, mmr: m.mmr });
    }
    delete s.gaming.rl;
    this.migrateDesign();
  }

  // Passages de style, une seule fois chacun.
  migrateDesign() {
    const s = this.s;
    const rev = s.settings.designRev || 0;
    if (rev < 3) {
      for (const o of s.overlays) {
        const def = overlayDefaults(o.type);
        // Le nouveau style repart de ses propres couleurs. Textes, positions et tailles ne bougent pas.
        for (const f of OVERLAY_TYPES[o.type]?.fields || []) if (f.type === 'color') o.settings[f.key] = def[f.key];
        if (['archivo', 'geist', 'syne'].includes(o.settings.font)) o.settings.font = 'onest';
        if (o.type === 'alerts' || o.type === 'chat') o.settings.theme = def.theme;
        if (o.type === 'gamepad') o.settings.pressed = def.pressed;
      }
      for (const r of s.alerts?.rules || []) if (!['', 'verre', 'carte', 'minimal'].includes(r.theme || '')) r.theme = '';
    }
    // Manette redessinée : les anciennes finitions transparentes passent au coloris par défaut.
    if (rev < 4) {
      for (const o of s.overlays) {
        if (o.type === 'gamepad' && (o.settings.finish?.shell?.alpha ?? 0) <= 30) { o.settings.finish = overlayDefaults('gamepad').finish; o.settings.colorway = 'fume'; }
      }
    }
    s.settings.designRev = 4;
  }

  // ---------- Chaînes ----------
  clientIds() {
    const d = this.license.apiDefaults();
    const pick = (k) => this.vault.get(`key:${k}`) || d[k] || '';
    return { twitch: pick('twitchClientId'), ytId: pick('youtubeClientId'), ytSecret: pick('youtubeClientSecret'), euler: pick('eulerKey'), eleven: pick('elevenKey'), spotify: pick('spotifyClientId') };
  }

  makeConnector(a) {
    const ids = this.clientIds();
    if (a.platform === 'tiktok') return new TikTokConnector(a, { vault: this.vault, signKey: ids.euler });
    if (a.platform === 'twitch' && a.mode === 'pseudo') return new TwitchIrc(a);
    if (a.platform === 'twitch') return new TwitchConnector(a, { vault: this.vault, clientId: ids.twitch });
    if (a.platform === 'youtube') return new YouTubeConnector(a, { vault: this.vault, clientId: ids.ytId, clientSecret: ids.ytSecret, quota: this.quota() });
    if (a.platform === 'kick') return new KickConnector(a);
    throw new Error('Plateforme inconnue');
  }

  quota() {
    const today = new Date().toISOString().slice(0, 10);
    const box = () => {
      if (this.s.ytQuota?.day !== today) this.s.ytQuota = { day: today, used: 0 };
      return this.s.ytQuota;
    };
    return { used: () => box().used, add: (n) => { box().used += n; this.save(); } };
  }

  // Une licence expirée ne supprime rien : seules les N premières chaînes tournent.
  usableAccounts() {
    const limit = this.features().channelsPerPlatform;
    const seen = {};
    return this.s.accounts.filter((a) => {
      seen[a.platform] = (seen[a.platform] || 0) + 1;
      return limit === -1 || seen[a.platform] <= limit;
    });
  }

  startAccount(a) {
    this.stopAccount(a.id);
    const usable = this.usableAccounts().some((u) => u.id === a.id);
    if (!usable) { this.setStatus(a.id, { state: 'locked', detail: 'Passe en PRO pour utiliser cette chaîne' }); return; }
    const c = this.makeConnector(a);
    c.on('status', (st) => this.setStatus(a.id, st));
    c.on('event', (raw) => this.ingest(a, raw));
    c.on('profile', (p) => { Object.assign(a, p); if (p.display) a.label = p.display; this.save(); this.pushChannels(); });
    c.on('log', (m) => this.log(`[${a.platform}:${a.label}] ${m}`));
    this.connectors.set(a.id, c);
    Promise.resolve(c.start()).catch((e) => this.setStatus(a.id, { state: 'error', detail: e.message }));
  }

  stopAccount(id) {
    const c = this.connectors.get(id);
    if (c) { c.removeAllListeners('status'); c.stop(); this.connectors.delete(id); }
    delete this.liveCounts[id];
    delete this.liveSince[id];
    this.setStatus(id, { state: 'stopped', detail: '' });
  }

  setStatus(id, st) {
    const before = this.status[id];
    if (before?.state !== st.state || before?.detail !== st.detail) {
      const a = this.s.accounts.find((x) => x.id === id);
      if (a && st.state !== 'stopped') this.log(`[${a.platform}:${a.label}] ${st.state}${st.detail ? ` : ${st.detail}` : ''}`);
    }
    this.status[id] = st;
    const was = Object.keys(this.liveSince).length > 0;
    if (st.state === 'live' && !this.liveSince[id]) this.liveSince[id] = Date.now();
    if (['offline', 'stopped', 'error'].includes(st.state)) delete this.liveSince[id];
    const is = Object.keys(this.liveSince).length > 0;
    if (!was && is) this.onLiveStart();
    if (was && !is) this.onLiveEnd();
    this.pushChannels();
  }

  // Début de live : session remise à zéro, pour que les essais d'avant ne comptent pas.
  onLiveStart() {
    this.viewers.reset();
    this.currentLive = { id: uid('l'), start: Date.now(), game: this.s.gaming.active, peak: 0, samples: [] };
    for (const g of this.s.goals) if (g.reset === 'live') { g.current = 0; g.reached = false; }
    this.pushGoals();
    this.pushLive();
  }

  onLiveEnd() {
    const l = this.currentLive;
    this.currentLive = null;
    if (!l || Date.now() - l.start < 120000) return;
    const c = this.viewers.session.counts;
    const g = this.viewers.session.gifts;
    this.stats.addLive({ ...l, end: Date.now(), follows: c.follow || 0, subs: (c.sub || 0) + (c.resub || 0) + (c.member || 0), likes: c.like || 0, shares: c.share || 0, messages: c.chat || 0, coins: g.coins, gifts: g.count, topGifter: this.viewers.session.topGift?.user || '' });
  }

  channels() {
    return this.s.accounts.map((a) => ({
      id: a.id, platform: a.platform, label: a.label, avatar: a.avatar || '', enabled: a.enabled !== false, mode: a.mode, username: a.username, channel: a.channel,
      status: this.status[a.id] || { state: 'stopped', detail: '' }, viewers: this.liveCounts[a.id] || 0, muted: Boolean(a.muted),
      activity: this.stats.activity(a.id), canSend: this.connectors.get(a.id)?.canSend?.() || false, liveSince: this.liveSince[a.id] || 0,
    }));
  }

  pushChannels() { this.push('channels', this.channels()); }

  totalViewers() { return Object.values(this.liveCounts).reduce((n, v) => n + v, 0); }

  // ---------- Pipeline d'événements ----------
  ingest(account, raw) {
    if (!raw) return;
    if (raw.type === 'viewers') {
      this.liveCounts[account.id] = raw.amount;
      this.stats.viewers(account, raw.amount);
      this.onViewers();
      return;
    }
    if (raw.type === 'streamstate') {
      this.setStatus(account.id, { state: raw.live ? 'live' : 'offline', detail: '' });
      return;
    }
    if (raw.type === 'giftstreak') {
      const ev = { ...raw, platform: account.platform, accountId: account.id };
      this.server.broadcast({ t: 'giftstreak', ev }, ['alerts', 'giftfeed']);
      this.viewers.streak(raw.user?.display, raw.user?.avatar, account.platform, raw.gift?.name, raw.gift?.image, raw.amount || 1);
      this.pushLive();
      return;
    }
    if (raw.type === 'battle') { this.onNativeBattle(account, raw); return; }
    if (account.muted) return;
    this.handle({ id: uid('e'), ts: Date.now(), platform: account.platform, accountId: account.id, channel: account.label, user: {}, ...raw });
  }

  handle(ev) {
    if (!ev.test) this.stats.record(ev);
    const result = this.viewers.record(ev, this.s.rewards);
    (this.recentTypes[ev.type] = this.recentTypes[ev.type] || []).push(Date.now());
    if (this.recentTypes[ev.type].length > 200) this.recentTypes[ev.type].shift();
    this.feed.push(ev);
    if (this.feed.length > 500) this.feed.shift();
    this.push('event', ev);
    this.server.broadcast({ t: 'ev', ev }, ['chat', 'ticker', 'giftfeed', 'webcam', 'dock']);
    if (ev.type !== 'chat') {
      this.queueAlert(ev);
      this.applySubathon(ev);
    }
    if (this.modOn('goals')) this.applyGoals(ev);
    if (this.modOn('battles')) this.applyBattle(ev);
    if (this.modOn('chatgames')) this.games.onEvent(ev, result);
    this.pushLive();
    this.runTriggers(ev);
    if (this.modOn('tts')) this.tts.fromEvent(ev);
    if (ev.type === 'chat') this.handleChat(ev);
  }

  simulate(type, platform = 'twitch', extra = {}) {
    const names = ['Lena', 'Marius', 'Kenza', 'Yanis', 'Inès', 'Théo', 'Sofia', 'Nolan'];
    const name = extra.user || names[crypto.randomInt(names.length)];
    const pick = (a) => a[crypto.randomInt(a.length)];
    const user = { id: `demo-${name}`, name, display: name, avatar: '', sub: false, mod: false, vip: false, owner: false, ...(extra.flags || {}) };
    const base = { id: uid('e'), ts: Date.now(), platform, accountId: 'demo', channel: `${PLATFORM_LABEL[platform]} test`, user, test: true };
    const gift = pick([{ id: 'demo1', name: 'Rose', cost: 1 }, { id: 'demo2', name: 'Fusée', cost: 500 }, { id: 'demo3', name: 'Lion', cost: 29999 }]);
    const samples = {
      chat: { text: extra.text || pick(['Salut tout le monde', 'Quelle game', '!son', 'gg', 'Bonne soirée !']) },
      follow: {}, sub: { months: 1, tier: '1000' }, resub: { months: 14, tier: '1000', text: 'Déjà 14 mois' }, giftsub: { amount: 5 },
      bits: { amount: 500, text: 'Bien joué' }, raid: { amount: 42 }, redeem: { reward: 'Hydrate-toi', amount: 500 }, hypetrain: { amount: 1 },
      superchat: { value: 10, currency: 'EUR', money: '10,00 €', text: 'Merci pour le live' }, supersticker: { value: 5, currency: 'EUR', money: '5,00 €' },
      member: { tier: 'Membre' }, milestone: { months: 6 },
      gift: { gift: { ...gift, image: '', count: 3 }, amount: 3, value: gift.cost * 3 },
      like: { amount: 50, total: (this.demoLikes = (this.demoLikes || 0) + 500) }, share: {}, join: {}, superfan: {},
      giftstreak: {},
    };
    if (type === 'giftstreak') {
      const g = { id: 'demo1', name: 'Rose', cost: 1, image: '' };
      const ev = { type, user, gift: g, amount: extra.amount || 5, platform, accountId: 'demo' };
      this.server.broadcast({ t: 'giftstreak', ev }, ['alerts', 'giftfeed']);
      this.viewers.streak(user.display, '', platform, g.name, '', ev.amount);
      this.pushLive();
      return;
    }
    this.handle({ ...base, ...(samples[type] || {}), type, ...(extra.fields || {}) });
  }

  // ---------- Alertes ----------
  ruleFor(ev) {
    const rules = this.s.alerts.rules.filter((r) => r.enabled && r.type === ev.type && (r.platforms?.includes(ev.platform) ?? true));
    const custom = this.allowed('alertRulesCustom');
    const amount = ev.value || ev.amount || 0;
    const fits = rules.filter((r) => (r.base || custom) && amount >= (r.minAmount || 0) && (!r.giftId || r.giftId === ev.gift?.id) && this.comboHit(ev.type, r));
    fits.sort((a, b) => (b.comboCount || 0) - (a.comboCount || 0) || (b.giftId ? 1 : 0) - (a.giftId ? 1 : 0) || (b.minAmount || 0) - (a.minAmount || 0));
    return fits[0];
  }

  // Combo : l'alerte part seulement si l'événement arrive N fois dans la fenêtre.
  comboHit(type, r) {
    if (!(r.comboCount > 1)) return true;
    if (!this.allowed('alertVariants')) return false;
    const since = Date.now() - (r.comboSeconds || 30) * 1000;
    return (this.recentTypes[type] || []).filter((t) => t >= since).length >= r.comboCount;
  }

  // Alerte aléatoire : chaque variante a un poids, les plus rares sortent moins souvent.
  pickVariant(rule) {
    const list = this.allowed('alertVariants') ? (rule.variants || []) : [];
    if (!list.length) return rule;
    const all = [{ weight: rule.weight ?? 50 }, ...list];
    let r = crypto.randomInt(Math.max(1, all.reduce((n, v) => n + (v.weight || 1), 0)));
    for (const v of all) { r -= v.weight || 1; if (r < 0) return { ...rule, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined)) }; }
    return rule;
  }

  queueAlert(ev) {
    const found = this.ruleFor(ev);
    if (!found || this.s.alerts.paused) return;
    if (ev.type === 'like') {
      const every = found.every || 1000;
      const mark = Math.floor((ev.total || 0) / every);
      if (mark <= (this.likeMarks[ev.accountId] || 0)) return;
      this.likeMarks[ev.accountId] = mark;
    } else if (found.every > 1 && ((this.viewers.session.counts[ev.type] || 0) % found.every) !== 0) return;
    const rule = this.pickVariant(found);
    const vars = this.vars(ev);
    const alert = {
      id: uid('a'), ruleId: rule.id, type: ev.type, platform: ev.platform, channel: ev.channel, title: renderTemplate(rule.message, vars), text: ev.text || '',
      user: ev.user?.display || '', avatar: ev.user?.avatar || '', image: rule.image || ev.gift?.image || '', sound: rule.sound, volume: rule.volume ?? 80, duration: rule.duration || 6, theme: rule.theme || '', position: rule.position || '',
    };
    this.alertQueue.push(alert);
    if (this.alertQueue.length > 60) this.alertQueue.shift();
    this.push('alertQueue', this.alertQueue.length);
    if (rule.tts) this.tts.say({ text: alert.title, user: ev.user, force: true });
    this.pumpAlerts();
  }

  pumpAlerts() {
    if (this.alertBusy || this.s.alerts.paused) return;
    const next = this.alertQueue.shift();
    if (!next) return;
    this.alertBusy = next;
    this.server.broadcast({ t: 'alert', alert: next }, 'alerts');
    this.push('alertQueue', this.alertQueue.length);
    this.alertTimer = setTimeout(() => {
      this.alertBusy = false;
      setTimeout(() => this.pumpAlerts(), (this.s.alerts.gap ?? 1) * 1000);
    }, next.duration * 1000);
  }

  skipAlert() {
    clearTimeout(this.alertTimer);
    this.alertBusy = false;
    this.server.broadcast({ t: 'alertSkip' }, 'alerts');
    this.pumpAlerts();
  }

  clearAlerts() { this.alertQueue = []; this.push('alertQueue', 0); }

  vars(ev) {
    return {
      user: ev.user?.display || 'Quelqu\'un', amount: (ev.amount ?? '').toLocaleString?.('fr-FR') ?? ev.amount, months: ev.months, money: ev.money, reward: ev.reward,
      gift: ev.gift?.name, total: (ev.total ?? '').toLocaleString?.('fr-FR'), channel: ev.channel, platform: PLATFORM_LABEL[ev.platform], text: ev.text || '', tier: ev.tier,
    };
  }

  // ---------- Goals ----------
  goalDelta(goal, ev) {
    if (goal.platforms?.length && !goal.platforms.includes(ev.platform)) return 0;
    switch (goal.metric) {
      case 'follow': return ev.type === 'follow' ? 1 : 0;
      case 'sub':
        if (['sub', 'resub', 'member'].includes(ev.type)) return 1;
        return ev.type === 'giftsub' ? ev.amount || 1 : 0;
      case 'likes': return ev.type === 'like' ? ev.amount || 0 : 0;
      case 'coins': return ev.type === 'gift' ? ev.value || 0 : 0;
      case 'gifts': return ev.type === 'gift' ? ev.amount || 1 : 0;
      case 'bits': return ev.type === 'bits' ? ev.amount || 0 : 0;
      case 'onegift': return ev.type === 'gift' && ev.gift?.id === goal.giftId ? ev.amount || 1 : 0;
      case 'money': return ['superchat', 'supersticker'].includes(ev.type) ? ev.value || 0 : 0;
      case 'chat': return ev.type === 'chat' ? 1 : 0;
      case 'shares': return ev.type === 'share' ? 1 : 0;
      default: return 0;
    }
  }

  activeGoals() {
    const limit = this.features().goals;
    return limit === -1 ? this.s.goals : this.s.goals.slice(0, limit);
  }

  applyGoals(ev) {
    let changed = false;
    for (const g of this.activeGoals()) {
      const d = this.goalDelta(g, ev);
      if (d) { this.bumpGoal(g, d); changed = true; }
    }
    if (changed) this.pushGoals();
  }

  bumpGoal(g, delta, absolute) {
    g.current = absolute !== undefined ? absolute : Math.max(0, (g.current || 0) + delta);
    if (g.current >= g.target && !g.reached) {
      g.reached = true;
      this.s.goalHistory.unshift({ title: g.title, target: g.target, at: Date.now() });
      this.s.goalHistory = this.s.goalHistory.slice(0, 100);
      const sys = { type: 'goalReached', platform: 'twitch', accountId: 'system', channel: 'Régie', user: { display: g.title } };
      this.runActions(g.actions || [], sys, { ...this.commandVars(sys, '', null), reward: g.title });
      this.fireType('goalReached', sys);
      this.handle({ id: uid('e'), ts: Date.now(), platform: 'twitch', accountId: 'system', channel: 'Régie', user: { display: g.title }, type: 'goal', reward: g.title, test: true });
      if (g.autoStep > 0) { g.target += g.autoStep; g.reached = false; }
    }
    if (g.current < g.target) g.reached = false;
  }

  pushGoals() {
    this.save();
    this.push('goals', this.s.goals);
    this.server.broadcast({ t: 'goals', goals: this.s.goals }, 'goal');
  }

  onViewers() {
    const total = this.totalViewers();
    let changed = false;
    for (const g of this.activeGoals()) {
      if (g.metric === 'viewers' && g.current !== total) { this.bumpGoal(g, 0, total); changed = true; }
    }
    if (changed) this.pushGoals();
    this.pushViewers();
  }

  pushViewers() {
    const perPlatform = {};
    for (const a of this.s.accounts) perPlatform[a.platform] = (perPlatform[a.platform] || 0) + (this.liveCounts[a.id] || 0);
    this.server.broadcast({ t: 'viewers', total: this.totalViewers(), perPlatform }, 'viewers');
    this.pushChannels();
  }

  // ---------- Battles ----------
  battleMode() {
    const b = this.s.battle;
    return !this.allowed('battleAllModes') && b.mode !== 'chat' ? 'chat' : b.mode;
  }

  startBattle(cfg = {}) {
    const b = this.s.battle;
    Object.assign(b, cfg);
    if (!this.allowed('battleAllModes')) { b.mode = 'chat'; b.teams = b.teams.slice(0, 2); }
    b.teams.forEach((t) => { t.score = 0; t.top = []; });
    b.status = 'running';
    b.winner = null;
    b.startedAt = Date.now();
    b.endsAt = b.duration > 0 ? Date.now() + b.duration * 1000 : 0;
    this.battleUsers.clear();
    this.supporters.clear();
    clearTimeout(this.battleTimer);
    if (b.endsAt) this.battleTimer = setTimeout(() => this.endBattle(), b.duration * 1000);
    this.pushBattle();
  }

  endBattle() {
    const b = this.s.battle;
    if (b.status !== 'running') return;
    clearTimeout(this.battleTimer);
    b.status = 'ended';
    const sorted = [...b.teams].sort((x, y) => y.score - x.score);
    b.winner = sorted[0].score === sorted[1]?.score ? 'tie' : sorted[0].id;
    this.pushBattle();
  }

  resetBattle() {
    const b = this.s.battle;
    clearTimeout(this.battleTimer);
    b.status = 'idle';
    b.winner = null;
    b.endsAt = 0;
    b.teams.forEach((t) => { t.score = 0; t.top = []; });
    this.pushBattle();
  }

  pushBattle() {
    this.save();
    this.push('battle', this.s.battle);
    this.server.broadcast({ t: 'battle', battle: this.s.battle }, 'battle');
  }

  battlePoints(ev) {
    const sc = this.s.battle.scoring;
    switch (ev.type) {
      case 'chat': return sc.chat;
      case 'like': return sc.like * (ev.amount || 0);
      case 'follow': return sc.follow;
      case 'share': return sc.share;
      case 'sub': case 'resub': case 'member': return sc.sub;
      case 'giftsub': return sc.sub * (ev.amount || 1);
      case 'gift': return sc.coin * (ev.value || 0);
      case 'bits': return sc.bit * (ev.amount || 0);
      case 'superchat': case 'supersticker': return sc.money * (ev.value || 0);
      default: return 0;
    }
  }

  applyBattle(ev) {
    const b = this.s.battle;
    if (b.status !== 'running') return;
    const mode = this.battleMode();
    const key = `${ev.platform}:${ev.user?.id || ev.user?.name}`;
    let team = null;
    const typed = (ev.text || '').trim().toLowerCase();
    if (mode === 'chat' || mode === 'teams') {
      if (ev.type === 'chat') {
        const t = b.teams.find((x) => x.keyword && typed.startsWith(x.keyword.toLowerCase()));
        if (t) { this.battleUsers.set(key, t.id); team = t; }
      }
      if (mode === 'teams' && !team) team = b.teams.find((x) => x.id === this.battleUsers.get(key));
    } else if (mode === 'platforms') {
      team = b.teams.find((x) => x.platforms?.includes(ev.platform));
    } else if (mode === 'gifts' && ev.type === 'gift') {
      team = b.teams.find((x) => x.giftIds?.includes(ev.gift?.id));
    }
    if (!team) return;
    const pts = mode === 'chat' ? b.scoring.chat : this.battlePoints(ev);
    if (!pts) return;
    team.score += pts;
    const sup = this.supporters.get(team.id) || new Map();
    const name = ev.user?.display || 'Anonyme';
    sup.set(name, (sup.get(name) || 0) + pts);
    this.supporters.set(team.id, sup);
    team.top = [...sup.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n, p]) => ({ name: n, points: p }));
    this.pushBattle();
  }

  // Battles natives TikTok : on affiche les scores envoyés par TikTok.
  onNativeBattle(account, raw) {
    const b = this.s.battle;
    if (b.mode !== 'tiktok' || !this.allowed('battleAllModes')) return;
    if (raw.phase === 'start') {
      this.startBattle({ duration: 0 });
      (raw.raw.anchors || []).slice(0, b.teams.length).forEach((name, i) => { b.teams[i].name = name; });
      b.nativeHosts = [];
      this.pushBattle();
    } else if (raw.phase === 'score' && b.status === 'running') {
      b.nativeHosts = b.nativeHosts || [];
      for (const s of raw.raw.scores || []) {
        if (!b.nativeHosts.includes(s.hostId)) b.nativeHosts.push(s.hostId);
        const team = b.teams[b.nativeHosts.indexOf(s.hostId)];
        if (team) team.score = s.points;
      }
      this.pushBattle();
    }
  }

  // ---------- Données en direct pour les overlays ----------
  liveVars() {
    const v = this.viewers.session;
    const t = this.spotify.state.track;
    const c = v.counts;
    const goal = this.s.goals[0];
    return {
      viewers: this.totalViewers(), lastFollower: v.last.follow?.name || '', lastSub: (v.last.sub || v.last.resub || v.last.member)?.name || '', lastGifter: v.last.gift?.name || '', lastGift: v.last.gift?.gift || '',
      lastBits: v.last.bits?.name || '', lastSuperchat: v.last.superchat?.name || '', topGifter: v.topGift?.user || '', topGift: v.topGift?.name || '', topGiftValue: v.topGift?.value || 0, topStreakUser: v.topStreak?.user || '', topStreak: v.topStreak?.count || 0,
      coins: v.gifts.coins, gifts: v.gifts.count, likes: c.like || 0, follows: c.follow || 0, subs: (c.sub || 0) + (c.resub || 0) + (c.member || 0), messages: c.chat || 0,
      song: t?.title || '', artist: t?.artist || '', goal: goal?.current || 0, goalTarget: goal?.target || 0, goalName: goal?.title || '', uptime: this.uptime(),
    };
  }

  // Limité à trois envois par seconde, même pendant un raid.
  pushLive() {
    if (this.liveTimer) return;
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null;
      this.server.broadcast({ t: 'vars', vars: this.liveVars() }, ['custom', 'webcam']);
      this.server.broadcast({ t: 'boards', boards: this.viewers.boards(10) }, 'leaderboard');
      const gifts = this.viewers.giftView();
      this.server.broadcast({ t: 'gifts', gifts }, ['gifttracker', 'topgift', 'topstreak']);
      this.push('session', gifts);
      this.push('activity', this.activityPoint());
    }, 330);
  }

  activityPoint() { return { ts: Date.now(), vars: this.liveVars() }; }

  // Sons : bibliothèque, ou sons intégrés.
  soundUrl(sound) {
    const builtin = ['chime', 'pop', 'coins', 'fanfare', 'horn', 'tally'].includes(sound);
    const port = this.server.port;
    if (builtin) return `http://127.0.0.1:${port}/assets/sounds/${sound}.wav`;
    return `http://127.0.0.1:${port}/media/${encodeURIComponent(sound)}?k=${this.server.token}`;
  }

  playSound(sound, volume = 80) {
    if (!sound || sound === 'none') return;
    if (this.s.sounds.output === 'overlay' && this.server.hasClient('alerts')) this.server.broadcast({ t: 'sound', sound, volume }, 'alerts');
    else this.audio?.('sound:play', { url: this.soundUrl(sound), volume });
  }

  // ---------- Commandes ----------
  activeCommands() {
    const limit = this.features().commands;
    return limit === -1 ? this.s.commands : this.s.commands.slice(0, limit);
  }

  cooled(key, seconds) {
    if (!seconds) return false;
    const until = this.cool.get(key) || 0;
    if (until > Date.now()) return true;
    this.cool.set(key, Date.now() + seconds * 1000);
    return false;
  }

  async reply(ev, text, where = 'origin') {
    if (!text) return;
    const targets = where === 'all' && this.allowed('replyAllChannels') ? [...this.connectors.values()] : [this.connectors.get(ev.accountId)].filter(Boolean);
    for (const c of targets) {
      if (!c.canSend?.()) continue;
      try { await c.send(text); } catch (e) { this.log(`Réponse impossible : ${e.message}`); }
    }
    if (ev.test) this.push('botReply', { text, platform: ev.platform });
  }

  uptime() {
    const since = Math.min(...Object.values(this.liveSince), Infinity);
    return Number.isFinite(since) ? duration(Date.now() - since) : 'hors ligne';
  }

  // Réponse au hasard (une par ligne), {random:1-100}, {pick:a|b|c}, {counter:Nom}, puis les variables.
  expand(tpl, vars) {
    let t = String(tpl || '');
    const lines = t.split(/\n|\s\|\|\s/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) t = lines[crypto.randomInt(lines.length)];
    t = t.replace(/\{random(?::(\d+)-(\d+))?\}/g, (m, a, b) => { const lo = Number(a ?? 1); const hi = Number(b ?? 100); return lo + crypto.randomInt(Math.max(1, hi - lo + 1)); });
    t = t.replace(/\{pick:([^}]+)\}/g, (m, l) => { const o = l.split('|'); return o[crypto.randomInt(o.length)]; });
    t = t.replace(/\{counter:([^}]+)\}/g, (m, n) => this.s.tools.counters.find((c) => c.name.toLowerCase() === n.toLowerCase())?.value ?? m);
    return renderTemplate(t, vars);
  }

  commandVars(ev, args, cmd) {
    const t = this.spotify.state.track;
    return {
      ...this.vars(ev), args, count: cmd?.uses ?? 0, uptime: this.uptime(), viewers: this.totalViewers(), points: this.viewers.points(ev), level: this.viewers.level(ev), game: gameById(this.s.gaming.active).name, record: this.gameRecord(),
      song: t ? `${t.title} de ${t.artist}` : 'aucune musique',
    };
  }

  handleChat(ev) {
    const text = (ev.text || '').trim();
    if (!text) return;
    const [head, ...rest] = text.split(/\s+/);
    const cmd = head.toLowerCase();
    const args = rest.join(' ');

    this.voteOrEnter(ev, text, cmd);
    if (this.modOn('chatgames') && this.minigames.onChat(ev, text)) return;
    if (this.games.onChat(ev, cmd, args)) return;
    if (cmd === this.s.clips.command?.toLowerCase()) { this.clipCommand(ev); return; }

    const sr = this.s.spotify.requests;
    if (sr.enabled && this.allowed('songRequests') && cmd === sr.command.toLowerCase()) { this.songRequest(ev, args, sr); return; }
    if (cmd === (this.s.tts.command || '').toLowerCase()) { this.tts.say({ text: args, user: ev.user, ev, viaCommand: true }); return; }
    if (cmd === '!commandes') {
      const list = this.activeCommands().filter((c) => c.enabled).map((c) => c.trigger).join(' ');
      this.reply(ev, list);
      return;
    }

    const c = this.activeCommands().find((x) => x.enabled && (x.trigger.toLowerCase() === cmd || x.aliases?.map((a) => a.toLowerCase()).includes(cmd)));
    if (!c) return;
    if (c.platforms && !c.platforms.includes(ev.platform)) return;
    if (userRank(ev.user) < (RANK[c.perm] ?? 0)) return;
    if (this.cooled(`cmd:${c.id}`, c.cooldown) || this.cooled(`cmd:${c.id}:${ev.platform}:${ev.user.id}`, c.userCooldown)) return;
    c.uses = (c.uses || 0) + 1;
    this.save();
    const vars = this.commandVars(ev, args, c);
    this.reply(ev, this.expand(c.perPlatform?.[ev.platform] || c.response, vars), c.replyTo);
    this.runActions(c.actions || [], ev, vars);
  }

  async songRequest(ev, query, sr) {
    if (userRank(ev.user) < (RANK[sr.perm] ?? 0)) return;
    if (this.cooled(`sr:${ev.platform}:${ev.user.id}`, sr.cooldown)) { this.reply(ev, `${ev.user.display}, attends un peu avant de redemander une musique.`); return; }
    if (!this.spotify.connected) { this.wish(ev, query, sr); return; }
    try {
      const t = await this.spotify.request(query, ev.user.display, sr);
      this.reply(ev, `${t.title} de ${t.artist} ajouté, merci ${ev.user.display}`);
    } catch (e) { this.reply(ev, `${ev.user.display} : ${e.message}`); }
  }

  // Sans compte Spotify relié, la demande attend dans une liste que le streamer lance d'un clic.
  wish(ev, query, sr) {
    const text = String(query).trim().slice(0, 120);
    if (!text) { this.reply(ev, `${ev.user.display}, écris ${sr.command} suivi du titre.`); return; }
    const low = text.toLowerCase();
    if ((sr.blocked || []).some((b) => b && low.includes(String(b).toLowerCase()))) { this.reply(ev, `${ev.user.display} : ce morceau n'est pas autorisé ici.`); return; }
    const list = this.s.spotify.wishlist || [];
    if (list.filter((w) => w.user === ev.user.display).length >= (sr.maxPerUser || 2)) { this.reply(ev, `${ev.user.display}, tu as déjà des demandes en attente.`); return; }
    this.s.spotify.wishlist = [...list, { id: uid('w'), query: text, user: ev.user.display, platform: ev.platform, at: Date.now() }].slice(-50);
    this.save();
    this.push('wishlist', this.s.spotify.wishlist);
    this.reply(ev, `${text} noté, merci ${ev.user.display}`);
  }

  // ---------- Déclencheurs et actions ----------
  activeTriggers() {
    const limit = this.features().triggers;
    return limit === -1 ? this.s.triggers : this.s.triggers.slice(0, limit);
  }

  checkCondition(c, ev) {
    const val = { amount: ev.value || ev.amount || 0, count: ev.amount || 0, months: ev.months || 0, user: ev.user?.display || '', platform: ev.platform || '', text: ev.text || '', gift: ev.gift?.name || '', role: ev.user?.owner ? 'owner' : ev.user?.mod ? 'mod' : ev.user?.vip ? 'vip' : ev.user?.sub ? 'sub' : 'all' }[c.field];
    const low = (x) => String(x ?? '').toLowerCase();
    switch (c.op) {
      case '>=': return Number(val) >= Number(c.value);
      case '<=': return Number(val) <= Number(c.value);
      case '!=': return low(val) !== low(c.value);
      case 'contains': return low(val).includes(low(c.value));
      default: return low(val) === low(c.value);
    }
  }

  triggerMatches(t, ev) {
    if (!t.enabled) return false;
    const on = t.on;
    if (on.platforms?.length && !on.platforms.includes(ev.platform)) return false;
    if ((ev.value || ev.amount || 0) < (on.minAmount || 0)) return false;
    if (on.giftId && (on.giftId !== ev.gift?.id || !this.allowed('giftTriggers'))) return false;
    if (on.word && (ev.text || '').trim().split(/\s+/)[0].toLowerCase() !== on.word.toLowerCase()) return false;
    const adv = this.allowed('automationAdvanced');
    const conds = adv ? (t.conditions || []) : (t.conditions || []).slice(0, 1);
    if (!conds.every((c) => this.checkCondition(c, ev))) return false;
    if (adv && on.count > 1) {
      const since = Date.now() - (on.seconds || 30) * 1000;
      if ((this.recentTypes[ev.type] || []).filter((x) => x >= since).length < on.count) return false;
    }
    return !this.cooled(`trg:${t.id}`, t.cooldown);
  }

  runTriggers(ev) {
    for (const t of this.activeTriggers()) {
      if (t.on.type === ev.type && this.triggerMatches(t, ev)) this.runActions(t.actions || [], ev, this.commandVars(ev, '', null));
    }
  }

  // Déclencheurs qui ne viennent pas du chat : goal atteint, jeu, événement personnalisé.
  fireType(type, ev, match = () => true) {
    for (const t of this.activeTriggers()) {
      if (t.on.type === type && match(t) && this.triggerMatches(t, ev)) this.runActions(t.actions || [], ev, this.commandVars(ev, '', null));
    }
  }

  fireCustom(name) {
    const sys = { type: 'custom', platform: 'twitch', accountId: 'system', channel: 'Régie', user: { display: 'Régie' } };
    this.fireType('custom', sys, (t) => (t.on.name || '').toLowerCase() === String(name).toLowerCase());
  }

  // Une action peut attendre quelques secondes avant de partir.
  runActions(list, ev, vars) {
    const adv = this.allowed('automationAdvanced');
    for (const a of list) {
      if (adv && a.delay > 0) setTimeout(() => this.runAction(a, ev, vars), a.delay * 1000);
      else this.runAction(a, ev, vars);
    }
  }

  runAction(a, ev, vars = {}) {
    switch (a.type) {
      case 'sound': this.playSound(a.sound, a.volume ?? 80); break;
      case 'tts': this.tts.say({ text: this.expand(a.text, vars), user: ev.user, force: true }); break;
      case 'chat': this.reply(ev, this.expand(a.text, vars), a.where); break;
      case 'alert':
        this.alertQueue.push({
          id: uid('a'), type: 'custom', platform: ev.platform, channel: ev.channel, title: this.expand(a.text, vars), text: '', user: ev.user?.display || '', avatar: ev.user?.avatar || '', image: a.image || '', sound: a.sound || 'pop', volume: 80, duration: a.duration || 5, theme: a.theme || '', position: '',
        });
        this.pumpAlerts();
        break;
      case 'counter': { const c = this.s.tools.counters.find((x) => x.id === a.counterId); if (c) this.setCounter(c, c.value + (a.step ?? 1)); break; }
      case 'goal': { const g = this.s.goals.find((x) => x.id === a.goalId); if (g) { this.bumpGoal(g, a.amount ?? 1); this.pushGoals(); } break; }
      case 'timer': { const t = this.s.tools.timers.find((x) => x.id === a.timerId); if (t) this.addTime(t, a.seconds ?? 60); break; }
      case 'obsScene': if (this.allowed('obsActions')) this.switchScene(a.scene).catch((e) => this.log(e.message)); break;
      case 'obsSource': if (this.allowed('obsActions')) this.obs.toggleSource(a.scene, a.source).catch((e) => this.log(e.message)); break;
      case 'replay': this.obs.saveReplay().catch((e) => this.log(e.message)); break;
      case 'clip': this.createClip(ev.user?.display || 'Régie').catch((e) => this.log(e.message)); break;
      case 'key': this.pressKey(a.key, a.hold); break;
      case 'webhook': this.callWebhook(a, ev, vars); break;
      case 'skipAlert': this.skipAlert(); break;
      case 'pauseAlerts': this.s.alerts.paused = !this.s.alerts.paused; this.save(); this.pumpAlerts(); this.push('alerts', this.s.alerts); break;
      case 'arena': this.games.arenaOpen(); break;
      case 'boss': this.games.bossStart(); break;
      case 'overlayFx': this.server.broadcast({ t: 'fx', fx: a.fx || 'confetti' }); break;
      case 'points': { const r = this.viewers.file.data.list[Viewers.key(ev)] || this.viewers.session.viewers[Viewers.key(ev)]; if (r) { r.points += Number(a.amount) || 0; this.viewers.file.save(); } break; }
      case 'show': this.server.broadcast({ t: 'show', item: { kind: a.file ? (/\.(mp4|webm)$/i.test(a.file) ? 'video' : 'image') : 'text', text: this.expand(a.text, vars), file: a.file || '', seconds: a.seconds || 5 } }, 'stage'); break;
      case 'notify': this.notify?.(this.expand(a.text, vars)); break;
      case 'rcon': if (this.allowed('rcon')) rconSend(this.s.gaming.rcon, this.expand(a.text, vars)).catch((e) => this.log(`Minecraft : ${e.message}`)); break;
      case 'fire': this.fireCustom(a.name); break;
      case 'mic': this.obs.toggleMute(a.input).catch((e) => this.log(e.message)); break;
      case 'spotify': this.spotify.control(a.action || 'pause').catch((e) => this.log(e.message)); break;
      case 'automation': { const t = this.s.triggers.find((x) => x.id === a.triggerId); if (t) { t.enabled = !t.enabled; this.save(); this.push('triggers', this.s.triggers); } break; }
      case 'minigame': if (a.game === 'roulette') this.minigames.spin(ev); else if (a.game === 'quiz') this.minigames.startQuiz({}); else this.minigames.startGuess({}); break;
      case 'game': this.gameEvent(a.kind || 'win', {}); break;
      default: break;
    }
  }

  // Touches simulées : désactivées par défaut, limitées à dix par seconde.
  pressKey(key, hold = 60) {
    if (!this.s.keys.enabled || !this.allowed('keystrokes') || !key) return false;
    const now = Date.now();
    this.keyStamps = this.keyStamps.filter((t) => now - t < 1000);
    if (this.keyStamps.length >= 10) return false;
    this.keyStamps.push(now);
    return this.input?.tap(key, Math.min(5000, Math.max(10, Number(hold) || 60)));
  }

  async callWebhook(a, ev, vars) {
    if (!this.allowed('webhooks') || !/^https?:\/\//.test(a.url || '')) return;
    // Les pseudos et messages viennent du chat : ils sont échappés avant d'entrer dans le JSON ou l'adresse.
    const esc = {};
    for (const [k, v] of Object.entries(vars)) esc[k] = v === undefined || v === null ? v : JSON.stringify(String(v)).slice(1, -1);
    const uri = {};
    for (const [k, v] of Object.entries(vars)) uri[k] = v === undefined || v === null ? v : encodeURIComponent(String(v));
    const body = a.body ? renderTemplate(a.body, esc) : JSON.stringify({ event: ev.type, platform: ev.platform, user: ev.user?.display, amount: ev.amount, text: ev.text, gift: ev.gift?.name, value: ev.value });
    try {
      const res = await fetch(renderTemplate(a.url, uri), { method: a.method || 'POST', headers: { 'Content-Type': 'application/json' }, body: (a.method || 'POST') === 'GET' ? undefined : body, signal: AbortSignal.timeout(6000) });
      if (!res.ok) this.log(`Webhook : réponse ${res.status}`);
    } catch (e) { this.log(`Webhook : ${e.message}`); }
  }

  // Webhook entrant : /hook/<id du déclencheur>?k=<jeton>
  fireHook(id) {
    const t = this.s.triggers.find((x) => x.id === id && x.on.type === 'webhook' && x.enabled);
    if (!t || !this.allowed('webhooks')) return false;
    this.fireTrigger(t);
    return true;
  }

  fireTrigger(t, ev) {
    const event = ev || { type: 'custom', platform: 'twitch', accountId: 'system', channel: 'Régie', user: { display: 'Régie' } };
    this.runActions(t.actions || [], event, this.commandVars(event, '', null));
  }

  deckPress(buttonId) {
    for (const page of this.s.deck.pages) {
      const b = page.buttons.find((x) => x.id === buttonId);
      if (b) { this.fireTrigger(b); return true; }
    }
    return false;
  }

  // ---------- Scènes et clips ----------
  async switchScene(scene, style) {
    const c = this.s.scenes;
    if (c.useTransition && this.allowed('customTransitions') && this.server.hasClient('transition')) {
      this.server.broadcast({ t: 'transition', style: style || c.transitionStyle, ms: c.transitionMs }, 'transition');
      await new Promise((r) => setTimeout(r, c.transitionMs / 2));
    }
    await this.obs.setScene(scene);
  }

  async createClip(by) {
    const c = [...this.connectors.values()].find((x) => x.createClip);
    if (!c) throw new Error('Connecte une chaîne Twitch pour créer un clip.');
    const clip = await c.createClip();
    this.s.clips.list.unshift({ id: clip.id, url: clip.url, editUrl: clip.editUrl, by, at: Date.now(), channel: c.account.label, source: 'twitch' });
    this.s.clips.list = this.s.clips.list.slice(0, 200);
    this.save();
    this.push('clips', this.s.clips);
    return clip;
  }

  clipCommand(ev) {
    const cfg = this.s.clips;
    if (userRank(ev.user) < (RANK[cfg.perm] ?? 0) || this.cooled('clip', cfg.cooldown)) return;
    this.createClip(ev.user.display).then((c) => this.reply(ev, `Clip créé : ${c.url}`)).catch((e) => this.log(e.message));
    this.obs.saveReplay().catch(() => {});
  }

  // ---------- Jeux ----------
  profile(id) {
    const game = gameById(id);
    const all = this.s.gaming.profiles;
    if (!all[id]) all[id] = { pseudo: '', level: 0, scene: '', deckPage: '', theme: '', modes: {}, session: {}, history: [] };
    for (const [mode] of game.modes) {
      if (!all[id].modes[mode]) all[id].modes[mode] = { tier: game.ranks[0]?.id || '', division: 1, mmr: 0, target: 0, best: null };
    }
    return all[id];
  }

  setRank(gameId, modeId, patch) {
    const game = gameById(gameId);
    const prof = this.profile(gameId);
    const m = prof.modes[modeId];
    Object.assign(m, patch);
    const score = rankScore(game, m.tier, m.division);
    if (!m.best || score > rankScore(game, m.best.tier, m.best.division)) m.best = { tier: m.tier, division: m.division, mmr: m.mmr };
    prof.history.unshift({ at: Date.now(), mode: modeId, label: rankLabel(game, m.tier, m.division), mmr: m.mmr });
    prof.history = prof.history.slice(0, 200);
    this.pushGame();
  }

  gameView(id = this.s.gaming.active) {
    const game = gameById(id);
    const prof = this.profile(id);
    return {
      id: game.id, name: game.name, pseudo: prof.pseudo, metric: game.metric, level: prof.level,
      modes: game.modes.map(([mode, name], i) => {
        const m = prof.modes[mode];
        const tier = game.ranks.find((t) => t.id === m.tier) || game.ranks[0];
        const next = nextRank(game, m.tier, m.division);
        return {
          ...rankLook(game, m.tier, m.division), id: mode, name, label: rankLabel(game, m.tier, m.division), color: tier?.color || '#FFFFFF', level: i + 1, mmr: m.mmr, target: m.target, nextLabel: next?.name || '',
          bestLabel: m.best ? rankLabel(game, m.best.tier, m.best.division) : '', progress: m.target > 0 ? Math.min(100, Math.round((m.mmr / m.target) * 100)) : 0, image: rankImage(this.s.gaming.rankImages?.[id], m.tier, m.division),
        };
      }),
      stats: game.stats.map((k) => ({ key: k, label: STAT_LABEL[k] || k, value: prof.session[k] || 0 })),
    };
  }

  gameRecord() {
    const prof = this.profile(this.s.gaming.active);
    return `${prof.session.wins || 0} V, ${prof.session.losses || 0} D`;
  }

  pushGame() {
    this.save();
    const view = this.gameView();
    this.push('gaming', this.s.gaming);
    this.server.broadcast({ t: 'game', game: view }, 'gamecard');
  }

  setActiveGame(id, auto) {
    const prev = this.s.gaming.active;
    this.s.gaming.active = id;
    const prof = this.profile(id);
    if (prof.theme) { try { this.applyTheme(prof.theme); } catch { /* thème retiré */ } }
    if (prof.scene && this.obs.state === 'connected') this.switchScene(prof.scene).catch((e) => this.log(e.message));
    if (prof.deckPage) this.push('deckPage', prof.deckPage);
    this.pushGame();
    if (auto && prev !== id) this.push('gameSwitched', gameById(id).name);
  }

  // Événement de match, venu d'un jeu compatible ou saisi à la main.
  gameEvent(kind, meta = {}) {
    const stat = { win: 'wins', loss: 'losses', draw: 'draws', kill: 'kills', death: 'deaths', assist: 'assists', goal: 'goals', save: 'saves', demo: 'demos', mvp: 'mvps' }[kind];
    const prof = this.profile(this.s.gaming.active);
    if (stat) prof.session[stat] = (prof.session[stat] || 0) + (meta.amount || 1);
    if (stat) this.pushGame();
    const sys = { type: 'game', platform: 'twitch', accountId: 'system', channel: gameById(this.s.gaming.active).name, user: { display: prof.pseudo || 'Streamer' }, amount: meta.amount || 1, text: meta.detail || '' };
    this.fireType('game', sys, (t) => !t.on.kind || t.on.kind === kind);
  }

  onHubUpdate(o) {
    if (o.state !== undefined) {
      this.gameLive = o.state;
      this.server.broadcast({ t: 'gamelive', live: o.state }, 'gamelive');
    }
    if (o.kind && this.allowed('gameLive')) this.gameEvent(o.kind, o);
  }

  applyTheme(id) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) throw new Error('Thème inconnu');
    for (const o of this.s.overlays) {
      const fields = OVERLAY_TYPES[o.type]?.fields || [];
      for (const f of fields) {
        if (f.key === 'font') o.settings.font = theme.font;
        else if (f.type === 'color' && theme.colors[f.key] !== undefined) o.settings[f.key] = theme.colors[f.key];
      }
      this.pushOverlayConfig(o);
    }
    this.save();
  }

  // ---------- Outils ----------
  setCounter(c, value) {
    c.value = value;
    this.save();
    this.push('tools', this.s.tools);
    this.server.broadcast({ t: 'counter', counter: c }, 'counter');
  }

  timerView(t) {
    const remaining = t.running ? (t.mode === 'stopwatch' ? t.remaining + (Date.now() - t.startedAt) / 1000 : Math.max(0, (t.endsAt - Date.now()) / 1000)) : t.remaining;
    return { id: t.id, name: t.name, mode: t.mode, running: t.running, remaining: Math.round(remaining), subathon: t.subathon?.enabled };
  }

  controlTimer(id, action, seconds) {
    const t = this.s.tools.timers.find((x) => x.id === id);
    if (!t) return;
    const view = this.timerView(t);
    if (action === 'start' && !t.running) {
      t.running = true;
      t.startedAt = Date.now();
      t.endsAt = Date.now() + t.remaining * 1000;
    } else if (action === 'pause' && t.running) {
      t.remaining = view.remaining;
      t.running = false;
    } else if (action === 'reset') {
      t.running = false;
      t.remaining = t.mode === 'stopwatch' ? 0 : t.seconds;
    } else if (action === 'set') {
      t.seconds = seconds;
      t.remaining = seconds;
      t.endsAt = Date.now() + seconds * 1000;
    }
    this.pushTimers();
  }

  addTime(t, seconds) {
    if (t.running) t.endsAt += seconds * 1000;
    t.remaining += seconds;
    this.pushTimers();
  }

  pushTimers() {
    this.save();
    this.push('tools', this.s.tools);
    this.push('timers', this.s.tools.timers.map((t) => this.timerView(t)));
    this.server.broadcast({ t: 'timers', timers: this.s.tools.timers.map((t) => this.timerView(t)) }, 'timer');
  }

  applySubathon(ev) {
    if (!this.allowed('subathon')) return;
    for (const t of this.s.tools.timers) {
      const c = t.subathon;
      if (!c?.enabled || t.mode !== 'countdown') continue;
      let add = 0;
      if (ev.type === 'follow') add = c.follow;
      else if (['sub', 'resub', 'member'].includes(ev.type)) add = c.sub;
      else if (ev.type === 'giftsub') add = c.sub * (ev.amount || 1);
      else if (ev.type === 'gift') add = c.coins * (ev.value || 0);
      else if (ev.type === 'bits') add = c.bits * (ev.amount || 0);
      else if (ev.type === 'like') add = (c.like || 0) * (ev.amount || 0);
      else if (['superchat', 'supersticker'].includes(ev.type)) add = c.money * (ev.value || 0);
      if (add) this.addTime(t, add);
    }
  }

  startPoll({ question, options, duration: dur }) {
    if (!this.allowed('polls')) throw new Error('Les sondages sont réservés à PRO.');
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (clean.length < 2) throw new Error('Ajoute au moins deux réponses.');
    this.s.tools.poll = { status: 'running', question, options: clean, votes: {}, duration: dur, endsAt: dur ? Date.now() + dur * 1000 : 0 };
    clearTimeout(this.pollTimer);
    if (dur) this.pollTimer = setTimeout(() => this.endPoll(), dur * 1000);
    this.pushPoll();
  }

  endPoll() {
    clearTimeout(this.pollTimer);
    if (this.s.tools.poll.status === 'running') this.s.tools.poll.status = 'ended';
    this.pushPoll();
  }

  pollView() {
    const p = this.s.tools.poll;
    const counts = (p.options || []).map(() => 0);
    for (const v of Object.values(p.votes || {})) counts[v] = (counts[v] || 0) + 1;
    return { status: p.status, question: p.question, options: p.options, counts, total: counts.reduce((a, b) => a + b, 0), endsAt: p.endsAt };
  }

  pushPoll() {
    this.save();
    this.push('poll', this.pollView());
    this.server.broadcast({ t: 'poll', poll: this.pollView() }, 'poll');
  }

  voteOrEnter(ev, text, cmd) {
    const p = this.s.tools.poll;
    const key = `${ev.platform}:${ev.user.id || ev.user.name}`;
    if (p.status === 'running') {
      const n = Number(text);
      const idx = Number.isInteger(n) && n >= 1 && n <= p.options.length ? n - 1 : p.options.findIndex((o) => o.toLowerCase() === text.toLowerCase());
      if (idx >= 0) { p.votes[key] = idx; this.pushPoll(); }
    }
    const g = this.s.tools.giveaway;
    if (g.status === 'open' && cmd === g.keyword.toLowerCase()) {
      if (userRank(ev.user) < (RANK[g.perm] ?? 0)) return;
      if (g.platforms?.length && !g.platforms.includes(ev.platform)) return;
      if (g.entrants.some((x) => x.key === key)) return;
      g.entrants.push({ key, name: ev.user.display, platform: ev.platform, weight: ev.user.sub ? Math.max(1, g.subLuck || 1) : 1 });
      this.pushGiveaway();
    }
  }

  giveawayControl(action, cfg = {}) {
    if (!this.allowed('giveaway')) throw new Error('Les giveaways sont réservés à PRO.');
    const g = this.s.tools.giveaway;
    Object.assign(g, cfg);
    if (action === 'open') { g.status = 'open'; g.entrants = []; g.winner = null; }
    if (action === 'close') g.status = 'closed';
    if (action === 'reset') { g.status = 'idle'; g.entrants = []; g.winner = null; }
    if (action === 'draw') {
      const pool = g.entrants.filter((e) => e.key !== g.winner?.key);
      const total = pool.reduce((n, e) => n + e.weight, 0);
      if (!total) throw new Error('Personne ne participe pour le moment.');
      let r = crypto.randomInt(total);
      for (const e of pool) { r -= e.weight; if (r < 0) { g.winner = e; break; } }
      g.status = 'closed';
    }
    this.pushGiveaway();
  }

  pushGiveaway() {
    this.save();
    this.push('giveaway', this.s.tools.giveaway);
    const g = this.s.tools.giveaway;
    this.server.broadcast({ t: 'giveaway', giveaway: { ...g, entrants: g.entrants.map((e) => ({ name: e.name, platform: e.platform })) } }, 'giveaway');
  }

  minuteTick() {
    const l = this.currentLive;
    if (l) {
      const v = this.totalViewers();
      l.peak = Math.max(l.peak, v);
      l.samples.push({ t: Date.now() - l.start, v });
      if (l.samples.length > 720) l.samples.shift();
    }
    const today = new Date();
    const stamp = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    let changed = false;
    for (const g of this.s.goals) {
      if ((g.reset === 'day' && g.resetAt !== stamp) || (g.reset === 'week' && today.getDay() === 1 && g.resetAt !== stamp)) {
        if (g.resetAt) { g.current = 0; g.reached = false; changed = true; }
        g.resetAt = stamp;
      }
    }
    if (changed) this.pushGoals();
  }

  runIntervals() {
    const list = this.activeTriggers();
    const now = Date.now();
    for (const t of list) {
      if (!t.enabled || t.on.type !== 'interval') continue;
      const every = Math.max(1, t.on.minutes || 10) * 60000;
      if (!t.lastRun) { t.lastRun = now; continue; }
      if (now - t.lastRun >= every) { t.lastRun = now; this.fireTrigger(t); }
    }
  }

  tick() {
    this.ticks = (this.ticks || 0) + 1;
    if (this.ticks % 5 === 0) this.runIntervals();
    if (this.ticks % 60 === 0) this.minuteTick();
    if (this.ticks % 3 === 0 && this.connectors.size) this.pushChannels(); // vumètres des tranches
    for (const t of this.s.tools.timers) {
      if (t.running && t.mode === 'countdown' && t.endsAt <= Date.now()) {
        t.running = false;
        t.remaining = 0;
        this.pushTimers();
      }
    }
    if (this.s.tools.timers.some((t) => t.running)) {
      this.server.broadcast({ t: 'timers', timers: this.s.tools.timers.map((t) => this.timerView(t)) }, 'timer');
      this.push('timers', this.s.tools.timers.map((t) => this.timerView(t)));
    }
  }

  // ---------- Overlays ----------
  // Applique les droits côté serveur : le lien d'un compte gratuit ne peut pas servir un thème Premium.
  effectiveSettings(o) {
    const f = this.features();
    if (o.type === 'custom') {
      // Emplacements perdus après une licence expirée : l'overlay reste enregistré mais ne s'affiche plus.
      const rank = this.s.overlays.filter((x) => x.type === 'custom').findIndex((x) => x.id === o.id);
      return f.customOverlays === -1 || rank < f.customOverlays ? o.settings : { ...o.settings, elements: [] };
    }
    const out = { ...overlayDefaults(o.type), ...o.settings };
    for (const field of OVERLAY_TYPES[o.type].fields) {
      if (!field.feature || f[field.feature]) continue;
      if (field.type === 'select') {
        const opt = field.options.find((x) => x.value === out[field.key]);
        if (opt?.premium) out[field.key] = field.default;
      } else out[field.key] = field.default;
    }
    return out;
  }

  overlayData(o) {
    const s = this.s;
    switch (o.type) {
      case 'goal': return { goals: s.goals };
      case 'battle': return { battle: s.battle };
      case 'spotify': return { spotify: this.spotify.state };
      case 'viewers': { const perPlatform = {}; for (const a of s.accounts) perPlatform[a.platform] = (perPlatform[a.platform] || 0) + (this.liveCounts[a.id] || 0); return { total: this.totalViewers(), perPlatform }; }
      case 'timer': return { timers: s.tools.timers.map((t) => this.timerView(t)) };
      case 'counter': return { counters: s.tools.counters };
      case 'poll': return { poll: this.pollView() };
      case 'giveaway': { const g = s.tools.giveaway; return { giveaway: { ...g, entrants: g.entrants.map((e) => ({ name: e.name, platform: e.platform })) } }; }
      case 'leaderboard': return { boards: this.viewers.boards(10) };
      case 'gamepad': return { pads: this.input?.pads?.() || [], pack: (this.s.padPacks || []).find((p) => p.id === o.settings.pack) || null };
      case 'gamecard': return { game: this.gameView() };
      case 'gamelive': return { live: this.gameLive, game: this.gameView() };
      case 'minigame': return { game: this.minigames.view() };
      case 'gifttracker': case 'topgift': case 'topstreak': return { gifts: this.viewers.giftView() };
      case 'giftfeed': return { backlog: this.viewers.session.gifts.log.slice(0, 10).reverse() };
      case 'arena': return { arena: s.arena };
      case 'boss': return { boss: s.boss };
      case 'brb': return { brb: this.brb || { active: false, startedAt: 0, elapsed: 0 } };
      case 'custom': case 'webcam': return { vars: this.liveVars() };
      case 'chat': case 'ticker': return { backlog: this.feed.filter((e) => o.type === 'chat' ? ['chat'].includes(e.type) : e.type !== 'chat').slice(-30) };
      default: return {};
    }
  }

  overlayInit(o) {
    return { t: 'init', overlay: { id: o.id, type: o.type, name: o.name, enabled: o.enabled !== false, settings: this.effectiveSettings(o) }, watermark: !this.allowed('removeWatermark'), data: this.overlayData(o) };
  }

  pushOverlayConfig(o) {
    this.server.broadcast(this.overlayInit(o), null, (c) => c.overlayId === o.id);
  }

  refreshAllOverlays() { for (const o of this.s.overlays) this.pushOverlayConfig(o); }

  addOverlay(type, name) {
    if (!OVERLAY_TYPES[type]) throw new Error('Type d\'overlay inconnu');
    if (!withinLimit(this.features().overlaysTotal, this.s.overlays.length)) throw new Error('Limite d\'overlays atteinte. Passe en PRO pour en créer plus.');
    const o = makeOverlay(type, name || OVERLAY_TYPES[type].name);
    this.s.overlays.push(o);
    this.save();
    return o;
  }

  stop() {
    clearInterval(this.ticker);
    clearTimeout(this.battleTimer);
    clearTimeout(this.alertTimer);
    clearTimeout(this.pollTimer);
    clearTimeout(this.liveTimer);
    this.games.stop();
    this.minigames.stop();
    if (this.currentLive) this.onLiveEnd();
    for (const id of [...this.connectors.keys()]) this.stopAccount(id);
  }
}

module.exports = { Engine, renderTemplate, userRank, duration, EVENT_TYPES, defaultRules, BOSSES };
