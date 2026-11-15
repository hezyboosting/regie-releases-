const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const tiktok = require('../src/main/connectors/tiktok');
const twitch = require('../src/main/connectors/twitch');
const youtube = require('../src/main/connectors/youtube');
const { simplify } = require('../src/main/spotify');
const { Obs, authString } = require('../src/main/obs');
const { xinputToStandard } = require('../src/main/input');
const { generateOverlay, sanitize } = require('../src/main/ai');

test('TikTok : chat, avec les deux formes de données connues', () => {
  const a = tiktok.normalize('chat', { comment: 'salut', user: { uniqueId: 'lena', nickname: 'Léna', userId: '1', profilePicture: { url: ['http://a'] } } });
  assert.deepEqual([a.type, a.text, a.user.name, a.user.display, a.user.avatar], ['chat', 'salut', 'lena', 'Léna', 'http://a']);
  const b = tiktok.normalize('chat', { content: 'yo', user: { displayId: 'kenza', nickname: 'Kenza', userId: '2', avatarThumb: { mUrls: ['http://b'] } } });
  assert.deepEqual([b.text, b.user.name, b.user.avatar], ['yo', 'kenza', 'http://b']);
});

test('TikTok : un combo de cadeaux ne compte qu\'à la fin', () => {
  const base = { giftId: 5655, repeatCount: 7, user: { uniqueId: 'x' }, giftDetails: { giftName: 'Rose', giftType: 1, diamondCount: 1 } };
  assert.equal(tiktok.normalize('gift', { ...base, repeatEnd: 0 }).type, 'giftstreak');
  const end = tiktok.normalize('gift', { ...base, repeatEnd: 1 });
  assert.deepEqual([end.type, end.amount, end.value, end.gift.name], ['gift', 7, 7, 'Rose']);
  const single = tiktok.normalize('gift', { giftId: 1, repeatCount: 1, repeatEnd: 0, user: {}, giftDetails: { giftName: 'Lion', giftType: 2, diamondCount: 29999 } });
  assert.deepEqual([single.type, single.value], ['gift', 29999]);
});

test('TikTok : likes, spectateurs et scores de battle', () => {
  assert.deepEqual(tiktok.normalize('like', { likeCount: 15, totalLikeCount: 1200, user: {} }).total, 1200);
  assert.equal(tiktok.normalize('viewers', { viewerCount: 321 }).amount, 321);
  assert.deepEqual(tiktok.battleScores({ armies: { h1: { hostScore: 40 }, h2: { hostScore: 12 } } }), [{ hostId: 'h1', points: 40 }, { hostId: 'h2', points: 12 }]);
  assert.deepEqual(tiktok.battleScores({ battleItems: [{ hostUserId: 'h1', battleGroups: [{ points: 3 }, { points: 4 }] }] }), [{ hostId: 'h1', points: 7 }]);
});

test('Twitch : les événements EventSub deviennent des événements unifiés', () => {
  const chat = twitch.normalize('channel.chat.message', { chatter_user_id: '9', chatter_user_login: 'lena', chatter_user_name: 'Lena', message: { text: '!son' }, badges: [{ set_id: 'moderator' }, { set_id: 'subscriber' }], color: '#ff0000' });
  assert.deepEqual([chat.type, chat.text, chat.user.mod, chat.user.sub, chat.color], ['chat', '!son', true, true, '#ff0000']);
  assert.equal(twitch.normalize('channel.follow', { user_id: '1', user_login: 'a', user_name: 'A' }).type, 'follow');
  assert.equal(twitch.normalize('channel.subscribe', { is_gift: true }), null);
  assert.equal(twitch.normalize('channel.subscription.message', { user_name: 'A', cumulative_months: 14, tier: '2000', message: { text: 'merci' } }).months, 14);
  assert.deepEqual([twitch.normalize('channel.subscription.gift', { is_anonymous: true, total: 5 }).user.display, twitch.normalize('channel.subscription.gift', { is_anonymous: true, total: 5 }).amount], ['Anonyme', 5]);
  assert.equal(twitch.normalize('channel.cheer', { bits: 500, user_name: 'A', message: 'gg' }).amount, 500);
  const raid = twitch.normalize('channel.raid', { from_broadcaster_user_name: 'Grosse Chaîne', viewers: 42 });
  assert.deepEqual([raid.type, raid.amount, raid.user.display], ['raid', 42, 'Grosse Chaîne']);
  assert.equal(twitch.normalize('channel.channel_points_custom_reward_redemption.add', { user_name: 'A', reward: { title: 'Hydrate', cost: 100 } }).reward, 'Hydrate');
});

