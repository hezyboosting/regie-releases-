const test = require('node:test');
const assert = require('node:assert');
const lic = require('../src/main/license');
const { Roles } = require('../src/main/roles');
const { Engine } = require('../src/main/engine');
const { Stats } = require('../src/main/stats');
const { Tts } = require('../src/main/tts');
const { Viewers } = require('../src/main/viewers');
const { filterText, renderTemplate } = require('../src/main/text');
const { defaultState } = require('../src/shared/defaults');
const { overlayDefaults } = require('../src/shared/overlay-schema');
const os = require('os');

const pair = lic.generateKeyPair();
const fakeConn = (send) => ({ canSend: () => true, send: async (t) => send(t), removeAllListeners() {}, stop() {} });

function rig(role = 'free') {
  const file = { data: defaultState(), save() {} };
  const statsFile = { data: { days: {}, supporters: {} }, save() {} };
  const vault = { d: {}, get(k) { return this.d[k]; }, set(k, v) { this.d[k] = v; } };
  const license = new Roles({ file, vault, publicKey: pair.publicKey });
  if (role === 'pro' || role === 'ultimate') file.data.license.key = lic.createLicense(pair.privateKey, { tier: role }).key;
  if (role === 'admin') license.setAdminKey(pair.privateKey);
  const sent = [];
  const server = { broadcast: (m, t) => sent.push({ m, t }), hasClient: () => false, connectedCount: () => 0, sendTo() {} };
  const pushed = [];
  const spotify = { connected: true, state: { track: { title: 'Titre', artist: 'Artiste' } }, request: async (q, who) => ({ title: q, artist: who }) };
  const tts = new Tts({
    getConfig: () => file.data.tts, getFeatures: () => license.features(), getElevenKey: () => '', mediaDir: os.tmpdir(),
    overlay() {}, engineSend: (c, p) => pushed.push({ c, p }), push() {}, log() {},
  });
  const stats = new Stats(statsFile);
  const viewers = new Viewers({ data: { list: {} }, save() {} });
  const keys = [];
  const sounds = [];
  const engine = new Engine({ file, vault, server, spotify, tts, stats, viewers, input: { tap: (k) => { keys.push(k); return true; } }, audio: (c, p) => sounds.push(p), obs: { setScene: async () => {}, saveReplay: async () => {} }, license, push: (c, p) => pushed.push({ c, p }), log() {} });
  clearInterval(engine.ticker);
  const ev = (type, extra = {}) => ({ id: 'e', ts: Date.now(), platform: 'twitch', accountId: 'a', channel: 'Ch', user: { id: 'u1', name: 'lena', display: 'Lena' }, type, ...extra });
  return { file, engine, sent, pushed, ev, stats, tts, license, viewers, keys, sounds };
}
const alerts = (sent) => sent.filter((x) => x.m.t === 'alert').map((x) => x.m.alert);

test('un follow produit une alerte avec le bon texte', () => {
  const { engine, sent, ev } = rig();
  engine.handle(ev('follow'));
  assert.equal(alerts(sent)[0].title, 'Lena suit la chaîne');
  engine.stop();
});

test('les alertes passent une par une dans une file', () => {
  const { engine, sent, ev } = rig();
  engine.handle(ev('follow'));
  engine.handle(ev('sub'));
  assert.equal(alerts(sent).length, 1);
  assert.equal(engine.alertQueue.length, 1);
  engine.skipAlert();
  assert.equal(alerts(sent).length, 2);
  engine.stop();
});

test('une alerte désactivée ou en pause ne se déclenche pas', () => {
  const { engine, sent, ev, file } = rig();
  file.data.alerts.rules.find((r) => r.type === 'follow').enabled = false;
  engine.handle(ev('follow'));
  file.data.alerts.paused = true;
  engine.handle(ev('sub'));
  assert.equal(alerts(sent).length, 0);
  engine.stop();
});

