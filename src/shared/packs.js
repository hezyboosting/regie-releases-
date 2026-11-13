// Packs prêts : un clic installe un live interactif complet (roue, course, automatisations, commandes, overlays).
// Tout reste modifiable ensuite, et un pack se retire sans toucher au reste.
'use strict';

const seg = (label, color, weight, actions = [], points = 0) => ({ label, color, weight, points, actions });
const show = (text, seconds = 8) => ({ type: 'show', text, seconds });
const sound = (name) => ({ type: 'sound', sound: name, volume: 80 });
const chat = (text) => ({ type: 'chat', text });
const key = (k, hold = 80) => ({ type: 'key', key: k, hold });
const rcon = (text) => ({ type: 'rcon', text });
const FX = { type: 'overlayFx' };

// Déclencheur : cadeau d'au moins « min » pièces (et au plus « max » si donné).
const gift = (name, min, max, actions, cooldown = 0) => ({
  name, cooldown, on: { type: 'gift', platforms: [], minAmount: min, giftId: '' }, conditions: max ? [{ field: 'amount', op: '<=', value: String(max) }] : [], actions,
});
const on = (name, type, actions, extra = {}, cooldown = 0) => ({ name, cooldown, on: { type, platforms: [], minAmount: 0, giftId: '', ...extra }, conditions: [], actions });
const cmd = (trigger, response, actions = [], cooldown = 20, userCooldown = 60) => ({ trigger, response, actions, cooldown, userCooldown, perm: 'all' });

const CHALLENGE = (label) => [show(`🎯 ${label}`), sound('horn')];