test('YouTube : API officielle et mode simple', () => {
  const author = { channelId: 'c', displayName: 'Nolan', isChatModerator: true, isChatSponsor: false, isChatOwner: false };
  assert.equal(youtube.normalizeApi({ snippet: { type: 'textMessageEvent', textMessageDetails: { messageText: 'yo' } }, authorDetails: author }).text, 'yo');
  const sc = youtube.normalizeApi({ snippet: { type: 'superChatEvent', superChatDetails: { amountMicros: '5000000', currency: 'EUR', amountDisplayString: '5,00 €', userComment: 'merci' } }, authorDetails: author });
  assert.deepEqual([sc.type, sc.value, sc.money, sc.text], ['superchat', 5, '5,00 €', 'merci']);
  assert.equal(youtube.normalizeApi({ snippet: { type: 'membershipGiftingEvent', membershipGiftingDetails: { giftMembershipsCount: 20 } }, authorDetails: author }).amount, 20);
  assert.equal(youtube.normalizeApi({ snippet: { type: 'chatEndedEvent' }, authorDetails: author }), null);
  const simple = youtube.normalizeSimple({ author: { name: 'Ana', channelId: 'x' }, message: [{ text: 'bon' }, { emojiText: ':)' }], isModerator: false, isMembership: true, isOwner: false });
  assert.deepEqual([simple.type, simple.text, simple.user.sub], ['chat', 'bon:)', true]);
  const sc2 = youtube.normalizeSimple({ author: { name: 'Ana' }, message: [], superchat: { amount: '€10,50', color: '#fff' } });
  assert.deepEqual([sc2.type, sc2.value], ['superchat', 10.5]);
});

test('Twitch : parcours complet contre un faux serveur (connexion, abonnements, reconnexion)', async () => {
  const subs = [];
  const sent = [];
  const api = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      assert.equal(req.headers['client-id'], 'cid');
      assert.equal(req.headers.authorization, 'Bearer tok');
      if (req.url === '/users') return res.end(JSON.stringify({ data: [{ id: '42', login: 'moi', display_name: 'Moi', profile_image_url: 'http://i' }] }));
      if (req.url.startsWith('/streams')) return res.end(JSON.stringify({ data: [{ viewer_count: 77 }] }));
      if (req.url === '/eventsub/subscriptions') { subs.push(JSON.parse(body)); res.statusCode = 202; return res.end('{}'); }
      if (req.url === '/chat/messages') { sent.push(JSON.parse(body)); return res.end('{}'); }
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => wss.once('listening', r));
  const wsPort = wss.address().port;
  const welcome = (id) => JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 10 } } });
  let conn = 0;
  const closed = [];
  wss.on('connection', (ws, req) => {
    conn += 1;
    const n = conn;
    ws.on('close', () => closed.push(n));
    ws.send(welcome(`s${n}`));
    if (n === 1) {
      setTimeout(() => ws.send(JSON.stringify({ metadata: { message_type: 'notification', subscription_type: 'channel.follow' }, payload: { event: { user_id: '7', user_login: 'lena', user_name: 'Lena' } } })), 80);
      setTimeout(() => ws.send(JSON.stringify({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: `ws://127.0.0.1:${wsPort}/rec` } } })), 160);
    }
    if (req.url === '/rec') setTimeout(() => ws.send(JSON.stringify({ metadata: { message_type: 'notification', subscription_type: 'channel.cheer' }, payload: { event: { bits: 100, user_name: 'Lena', user_id: '7', user_login: 'lena' } } })), 80);
  });
  const vault = { d: { 'twitch:a': { access: 'tok', refresh: 'r', expires: Date.now() + 3600000 } }, get(k) { return this.d[k]; }, set(k, v) { this.d[k] = v; } };
  const c = new twitch.TwitchConnector({ id: 'a', platform: 'twitch' }, { vault, clientId: 'cid', endpoints: { api: `http://127.0.0.1:${api.address().port}`, ws: `ws://127.0.0.1:${wsPort}/` } });
  const events = [];
  const states = [];
  c.on('event', (e) => events.push(e));
  c.on('status', (s) => states.push(s.state));
  await c.start();
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(states.includes('live'));
  assert.equal(subs.length, 12, 'douze abonnements EventSub');
  assert.ok(subs.every((s) => s.transport.method === 'websocket' && s.transport.session_id === 's1'), 'liés à la première session');
  assert.deepEqual(subs.find((s) => s.type === 'channel.follow').condition, { broadcaster_user_id: '42', moderator_user_id: '42' });
  assert.equal(subs.find((s) => s.type === 'channel.raid').condition.to_broadcaster_user_id, '42');
  assert.ok(events.some((e) => e.type === 'follow' && e.user.display === 'Lena'));
  assert.ok(events.some((e) => e.type === 'bits' && e.amount === 100), 'les événements continuent après la reconnexion');
  assert.ok(events.some((e) => e.type === 'viewers' && e.amount === 77));
  assert.ok(closed.includes(1), 'l\'ancien socket est fermé');
  await c.send('merci');
  assert.deepEqual(sent[0], { broadcaster_id: '42', sender_id: '42', message: 'merci' });
  c.stop();
  wss.close();
  api.close();
});

