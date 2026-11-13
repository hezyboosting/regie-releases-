// Live interactif (roue, course aux likes), packs prêts et traduction anglaise.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const lic = require('../src/main/license');
const { Roles } = require('../src/main/roles');
const { Engine } = require('../src/main/engine');
const { Stats } = require('../src/main/stats');
const { Tts } = require('../src/main/tts');
const { Viewers } = require('../src/main/viewers');
const { defaultState } = require('../src/shared/defaults');
const { PACKS } = require('../src/shared/packs');
const { OVERLAY_TYPES } = require('../src/shared/overlay-schema');
const { makeTranslator } = require('../src/shared/translate');

const pair = lic.generateKeyPair();

function rig() {
  const file = { data: defaultState(), save() {} };
  const vault = { d: {}, get(k) { return this.d[k]; }, set(k, v) { this.d[k] = v; } };
  const license = new Roles({ file, vault, publicKey: pair.publicKey });
  const sent = [];
  const pushed = [];
  const replies = [];
  const server = { broadcast: (m, t) => sent.push({ m, t }), hasClient: () => false, connectedCount: () => 0, sendTo() {}, port: 1 };
  const tts = new Tts({ getConfig: () => file.data.tts, getFeatures: () => license.features(), getElevenKey: () => '', mediaDir: os.tmpdir(), overlay() {}, engineSend() {}, push() {}, log() {} });
  const engine = new Engine({
    file, vault, server, spotify: { connected: false, state: { track: null } }, tts, stats: new Stats({ data: { days: {}, supporters: {} }, save() {} }),
    viewers: new Viewers({ data: { list: {} }, save() {} }), input: { tap: () => true }, audio() {}, obs: { setScene: async () => {}, saveReplay: async () => {} }, license, push: (c, p) => pushed.push({ c, p }), log() {},
  });
  clearInterval(engine.ticker);
  engine.reply = async (e, text) => { replies.push(text); };
  const ev = (type, extra = {}) => ({ id: 'e', ts: Date.now(), platform: 'tiktok', accountId: 'a', channel: 'Ch', user: { id: extra.uid || 'u1', name: extra.uid || 'lena', display: extra.name || 'Lena' }, type, ...extra });
  return { file, engine, sent, pushed, replies, ev };
}

test('un cadeau assez gros fait tourner la roue, les suivants attendent leur tour', () => {
  const { file, engine, sent, ev } = rig();
  file.data.tools.wheel.minCoins = 10;
  engine.handle(ev('gift', { value: 50, amount: 1, gift: { id: 'g', name: 'Rose' } }));
  engine.handle(ev('gift', { value: 99, amount: 1, gift: { id: 'g', name: 'Rose' }, uid: 'u2', name: 'Max' }));
  engine.handle(ev('gift', { value: 2, amount: 1, gift: { id: 'g', name: 'Rose' }, uid: 'u3', name: 'Sam' }));
  const view = engine.fun.wheelView();
  assert.equal(view.status, 'spinning');
  assert.equal(view.user, 'Lena');
  assert.equal(view.queue, 1);
  assert.deepEqual(view.next, ['Max']);
  assert.ok(sent.some((x) => x.m.t === 'wheel' && x.t === 'wheel'));
  engine.stop();
});

test('la commande de la roue coûte des points et respecte l\'attente', () => {
  const { file, engine, replies, ev } = rig();
  Object.assign(file.data.tools.wheel, { command: '!roue', cost: 100, cooldown: 0 });
  engine.handle(ev('chat', { text: '!roue' }));
  assert.equal(engine.fun.wheelView().status, 'idle');
  assert.match(replies[0], /100 points/);
  engine.stop();
});

test('la roue tire une case selon les chances et lance ses actions', async () => {
  const { file, engine, ev } = rig();
  Object.assign(file.data.tools.wheel, { spinSeconds: 2, resultSeconds: 2, spinSound: '', resultSound: '', segments: [{ id: 'a', label: 'Seule case', color: '#fff', weight: 5, points: 0, actions: [{ type: 'overlayFx' }] }, { id: 'b', label: 'Jamais', color: '#000', weight: 0, actions: [] }] });
  const fired = [];
  engine.runAction = (a) => fired.push(a.type);
  engine.fun.wheelRequest(ev('custom'));
  assert.equal(engine.fun.wheelView().segments.length, 1);
  await new Promise((r) => setTimeout(r, 2400));
  assert.equal(engine.fun.wheelView().status, 'result');
  assert.equal(engine.fun.wheelView().result, 'Seule case');
  assert.deepEqual(fired, ['overlayFx']);
  engine.stop();
});

