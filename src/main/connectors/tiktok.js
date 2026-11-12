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
    image: first(gd.giftImage?.giftPictureUrl, gd.icon?.mUrls?.[0], gd.image?.mUrls?.[0], ex.image?.url_list?.[0], ex.icon?.url_list?.[0], ''),
    cost,
    count,
    streaking: type === 1 && !Number(d.repeatEnd),
  };
}

// Transforme un message brut en événement unifié (fonction pure, testée dans test/).
function normalize(kind, d) {
  switch (kind) {
    case 'chat': return { type: 'chat', user: normalizeUser(d.user), text: String(first(d.comment, d.content, '')) };
    case 'gift': {
      const gift = normalizeGift(d);
      if (gift.streaking) return { type: 'giftstreak', user: normalizeUser(d.user), gift, amount: gift.count };
      return { type: 'gift', user: normalizeUser(d.user), gift, amount: gift.count, value: gift.cost * gift.count };
    }
    case 'like': return { type: 'like', user: normalizeUser(d.user), amount: Number(first(d.likeCount, d.count, 1)) || 1, total: Number(first(d.totalLikeCount, d.total, 0)) || 0 };
    case 'follow': return { type: 'follow', user: normalizeUser(d.user) };
    case 'share': return { type: 'share', user: normalizeUser(d.user) };
    case 'emote': return null;
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
  constructor(account, { vault, signKey }) {
    super();
    this.account = account;
    this.vault = vault;
    this.signKey = signKey;
    this.conn = null;
    this.stopped = true;
    this.retry = null;
    this.failures = 0;
  }

  get username() { return String(this.account.username || '').replace(/^@/, '').trim(); }

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
    const conn = new TikTokLiveConnection(this.username, this.options());
    this.conn = conn;

    // Hors live, on vérifie directement chez TikTok, sans toucher au quota du service de connexion.
    const keep = IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute;
    IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
    let live = null;
    try { live = await conn.fetchIsLive(); } catch { live = null; } finally { IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = keep; }
    if (this.stopped || this.conn !== conn) return;
    if (live === false) {
      this.failures = 0;
      this.status('offline', 'Pas en live pour le moment');
      this.scheduleRetry(60000);
      return;
    }

    const on = (ev, kind) => conn.on(ev, (d) => {
      const out = normalize(kind, d);
      if (out) this.emit('event', out);
    });
    on(WebcastEvent.CHAT, 'chat');
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
    conn.on(WebcastEvent.STREAM_END, () => { this.status('offline', 'Le live est terminé'); this.scheduleRetry(); });
    conn.on(ControlEvent.DISCONNECTED, () => { if (!this.stopped) { this.status('offline', 'Connexion perdue'); this.scheduleRetry(); } });
    conn.on(ControlEvent.ERROR, (e) => { const m = String(e?.exception?.message || e?.message || e); if (!isOffline({ message: m })) this.emit('log', m); });

    try {
      await conn.connect();
      this.failures = 0;
      this.status('live');
      this.emit('log', `Connecté au live de @${this.username}`);
    } catch (err) {
      if (this.stopped) return;
      if (isOffline(err)) { this.failures = 0; this.status('offline', 'Pas en live pour le moment'); this.scheduleRetry(60000); return; }
      this.failures += 1;
      const wait = retryDelay(err, this.failures);
      this.emit('log', `${err?.constructor?.name || 'Erreur'} : ${String(err?.message || err).replace(/\s+/g, ' ').slice(0, 400)}`);
      this.status('error', frenchError(`${isRateLimit(err) ? 'rate ' : ''}${isSignError(err) ? 'sign ' : ''}${err?.message || err}`, wait));
      this.scheduleRetry(wait);
    }
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
    this.status('stopped');
  }

  canSend() { return Boolean(this.signKey && this.vault.get(`tiktok:${this.account.id}`)?.sessionId); }

  async send(text) {
    if (!this.canSend() || !this.conn) throw new Error('Pour répondre sur TikTok, ajoute ta clé Euler Stream et ta session dans la chaîne.');
    await this.conn.sendMessage(text);
  }

  async fetchGifts() {
    const { TikTokLiveConnection } = require('tiktok-live-connector');
    const conn = this.conn || new TikTokLiveConnection(this.username, this.options());
    const list = await conn.fetchAvailableGifts();
    return (Array.isArray(list) ? list : []).map((g) => ({
      id: String(g.id), name: g.name, cost: g.diamond_count ?? g.diamondCount ?? 0, image: g.image?.url_list?.[0] || g.icon?.url_list?.[0] || '',
    }));
  }
}

module.exports = { TikTokConnector, normalize, normalizeUser, normalizeGift, battleScores, frenchError, isOffline, socialIsFollow, retryDelay, isSignError, isRateLimit };