test('Spotify : conversion de l\'état du lecteur', () => {
  const s = simplify({ is_playing: true, progress_ms: 1000, device: { name: 'PC' }, item: { id: 't', uri: 'u', name: 'Titre', duration_ms: 5000, artists: [{ name: 'A' }, { name: 'B' }], album: { name: 'Al', images: [{ url: 'http://c' }] } } }, [{ id: 'n', name: 'Next', artists: [{ name: 'C' }] }]);
  assert.deepEqual([s.playing, s.track.title, s.track.artist, s.track.cover, s.queue[0].title], [true, 'Titre', 'A, B', 'http://c', 'Next']);
  assert.equal(simplify(null).track, null);
});

test('OBS : authentification et demande de scène contre un faux serveur', async () => {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => wss.once('listening', r));
  const salt = 'sel'; const challenge = 'defi';
  const expected = authString('secret', salt, challenge);
  const secret = crypto.createHash('sha256').update(`secret${salt}`).digest('base64');
  assert.equal(expected, crypto.createHash('sha256').update(secret + challenge).digest('base64'));
  const scenes = [];
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ op: 0, d: { rpcVersion: 1, authentication: { salt, challenge } } }));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.op === 1) { assert.equal(m.d.authentication, expected); ws.send(JSON.stringify({ op: 2, d: {} })); }
      if (m.op === 6) {
        if (m.d.requestType === 'SetCurrentProgramScene') scenes.push(m.d.requestData.sceneName);
        ws.send(JSON.stringify({ op: 7, d: { requestId: m.d.requestId, requestStatus: { result: true }, responseData: m.d.requestType === 'GetStreamStatus' ? { outputActive: true } : {} } }));
      }
    });
  });
  const obs = new Obs();
  obs.connect({ host: '127.0.0.1', port: wss.address().port, password: 'secret' });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(obs.state, 'connected');
  assert.equal(obs.streaming, true);
  await obs.setScene('Pause');
  assert.deepEqual(scenes, ['Pause']);
  obs.disconnect();
  wss.close();
});

test('Manette : XInput vers disposition standard', () => {
  const p = xinputToStandard({ wButtons: 0x1000 | 0x0001 | 0x0100, bLeftTrigger: 255, bRightTrigger: 0, sThumbLX: 32767, sThumbLY: 32767, sThumbRX: 0, sThumbRY: -32768 });
  assert.deepEqual([p.b[0], p.b[12], p.b[4], p.b[1], p.b[6]], [true, true, true, false, true]);
  assert.deepEqual([p.a[0], p.a[1], p.a[3]], [1, -1, 1]);
  assert.equal(p.lt, 1);
});