test('la course aux likes démarre au premier like et désigne un vainqueur', () => {
  const { file, engine, ev } = rig();
  Object.assign(file.data.tools.likeRace, { enabled: true, target: 100, autoStart: true, autoRestart: false, actions: [] });
  engine.handle(ev('like', { amount: 60 }));
  engine.handle(ev('like', { amount: 30, uid: 'u2', name: 'Max' }));
  let r = engine.fun.raceView();
  assert.equal(r.status, 'running');
  assert.equal(r.racers[0].name, 'Lena');
  engine.handle(ev('like', { amount: 45 }));
  r = engine.fun.raceView();
  assert.equal(r.status, 'won');
  assert.equal(r.winner.name, 'Lena');
  engine.stop();
});

test('la course compte aussi les messages quand c\'est réglé (Twitch, YouTube, Kick)', () => {
  const { file, engine, ev } = rig();
  Object.assign(file.data.tools.likeRace, { enabled: true, target: 1000, autoStart: true, chatPoints: 5 });
  engine.handle({ ...ev('chat', { text: 'salut' }), platform: 'twitch' });
  assert.equal(engine.fun.raceView().racers[0].score, 5);
  engine.stop();
});

test('chaque pack ne référence que des overlays et des actions existants', () => {
  const known = new Set(['chat', 'alert', 'show', 'tts', 'sound', 'counter', 'goal', 'timer', 'points', 'key', 'overlayFx', 'notify', 'obsScene', 'obsSource', 'mic', 'replay', 'clip', 'spotify', 'arena', 'boss', 'minigame', 'game', 'skipAlert', 'pauseAlerts', 'automation', 'fire', 'rcon', 'webhook', 'wheel', 'likeRace']);
  for (const p of PACKS) {
    for (const t of p.overlays) assert.ok(OVERLAY_TYPES[t], `${p.id} : overlay ${t}`);
    const actions = [...p.triggers.flatMap((t) => t.actions), ...p.commands.flatMap((c) => c.actions), ...(p.wheel?.segments || []).flatMap((s) => s.actions), ...(p.likeRace?.actions || [])];
    for (const a of actions) assert.ok(known.has(a.type), `${p.id} : action ${a.type}`);
    for (const s of p.wheel?.segments || []) assert.ok(s.weight > 0 && s.label, `${p.id} : case`);
  }
});

test('une langue anglaise traduit les textes à trous et les phrases du bot', () => {
  const t = makeTranslator(require('../src/shared/i18n-en.json'));
  assert.equal(t('Aperçu de Minuteur'), 'Preview of Timer');
  assert.equal(t('Léna suit la chaîne'), 'Léna follows the channel');
  assert.equal(t('Kenza, tu as déjà des demandes en attente.'), 'Kenza, you already have requests waiting.');
  assert.equal(t('Bonjour inconnu'), 'Bonjour inconnu');
});

test('les noms par défaut passés en français sont repris dans les anciennes données', () => {
  const state = defaultState();
  state.overlays = [{ id: 'o1', type: 'giftfeed', name: 'Gift Feed', settings: {} }, { id: 'o2', type: 'goal', name: 'Mon goal', settings: {} }];
  state.arena.title = 'Chat Battle';
  const file = { data: state, save() {} };
  const vault = { d: {}, get(k) { return this.d[k]; }, set(k, v) { this.d[k] = v; } };
  const license = new Roles({ file, vault, publicKey: pair.publicKey });
  const engine = new Engine({ file, vault, server: { broadcast() {}, hasClient: () => false }, spotify: { state: {} }, tts: { fromEvent() {} }, stats: { record() {} }, viewers: new Viewers({ data: { list: {} }, save() {} }), input: {}, obs: {}, license, push() {}, log() {} });
  clearInterval(engine.ticker);
  assert.equal(state.overlays.find((o) => o.id === 'o1').name, 'Fil des cadeaux');
  assert.equal(state.overlays.find((o) => o.id === 'o2').name, 'Mon goal');
  assert.equal(state.arena.title, 'Bataille du chat');
  engine.stop();
});