test('les paliers ULTIMATE choisissent l\'alerte la plus précise, et sont ignorés en FREE', () => {
  const build = (role) => {
    const r = rig(role);
    r.file.data.alerts.rules.push({ id: 'big', type: 'bits', enabled: true, base: false, platforms: ['twitch'], minAmount: 1000, message: 'ÉNORME', sound: 'horn', duration: 5 });
    r.engine.handle(r.ev('bits', { amount: 2000 }));
    return alerts(r.sent)[0].title;
  };
  assert.equal(build('ultimate'), 'ÉNORME');
  assert.match(build('free'), /^Lena envoie 2\s000 bits$/);
});

test('les likes déclenchent une alerte seulement au passage d\'un palier', () => {
  const { engine, sent, ev, file } = rig();
  Object.assign(file.data.alerts.rules.find((r) => r.type === 'like'), { enabled: true, every: 1000 });
  const like = (total) => { engine.handle(ev('like', { platform: 'tiktok', amount: 10, total })); engine.skipAlert(); };
  like(900); like(1100); like(1500); like(2100);
  assert.equal(alerts(sent).length, 2);
  engine.stop();
});

test('les goals avancent selon le type et la plateforme', () => {
  const { engine, ev, file, pushed } = rig('ultimate');
  file.data.goals.push({ id: 'g', title: 'Subs', metric: 'sub', platforms: ['twitch'], current: 0, target: 10, autoStep: 0 });
  file.data.goals.push({ id: 'h', title: 'Coins', metric: 'coins', platforms: [], current: 0, target: 100, autoStep: 50 });
  engine.handle(ev('sub'));
  engine.handle(ev('giftsub', { amount: 5 }));
  engine.handle(ev('sub', { platform: 'youtube' }));
  engine.handle(ev('gift', { platform: 'tiktok', amount: 2, value: 120, gift: { id: '1', name: 'X' } }));
  assert.equal(file.data.goals[0].current, 6);
  assert.equal(file.data.goals[1].current, 120);
  assert.equal(file.data.goals[1].target, 150, 'relance automatique');
  assert.ok(pushed.some((p) => p.c === 'event' && p.p.type === 'goal'), 'atteindre un goal émet un événement');
  engine.stop();
});

test('en FREE, seuls les trois premiers goals avancent', () => {
  const { engine, ev, file } = rig();
  for (const id of ['a', 'b', 'c', 'd']) file.data.goals.push({ id, title: id, metric: 'follow', platforms: [], current: 0, target: 10, autoStep: 0 });
  engine.handle(ev('follow'));
  assert.deepEqual(file.data.goals.map((g) => g.current), [1, 1, 1, 0]);
  engine.stop();
});

test('battle : vote au chat, équipes et plateformes', () => {
  const r = rig('ultimate');
  const b = r.file.data.battle;
  r.engine.startBattle({ mode: 'chat', duration: 0 });
  r.engine.handle(r.ev('chat', { text: '!rouge allez' }));
  r.engine.handle(r.ev('chat', { text: 'rien à voir' }));
  r.engine.handle(r.ev('chat', { text: '!BLEU' }));
  assert.deepEqual(b.teams.map((t) => t.score), [1, 1]);

  r.engine.startBattle({ mode: 'teams', duration: 0 });
  r.engine.handle(r.ev('chat', { text: '!bleu' }));
  r.engine.handle(r.ev('bits', { amount: 300 }));
  assert.deepEqual(b.teams.map((t) => t.score), [0, 301]);
  assert.equal(b.teams[1].top[0].name, 'Lena');

  b.teams[0].platforms = ['tiktok']; b.teams[1].platforms = ['twitch', 'youtube'];
  r.engine.startBattle({ mode: 'platforms', duration: 0 });
  r.engine.handle(r.ev('follow', { platform: 'tiktok' }));
  r.engine.handle(r.ev('sub', { platform: 'youtube' }));
  assert.deepEqual(b.teams.map((t) => t.score), [10, 500]);
  r.engine.endBattle();
  assert.equal(b.winner, 'b');
  r.engine.stop();
});

test('si l\'admin réserve les modes de battle, le FREE revient au vote au chat', () => {
  const r = rig();
  r.file.data.remote.config = { features: { battleAllModes: { free: false } } };
  r.engine.startBattle({ mode: 'platforms', duration: 0 });
  assert.equal(r.file.data.battle.mode, 'chat');
  r.engine.stop();
});