test('IA : la réponse est validée et nettoyée', async () => {
  const body = JSON.stringify({ name: 'Test', elements: [
    { kind: 'text', x: 10, y: 20, w: 300, h: 60, text: 'Salut {viewers}', color: '#FF0000', font: 'inconnue', size: 9999 },
    { kind: 'script', text: 'x' }, { kind: 'shape', x: 'a', fill: 'red;background:url(x)', radius: 5 },
  ] });
  const calls = [];
  const fetchImpl = async (u, o) => { calls.push([u, o]); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: `Voici : ${body}` }] }) }; };
  const out = await generateOverlay({ key: 'k', prompt: 'un bandeau', fetchImpl });
  assert.equal(out.elements.length, 2);
  assert.equal(out.elements[0].font, 'geist');
  assert.equal(out.elements[0].size, 300);
  assert.equal(out.elements[1].fill, '#171230');
  assert.equal(out.elements[1].x, 100);
  assert.equal(calls[0][1].headers['x-api-key'], 'k');
  assert.equal(calls[0][1].headers['anthropic-version'], '2023-06-01');
  await assert.rejects(generateOverlay({ key: '', prompt: 'x', fetchImpl }), /clé API/);
  await assert.rejects(generateOverlay({ key: 'k', prompt: 'x', fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) }), /pas valide/);
  assert.throws(() => sanitize({ elements: [{ kind: 'script' }] }), /exploitable/);
});

test('OBS : scènes, sources, clips de replay et changement de scène suivi', async () => {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => wss.once('listening', r));
  const asked = [];
  let sock;
  wss.on('connection', (ws) => {
    sock = ws;
    ws.send(JSON.stringify({ op: 0, d: { rpcVersion: 1 } }));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.op === 1) ws.send(JSON.stringify({ op: 2, d: {} }));
      if (m.op !== 6) return;
      asked.push(m.d.requestType);
      const data = { GetSceneList: { currentProgramSceneName: 'Jeu', scenes: [{ sceneName: 'Pause' }, { sceneName: 'Jeu' }] }, GetSceneItemList: { sceneItems: [{ sceneItemId: 1, sourceName: 'Cam', sceneItemEnabled: true }] }, GetSceneItemId: { sceneItemId: 1 }, GetSceneItemEnabled: { sceneItemEnabled: true }, GetLastReplayBufferReplay: { savedReplayPath: 'C:/clip.mp4' }, GetSourceScreenshot: { imageData: 'data:image/jpeg;base64,xx' } }[m.d.requestType] || {};
      ws.send(JSON.stringify({ op: 7, d: { requestId: m.d.requestId, requestStatus: { result: true }, responseData: data } }));
    });
  });
  const obs = new Obs();
  obs.connect({ host: '127.0.0.1', port: wss.address().port, password: '' });
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(await obs.scenes(), { current: 'Jeu', scenes: ['Jeu', 'Pause'] });
  assert.equal((await obs.sources('Jeu'))[0].name, 'Cam');
  await obs.toggleSource('Jeu', 'Cam');
  assert.ok(asked.includes('SetSceneItemEnabled'));
  await obs.saveReplay();
  assert.equal(await obs.lastReplay(), 'C:/clip.mp4');
  assert.match(await obs.thumbnail('Jeu'), /^data:image/);
  const changed = new Promise((r) => obs.once('scene', r));
  sock.send(JSON.stringify({ op: 5, d: { eventType: 'CurrentProgramSceneChanged', eventData: { sceneName: 'Pause' } } }));
  assert.equal(await changed, 'Pause');
  obs.disconnect();
  wss.close();
});

test('TikTok : un follow se reconnaît même si TikTok change sa clé d\'affichage', () => {
  const { socialIsFollow } = require('../src/main/connectors/tiktok');
  assert.equal(socialIsFollow({ common: { displayText: { key: 'pm_main_follow_message_viewer_2' } } }), true);
  assert.equal(socialIsFollow({ common: { displayText: { key: 'nouvelle_cle', defaultPattern: '{0:user} a suivi l\'hôte' } } }), true);
  assert.equal(socialIsFollow({ action: '1', common: { displayText: { key: 'inconnue' } } }), true);
  assert.equal(socialIsFollow({ followType: 1 }), true);
  assert.equal(socialIsFollow({ action: '3', common: { displayText: { key: 'pm_mt_guidance_share' } } }), false);
  assert.equal(socialIsFollow({ action: '1', common: { displayText: { key: 'x', defaultPattern: '{0:user} shared the LIVE' } } }), false);
  assert.equal(socialIsFollow({}), false);
});