test('un pack partagé est nettoyé : pas de webhook, textes bornés, format vérifié', () => {
  const { sanitizePack } = require('../src/shared/packs');
  assert.throws(() => sanitizePack({ format: 'autre' }));
  const p = sanitizePack({
    format: 'regie-pack-1', id: 'test', name: 'Mon pack', overlays: ['wheel'],
    triggers: [{ name: 'x', on: { type: 'gift', minAmount: 10 }, actions: [{ type: 'webhook', url: 'https://exemple.test' }, { type: 'key', key: 'Space' }] }],
    commands: [{ trigger: '!go', response: 'ok', actions: [] }, { trigger: 'pas une commande', response: '' }],
    wheel: { segments: [{ label: 'A', color: 'rouge', weight: 2, actions: [{ type: 'rcon', text: 'say hi', server: 'srv1' }] }] },
  });
  assert.equal(p.id, 'u-test');
  assert.deepEqual(p.triggers[0].actions.map((a) => a.type), ['key']);
  assert.equal(p.commands.length, 1);
  assert.equal(p.wheel.segments[0].color, '#8B3DFF');
  assert.equal(p.wheel.segments[0].actions[0].server, undefined);
});

test('les actions par cadeau reconnaissent un cadeau par son nom et répètent les combos', async () => {
  const { file, engine, ev } = rig();
  const fired = [];
  engine.runAction = (a) => fired.push(a.type);
  engine.allowed = () => true;
  file.data.triggers.push({ id: 't1', name: 'Rose', enabled: true, cooldown: 0, conditions: [], on: { type: 'gift', platforms: [], minAmount: 0, giftId: '', giftName: 'Rose' }, actions: [{ type: 'overlayFx' }], giftAction: 'Rose', repeat: true });
  engine.handle(ev('gift', { gift: { id: '5655', name: 'Rose' }, amount: 3, value: 3 }));
  engine.handle(ev('gift', { gift: { id: '1', name: 'Lion' }, amount: 1, value: 29999 }));
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(fired.filter((x) => x === 'overlayFx').length, 3);
  engine.stop();
});

test('le récap de live compte les soutiens et compare au live précédent', () => {
  const { engine, ev } = rig();
  engine.handle(ev('gift', { gift: { id: 'g', name: 'Rose' }, amount: 1, value: 500 }));
  engine.handle(ev('follow', { uid: 'u9', name: 'Max' }));
  const r = engine.buildRecap();
  assert.equal(r.top[0].name, 'Lena');
  assert.equal(r.follows, 1);
  assert.ok(r.duration >= 0);
  engine.stop();
});

test('boutique de points : liste numérotée, achat par numéro, stock et texte obligatoire', () => {
  const { file, engine, replies, ev } = rig();
  const fired = [];
  engine.runAction = (a, e, vars) => fired.push(`${a.type}:${vars.args || ''}`);
  file.data.rewards.list = [
    { id: 'a', emoji: '🎉', name: 'Confettis', cost: 10, enabled: true, stock: 1, actions: [{ type: 'overlayFx' }] },
    { id: 'b', emoji: '💬', name: 'Message', cost: 10, enabled: true, needsText: true, actions: [{ type: 'show' }] },
  ];
  engine.handle(ev('bits', { amount: 100 }));
  engine.handle(ev('chat', { text: '!boutique' }));
  assert.match(replies.at(-1), /1\. 🎉Confettis \(10\) · 2\. 💬Message \(10\)/);
  engine.handle(ev('chat', { text: '!acheter 1' }));
  engine.handle(ev('chat', { text: '!acheter 1' }));
  assert.match(replies.at(-1), /épuisé/);
  engine.handle(ev('chat', { text: '!acheter 2' }));
  assert.match(replies.at(-1), /ajoute ton texte/);
  engine.handle(ev('chat', { text: '!acheter mess Bonjour le chat' }));
  assert.deepEqual(fired, ['overlayFx:', 'show:Bonjour le chat']);
  assert.equal(engine.games.shopView().log[0].reward, 'Message');
  engine.stop();
});

