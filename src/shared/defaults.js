const crypto = require('crypto');
const { overlayDefaults } = require('./overlay-schema');

const uid = (p = '') => p + crypto.randomBytes(5).toString('hex');

const ALL = ['tiktok', 'twitch', 'youtube', 'kick'];

// Types d'événements reconnus, avec le message par défaut et les plateformes concernées.
const EVENT_TYPES = {
  follow: { label: 'Follow', message: '{user} suit la chaîne', platforms: ['tiktok', 'twitch'], sound: 'chime' },
  sub: { label: 'Abonnement', message: '{user} s\'abonne', platforms: ALL, sound: 'fanfare' },
  resub: { label: 'Réabonnement', message: '{user} est abonné depuis {months} mois', platforms: ['twitch'], sound: 'fanfare' },
  giftsub: { label: 'Subs offerts', message: '{user} offre {amount} abonnements', platforms: ['twitch', 'youtube'], sound: 'fanfare' },
  bits: { label: 'Bits', message: '{user} envoie {amount} bits', platforms: ['twitch'], sound: 'coins', min: 1 },
  raid: { label: 'Raid', message: '{user} arrive avec {amount} personnes', platforms: ['twitch'], sound: 'horn' },
  redeem: { label: 'Points de chaîne', message: '{user} utilise {reward}', platforms: ['twitch'], sound: 'pop', enabled: false },
  vip: { label: 'Nouveau VIP', message: '{user} devient VIP', platforms: ['twitch'], sound: 'fanfare' },
  hypetrain: { label: 'Hype Train', message: 'Le Hype Train démarre', platforms: ['twitch'], sound: 'horn' },
  superchat: { label: 'Super Chat', message: '{user} envoie {money}', platforms: ['youtube'], sound: 'coins' },
  supersticker: { label: 'Super Sticker', message: '{user} envoie un sticker à {money}', platforms: ['youtube'], sound: 'coins' },
  member: { label: 'Nouveau membre', message: '{user} devient membre', platforms: ['youtube'], sound: 'fanfare' },
  milestone: { label: 'Palier de membre', message: '{user} est membre depuis {months} mois', platforms: ['youtube'], sound: 'fanfare' },
  gift: { label: 'Cadeau', message: '{user} envoie {amount} × {gift}', platforms: ['tiktok'], sound: 'coins' },
  like: { label: 'Palier de likes', message: '{total} likes sur le live', platforms: ['tiktok'], sound: 'pop', enabled: false, every: 1000 },
  share: { label: 'Partage', message: '{user} partage le live', platforms: ['tiktok'], sound: 'pop', enabled: false },
  join: { label: 'Arrivée', message: '{user} rejoint le live', platforms: ['tiktok'], sound: 'pop', enabled: false },
  superfan: { label: 'Super Fan', message: '{user} devient Super Fan', platforms: ['tiktok'], sound: 'fanfare' },
  goal: { label: 'Goal atteint', message: 'Objectif atteint : {reward}', platforms: ALL, sound: 'fanfare' },
};

const RANKS = [
  ['bronze', 'Bronze', '#C7814F', 30, 0], ['argent', 'Argent', '#B9C4D0', 25, 200], ['or', 'Or', '#FFC53D', 18, 600], ['platine', 'Platine', '#57E0D6', 12, 1500],
  ['diamant', 'Diamant', '#57B8FF', 8, 4000], ['champion', 'Champion', '#B77DFF', 4, 10000], ['grand', 'Grand Champion', '#FF4D6D', 2, 25000], ['legende', 'Légende', '#FFFFFF', 1, 60000],
].map(([id, name, color, weight, min]) => ({ id, name, color, weight, min }));

const PLAYLISTS = [
  { id: '1v1', name: 'Duel 1v1', tier: 'gold', division: 1, mmr: 0 }, { id: '2v2', name: 'Double 2v2', tier: 'gold', division: 1, mmr: 0 },
  { id: '3v3', name: 'Standard 3v3', tier: 'gold', division: 1, mmr: 0 },
];

const defaultRules = () => Object.entries(EVENT_TYPES).map(([type, e]) => ({
  id: uid('r'), type, enabled: e.enabled !== false, base: true,
  platforms: e.platforms, minAmount: e.min || 0, every: e.every || 0, giftId: '', message: e.message,
  sound: e.sound, volume: 80, image: '', duration: 6, tts: false,
}));

const makeOverlay = (type, name) => ({ id: uid('o'), type, name, enabled: true, settings: overlayDefaults(type) });