test('TikTok : les essais ratés s\'espacent pour ne pas épuiser la limite gratuite', () => {
  const { retryDelay, frenchError, isSignError } = require('../src/main/connectors/tiktok');
  const plain = new Error('boom');
  assert.deepEqual([1, 2, 3, 4, 5, 9].map((n) => retryDelay(plain, n) / 1000), [60, 120, 300, 600, 900, 900]);
  class SignatureRateLimitError extends Error {}
  const limited = Object.assign(new SignatureRateLimitError('[Rate Limited] Too many connections'), { retryAfter: 0 });
  assert.equal(retryDelay(limited, 1), 120000, 'jamais moins de 2 minutes après une limite');
  limited.retryAfter = 1800000;
  assert.equal(retryDelay(limited, 1), 1800000, 'on respecte l\'attente demandée');
  limited.retryAfter = 99999999;
  assert.equal(retryDelay(limited, 1), 3600000, 'une heure au plus');
  assert.ok(isSignError(limited));
  assert.ok(isSignError(new Error('[Sign Error] Unexpected status')));
  assert.ok(!isSignError(plain));
  assert.match(frenchError('rate sign x', 600000), /^Limite gratuite de connexion TikTok atteinte sur ce réseau\. Nouvel essai à \d{2}:\d{2}\.$/);
  assert.match(frenchError('sign x', 60000), /ne répond pas\. Nouvel essai dans une minute\./);
});

test('TikTok : hors live, aucun appel au service de connexion ; en cas de limite, attente et message clair', async () => {
  const { EventEmitter } = require('events');
  const lib = require.resolve('tiktok-live-connector');
  const saved = require.cache[lib];
  const calls = { connect: 0, skip: [] };
  let live = false;
  let fail = null;
  class SignatureRateLimitError extends Error {}
  const IsLiveRouteConfig = { skipFetchRoomIdFromEulerRoute: false };
  class TikTokLiveConnection extends EventEmitter {
    async fetchIsLive() { calls.skip.push(IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute); if (live === 'boom') throw new Error('html bloqué'); return live; }
    async connect() { calls.connect += 1; if (fail) throw fail; }
    disconnect() {}
  }
  require.cache[lib] = { id: lib, filename: lib, loaded: true, exports: { TikTokLiveConnection, WebcastEvent: {}, ControlEvent: {}, IsLiveRouteConfig } };
  const { TikTokConnector } = require('../src/main/connectors/tiktok');
  const run = async () => {
    const c = new TikTokConnector({ id: 'a', username: '@hezy' }, { vault: { get: () => null } });
    const seen = [];
    c.on('status', (s) => seen.push(s));
    c.on('log', () => {});
    let waited = null;
    c.scheduleRetry = (w) => { waited = w; };
    await c.start();
    c.stop();
    return { last: seen.filter((s) => s.state !== 'stopped').pop(), waited };
  };
  try {
    let r = await run();
    assert.equal(r.last.state, 'offline');
    assert.equal(calls.connect, 0, 'pas de connexion signée hors live');
    assert.deepEqual(calls.skip, [true], 'vérification sans le service de connexion');
    assert.equal(IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute, false, 'réglage global remis en place');
    live = true;
    fail = Object.assign(new SignatureRateLimitError('[Rate Limited] too many'), { retryAfter: 600000 });
    r = await run();
    assert.equal(calls.connect, 1);
    assert.equal(r.last.state, 'error');
    assert.match(r.last.detail, /Limite gratuite/);
    assert.equal(r.waited, 600000);
    live = 'boom';
    fail = null;
    r = await run();
    assert.equal(calls.connect, 2, 'statut inconnu : on tente quand même');
    assert.equal(r.last.state, 'live');
  } finally {
    if (saved) require.cache[lib] = saved; else delete require.cache[lib];
  }
});

