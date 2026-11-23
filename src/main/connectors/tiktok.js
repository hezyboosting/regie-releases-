// TikTok LIVE via tiktok-live-connector (bibliothèque non officielle : TikTok n'a pas d'API publique pour ça).
const { EventEmitter } = require('events');

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');

function normalizeUser(u = {}) {
  const name = first(u.uniqueId, u.displayId, u.userId, 'inconnu');
  const avatar = first(u.profilePicture?.url?.[0], u.profilePicture?.urls?.[0], u.avatarThumb?.mUrls?.[0], u.avatarThumb?.urlList?.[0], u.avatarThumb?.url?.[0], '');
  return {
    id: String(first(u.userId, u.id, name)),
    name: String(name),
    display: String(first(u.nickname, u.nickName, name)),
    avatar,
    mod: Boolean(u.isModerator || u.userIdentity?.isModeratorOfAnchor),
    sub: Boolean(u.isSubscriber || u.userIdentity?.isSubscriberOfAnchor),
    vip: false,
    owner: false,
  };
}

function normalizeGift(d = {}) {
  const gd = first(d.giftDetails, d.gift, {});
  const ex = d.extendedGiftInfo || {};
  const type = Number(first(gd.giftType, gd.type, ex.type, 0));
  const count = Number(first(d.repeatCount, d.comboCount, 1)) || 1;
  const cost = Number(first(gd.diamondCount, ex.diamond_count, ex.diamondCount, 0)) || 0;
  return {
    id: String(first(d.giftId, gd.id, ex.id, '')),
    name: String(first(gd.giftName, gd.name, ex.name, 'Cadeau')),
    // La bibliothèque a changé de format au fil des versions : image.urlList (actuel), mUrls, url, url_list (catalogue).
    image: first(gd.image?.urlList?.[0], gd.giftImage?.urlList?.[0], gd.giftImage?.url?.[0], gd.giftImage?.giftPictureUrl, d.giftPictureUrl, gd.icon?.urlList?.[0],
      gd.image?.mUrls?.[0], gd.icon?.mUrls?.[0], gd.image?.url?.[0], gd.previewImage?.urlList?.[0], ex.image?.url_list?.[0], ex.icon?.url_list?.[0], ''),
    cost,
    count,
    streaking: type === 1 && !Number(d.repeatEnd),
  };
}

// Emotes TikTok : image et place dans le message (index en caractères, 0 = au début).
function emoteUrl(e) { return first(e?.image?.urlList?.[0], e?.image?.url?.[0], e?.image?.imageUrl, e?.image?.mUrls?.[0], ''); }
function inlineEmotes(d) {
  return (Array.isArray(d.emotes) ? d.emotes : []).map((x) => ({ i: Number(x.index ?? x.placeInComment) || 0, url: emoteUrl(x.emote), id: String(x.emote?.emoteId || '') })).filter((x) => x.url);
}

// Modérateur ou abonné : TikTok le dit sur le message (userIdentity), plus toujours sur le compte.
const withIdentity = (d) => (d.userIdentity && d.user ? { ...d.user, userIdentity: d.userIdentity } : d.user);

// Transforme un message brut en événement unifié (fonction pure, testée dans test/).
function normalize(kind, d) {
  switch (kind) {
    case 'chat': {
      const emotes = inlineEmotes(d);
      return { type: 'chat', user: normalizeUser(withIdentity(d)), text: String(first(d.comment, d.content, '')), ...(emotes.length ? { emotes } : {}) };
    }
    // Message fait uniquement d'une emote (autocollant d'abonné) : un message du chat comme les autres.
    case 'emote': {
      const list = (Array.isArray(d.emoteList) ? d.emoteList : d.emote ? [d.emote] : []).map((e) => ({ i: 0, url: emoteUrl(e), id: String(e?.emoteId || '') })).filter((x) => x.url);
      if (!list.length) return null;
      return { type: 'chat', user: normalizeUser(withIdentity(d)), text: '', emotes: list, sticker: true };
    }
    case 'gift': {
      const gift = normalizeGift(d);
      if (gift.streaking) return { type: 'giftstreak', user: normalizeUser(d.user), gift, amount: gift.count };
      return { type: 'gift', user: normalizeUser(d.user), gift, amount: gift.count, value: gift.cost * gift.count };
    }
    case 'like': return { type: 'like', user: normalizeUser(d.user), amount: Number(first(d.likeCount, d.count, 1)) || 1, total: Number(first(d.totalLikeCount, d.total, 0)) || 0 };
    case 'follow': return { type: 'follow', user: normalizeUser(d.user) };
    case 'share': return { type: 'share', user: normalizeUser(d.user) };
    case 'member': return { type: 'join', user: normalizeUser(d.user) };
    case 'superfan': return { type: 'superfan', user: normalizeUser(d.user) };
    case 'sub': return { type: 'sub', user: normalizeUser(d.user), months: Number(d.subMonth) || 1 };
    case 'viewers': return { type: 'viewers', amount: Number(first(d.viewerCount, d.total, 0)) || 0 };
    default: return null;
  }
}