const defaultState = () => {
  const counter = { id: uid('c'), name: 'Morts', value: 0, step: 1 };
  const timer = { id: uid('t'), name: 'Pause', mode: 'countdown', seconds: 600, running: false, endsAt: 0, remaining: 600, subathon: { enabled: false, follow: 30, sub: 300, coins: 1, bits: 1, money: 60, like: 0 } };
  return {
    firstRun: true,
    accounts: [],
    overlays: [makeOverlay('alerts', 'Alertes'), makeOverlay('chat', 'Chat unifié'), makeOverlay('spotify', 'Spotify'), makeOverlay('gamepad', 'Manette')],
    alerts: { paused: false, gap: 1, rules: defaultRules() },
    goals: [],
    battle: {
      status: 'idle', mode: 'chat', title: 'Battle', duration: 300, endsAt: 0, winner: null,
      teams: [{ id: 'a', name: 'Rouge', color: '#FF3D71', score: 0, keyword: '!rouge', platforms: [] }, { id: 'b', name: 'Bleu', color: '#6F8FB5', score: 0, keyword: '!bleu', platforms: [] }],
      scoring: { chat: 1, like: 1, follow: 10, share: 5, sub: 500, coin: 1, bit: 1, money: 100 },
    },
    commands: [
      { id: uid('k'), trigger: '!discord', enabled: true, perm: 'all', cooldown: 30, userCooldown: 60, platforms: ALL, replyTo: 'origin', response: 'Rejoins le Discord : ajoute ton lien ici', perPlatform: {}, actions: [], uses: 0 },
      { id: uid('k'), trigger: '!uptime', enabled: true, perm: 'all', cooldown: 30, userCooldown: 60, platforms: ALL, replyTo: 'origin', response: 'En direct depuis {uptime}', perPlatform: {}, actions: [], uses: 0 },
      { id: uid('k'), trigger: '!son', enabled: true, perm: 'all', cooldown: 30, userCooldown: 60, platforms: ALL, replyTo: 'origin', response: 'En ce moment : {song}', perPlatform: {}, actions: [], uses: 0 },
    ],
    triggers: [],
    ranks: { enabled: true, game: 'rocketleague', reveal: 'classic', mode: 'random', announce: false, message: '{user} entre au rang {rank}', list: RANKS },
    rewards: {
      enabled: true, perMessage: 1, perLike: 0.1, perFollow: 50, perShare: 10, perSub: 500, perCoin: 1, perBit: 1, perEuro: 100,
      commandPoints: '!points', commandTop: '!top', commandRank: '!rang', list: [],
    },
    arena: { status: 'idle', title: 'Chat Battle', joinWord: '!fight', attackWord: '!attaque', lobby: 30, speed: 1400, maxFighters: 16, prize: 200, fighters: [], log: [], winner: null, endsAt: 0 },
    boss: {
      status: 'idle', bossId: 'golem', name: 'Golem de Basalte', level: 1, baseHp: 5000, hp: 5000, maxHp: 5000, duration: 300, endsAt: 0, regen: 0, hitWord: '!hit', prize: 300, autoNext: true,
      damage: { chat: 1, hit: 5, like: 1, follow: 50, share: 20, sub: 500, coin: 2, bit: 1, money: 200 }, players: [], log: [],
    },
    gaming: { rankImages: {}, active: 'rocketleague', auto: true, command: '!rank', profiles: {}, rcon: { host: '127.0.0.1', port: 25575, password: '' }, gsiToken: uid('g') },
    minigame: { kind: '', status: 'idle' },
    minigames: {
      rouletteCommand: '!roulette', rouletteCost: 50, rouletteCooldown: 60, quiz: [],
      roulette: [
        { id: uid('s'), label: 'Rien', color: '#6F8FB5', weight: 30, points: 0, actions: [] }, { id: uid('s'), label: '100 points', color: '#3DF0C2', weight: 25, points: 100, actions: [] },
        { id: uid('s'), label: '250 points', color: '#B9A15E', weight: 15, points: 250, actions: [] }, { id: uid('s'), label: 'Confettis', color: '#FF3D71', weight: 20, points: 0, actions: [{ type: 'overlayFx' }] }, { id: uid('s'), label: 'Jackpot', color: '#8B3DFF', weight: 5, points: 1000, actions: [] },
      ],
    },
    goalHistory: [],
    sounds: { output: 'app', device: '', categories: ['Alertes', 'Mèmes', 'Ambiance'], library: [] },
    deck: { pages: [{ id: uid('p'), name: 'Principal', game: '', buttons: [] }] },
    clips: { list: [], command: '!clip', perm: 'mod', cooldown: 60 },
    scenes: { useTransition: false, transitionStyle: 'volet', transitionMs: 1100 },
    keys: { enabled: false },
    tts: {
      enabled: false, provider: 'system', voice: '', rate: 1, pitch: 1, volume: 80,
      read: { chat: false, command: true, gift: false, superchat: true, bits: true, sub: true }, command: '!tts',
      perm: 'all', allowUsers: [], blockUsers: [], platforms: ALL, maxLength: 200, cooldown: 10, minBits: 0, stripLinks: true, stripEmoji: true, skipCommands: true,
      blocked: [], template: '{user} dit : {text}', elevenVoice: '', elevenModel: 'eleven_turbo_v2_5', userVoices: {},
    },
    padPacks: [],
    spotify: { connected: false, source: 'spotify', wishlist: [], requests: { enabled: false, command: '!sr', perm: 'all', cooldown: 120, maxPerUser: 2, maxLengthMin: 8, blocked: [] } },
    tools: {
      counters: [counter], timers: [timer],
      poll: { status: 'idle', question: '', options: [], votes: {}, endsAt: 0, duration: 120 },
      giveaway: { status: 'idle', title: 'Giveaway', keyword: '!participe', perm: 'all', platforms: ALL, entrants: [], winner: null, subLuck: 1 },
      soundboard: [],
    },
    obs: { enabled: false, host: '127.0.0.1', port: 4455, password: '' },
    settings: {
      port: 7787, lan: false, overlayToken: uid(''), keepHistory: true, onboarded: false, inputPaused: false, theme: 'dark', accent: '', economy: false, devMode: false, profileName: '', profileAvatar: '', navCollapsed: false,
      modules: {},
    },
    license: { key: '', viewAs: '' },
    remote: { rev: 0, config: null, fetchedAt: 0, urlOverride: '' },
    adminDraft: { rev: 0, features: {}, announcement: '', latestVersion: '', downloadUrl: '', revoked: [], defaults: {}, templates: [] },
    issuedKeys: [],
  };
};

module.exports = { uid, ALL, EVENT_TYPES, RANKS, PLAYLISTS, defaultRules, makeOverlay, defaultState };