test('battle TikTok : les scores suivent ceux envoyés par TikTok', () => {
  const r = rig('ultimate');
  r.file.data.battle.mode = 'tiktok';
  const a = { id: 'a', platform: 'tiktok', label: 'x' };
  r.engine.ingest(a, { type: 'battle', phase: 'start', raw: { anchors: ['Moi', 'Rival'] } });
  r.engine.ingest(a, { type: 'battle', phase: 'score', raw: { scores: [{ hostId: '1', points: 40 }, { hostId: '2', points: 90 }] } });
  assert.deepEqual(r.file.data.battle.teams.map((t) => [t.name, t.score]), [['Moi', 40], ['Rival', 90]]);
  r.engine.stop();
});

test('commande : variables, cooldown, droits et plateforme', async () => {
  const r = rig('ultimate');
  const replies = [];
  r.engine.connectors.set('a', fakeConn((t) => replies.push(t)));
  r.file.data.commands.push({ id: 'k', trigger: '!salut', aliases: ['!yo'], enabled: true, perm: 'all', cooldown: 30, userCooldown: 0, platforms: ['twitch'], replyTo: 'origin', response: 'Salut {user}, {args} sur {platform}', perPlatform: {}, actions: [], uses: 0 });
  r.file.data.commands.push({ id: 'm', trigger: '!mod', enabled: true, perm: 'mod', cooldown: 0, userCooldown: 0, platforms: ['twitch'], replyTo: 'origin', response: 'ok mod', perPlatform: {}, actions: [], uses: 0 });
  r.engine.handle(r.ev('chat', { text: '!SALUT tout le monde' }));
  r.engine.handle(r.ev('chat', { text: '!salut encore' }));
  r.engine.handle(r.ev('chat', { text: '!yo', platform: 'tiktok' }));
  r.engine.handle(r.ev('chat', { text: '!mod' }));
  r.engine.handle(r.ev('chat', { text: '!mod', user: { id: 'x', display: 'Mod', mod: true } }));
  await new Promise((d) => setTimeout(d, 20));
  assert.deepEqual(replies, ['Salut Lena, tout le monde sur Twitch', 'ok mod']);
  r.engine.stop();
});

test('commande : réponse sur toutes les chaînes réservée à ULTIMATE', async () => {
  const check = async (role) => {
    const r = rig(role);
    const out = [];
    r.engine.connectors.set('a', fakeConn(() => out.push('a')));
    r.engine.connectors.set('b', fakeConn(() => out.push('b')));
    r.file.data.commands = [{ id: 'k', trigger: '!x', enabled: true, perm: 'all', cooldown: 0, userCooldown: 0, platforms: ['twitch'], replyTo: 'all', response: 'hop', perPlatform: {}, actions: [], uses: 0 }];
    r.engine.handle(r.ev('chat', { text: '!x' }));
    await new Promise((d) => setTimeout(d, 20));
    r.engine.stop();
    return out.length;
  };
  assert.equal(await check('ultimate'), 2);
  assert.equal(await check('free'), 1);
});

test('manette redessinée : seules les anciennes finitions transparentes changent', () => {
  const r = rig('ultimate');
  const pads = [
    { id: 'a', type: 'gamepad', name: 'A', settings: { finish: { shell: { alpha: 22 } }, colorway: 'bleu' } },
    { id: 'b', type: 'gamepad', name: 'B', settings: { finish: { shell: { alpha: 100, c1: '#123456' } }, colorway: 'rouge' } },
  ];
  r.file.data.overlays.push(...pads);
  r.file.data.settings.designRev = 3;
  r.engine.migrateDesign();
  r.engine.stop();
  assert.equal(pads[0].settings.finish.shell.alpha, 100);
  assert.equal(pads[0].settings.colorway, 'fume');
  assert.equal(pads[1].settings.finish.shell.c1, '#123456', 'un réglage personnel reste');
  assert.equal(r.file.data.settings.designRev, 4);
});