test('TikTok : le cadeau garde sa vraie image avec le format actuel de la bibliothèque (image.urlList)', () => {
  const ev = tiktok.normalize('gift', {
    user: { displayId: 'lena', nickname: 'Lena', avatarThumb: { urlList: ['https://p16/avatar.webp'] } },
    giftId: '5655', repeatCount: 3, repeatEnd: 1,
    gift: { id: '5655', name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['https://p16/rose.png'] }, icon: { urlList: ['https://p16/rose-icon.png'] } },
  });
  assert.equal(ev.type, 'gift');
  assert.equal(ev.gift.name, 'Rose');
  assert.equal(ev.gift.image, 'https://p16/rose.png');
  assert.equal(ev.user.avatar, 'https://p16/avatar.webp');
  assert.equal(ev.value, 3);
});

test('écrire sur TikTok et Kick passe par le compte connecté dans Régie quand il n\'y a pas de clé Euler', async () => {
  const { TikTokConnector } = require('../src/main/connectors/tiktok');
  const { KickConnector } = require('../src/main/connectors/kick');
  const sent = [];
  const webchat = { logged: { tiktok: false, kick: false }, send: async (site, user, text) => { sent.push([site, user, text]); return true; } };
  const vault = { get: () => null };
  const tt = new TikTokConnector({ id: 't', platform: 'tiktok', username: '@lena' }, { vault, signKey: '', webchat });
  const kk = new KickConnector({ id: 'k', platform: 'kick', username: 'lena' }, { webchat });
  assert.equal(tt.canSend(), false);
  assert.match(tt.sendHint(), /Écrire dans le chat/);
  await assert.rejects(() => tt.send('salut'), /connecte ton compte/i);
  webchat.logged.tiktok = true;
  webchat.logged.kick = true;
  assert.equal(tt.canSend(), true);
  assert.equal(kk.canSend(), true);
  await tt.send('salut');
  await kk.send('yo');
  assert.deepEqual(sent, [['tiktok', 'lena', 'salut'], ['kick', 'lena', 'yo']]);
});

test('TikTok : les emotes ne sont plus perdues (message fait d\'une emote, emote au milieu d\'un message)', () => {
  const { normalize } = require('../src/main/connectors/tiktok');
  const user = { uniqueId: 'lena', nickname: 'Léna' };
  const sticker = normalize('emote', { user, emoteList: [{ emoteId: '42', image: { urlList: ['https://p16.tiktokcdn.com/emote42.png'] } }] });
  assert.equal(sticker.type, 'chat');
  assert.equal(sticker.text, '');
  assert.deepEqual(sticker.emotes, [{ i: 0, url: 'https://p16.tiktokcdn.com/emote42.png', id: '42' }]);
  const mixed = normalize('chat', { user, comment: 'gg  bien joué', emotes: [{ index: 3, emote: { emoteId: '7', image: { urlList: ['https://x/e7.png'] } } }] });
  assert.equal(mixed.text, 'gg  bien joué');
  assert.equal(mixed.emotes[0].i, 3);
  assert.equal(normalize('emote', { user, emoteList: [] }), null);
  assert.equal(normalize('chat', { user, comment: 'salut' }).emotes, undefined);
});

// ---------- 2.17 : messages perdus selon le compte qui écrit ----------
// Encode de vrais paquets TikTok (même format que la page du live) avec le schéma de la bibliothèque.
async function tiktokProto() {
  const path = require('path');
  const { pathToFileURL } = require('url');
  const root = require.resolve('tiktok-live-connector').split(`${path.sep}tiktok-live-connector${path.sep}`)[0];
  const P = await import(pathToFileURL(path.join(root, 'tiktok-live-proto', 'dist', 'node', 'v3.js')).href);
  const mk = (T, part) => Object.assign(T.decode(new Uint8Array(0)), part);
  const chat = (id, name, text, at = Date.now()) => mk(P.BaseProtoMessage, {
    method: 'WebcastChatMessage', msgId: id,
    payload: Buffer.from(P.WebcastChatMessage.encode(mk(P.WebcastChatMessage, {
      common: mk(P.CommonMessageData, { method: 'WebcastChatMessage', msgId: id, createTime: String(at) }),
      user: mk(P.User, { id: `9${id}`, displayId: name, nickname: name.toUpperCase(), avatarThumb: mk(P.ImageModel, { urlList: [`https://p16/${name}.jpg`] }) }),
      content: text,
    })).finish()),
  });
  const result = (messages, now = Date.now()) => Buffer.from(P.ProtoMessageFetchResult.encode(mk(P.ProtoMessageFetchResult, { messages, now: String(now) })).finish());
  const frame = (messages) => Buffer.from(P.WebcastPushFrame.encode(mk(P.WebcastPushFrame, { payloadEncoding: 'pb', payloadType: 'msg', payload: require('zlib').gzipSync(result(messages)) })).finish());
  return { P, mk, chat, result, frame };
}