test('traduction du chat : Google sans clé, même langue ignorée, commandes ignorées, cache', async () => {
  const { ChatTranslator } = require('../src/main/chat-translate');
  let calls = 0;
  const fake = async (url) => {
    calls += 1;
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    const fr = q.startsWith('Bonjour');
    return { ok: true, json: async () => [[[fr ? q : 'Bonjour à tous', q]], null, fr ? 'fr' : 'en'] };
  };
  const t = new ChatTranslator({ fetchImpl: fake });
  assert.deepEqual(await t.translate('Hello everyone', 'fr'), { text: 'Bonjour à tous', from: 'en' });
  assert.equal(await t.translate('Bonjour tout le monde', 'fr'), null);
  assert.equal(await t.translate('!roue', 'fr'), null);
  assert.equal(await t.translate('🔥🔥', 'fr'), null);
  await t.translate('Hello everyone', 'fr');
  assert.equal(calls, 2);
});

test('traduction du chat : DeepL avec la clé gratuite', async () => {
  const { ChatTranslator } = require('../src/main/chat-translate');
  let seen = null;
  const fake = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ translations: [{ detected_source_language: 'ES', text: 'Salut' }] }) }; };
  const t = new ChatTranslator({ fetchImpl: fake, getKey: () => 'abc:fx' });
  assert.deepEqual(await t.translate('Hola amigos', 'fr', 'deepl'), { text: 'Salut', from: 'es' });
  assert.match(seen.url, /api-free\.deepl\.com/);
  assert.match(seen.opts.body, /target_lang=FR/);
});

test('rangs : seuls les rangs cochés sortent, et le rang d\'un autre jeu ne reste pas', () => {
  const { file, engine, sent, ev } = rig();
  file.data.ranks.game = 'rocketleague';
  const all = engine.games.rankPool(true);
  const keep = all[all.length - 1].id;
  file.data.ranks.picks = { rocketleague: Object.fromEntries(all.map((x) => [x.id, { on: x.id === keep }])) };
  for (let i = 0; i < 20; i += 1) assert.equal(engine.games.drawRank().id, keep);
  // Premier suivi : rang de Rocket League.
  engine.handle(ev('follow', { uid: 'kenza', name: 'Kenza' }));
  const card = sent.filter((x) => x.m.t === 'rank').pop().m.card;
  assert.equal(card.rank.id, keep);
  assert.equal(card.rank.chance, 1);
  // Changement de jeu puis nouveau suivi : un rang du nouveau jeu, pas l'ancien.
  file.data.ranks.game = 'valorant';
  file.data.ranks.again = 'keep';
  const v = engine.viewers.file.data.list['tiktok:kenza'];
  v.rankShownAt = 0;
  engine.handle(ev('follow', { uid: 'kenza', name: 'Kenza' }));
  const again = sent.filter((x) => x.m.t === 'rank').pop().m.card;
  assert.ok(engine.games.rankPool(true).some((x) => x.id === again.rank.id), 'rang tiré dans Valorant');
  // Suivi suivant (plus de dix minutes après) : on remontre le même rang Valorant.
  v.rankShownAt = 0;
  engine.handle(ev('follow', { uid: 'kenza', name: 'Kenza' }));
  assert.equal(sent.filter((x) => x.m.t === 'rank').pop().m.card.rank.id, again.rank.id);
});

test('rangs : donner un rang précis, depuis l\'appli ou par la commande des modos', () => {
  const { file, engine, sent, replies, ev } = rig();
  file.data.ranks.game = 'valorant';
  const target = engine.games.rankPool(true).find((x) => /immortel/i.test(x.name)) || engine.games.rankPool(true)[3];
  const r = engine.games.giveRank('@Yanis', target.id);
  assert.equal(r.id, target.id);
  assert.equal(sent.filter((x) => x.m.t === 'rank').pop().m.card.rank.id, target.id);
  engine.handle(ev('chat', { text: `!donnerang @Lina ${target.name.slice(0, 4)}`, flags: { mod: true } }));
  const mod = { ...ev('chat', { text: `!donnerang @Lina ${target.name.slice(0, 4)}` }), user: { id: 'm', name: 'modo', display: 'Modo', mod: true } };
  engine.handle(mod);
  assert.ok(replies.some((t) => t.includes(`Lina reçoit le rang ${target.name}`)), replies.join(' | '));
});

test('TikTok : les gifts sans image prennent celle du catalogue', () => {
  const { engine, sent, ev } = rig();
  engine.gifts = [{ id: '5655', name: 'Rose', cost: 1, image: 'https://p16/rose.png' }];
  engine.handle(ev('gift', { value: 1, amount: 1, gift: { id: '5655', name: 'Rose', image: '' } }));
  const g = sent.find((x) => x.m.t === 'ev' && x.m.ev.type === 'gift').m.ev.gift;
  assert.equal(g.image, 'https://p16/rose.png');
});