test('sans compte Spotify, les demandes attendent dans une liste', async () => {
  const r = rig('ultimate');
  const replies = [];
  r.engine.spotify.connected = false;
  r.engine.connectors.set('a', fakeConn((t) => replies.push(t)));
  Object.assign(r.file.data.spotify.requests, { enabled: true, cooldown: 0, maxPerUser: 1, blocked: ['interdit'] });
  r.engine.handle(r.ev('chat', { text: '!sr' }));
  r.engine.handle(r.ev('chat', { text: '!sr un titre interdit' }));
  r.engine.handle(r.ev('chat', { text: '!sr daft punk' }));
  r.engine.handle(r.ev('chat', { text: '!sr encore une' }));
  await new Promise((d) => setTimeout(d, 20));
  r.engine.stop();
  const list = r.file.data.spotify.wishlist;
  assert.equal(list.length, 1);
  assert.equal(list[0].query, 'daft punk');
  assert.equal(list[0].user, 'Lena');
  assert.match(replies.join('|'), /suivi du titre/);
  assert.match(replies.join('|'), /pas autorisé/);
  assert.match(replies.join('|'), /daft punk noté/);
  assert.match(replies.join('|'), /déjà des demandes/);
});

test('demande de musique : ULTIMATE seulement', async () => {
  const run = async (role) => {
    const r = rig(role);
    const replies = [];
    r.engine.connectors.set('a', fakeConn((t) => replies.push(t)));
    r.file.data.spotify.requests.enabled = true;
    r.engine.handle(r.ev('chat', { text: '!sr daft punk' }));
    await new Promise((d) => setTimeout(d, 20));
    r.engine.stop();
    return replies;
  };
  assert.match((await run('ultimate'))[0], /daft punk de Lena ajouté/);
  assert.deepEqual(await run('free'), []);
});

test('déclencheur : un cadeau précis lance ses actions', () => {
  const r = rig('ultimate');
  const c = r.file.data.tools.counters[0];
  r.file.data.triggers.push({ id: 't', enabled: true, cooldown: 0, on: { type: 'gift', platforms: ['tiktok'], minAmount: 0, giftId: 'rose' }, actions: [{ type: 'counter', counterId: c.id, step: 2 }] });
  r.engine.handle(r.ev('gift', { platform: 'tiktok', amount: 1, value: 1, gift: { id: 'rose', name: 'Rose' } }));
  r.engine.handle(r.ev('gift', { platform: 'tiktok', amount: 1, value: 1, gift: { id: 'lion', name: 'Lion' } }));
  assert.equal(c.value, 2);
  r.engine.stop();
});

test('minuteur subathon : chaque soutien ajoute du temps', () => {
  const r = rig('ultimate');
  const t = r.file.data.tools.timers[0];
  t.subathon.enabled = true;
  r.engine.controlTimer(t.id, 'start');
  const before = t.endsAt;
  r.engine.handle(r.ev('sub'));
  r.engine.handle(r.ev('follow'));
  assert.equal(t.endsAt - before, 330000);
  r.engine.stop();
});

test('sondage multi-plateformes : une voix par personne', () => {
  const r = rig('ultimate');
  r.engine.startPoll({ question: 'Q', options: ['Oui', 'Non'], duration: 0 });
  r.engine.handle(r.ev('chat', { text: '1' }));
  r.engine.handle(r.ev('chat', { text: '2' }));
  r.engine.handle(r.ev('chat', { text: 'oui', platform: 'tiktok' }));
  r.engine.handle(r.ev('chat', { text: 'Non', platform: 'youtube', user: { id: 'y', display: 'Y' } }));
  assert.deepEqual(r.engine.pollView().counts, [1, 2]);
  r.engine.stop();
});

test('giveaway : inscription unique, tirage parmi les inscrits, droits', () => {
  const r = rig('ultimate');
  r.engine.giveawayControl('open', { keyword: '!go' });
  r.engine.handle(r.ev('chat', { text: '!go' }));
  r.engine.handle(r.ev('chat', { text: '!go' }));
  r.engine.handle(r.ev('chat', { text: '!go', user: { id: 'b', display: 'B' }, platform: 'tiktok' }));
  const g = r.file.data.tools.giveaway;
  assert.equal(g.entrants.length, 2);
  r.engine.giveawayControl('draw');
  assert.ok(['Lena', 'B'].includes(g.winner.name));
  const first = g.winner.key;
  r.engine.giveawayControl('draw');
  assert.notEqual(g.winner.key, first, 'un second tirage donne quelqu\'un d\'autre');
  r.engine.stop();
  const free = rig();
  assert.throws(() => free.engine.giveawayControl('open'), /PRO/);
  free.engine.stop();
});