// État d'une battle TikTok à partir de linkMicBattle et linkMicArmies.
function battleScores(d) {
  const out = [];
  for (const [hostId, group] of Object.entries(d.armies || {})) {
    out.push({ hostId, points: Number(first(group.hostScore, group.anchorScore, group.score, 0)) || 0 });
  }
  if (!out.length) {
    for (const item of d.battleItems || []) {
      out.push({ hostId: item.hostUserId, points: (item.battleGroups || []).reduce((n, g) => n + (Number(g.points) || 0), 0) });
    }
  }
  return out;
}

// ---------- Lecture avec ton compte ----------
// Les messages du chat arrivent par deux chemins : la lecture anonyme (bibliothèque) et la page de ton
// live ouverte avec ton compte (webchat.watch). Chaque message TikTok a un identifiant unique : on ne
// l'affiche qu'une fois, quel que soit le chemin qui l'apporte en premier.
const READER_KINDS = { WebcastChatMessage: 'chat', WebcastEmoteChatMessage: 'emote' };
const toMs = (v) => { const n = Number(v) || 0; return n && n < 1e11 ? n * 1000 : n; };

class Seen {
  constructor({ max = 4000, idMs = 10 * 60 * 1000, textMs = 8000 } = {}) { this.max = max; this.idMs = idMs; this.textMs = textMs; this.map = new Map(); }

  static key(kind, d = {}) {
    const id = String(d?.common?.msgId || '');
    if (id && id !== '0') return { key: `m:${id}`, byId: true };
    const u = d?.user || {};
    return { key: `t:${kind}:${first(u.id, u.userId, u.displayId, u.uniqueId, '')}:${first(d.comment, d.content, '')}`, byId: false };
  }

  // Renvoie l'entrée précédente si le message a déjà été vu, sinon l'enregistre et renvoie null.
  check(kind, d, src, now = Date.now()) {
    const { key, byId } = Seen.key(kind, d);
    const old = this.map.get(key);
    if (old && now - old.at < (byId ? this.idMs : this.textMs)) return old;
    this.map.set(key, { at: now, src });
    if (this.map.size > this.max) for (const k of [...this.map.keys()].slice(0, this.map.size - this.max)) this.map.delete(k);
    return null;
  }
}

// Paquet reçu par la page du live → messages du chat prêts à normaliser (fonction testée dans test/).
async function decodeReaderPacket(kind, buf) {
  const { deserializeWebSocketMessage, deserializeMessage } = require('tiktok-live-connector');
  const result = kind === 'ws' ? (await deserializeWebSocketMessage(buf))?.protoMessageFetchResult : deserializeMessage('ProtoMessageFetchResult', buf);
  if (!result) return [];
  const now = toMs(result.now);
  const out = [];
  for (const m of result.messages || []) {
    const k = READER_KINDS[m.method];
    const data = m.decodedData?.data;
    if (!k || !data || m.isHistory) continue;
    // Les anciens messages renvoyés au chargement de la page ne sont pas rejoués.
    const at = toMs(data.common?.createTime);
    if (now && at && now - at > 45000) continue;
    out.push({ kind: k, data });
  }
  return out;
}

// Repli si TikTok change la clé d'affichage d'un follow : le message social garde son action ou son type.
function socialIsFollow(d = {}) {
  const key = String(d.common?.displayText?.key || '').toLowerCase();
  const pattern = String(d.common?.displayText?.defaultPattern || '').toLowerCase();
  if (key.includes('share') || pattern.includes('share') || pattern.includes('partag')) return false;
  return key.includes('follow') || pattern.includes('follow') || pattern.includes('suivi') || String(d.action) === '1' || Number(d.followType) > 0;
}