test('Streamer.bot : l\'action part avec son nom et les infos de l\'événement', async () => {
  const { WebSocketServer } = require('ws');
  const { streamerBotAction } = require('../src/main/streamerbot');
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((r) => wss.on('listening', r));
  let got = null;
  wss.on('connection', (c) => c.on('message', (m) => { got = JSON.parse(String(m)); c.send(JSON.stringify({ id: got.id, status: 'ok' })); }));
  const ok = await streamerBotAction(`127.0.0.1:${wss.address().port}`, 'Confettis', { user: 'Lena', gift: 'Rose' });
  assert.equal(ok, true);
  assert.equal(got.request, 'DoAction');
  assert.equal(got.action.name, 'Confettis');
  assert.equal(got.args.user, 'Lena');
  await assert.rejects(streamerBotAction('127.0.0.1:1', 'X', {}, { timeout: 800 }));
  wss.close();
});

test('derniers événements et bienvenue : les overlays reçoivent les bonnes infos', () => {
  const { engine, sent, ev, file } = rig();
  engine.handle(ev('gift', { value: 15, amount: 3, gift: { id: 'g', name: 'Rose', image: 'https://p16/rose.png' } }));
  engine.handle(ev('follow', { uid: 'kenza', name: 'Kenza' }));
  const last = sent.filter((x) => x.m.t === 'last').pop().m.last;
  assert.equal(last.gift.gift.image, 'https://p16/rose.png');
  assert.equal(last.follow.name, 'Kenza');
  assert.ok(file.data.lastEvents.gift);
  engine.server.hasClient = (t) => t === 'welcome';
  engine.handle(ev('chat', { uid: 'yanis', name: 'Yanis', text: 'salut' }));
  engine.handle(ev('chat', { uid: 'yanis', name: 'Yanis', text: 'encore' }));
  const w = sent.filter((x) => x.m.t === 'welcome');
  assert.equal(w.length, 1, 'une seule bienvenue par live');
  assert.equal(w[0].m.who.name, 'Yanis');
  clearTimeout(engine.lastSaveT);
});