test('les essais n\'entrent jamais dans les stats', () => {
  const r = rig();
  r.engine.simulate('gift', 'tiktok');
  r.engine.handle(r.ev('follow'));
  const day = Object.values(r.stats.file.data.days)[0];
  assert.deepEqual(Object.keys(day), ['twitch']);
  assert.equal(day.twitch.follow, 1);
  r.engine.stop();
});

test('stats : historique limité en FREE, complet en ULTIMATE', () => {
  const r = rig();
  const d = r.stats.file.data.days;
  d['2020-01-01'] = { twitch: { follow: 9 } };
  r.engine.handle(r.ev('follow'));
  assert.equal(r.stats.report(7).series.length, 1);
  assert.equal(r.stats.report(7).hidden, 1);
  assert.equal(r.stats.report(-1).series.length, 2);
  assert.match(r.stats.csv(-1), /2020-01-01;twitch/);
  r.engine.stop();
});

test('un lien d\'overlay gratuit ne sert jamais un thème ULTIMATE ni du CSS', () => {
  const run = (role) => {
    const r = rig(role);
    const o = { id: 'o', type: 'spotify', name: 'S', settings: { ...overlayDefaults('spotify'), theme: 'cassette', reactive: true, customCss: 'body{}' } };
    const out = r.engine.effectiveSettings(o);
    const init = r.engine.overlayInit(o);
    r.engine.stop();
    return [out.theme, out.reactive, out.customCss, init.watermark];
  };
  assert.deepEqual(run('free'), ['capsule', false, '', true]);
  assert.deepEqual(run('ultimate'), ['cassette', true, 'body{}', false]);
});

test('une licence expirée laisse les chaînes en plus à l\'arrêt, sans les supprimer', () => {
  const r = rig();
  r.file.data.accounts = [{ id: '1', platform: 'tiktok', username: 'a' }, { id: '2', platform: 'tiktok', username: 'b' }, { id: '3', platform: 'twitch' }];
  assert.deepEqual(r.engine.usableAccounts().map((a) => a.id), ['1', '3']);
  r.engine.startAccount(r.file.data.accounts[1]);
  assert.equal(r.engine.status['2'].state, 'locked');
  assert.equal(r.file.data.accounts.length, 3);
  r.engine.stop();
});

test('TTS : filtres, longueur, mots bloqués et attente par viewer', () => {
  assert.equal(filterText('regarde https://site.fr vite', {}), 'regarde lien vite');
  assert.equal(filterText('wooooooooow', {}), 'wooow');
  assert.equal(filterText('salut 😀', {}), 'salut');
  assert.equal(filterText('un gros mot ici', { blocked: ['gros mot'] }), '');
  assert.equal(filterText('abcdef', { maxLength: 3 }), 'abc');
  assert.equal(renderTemplate('{user} : {inconnu}', { user: 'A' }), 'A : {inconnu}');
  const r = rig();
  Object.assign(r.file.data.tts, { enabled: true, cooldown: 10 });
  assert.equal(r.tts.say({ text: 'un', user: { id: '1', display: 'A' }, ev: { platform: 'twitch' } }), true);
  assert.equal(r.tts.say({ text: 'deux', user: { id: '1', display: 'A' }, ev: { platform: 'twitch' } }), false);
  assert.equal(r.tts.say({ text: 'trois', user: { id: '2', display: 'B' }, ev: { platform: 'twitch' } }), true);
  r.tts.done(r.tts.current.id);
  clearTimeout(r.tts.guard);
  r.tts.done(r.tts.current?.id);
  clearTimeout(r.tts.guard);
  r.engine.stop();
});