const PACKS = [
  {
    id: 'defis', name: 'Défis pour n\'importe quel jeu', game: 'any', color: '#FF4D6D',
    blurb: 'Les cadeaux et les likes font tourner une roue de défis. Le défi s\'affiche à l\'écran : ça marche avec tous les jeux.',
    needs: [],
    overlays: ['wheel', 'stage'],
    wheel: {
      title: 'Roue des défis', command: '!defi', cost: 100, minCoins: 10, likesEvery: 2000,
      segments: [
        seg('Sans viser pendant 1 minute', '#FF4D6D', 12, CHALLENGE('Sans viser pendant 1 minute')),
        seg('Arme au hasard', '#8B3DFF', 12, CHALLENGE('Arme au hasard pour la prochaine manche')),
        seg('Joue sans le son 2 minutes', '#57B8FF', 10, CHALLENGE('Joue sans le son pendant 2 minutes')),
        seg('Le chat choisit ta prochaine action', '#3DF0C2', 12, CHALLENGE('Le chat choisit ta prochaine action')),
        seg('Danse de la victoire', '#FFC53D', 10, CHALLENGE('Danse de la victoire à la prochaine élimination')),
        seg('Que des mêlées', '#FF8A5C', 8, CHALLENGE('Que des attaques au corps à corps')),
        seg('Joker : rien !', '#6F8FB5', 16, [show('😅 Joker : pas de défi cette fois')]),
        seg('Défi en double', '#FFD24A', 4, [show('🔥 Défi en double : la roue repart !'), { type: 'wheel' }]),
      ],
    },
    triggers: [],
    commands: [],
  },
  {
    id: 'touches', name: 'Le chat contrôle ton jeu', game: 'any', color: '#3DF0C2',
    blurb: 'Chaque cadeau presse une touche dans ton jeu : sauter, s\'accroupir, recharger… Change les touches pour coller à ton jeu.',
    needs: ['keys'],
    overlays: ['alerts'],
    triggers: [
      gift('Petit cadeau : saute', 1, 9, [key('Space'), show('🦘 {user} te fait sauter', 3)], 1),
      gift('Cadeau moyen : accroupi', 10, 99, [key('Ctrl', 600), show('🙇 {user} te fait t\'accroupir', 3)], 1),
      gift('Gros cadeau : recharge', 100, 499, [key('R'), show('🔄 {user} te fait recharger', 3)], 2),
      gift('Énorme cadeau : change d\'arme', 500, 0, [key('Q'), FX, show('💥 {user} change ton arme !', 4)], 3),
    ],
    commands: [cmd('!saute', '{user} te fait sauter !', [key('Space')], 15, 60)],
  },
  {
    id: 'minecraft', name: 'Minecraft interactif', game: 'minecraft', color: '#3BBF7C',
    blurb: 'Zombies, creepers, TNT et diamants envoyés par les cadeaux, plus une roue Minecraft. Il faut la liaison RCON dans Mes jeux.',
    needs: ['rcon'],
    overlays: ['wheel', 'alerts'],
    wheel: {
      title: 'Roue Minecraft', command: '!roue', cost: 50, minCoins: 20, likesEvery: 1500,
      segments: [
        seg('Pluie de TNT', '#FF4D6D', 6, [rcon('execute at @a run summon minecraft:tnt ~ ~3 ~ {fuse:60}'), rcon('execute at @a run summon minecraft:tnt ~2 ~3 ~ {fuse:70}')]),
        seg('Creeper surprise', '#3BBF7C', 12, [rcon('execute at @a run summon minecraft:creeper ~3 ~ ~')]),
        seg('Horde de zombies', '#6F8FB5', 12, [rcon('execute at @a run summon minecraft:zombie ~3 ~ ~'), rcon('execute at @a run summon minecraft:zombie ~-3 ~ ~')]),
        seg('Diamants', '#57E0D6', 12, [rcon('give @a minecraft:diamond 3')]),
        seg('La nuit tombe', '#2B2F4A', 10, [rcon('time set night')]),
        seg('Lévitation', '#B46BFF', 10, [rcon('effect give @a minecraft:levitation 6 1')]),
        seg('Festin', '#FFC53D', 12, [rcon('give @a minecraft:cooked_beef 16')]),
        seg('Rien du tout', '#9AA3AF', 14, []),
        seg('Totem de survie', '#FFD24A', 4, [rcon('give @a minecraft:totem_of_undying 1')]),
      ],
    },
    triggers: [
      gift('Zombie', 1, 9, [rcon('execute at @a run summon minecraft:zombie ~3 ~ ~'), show('🧟 {user} envoie un zombie', 3)]),
      gift('Diamant', 10, 29, [rcon('give @a minecraft:diamond 1'), show('💎 {user} offre un diamant', 3)]),
      gift('Creeper', 30, 99, [rcon('execute at @a run summon minecraft:creeper ~3 ~ ~'), show('💚 {user} envoie un creeper', 3)]),
      gift('TNT', 100, 499, [rcon('execute at @a run summon minecraft:tnt ~ ~3 ~ {fuse:60}'), show('🧨 {user} lâche une TNT', 3)]),
      gift('Wither', 500, 0, [rcon('execute at @a run summon minecraft:wither ~6 ~2 ~'), FX, show('☠️ {user} invoque un Wither', 5)]),
      on('Un cookie par suivi', 'follow', [rcon('give @a minecraft:cookie 1')]),
      on('La nuit à chaque partage', 'share', [rcon('time set night')], {}, 60),
    ],
    commands: [],
  },
  {
    id: 'fps', name: 'FPS : Valorant, CS2, CoD, Fortnite, Apex', game: 'fps', color: '#8B3DFF',
    blurb: 'Sons et confettis sur tes éliminations et tes victoires, et une roue de défis de tireur pour le chat.',
    needs: [],
    overlays: ['wheel', 'gamecard', 'stage'],
    wheel: {
      title: 'Roue du tireur', command: '!defi', cost: 100, minCoins: 10, likesEvery: 2000,
      segments: [
        seg('Pistolet seulement', '#FF4D6D', 14, CHALLENGE('Pistolet seulement pour la prochaine manche')),
        seg('Pas de lunette', '#57B8FF', 12, CHALLENGE('Interdit de viser à la lunette')),
        seg('Accroupi tout le round', '#3DF0C2', 10, CHALLENGE('Accroupi pendant tout le round')),
        seg('Arme du premier mort', '#8B3DFF', 10, CHALLENGE('Prends l\'arme du premier joueur éliminé')),
        seg('Que des grenades', '#FF8A5C', 8, CHALLENGE('Que des grenades et du couteau')),
        seg('Joker', '#6F8FB5', 16, [show('😅 Joker : pas de défi')]),
        seg('Rush B sans s\'arrêter', '#FFC53D', 10, CHALLENGE('Fonce sans t\'arrêter au prochain round')),
      ],
    },
    triggers: [
      on('Victoire', 'game', [sound('fanfare'), FX, chat('Victoire ! GG à tout le chat 🎉')], { kind: 'win' }, 5),
      on('Élimination', 'game', [sound('pop')], { kind: 'kill' }, 1),
      on('Défaite', 'game', [sound('horn')], { kind: 'loss' }, 5),
    ],
    commands: [],
  },
  {
    id: 'rocketleague', name: 'Rocket League', game: 'rocketleague', color: '#57B8FF',
    blurb: 'Confettis à chaque but, fanfare à la victoire, et une roue de défis Rocket League pour le chat.',
    needs: [],
    overlays: ['wheel', 'gamelive', 'gamecard'],
    wheel: {
      title: 'Roue Rocket League', command: '!defi', cost: 100, minCoins: 10, likesEvery: 2000,
      segments: [
        seg('Sans boost 1 minute', '#FF4D6D', 14, CHALLENGE('Sans boost pendant 1 minute')),
        seg('Ballcam coupée', '#57B8FF', 12, CHALLENGE('Ballcam coupée jusqu\'au prochain but')),
        seg('Que des démos', '#FF8A5C', 10, CHALLENGE('Que des démolitions jusqu\'au prochain but')),
        seg('Gardien de but', '#3DF0C2', 12, CHALLENGE('Tu restes dans les cages')),
        seg('Le chat choisit ta voiture', '#8B3DFF', 10, CHALLENGE('Le chat choisit ta prochaine voiture')),
        seg('Joker', '#6F8FB5', 16, [show('😅 Joker : pas de défi')]),
      ],
    },
    triggers: [
      on('But marqué', 'game', [FX, sound('coins')], { kind: 'goal' }, 2),
      on('Victoire', 'game', [sound('fanfare'), FX, chat('Victoire ! GG à tout le chat 🎉')], { kind: 'win' }, 5),
    ],
    commands: [],
  },
  {
    id: 'tiktok', name: 'Ambiance TikTok LIVE', game: 'any', color: '#FE2C55',
    blurb: 'Course aux likes, avatars des spectateurs, pot à cadeaux, feu d\'artifice et roue sur les gros cadeaux : tout ce qu\'on voit sur les plus gros lives.',
    needs: [],
    overlays: ['likerace', 'avatars', 'coinjar', 'firework', 'wheel', 'alerts'],
    likeRace: { enabled: true, target: 1000, autoStart: true, autoRestart: true, restartSeconds: 15, announce: true, actions: [FX, sound('fanfare')] },
    wheel: { minCoins: 30, likesEvery: 0, command: '!roue', cost: 0 },
    triggers: [
      gift('Merci pour le gros cadeau', 100, 0, [FX, chat('Merci énorme {user} pour {gift} ❤️')], 5),
    ],
    commands: [],
  },
  {
    id: 'soiree', name: 'Soirée interactive tout-en-un', game: 'any', color: '#FFC53D',
    blurb: 'La roue, la course aux likes, les avatars et une file d\'attente pour jouer avec le chat. Parfait pour un live sans jeu précis.',
    needs: [],
    overlays: ['wheel', 'likerace', 'avatars', 'queue', 'alerts'],
    likeRace: { enabled: true, target: 500, autoStart: true, autoRestart: true, restartSeconds: 20, chatPoints: 2, coinPoints: 10, announce: true, actions: [FX] },
    wheel: { minCoins: 10, likesEvery: 1000, command: '!roue', cost: 50 },
    triggers: [on('Merci au suivi', 'follow', [chat('Bienvenue {user} 👋')], {}, 2)],
    commands: [cmd('!jeux', 'Tape !roue pour la roue, !join pour jouer avec moi, et like pour gagner la course !')],
  },
];