test('catalogue TikTok : liste officielle normalisée, images gardées sur le PC et données aux overlays', async () => {
  const fs = require('fs');
  const path = require('path');
  const { GiftCatalog, normalizeList } = require('../src/main/giftcatalog');
  const list = normalizeList([
    { id: 11046, name: 'Galaxie', diamond_count: 1000, image: { url_list: ['https://p16/galaxy.png'] } },
    { id: 5655, name: 'Rose', diamondCount: 1, image: { urlList: ['https://p16/rose.webp'] } },
    { id: 5655, name: 'Rose', diamondCount: 1, image: { urlList: [] } },
    { name: 'sans id' },
  ]);
  assert.deepEqual(list.map((g) => g.id), ['5655', '11046']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gifts-'));
  const state = { giftCache: [] };
  const png = Buffer.alloc(200, 7);
  const fetchImpl = async (url) => (/gift\/list/.test(url)
    ? { ok: true, json: async () => ({ data: { gifts: [{ id: 11046, name: 'Galaxie', diamond_count: 1000, image: { url_list: ['https://p16/galaxy.png'] } }] } }) }
    : { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => png });
  const cat = new GiftCatalog({ dir, state: () => state, save() {}, fetchImpl });
  const got = await cat.refresh({ sources: [async () => { throw new Error('pas de live'); }] });
  assert.equal(got[0].name, 'Galaxie');
  assert.equal(got[0].file, '11046.png');
  assert.ok(fs.existsSync(path.join(dir, '11046.png')));
  assert.equal(cat.localUrl(got[0]), '/gifts/11046.png');
  // Un événement « Galaxie » sans image (ou avec l'adresse TikTok) prend l'image gardée sur le PC.
  const { engine, sent, ev } = rig();
  engine.catalog = cat;
  engine.gifts = got;
  engine.handle(ev('gift', { value: 1000, amount: 1, gift: { id: '11046', name: 'Galaxie', image: '' } }));
  assert.equal(sent.find((x) => x.m.t === 'ev' && x.m.ev.type === 'gift').m.ev.gift.image, '/gifts/11046.png');
});

test('le chat joue : vote, le plus demandé lance son action ; chaos limité par seconde', async () => {
  const { file, engine, ev } = rig();
  const pressed = [];
  engine.pressKey = (k) => pressed.push(k);
  Object.assign(file.data.chatPlays, { enabled: true, mode: 'vote', voteSeconds: 2, userCooldown: 0 });
  engine.handle(ev('chat', { uid: 'a', name: 'A', text: 'saute' }));
  engine.handle(ev('chat', { uid: 'b', name: 'B', text: '!saute' }));
  engine.handle(ev('chat', { uid: 'c', name: 'C', text: 'gauche' }));
  assert.equal(engine.play.tallies()[file.data.chatPlays.commands.find((x) => x.word === 'saute').id], 2);
  engine.play.endRound();
  assert.deepEqual(pressed, ['Space']);
  file.data.chatPlays.mode = 'chaos';
  file.data.chatPlays.maxPerSecond = 2;
  for (const u of ['d', 'e', 'f']) engine.handle(ev('chat', { uid: u, name: u, text: 'droite' }));
  assert.deepEqual(pressed, ['Space', 'D', 'D']);
  engine.play.stop();
});

test('paris : mises en points, gagnants payés au prorata, annulation remboursée', () => {
  const { file, engine, ev } = rig();
  file.data.rewards.perMessage = 0;
  const list = engine.viewers.file.data.list;
  for (const [u, pts] of [['a', 500], ['b', 300], ['c', 200]]) list[`tiktok:${u}`] = { name: u, points: pts, coins: 0, messages: 0, likes: 0, gifts: 0, follows: 0 };
  engine.play.predictionOpen({ question: 'On gagne ?', options: ['Oui', 'Non'], seconds: 0 });
  engine.handle(ev('chat', { uid: 'a', name: 'a', text: '!parier 1 100' }));
  engine.handle(ev('chat', { uid: 'b', name: 'b', text: '!parier 1 300' }));
  engine.handle(ev('chat', { uid: 'c', name: 'c', text: '!parier 2 tout' }));
  assert.equal(list['tiktok:a'].points, 400);
  assert.equal(list['tiktok:c'].points, 0);
  const v = engine.play.predictionView();
  assert.equal(v.total, 600);
  engine.play.predictionResolve(0);
  assert.equal(list['tiktok:a'].points, 400 + 150);
  assert.equal(list['tiktok:b'].points, 0 + 450);
  assert.equal(list['tiktok:c'].points, 0);
  engine.play.predictionOpen({ question: 'Top 1 ?', options: ['Oui', 'Non'], seconds: 0 });
  engine.handle(ev('chat', { uid: 'a', name: 'a', text: '!parier 2 50' }));
  engine.play.predictionCancel();
  assert.equal(list['tiktok:a'].points, 550);
  engine.play.stop();
});

test('plinko : un cadeau lâche une balle par cadeau, la mise en points est multipliée par la case', async () => {
  const { file, engine, sent, ev } = rig();
  const { STEP_MS } = require('../src/main/plinko');
  file.data.rewards.perMessage = 0;
  file.data.plinko.enabled = true;
  file.data.plinko.rows = 8;
  file.data.plinko.bins = require('../src/shared/plinko-bins').defaultBins(9);
  engine.handle(ev('gift', { value: 3, amount: 3, gift: { id: 'g', name: 'Rose', cost: 1 } }));
  const drops = sent.filter((x) => x.m.t === 'plinko' && x.m.drop);
  assert.equal(drops.length, 3);
  for (const d of drops) { assert.equal(d.m.drop.path.length, 8); assert.equal(d.m.drop.bin, d.m.drop.path.reduce((n, x) => n + x, 0)); }
  // Mise : tout tombe dans la case du centre (chances choisies).
  file.data.plinko.mode = 'weights';
  file.data.plinko.bins.forEach((b, i) => { b.weight = i === 4 ? 1 : 0; b.mult = i === 4 ? 2 : 0; });
  const list = engine.viewers.file.data.list;
  list['tiktok:z'] = { name: 'z', points: 300, coins: 0, messages: 0, likes: 0, gifts: 0, follows: 0 };
  engine.plinko.inFlight = 0;
  engine.handle(ev('chat', { uid: 'z', name: 'z', text: '!plinko 100' }));
  assert.equal(list['tiktok:z'].points, 200);
  const bet = sent.filter((x) => x.m.drop && x.m.drop.bet === 100)[0];
  assert.equal(bet.m.drop.bin, 4);
  await new Promise((r) => setTimeout(r, 8 * STEP_MS + 800));
  assert.equal(list['tiktok:z'].points, 400);
  engine.plinko.stop();
  engine.play.stop();
});

test('plinko : cases par défaut symétriques, la planche rend environ 90 % des mises', () => {
  const { defaultBins, naturalOdds } = require('../src/shared/plinko-bins');
  for (const rows of [8, 12, 16]) {
    const bins = defaultBins(rows + 1);
    const odds = naturalOdds(rows);
    assert.equal(bins.length, rows + 1);
    assert.deepEqual(bins.map((b) => b.mult), [...bins].reverse().map((b) => b.mult));
    const ev = bins.reduce((n, b, i) => n + b.mult * odds[i], 0);
    assert.ok(ev > 0.8 && ev < 1, `rendement ${ev}`);
  }
});

test('discord : refuse un faux lien, prépare l\'annonce et le récap', async () => {
  const { Discord, liveUrl } = require('../src/main/discord');
  assert.equal(Discord.valid('https://discord.com/api/webhooks/123456/abc_DEF-1'), true);
  assert.equal(Discord.valid('https://evil.example/api/webhooks/1/x'), false);
  assert.equal(liveUrl({ platform: 'tiktok', username: '@lena' }), 'https://www.tiktok.com/@lena/live');
  const { file, engine } = rig();
  file.data.accounts.push({ id: 'a', platform: 'twitch', label: 'Lena', channel: 'lena' });
  file.data.discord.mention = 'here';
  const p = engine.discord.livePayload();
  assert.match(p.content, /^@here 🔴/);
  assert.match(p.embeds[0].description, /twitch\.tv\/lena/);
  const posted = [];
  engine.vault.set('key:discordWebhook', 'https://discord.com/api/webhooks/1/x');
  const realFetch = global.fetch;
  global.fetch = async (url, o) => { posted.push({ url, body: JSON.parse(o.body) }); return { ok: true, status: 204 }; };
  file.data.discord.enabled = true;
  await engine.discord.onLiveStart();
  await engine.discord.onLiveStart();
  assert.equal(posted.length, 1);
  const r = engine.buildRecap();
  await engine.discord.onLiveEnd({ ...r, top: [{ name: 'Léna', points: 10 }] });
  assert.equal(posted.length, 2);
  assert.ok(posted[1].body.embeds[0].fields.some((f) => f.name === 'Meilleurs soutiens'));
  global.fetch = realFetch;
  engine.play.stop();
});

test('quoi de neuf : seulement les versions plus récentes que la dernière vue', () => {
  const { newerThan, CHANGELOG } = require('../src/shared/changelog');
  assert.deepEqual(newerThan('2.13.0', '2.14.0').map((c) => c.version), ['2.14.0']);
  assert.equal(newerThan('', CHANGELOG[0].version).length, CHANGELOG.length);
  assert.deepEqual(newerThan('2.14.0', '2.14.0'), []);
  // La publication automatique peut monter le dernier chiffre (2.14.0 → 2.14.1) : on compare 2.14.
  assert.equal(require('../package.json').version.split('.').slice(0, 2).join('.'), CHANGELOG[0].version.split('.').slice(0, 2).join('.'));
});

test('suivi = rang : passer en mode points ne remontre pas une carte à chaque spectateur déjà classé', () => {
  const { file, engine, sent, ev } = rig();
  file.data.ranks.enabled = true;
  file.data.ranks.game = 'valorant';
  const list = engine.viewers.file.data.list;
  list['tiktok:u1'] = { name: 'lena', points: 50, coins: 0, messages: 0, likes: 0, gifts: 0, follows: 1, rank: 'gold', rankGame: 'valorant', ranks: { valorant: 'gold' } };
  file.data.ranks.mode = 'points';
  const cards = () => sent.filter((x) => x.m.t === 'rank').length;
  engine.handle(ev('chat', { text: 'salut' }));
  engine.handle(ev('chat', { text: 'encore' }));
  assert.equal(cards(), 0);
  assert.ok(list['tiktok:u1'].ranks['points:valorant']);
  // Il monte vraiment de rang : une carte.
  list['tiktok:u1'].points = 5000;
  engine.handle(ev('chat', { text: 'gg' }));
  assert.equal(cards(), 1);
  engine.play.stop();
});