test('Gift Tracker : total, top gift, top streak et classements', () => {
  const r = rig();
  const gift = (user, id, name, count, cost) => r.engine.handle(r.ev('gift', { platform: 'tiktok', user: { id: user, name: user, display: user }, amount: count, value: count * cost, gift: { id, name, cost, image: '' } }));
  gift('a', '1', 'Rose', 50, 1);
  gift('b', '2', 'Lion', 1, 29999);
  gift('a', '1', 'Rose', 10, 1);
  r.engine.handle(r.ev('like', { platform: 'tiktok', amount: 300, total: 300, user: { id: 'c', name: 'c', display: 'c' } }));
  const v = r.viewers.giftView();
  assert.equal(v.coins, 30059);
  assert.equal(v.count, 61);
  assert.equal(v.byGift[0].name, 'Lion');
  assert.equal(v.byGift[1].count, 60);
  assert.equal(v.topGift.user, 'b');
  assert.deepEqual([v.topStreak.user, v.topStreak.count], ['a', 50]);
  assert.equal(r.viewers.board('coins')[0].name, 'b');
  assert.equal(r.viewers.board('likes')[0].name, 'c');
  r.engine.stop();
});

test('les essais restent hors du cumul des spectateurs', () => {
  const r = rig();
  r.engine.simulate('gift', 'tiktok');
  assert.equal(Object.keys(r.viewers.file.data.list).length, 0);
  assert.equal(r.viewers.board('coins').length, 1);
  r.engine.stop();
});

test('Follow = Rank : un rang à la première fois, et pas à chaque follow', () => {
  const r = rig();
  r.engine.handle(r.ev('follow'));
  r.engine.handle(r.ev('follow'));
  const cards = r.sent.filter((x) => x.m.t === 'rank');
  assert.equal(cards.length, 1);
  assert.ok(r.file.data.ranks.list.some((x) => x.id === cards[0].m.card.rank.id));
  assert.equal(r.viewers.file.data.list['twitch:u1'].rank, cards[0].m.card.rank.id);
  r.engine.stop();
});

test('rangs par points : le rang suit le total', () => {
  const r = rig();
  r.file.data.ranks.mode = 'points';
  assert.equal(r.engine.games.rankForPoints(0).id, 'bronze');
  assert.equal(r.engine.games.rankForPoints(700).id, 'or');
  assert.equal(r.engine.games.rankForPoints(99999).id, 'legende');
  r.engine.stop();
});

test('points et récompenses : gagner, consulter, dépenser', async () => {
  const r = rig();
  const replies = [];
  r.engine.connectors.set('a', fakeConn((t) => replies.push(t)));
  r.file.data.rewards.list.push({ id: 'w', name: 'Hydrate', command: '!eau', cost: 100, enabled: true, actions: [{ type: 'sound', sound: 'pop' }] });
  r.engine.handle(r.ev('chat', { text: '!eau' }));
  r.engine.handle(r.ev('bits', { amount: 300 }));
  assert.equal(r.viewers.points(r.ev('chat')), 301);
  r.engine.handle(r.ev('chat', { text: '!points' }));
  r.engine.handle(r.ev('chat', { text: '!eau' }));
  await new Promise((d) => setTimeout(d, 20));
  assert.match(replies[0], /il te faut 100 points/);
  assert.match(replies[1], /30\d points/);
  assert.match(replies[2], /Lena utilise Hydrate/);
  assert.equal(r.sounds.length, 1);
  assert.ok(r.viewers.points(r.ev('chat')) < 210);
  r.engine.stop();
});

test('Chat Battle : inscription, combat jusqu\'au dernier survivant, gain de points', async () => {
  const r = rig();
  const a = r.file.data.arena;
  a.speed = 1;
  a.lobby = 60;
  r.engine.games.arenaOpen();
  r.engine.handle(r.ev('chat', { text: '!fight', user: { id: 'x', display: 'Xavier', name: 'x' } }));
  r.engine.handle(r.ev('chat', { text: '!fight', user: { id: 'x', display: 'Xavier', name: 'x' } }));
  r.engine.handle(r.ev('chat', { text: '!fight', user: { id: 'y', display: 'Yvan', name: 'y' } }));
  assert.equal(a.fighters.length, 2);
  r.engine.games.arenaBots(2);
  r.engine.games.arenaStart();
  assert.equal(a.status, 'fight');
  for (let i = 0; i < 400 && a.status === 'fight'; i += 1) await new Promise((d) => setTimeout(d, 3));
  assert.equal(a.status, 'ended');
  assert.equal(a.fighters.filter((f) => f.alive).length, 1);
  assert.ok(a.winner.name);
  r.engine.stop();
});