test('TikTok : les paquets lus par la page du live donnent les messages du chat (historique écarté)', async () => {
  const { chat, frame, result, mk, P } = await tiktokProto();
  const old = Date.now() - 5 * 60000;
  const hist = chat('11', 'ancien', 'déjà vu');
  hist.isHistory = true;
  const gift = mk(P.BaseProtoMessage, { method: 'WebcastGiftMessage', msgId: '12', payload: Buffer.alloc(0) });
  const items = await tiktok.decodeReaderPacket('ws', frame([chat('10', 'nouveaucompte', 'tu me vois ?'), hist, chat('13', 'vieux', 'il y a 5 min', old), gift]));
  assert.equal(items.length, 1);
  const ev = tiktok.normalize(items[0].kind, items[0].data);
  assert.deepEqual([ev.type, ev.text, ev.user.name, ev.user.display, ev.user.avatar, ev.user.id], ['chat', 'tu me vois ?', 'nouveaucompte', 'NOUVEAUCOMPTE', 'https://p16/nouveaucompte.jpg', '910']);
  // Même chose par le relevé HTTP de secours de la page.
  const viaFetch = await tiktok.decodeReaderPacket('fetch', result([chat('14', 'autre', 'salut')]));
  assert.equal(viaFetch[0].data.content, 'salut');
});

test('TikTok : un message arrivé par la lecture anonyme et par ton compte ne s\'affiche qu\'une fois', async () => {
  const { chat, frame, P } = await tiktokProto();
  const webchat = { logged: { tiktok: true }, watch: (site, user, opts) => { webchat.opts = opts; return { stop() {}, poke() {} }; } };
  const c = new tiktok.TikTokConnector({ id: 'a1', username: '@moi' }, { vault: { get: () => null }, webchat });
  const out = [];
  c.on('event', (e) => out.push(e));
  c.stopped = false;
  c.startReader();
  assert.ok(webchat.opts, 'la lecture avec le compte démarre par défaut');
  // Lecture anonyme : message de A.
  const a = P.WebcastChatMessage.decode(chat('100', 'compteA', 'message A').payload);
  if (c.fresh('chat', a, 'anonyme')) out.push(tiktok.normalize('chat', a));
  // La page du live reçoit A (doublon) et B (que la lecture anonyme n'a jamais eu).
  await webchat.opts.onData('ws', frame([chat('100', 'compteA', 'message A'), chat('101', 'compteB', 'message B')]));
  await webchat.opts.onData('ws', frame([chat('101', 'compteB', 'message B')]));
  assert.deepEqual(out.map((e) => e.text), ['message A', 'message B']);
  assert.deepEqual(c.readerInfo(), { state: 'starting', count: 3, extra: 1 });
  // B arrive ensuite aussi en anonyme : pas de doublon, et il ne compte plus comme récupéré.
  const b = P.WebcastChatMessage.decode(chat('101', 'compteB', 'message B').payload);
  assert.equal(c.fresh('chat', b, 'anonyme'), false);
  assert.equal(c.readerInfo().extra, 0);
  // Coupée par l'utilisateur, la lecture ne redémarre pas.
  c.stopReader();
  c.account.fullChat = false;
  webchat.opts = null;
  c.startReader();
  assert.equal(webchat.opts, null);
  assert.equal(c.readerInfo().state, 'off');
});

test('TikTok : sans identifiant, le même texte du même compte n\'est écarté que quelques secondes', () => {
  const seen = new tiktok.Seen({ textMs: 1000 });
  const d = { user: { id: '5' }, content: 'gg' };
  assert.equal(seen.check('chat', d, 'anonyme', 0), null);
  assert.ok(seen.check('chat', d, 'compte', 500));
  assert.equal(seen.check('chat', d, 'anonyme', 5000), null, 'le spectateur peut réécrire « gg » plus tard');
  assert.equal(seen.check('chat', { ...d, user: { id: '6' } }, 'anonyme', 5000), null, 'un autre compte qui écrit pareil passe');
});