const isOffline = (err) => /isn.t online|not online|offline|not live|has ended|UserOffline/i.test(`${err?.constructor?.name} ${err?.name} ${err?.message}`);

const LIMIT = 'Limite gratuite de connexion TikTok atteinte sur ce réseau';
const isSignError = (err) => /SignAPI|SignatureRateLimit|SignatureMissing|PremiumFeature/.test(err?.constructor?.name || err?.name || '') || /\[(Rate Limited|Sign Error|Empty Payload|Premium Feature)\]|sign server|eulerstream/i.test(err?.message || '');
const isRateLimit = (err) => err?.constructor?.name === 'SignatureRateLimitError' || /rate.?limit|429|too many/i.test(err?.message || '');
const clock = (ms) => new Date(Date.now() + ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Attente avant un nouvel essai : chaque essai raté consomme le quota gratuit, on espace donc de plus en plus.
const STEPS = [60, 120, 300, 600, 900].map((s) => s * 1000);
function retryDelay(err, failures, now = Date.now()) {
  const base = STEPS[Math.min(Math.max(failures - 1, 0), STEPS.length - 1)];
  if (!isRateLimit(err)) return base;
  const after = Number(err?.retryAfter) || 0;
  const reset = Number(err?.resetTime) ? Number(err.resetTime) - now : 0;
  return Math.min(Math.max(base, after, reset, 120000), 3600000);
}

function frenchError(msg, wait = 60000) {
  const at = wait > 90000 ? `Nouvel essai à ${clock(wait)}.` : 'Nouvel essai dans une minute.';
  if (/rate|429|too many/i.test(msg)) return `${LIMIT}. ${at}`;
  if (/sign|euler|api.?key|empty payload|premium/i.test(msg)) return `Le service de connexion TikTok ne répond pas. ${at}`;
  if (/room ?id|not found|user.*exist/i.test(msg)) return `Compte introuvable ou TikTok injoignable. ${at}`;
  return `Connexion TikTok impossible. ${at}`;
}

class TikTokConnector extends EventEmitter {
  constructor(account, { vault, signKey, webchat }) {
    super();
    this.account = account;
    this.vault = vault;
    this.signKey = signKey;
    this.webchat = webchat;
    this.conn = null;
    this.stopped = true;
    this.retry = null;
    this.failures = 0;
    this.live = null; // null : on ne sait pas (le relevé du live a échoué)
    this.seen = new Seen();
    this.reader = null;
    this.readerState = 'off';
    this.readerCount = 0; // messages lus par la page avec ton compte
    this.readerExtra = 0; // dont ceux que la lecture anonyme n'a jamais reçus
    this.readerErrors = 0;
  }

  get username() { return String(this.account.username || '').replace(/^@/, '').trim(); }

  // Activée par défaut dès que ton compte TikTok est connecté dans Régie ; tu peux la couper.
  get wantsReader() { return this.account.fullChat !== false; }

  // Un message ne passe qu'une fois, qu'il vienne de la lecture anonyme ou de ton compte.
  fresh(kind, d, src) {
    if (src === 'compte') this.readerCount += 1;
    const old = this.seen.check(kind, d, src);
    if (!old) { if (src === 'compte') { this.readerExtra += 1; this.emit('changed'); } return true; }
    // Arrivé d'abord par ton compte puis par la lecture anonyme : ce n'était pas un message manquant.
    if (src !== 'compte' && old.src === 'compte' && !old.matched) { old.matched = true; this.readerExtra = Math.max(0, this.readerExtra - 1); }
    return false;
  }

  startReader() {
    if (this.stopped || this.reader || !this.webchat?.watch || !this.wantsReader || !this.username) return;
    this.reader = this.webchat.watch('tiktok', this.username, {
      onData: (kind, buf) => this.onReaderData(kind, buf),
      // Statut inconnu (relevé refusé par TikTok) : la page s'ouvre quand même, elle saura si le live tourne.
      isLive: () => this.live !== false,
      onChange: (st) => { this.readerState = st; this.emit('changed'); },
    });
    this.readerState = 'starting';
    this.emit('changed');
  }

  stopReader() {
    try { this.reader?.stop(); } catch { /* déjà arrêtée */ }
    this.reader = null;
    this.readerState = 'off';
    this.emit('changed');
  }

  async onReaderData(kind, buf) {
    // Les compteurs du diagnostic se rafraîchissent dans Connexions toutes les 5 s au plus.
    if (Date.now() - (this.readerPushed || 0) > 5000) { this.readerPushed = Date.now(); this.emit('changed'); }
    let items;
    try { items = await decodeReaderPacket(kind, buf); } catch (e) {
      this.readerErrors += 1;
      if (this.readerErrors === 1 || this.readerErrors % 200 === 0) this.emit('log', `Lecture avec ton compte : paquet illisible (${String(e?.message || e).slice(0, 120)})`);
      return;
    }
    for (const it of items) {
      if (!this.fresh(it.kind, it.data, 'compte')) continue;
      const out = normalize(it.kind, it.data);
      if (out) this.emit('event', out);
    }
  }

  readerInfo() {
    if (!this.wantsReader) return { state: 'off', count: 0, extra: 0 };
    const state = this.webchat?.logged?.tiktok ? this.readerState : 'login';
    const page = this.reader?.info?.() || {};
    // Diagnostic affiché dans Connexions : page ouverte, connexion au chat, paquets, messages lus.
    return { state, count: this.readerCount, extra: this.readerExtra, page: Boolean(page.page), sockets: page.sockets || 0, frames: page.frames || 0, lastAt: page.last || 0, url: page.url || '', errors: this.readerErrors };
  }

  status(state, detail = '') { this.emit('status', { state, detail }); }

  options() {
    const opts = { processInitialData: false, enableExtendedGiftInfo: false, fetchRoomInfoOnConnect: true };
    if (this.signKey) opts.signApiKey = this.signKey;
    const session = this.vault.get(`tiktok:${this.account.id}`);
    if (session?.sessionId && session?.ttTargetIdc && this.signKey) {
      opts.authenticateWs = true;
      opts.session = { cookie: { type: 'cookie', value: { sessionId: session.sessionId, ttTargetIdc: session.ttTargetIdc } } };
    }
    return opts;
  }

  async start() {
    this.stopped = false;
    clearTimeout(this.retry);
    const { TikTokLiveConnection, WebcastEvent, ControlEvent, IsLiveRouteConfig } = require('tiktok-live-connector');
    this.status('connecting');
    const opts = this.options();
    // La page de ton live, ouverte avec ton compte, lit aussi le chat (voir webchat.watch).
    this.startReader();
    if (this.stopped) return;
    const conn = new TikTokLiveConnection(this.username, opts);
    this.conn = conn;

    // Hors live, on vérifie directement chez TikTok, sans toucher au quota du service de connexion.
    const keep = IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute;
    IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
    let live = null;
    try { live = await conn.fetchIsLive(); } catch { live = null; } finally { IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = keep; }
    if (this.stopped || this.conn !== conn) return;
    if (live !== null) this.setLive(live);
    if (live === false) {
      this.failures = 0;
      this.status('offline', 'Pas en live pour le moment');
      this.scheduleRetry(60000);
      return;
    }

    const on = (ev, kind) => conn.on(ev, (d) => {
      if ((kind === 'chat' || kind === 'emote') && !this.fresh(kind, d, 'anonyme')) return;
      const out = normalize(kind, d);
      if (out) this.emit('event', out);
    });
    on(WebcastEvent.CHAT, 'chat');
    on(WebcastEvent.EMOTE, 'emote');
    on(WebcastEvent.GIFT, 'gift');
    on(WebcastEvent.LIKE, 'like');
    on(WebcastEvent.FOLLOW, 'follow');
    on(WebcastEvent.SHARE, 'share');
    on(WebcastEvent.MEMBER, 'member');
    on(WebcastEvent.SUPER_FAN_JOIN, 'superfan');
    const unknown = new Set();
    conn.on('social', (d) => {
      if (socialIsFollow(d)) { this.emit('event', normalize('follow', d)); return; }
      const key = String(d?.common?.displayText?.key || d?.action || 'vide');
      if (!unknown.has(key) && unknown.size < 20) { unknown.add(key); this.emit('log', `Message social TikTok non reconnu : ${key}`); }
    });
    let seen = 0;
    conn.on(WebcastEvent.CHAT, () => { seen += 1; if (seen === 1) this.emit('log', 'Premier message du chat reçu'); });
    on(WebcastEvent.ROOM_USER, 'viewers');

    conn.on(WebcastEvent.LINK_MIC_BATTLE, (d) => this.emit('event', { type: 'battle', phase: 'start', battleId: String(d.battleId || ''), raw: { anchors: Object.values(d.anchorInfo || {}).map((a) => a.user?.displayId || a.user?.nickName).filter(Boolean) } }));
    conn.on(WebcastEvent.LINK_MIC_ARMIES, (d) => this.emit('event', { type: 'battle', phase: 'score', battleId: String(d.battleId || ''), raw: { scores: battleScores(d) } }));
    conn.on(WebcastEvent.STREAM_END, () => { this.setLive(false); this.status('offline', 'Le live est terminé'); this.scheduleRetry(); });
    conn.on(ControlEvent.DISCONNECTED, () => { if (!this.stopped) { this.status('offline', 'Connexion perdue'); this.scheduleRetry(); } });
    conn.on(ControlEvent.ERROR, (e) => { const m = String(e?.exception?.message || e?.message || e); if (!isOffline({ message: m })) this.emit('log', m); });

    try {
      await conn.connect();
      this.failures = 0;
      this.setLive(true);
      this.status('live');
      this.emit('log', `Connecté au live de @${this.username}`);
    } catch (err) {
      if (this.stopped) return;
      if (isOffline(err)) { this.setLive(false); this.failures = 0; this.status('offline', 'Pas en live pour le moment'); this.scheduleRetry(60000); return; }
      this.failures += 1;
      const wait = retryDelay(err, this.failures);
      this.emit('log', `${err?.constructor?.name || 'Erreur'} : ${String(err?.message || err).replace(/\s+/g, ' ').slice(0, 400)}`);
      // La lecture anonyme est refusée (limite du service de connexion…) mais le live tourne : la page
      // ouverte avec ton compte continue de lire le chat en attendant.
      this.status('error', frenchError(`${isRateLimit(err) ? 'rate ' : ''}${isSignError(err) ? 'sign ' : ''}${err?.message || err}`, wait));
      this.scheduleRetry(wait);
    }
  }

  setLive(on) {
    if (this.live === on) return;
    this.live = on;
    if (on) this.reader?.poke();
  }

  scheduleRetry(wait = 60000) {
    clearTimeout(this.retry);
    if (this.stopped) return;
    this.retry = setTimeout(() => { if (!this.stopped) { this.safeDisconnect(); this.start(); } }, wait);
  }

  safeDisconnect() {
    try { this.conn?.removeAllListeners?.(); Promise.resolve(this.conn?.disconnect?.()).catch(() => {}); } catch { /* déjà fermé */ }
    this.conn = null;
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.safeDisconnect();
    this.stopReader();
    this.live = null;
    this.status('stopped');
  }

  // Deux façons d'écrire : le service Euler Stream (clé payante + session), ou ton compte TikTok
  // connecté dans Régie (Connexions › Écrire dans le chat), qui tape le message sur la page de ton live.
  get viaEuler() { return Boolean(this.signKey && this.vault.get(`tiktok:${this.account.id}`)?.sessionId); }

  canSend() { return this.viaEuler || Boolean(this.webchat?.logged?.tiktok); }

  sendHint() { return this.canSend() ? '' : 'Connecte ton compte TikTok pour écrire (Connexions › Écrire dans le chat).'; }

  async send(text) {
    if (this.viaEuler && this.conn) {
      try { await this.conn.sendMessage(text); return; } catch (e) { if (!this.webchat?.logged?.tiktok) throw e; }
    }
    if (!this.webchat?.logged?.tiktok) throw new Error('Pour écrire sur TikTok, connecte ton compte dans Régie : Connexions › Écrire dans le chat.');
    await this.webchat.send('tiktok', this.username, text);
  }

  async fetchGifts() {
    const { TikTokLiveConnection } = require('tiktok-live-connector');
    const conn = this.conn || new TikTokLiveConnection(this.username, this.options());
    // Hors live, on retrouve d'abord la salle de la chaîne : TikTok donne son catalogue même sans direct.
    if (!conn.roomId) await conn.fetchRoomId();
    const list = await conn.fetchAvailableGifts();
    return (Array.isArray(list) ? list : []).map((g) => ({
      id: String(g.id), name: g.name, cost: g.diamond_count ?? g.diamondCount ?? 0, image: g.image?.url_list?.[0] || g.image?.urlList?.[0] || g.icon?.url_list?.[0] || g.icon?.urlList?.[0] || '',
    }));
  }
}

module.exports = { TikTokConnector, Seen, decodeReaderPacket, READER_KINDS, normalize, normalizeUser, normalizeGift, battleScores, frenchError, isOffline, socialIsFollow, retryDelay, isSignError, isRateLimit };