test('Chat Battle : trop peu de combattants annule le combat', () => {
  const r = rig();
  r.engine.games.arenaOpen();
  r.engine.games.arenaStart();
  assert.equal(r.file.data.arena.status, 'idle');
  r.engine.stop();
});

test('Boss Battle : dégâts par type, classement, victoire et boss suivant', () => {
  const r = rig();
  const b = r.file.data.boss;
  b.baseHp = 1000;
  b.autoNext = false;
  r.engine.games.bossStart();
  r.engine.handle(r.ev('chat', { text: '!hit' }));
  r.engine.handle(r.ev('chat', { text: 'salut' }));
  r.engine.handle(r.ev('bits', { amount: 100 }));
  assert.equal(b.hp, 1000 - 5 - 1 - 1 - 100);
  assert.equal(b.players[0].name, 'Lena');
  r.engine.handle(r.ev('superchat', { value: 100, money: '100 €', platform: 'youtube' }));
  assert.equal(b.status, 'won');
  assert.equal(b.hp, 0);
  r.engine.stop();
});

test('Boss Battle : le temps écoulé donne la défaite', () => {
  const r = rig();
  r.engine.games.bossStart({ duration: 100 });
  r.file.data.boss.endsAt = Date.now() - 1;
  r.engine.games.bossTick();
  assert.equal(r.file.data.boss.status, 'lost');
  r.engine.stop();
});

test('rang en jeu : un modérateur le met à jour depuis le chat, pas un viewer', async () => {
  const r = rig();
  r.engine.handle(r.ev('chat', { text: '!rank 2v2 diamant 2 1050' }));
  const p = r.engine.profile('rocketleague').modes['2v2'];
  assert.equal(p.tier, 'bronze');
  r.engine.handle(r.ev('chat', { text: '!rank 2v2 diamant 2 1050', user: { id: 'm', display: 'Mod', mod: true } }));
  assert.deepEqual([p.tier, p.division, p.mmr], ['diamant', 2, 1050]);
  r.engine.handle(r.ev('chat', { text: '!rank 2v2 grand champion 3 1600', user: { id: 'm', display: 'Mod', mod: true } }));
  assert.deepEqual([p.tier, p.division, p.mmr], ['grand-champion', 3, 1600]);
  r.engine.stop();
});

test('touches simulées : coupées par défaut, puis limitées à dix par seconde', () => {
  const r = rig();
  r.engine.runAction({ type: 'key', key: 'F5' }, r.ev('gift'));
  assert.equal(r.keys.length, 0);
  r.file.data.keys.enabled = true;
  for (let i = 0; i < 15; i += 1) r.engine.runAction({ type: 'key', key: 'F5' }, r.ev('gift'));
  assert.equal(r.keys.length, 10);
  r.engine.stop();
});

test('webhook sortant : ULTIMATE, et les textes du chat sont échappés', async () => {
  const real = global.fetch;
  const calls = [];
  global.fetch = async (u, o) => { calls.push([u, o]); return { ok: true }; };
  const r = rig('ultimate');
  const ev = r.ev('chat', { text: 'a"b' });
  await r.engine.callWebhook({ url: 'https://x.test/?m={text}', body: '{"msg":"{text}"}' }, ev, r.engine.commandVars(ev, '', null));
  assert.equal(calls[0][0], 'https://x.test/?m=a%22b');
  assert.equal(JSON.parse(calls[0][1].body).msg, 'a"b');
  r.engine.stop();
  const f = rig();
  await f.engine.callWebhook({ url: 'https://x.test/' }, f.ev('chat'), {});
  assert.equal(calls.length, 1);
  f.engine.stop();
  global.fetch = real;
});