const packInfo = (p) => ({
  id: p.id, name: p.name, game: p.game, color: p.color, blurb: p.blurb, needs: p.needs, overlays: p.overlays, custom: Boolean(p.custom), author: p.author || '',
  counts: { triggers: p.triggers.length, commands: p.commands.length, segments: p.wheel?.segments?.length || 0, race: Boolean(p.likeRace) },
});

// Packs partagés entre streamers : on garde ce qui est sûr. Pas de webhook (envoi de données vers une adresse
// inconnue), textes et listes bornés, actions connues seulement.
const SAFE_ACTIONS = new Set(['chat', 'alert', 'show', 'tts', 'sound', 'counter', 'goal', 'timer', 'points', 'key', 'pad', 'overlayFx', 'notify', 'obsScene', 'obsSource', 'mic', 'replay', 'clip', 'spotify', 'arena', 'boss', 'minigame', 'game', 'skipAlert', 'pauseAlerts', 'fire', 'rcon', 'wheel', 'likeRace']);
const str = (v, n) => String(v ?? '').slice(0, n);
const cleanActions = (list) => (Array.isArray(list) ? list : []).filter((a) => a && SAFE_ACTIONS.has(a.type)).slice(0, 12).map((a) => {
  const out = {};
  for (const [k, v] of Object.entries(a)) if (['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'string' ? str(v, 400) : v;
  if (out.type === 'rcon') delete out.server;
  return out;
});
function sanitizePack(d) {
  if (!d || d.format !== 'regie-pack-1') throw new Error('Ce fichier n\'est pas un pack Régie.');
  const trig = (t) => ({ name: str(t.name, 80), cooldown: Number(t.cooldown) || 0, on: { type: str(t.on?.type, 30), platforms: [], minAmount: Number(t.on?.minAmount) || 0, giftId: str(t.on?.giftId, 60), giftName: str(t.on?.giftName, 60), kind: str(t.on?.kind, 30), name: str(t.on?.name, 80) }, conditions: (t.conditions || []).slice(0, 4).map((c) => ({ field: str(c.field, 20), op: str(c.op, 4), value: str(c.value, 60) })), actions: cleanActions(t.actions) });
  const cmd = (c) => ({ trigger: str(c.trigger, 40).toLowerCase(), response: str(c.response, 400), actions: cleanActions(c.actions), cooldown: Number(c.cooldown) || 20, userCooldown: Number(c.userCooldown) || 60, perm: ['all', 'subs', 'mods'].includes(c.perm) ? c.perm : 'all' });
  const pack = {
    id: `u-${str(d.id, 40).replace(/[^\w-]/g, '') || Date.now().toString(36)}`.replace(/^u-u-/, 'u-'), name: str(d.name, 80) || 'Pack partagé', blurb: str(d.blurb, 300), game: str(d.game, 30) || 'any', color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#8FD3FF',
    needs: (d.needs || []).filter((n) => ['keys', 'rcon', 'pad'].includes(n)), overlays: (d.overlays || []).map((t) => str(t, 30)).slice(0, 12),
    triggers: (d.triggers || []).slice(0, 40).map(trig), commands: (d.commands || []).filter((c) => /^!\S{1,30}$/.test(c.trigger || '')).slice(0, 30).map(cmd), custom: true, author: str(d.author, 60),
  };
  if (d.wheel) {
    const w = d.wheel;
    pack.wheel = { title: str(w.title, 60), command: str(w.command, 30), cost: Number(w.cost) || 0, minCoins: Number(w.minCoins) || 0, likesEvery: Number(w.likesEvery) || 0 };
    if (Array.isArray(w.segments)) pack.wheel.segments = w.segments.slice(0, 24).map((x) => ({ label: str(x.label, 60), color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '#8B3DFF', weight: Math.max(0, Number(x.weight) || 0), points: Number(x.points) || 0, actions: cleanActions(x.actions) }));
  }
  if (d.likeRace) {
    const r = d.likeRace;
    pack.likeRace = { enabled: true, target: Number(r.target) || 500, autoStart: r.autoStart !== false, autoRestart: r.autoRestart !== false, restartSeconds: Number(r.restartSeconds) || 15, chatPoints: Number(r.chatPoints) || 0, coinPoints: Number(r.coinPoints) || 0, actions: cleanActions(r.actions) };
  }
  return pack;
}

module.exports = { PACKS, packInfo, sanitizePack, SAFE_ACTIONS };