test('YouTube : le mode simple lit « Chat en direct » (tous les messages) et pas « Chat principal »', () => {
  const data = { contents: { liveChatRenderer: { continuations: [{ reloadContinuationData: { continuation: 'TOP' } }], header: { liveChatHeaderRenderer: { viewSelector: { sortFilterSubMenuRenderer: { subMenuItems: [
    { title: 'Chat principal', selected: true, continuation: { reloadContinuationData: { continuation: 'TOP' } }, subtitle: 'Certains messages, comme le spam potentiel, peuvent ne pas être visibles' },
    { title: 'Chat en direct', selected: false, continuation: { reloadContinuationData: { continuation: 'ALL"\\]x' } }, subtitle: 'Tous les messages sont visibles' },
  ] } } } } } } };
  const html = `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
  assert.equal(youtube.liveChatContinuation(html), 'ALL"\\]x');
  assert.equal(youtube.liveChatContinuation('<html>rien</html>'), '');
  // Un menu de tri des commentaires ne se confond pas avec celui du chat.
  const comments = `"sortFilterSubMenuRenderer":{"subMenuItems":[{"title":"Top"},{"title":"Récents","serviceEndpoint":{}}]}`;
  assert.equal(youtube.liveChatContinuation(comments + html), 'ALL"\\]x');
});

test('YouTube : le correctif lit « Chat en direct », marque l\'historique et évite les relevés qui se chevauchent', async () => {
  const requests = require('youtube-chat/dist/requests');
  const parser = require('youtube-chat/dist/parser');
  const keep = { chat: requests.fetchChat, page: requests.fetchLivePage, opts: parser.getOptionsFromLivePage };
  let calls = 0;
  let release;
  requests.fetchChat = async (o) => { calls += 1; if (calls === 2) await new Promise((r) => { release = r; }); return [[{ id: `m${calls}` }], `${o.continuation}+`]; };
  requests.fetchLivePage = async () => ({ liveId: 'abc', continuation: 'ALL', allChat: true });
  try {
    youtube.patchYoutubeChat();
    const page = '<link rel="canonical" href="https://www.youtube.com/watch?v=abc">"INNERTUBE_API_KEY":"k","clientVersion":"2.2024","continuation":"TOP",'
      + '"sortFilterSubMenuRenderer":{"subMenuItems":[{"selected":true,"continuation":{"reloadContinuationData":{"continuation":"TOP"}}},{"selected":false,"continuation":{"reloadContinuationData":{"continuation":"ALL"}}}]}';
    const opts = parser.getOptionsFromLivePage(page);
    assert.deepEqual([opts.continuation, opts.allChat], ['ALL', true]);
    const o = await requests.fetchLivePage({ handle: '@x' });
    const [first] = await requests.fetchChat(o);
    assert.equal(first[0].history, true, 'le premier relevé est l\'historique');
    const slow = requests.fetchChat(o);
    const overlap = await requests.fetchChat(o);
    assert.deepEqual(overlap, [[], o.continuation], 'pas de second relevé tant que le précédent n\'est pas revenu');
    release();
    const [second] = await slow;
    assert.equal(second[0].history, undefined, 'les relevés suivants ne sont jamais filtrés');
    assert.equal(calls, 2);
  } finally {
    Object.assign(requests, { fetchChat: keep.chat, fetchLivePage: keep.page });
    parser.getOptionsFromLivePage = keep.opts;
  }
});

test('Twitch : « /me » n\'affiche plus les caractères de contrôle', () => {
  const { parseIrc, normalizeIrc } = require('../src/main/connectors/twitch-irc');
  const ev = normalizeIrc(parseIrc('@display-name=Bob;user-id=1 :bob!bob@bob.tmi.twitch.tv PRIVMSG #chan :\u0001ACTION danse\u0001'));
  assert.deepEqual([ev.type, ev.text, ev.action], ['chat', 'danse', true]);
  assert.equal(normalizeIrc(parseIrc(':bob!bob@bob.tmi.twitch.tv PRIVMSG #chan :salut')).text, 'salut');
});