test('webhook entrant : lance seulement un déclencheur de ce type', () => {
  const r = rig('ultimate');
  const c = r.file.data.tools.counters[0];
  r.file.data.triggers.push({ id: 'h', enabled: true, on: { type: 'webhook' }, actions: [{ type: 'counter', counterId: c.id, step: 1 }] });
  r.file.data.triggers.push({ id: 'n', enabled: true, on: { type: 'follow' }, actions: [{ type: 'counter', counterId: c.id, step: 1 }] });
  assert.equal(r.engine.fireHook('h'), true);
  assert.equal(r.engine.fireHook('n'), false);
  assert.equal(c.value, 1);
  r.engine.stop();
});

test('événement à intervalle : se lance au bon moment', () => {
  const r = rig();
  const c = r.file.data.tools.counters[0];
  const t = { id: 'i', enabled: true, on: { type: 'interval', minutes: 10 }, actions: [{ type: 'counter', counterId: c.id, step: 1 }] };
  r.file.data.triggers.push(t);
  r.engine.runIntervals();
  assert.equal(c.value, 0);
  t.lastRun = Date.now() - 11 * 60000;
  r.engine.runIntervals();
  assert.equal(c.value, 1);
  r.engine.stop();
});

test('TTS : liste noire, liste blanche et rôle minimum', () => {
  const r = rig();
  Object.assign(r.file.data.tts, { enabled: true, cooldown: 0, perm: 'sub', blockUsers: ['troll'], allowUsers: ['ami'] });
  const say = (user) => r.tts.say({ text: 'bonjour', user, ev: { platform: 'twitch' } });
  assert.equal(say({ id: '1', name: 'Troll', display: 'Troll', sub: true }), false);
  assert.equal(say({ id: '2', name: 'inconnu', display: 'Inconnu' }), false);
  assert.equal(say({ id: '3', name: 'ami', display: 'Ami' }), true);
  assert.equal(say({ id: '4', name: 'abo', display: 'Abo', sub: true }), true);
  clearTimeout(r.tts.guard);
  r.engine.stop();
});

test('TTS : une voix par langue en FREE, toutes en ULTIMATE', () => {
  const voices = [{ id: 'a', lang: 'fr-FR' }, { id: 'b', lang: 'fr-FR' }, { id: 'c', lang: 'en-US' }];
  const build = (role) => { const r = rig(role); r.tts.getVoices = () => voices; r.engine.stop(); return r; };
  const free = build('free');
  assert.deepEqual(free.tts.allowedVoices().map((v) => v.id), ['a', 'c']);
  assert.equal(free.tts.voiceFor('b'), '');
  assert.equal(free.tts.voiceFor('a'), 'a');
  const pro = build('ultimate');
  assert.equal(pro.tts.allowedVoices().length, 3);
  assert.equal(pro.tts.voiceFor('b'), 'b');
});

test('overlays personnalisés : deux emplacements en FREE, sans limite en PRO', () => {
  const r = rig();
  const mk = (id) => ({ id, type: 'custom', name: id, settings: { elements: [{ kind: 'text' }] } });
  r.file.data.overlays.push(mk('o1'), mk('o2'), mk('o3'));
  assert.equal(r.engine.effectiveSettings(r.file.data.overlays.at(-2)).elements.length, 1);
  assert.equal(r.engine.effectiveSettings(r.file.data.overlays.at(-1)).elements.length, 0);
  assert.equal(r.license.features().customOverlays, 2);
  r.engine.stop();
  const p = rig('pro');
  assert.equal(p.license.features().customOverlays, -1);
  p.engine.stop();
});

test('thème de jeu : les couleurs passent sur tous les overlays', () => {
  const r = rig();
  r.engine.applyTheme('ambre');
  const alerts = r.file.data.overlays.find((o) => o.type === 'alerts');
  assert.equal(alerts.settings.accent, '#F3D38A');
  assert.equal(alerts.settings.font, 'onest');
  assert.throws(() => r.engine.applyTheme('rien'));
  r.engine.stop();
});

test('les messages du chat ne lancent jamais une commande système', () => {
  const r = rig();
  const out = renderTemplate('{user}', { user: '$(rm -rf /) {text}' });
  assert.equal(out, '$(rm -rf /) {text}');
  r.engine.stop();
});
