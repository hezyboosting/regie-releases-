// YouTube en deux modes :
//  - « simple » : lecture du chat public sans clé (bibliothèque youtube-chat, non officielle, lecture seule) ;
//  - « api » : API officielle via OAuth, avec réponses et événements membres, soumise au quota Google.
const { EventEmitter } = require('events');
const crypto = require('crypto');
const http = require('http');

const API = 'https://www.googleapis.com/youtube/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const DAILY_QUOTA = 10000;
const QUOTA_MARGIN = 500;

// Connexion Google avec retour sur 127.0.0.1 et PKCE.
function oauthFlow({ clientId, clientSecret, openExternal }) {
  return new Promise((resolve, reject) => {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<meta charset=utf-8><body style="font:18px sans-serif;background:#262C33;color:#ECE8DE;display:grid;place-items:center;height:100vh;margin:0">Connexion reçue. Tu peux revenir dans Régie.</body>');
      server.close();
      clearTimeout(timeout);
      if (url.searchParams.get('state') !== state) return reject(new Error('Réponse Google invalide.'));
      if (!url.searchParams.get('code')) return reject(new Error('Connexion Google annulée.'));
      try {
        const redirect = `http://127.0.0.1:${server.address()?.port || port}`;
        const r = await fetch(TOKEN_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get('code'), code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirect }).toString(),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error_description || 'Google a refusé la connexion.');
        resolve({ access: d.access_token, refresh: d.refresh_token, expires: Date.now() + d.expires_in * 1000 });
      } catch (e) { reject(e); }
    });
    let port;
    const timeout = setTimeout(() => { server.close(); reject(new Error('Connexion Google expirée. Réessaie.')); }, 5 * 60000);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      const q = new URLSearchParams({
        client_id: clientId, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent',
        code_challenge: challenge, code_challenge_method: 'S256', state,
      });
      openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
    });
  });
}

// Événement de l'API officielle vers événement unifié (fonction pure, testée dans test/).
function normalizeApi(item) {
  const s = item.snippet || {};
  const a = item.authorDetails || {};
  const user = {
    id: a.channelId || '', name: a.displayName || 'Anonyme', display: a.displayName || 'Anonyme', avatar: a.profileImageUrl || '',
    mod: Boolean(a.isChatModerator), sub: Boolean(a.isChatSponsor), vip: false, owner: Boolean(a.isChatOwner),
  };
  const micros = (d) => (Number(d?.amountMicros) || 0) / 1e6;
  switch (s.type) {
    case 'textMessageEvent': return { type: 'chat', user, text: s.textMessageDetails?.messageText ?? s.displayMessage ?? '' };
    case 'superChatEvent': return { type: 'superchat', user, value: micros(s.superChatDetails), currency: s.superChatDetails?.currency, money: s.superChatDetails?.amountDisplayString, text: s.superChatDetails?.userComment || '' };
    case 'superStickerEvent': return { type: 'supersticker', user, value: micros(s.superStickerDetails), currency: s.superStickerDetails?.currency, money: s.superStickerDetails?.amountDisplayString };
    case 'newSponsorEvent': return { type: 'member', user, tier: s.newSponsorDetails?.memberLevelName || '' };
    case 'memberMilestoneChatEvent': return { type: 'milestone', user, months: s.memberMilestoneChatDetails?.memberMonth || 1, text: s.memberMilestoneChatDetails?.userComment || '' };
    case 'membershipGiftingEvent': return { type: 'giftsub', user, amount: s.membershipGiftingDetails?.giftMembershipsCount || 1 };
    default: return null;
  }
}

// Mode simple : ChatItem de youtube-chat vers événement unifié.
function normalizeSimple(c) {
  const text = (c.message || []).map((m) => m.text || m.emojiText || '').join('');
  const user = {
    id: c.author?.channelId || '', name: c.author?.name || 'Anonyme', display: c.author?.name || 'Anonyme', avatar: c.author?.thumbnail?.url || '',
    mod: Boolean(c.isModerator), sub: Boolean(c.isMembership), vip: false, owner: Boolean(c.isOwner),
  };
  if (c.superchat) {
    const num = Number(String(c.superchat.amount).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    return { type: c.superchat.sticker ? 'supersticker' : 'superchat', user, value: num, money: c.superchat.amount, text };
  }
  return { type: 'chat', user, text };
}

class YouTubeConnector extends EventEmitter {
  constructor(account, { vault, clientId, clientSecret, quota }) {
    super();
    this.account = account;
    this.vault = vault;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.quota = quota;
    this.stopped = true;
    this.timer = null;
  }

  get key() { return `youtube:${this.account.id}`; }

  get mode() { return this.account.mode || 'simple'; }

  status(state, detail = '') { this.emit('status', { state, detail }); }

  later(fn, ms) { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(fn, ms); }

  start() {
    this.stopped = false;
    this.status('connecting');
    return this.mode === 'api' ? this.findBroadcast() : this.startSimple();
  }

  // ---- mode simple
  async startSimple() {
    try {
      const { LiveChat } = require('youtube-chat');
      const raw = String(this.account.channel || '').trim();
      const handle = raw.startsWith('@') ? raw : null;
      const id = handle ? { handle } : /^[\w-]{11}$/.test(raw) ? { liveId: raw } : { channelId: raw };
      this.live = new LiveChat(id, 5000);
      const started = Date.now();
      this.live.on('start', () => this.status('live'));
      this.live.on('end', () => { this.status('offline', 'Le live est terminé'); this.later(() => this.startSimple(), 60000); });
      this.live.on('error', (e) => this.emit('log', String(e?.message || e)));
      this.live.on('chat', (c) => {
        if (c.timestamp && new Date(c.timestamp).getTime() < started) return; // historique
        this.emit('event', normalizeSimple(c));
      });
      const ok = await this.live.start();
      if (!ok) { this.status('offline', 'Pas en live pour le moment'); this.later(() => this.startSimple(), 60000); }
    } catch (e) {
      this.emit('log', e.message);
      this.status('error', 'Connexion YouTube impossible. Nouvel essai dans une minute.');
      this.later(() => this.startSimple(), 60000);
    }
  }

  // ---- mode API
  async token() {
    const t = this.vault.get(this.key);
    if (!t) throw new Error('Reconnecte cette chaîne YouTube.');
    if (t.expires - 60000 > Date.now()) return t.access;
    const r = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, refresh_token: t.refresh, grant_type: 'refresh_token' }).toString(),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('La session YouTube a expiré. Reconnecte cette chaîne.');
    this.vault.set(this.key, { ...t, access: d.access_token, expires: Date.now() + d.expires_in * 1000 });
    return d.access_token;
  }

  async call(path, cost, opts = {}) {
    const used = this.quota.used();
    if (used + cost > DAILY_QUOTA - QUOTA_MARGIN) throw Object.assign(new Error('Quota YouTube du jour presque épuisé.'), { quota: true });
    const res = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    this.quota.add(cost);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(d.error?.message || `YouTube a répondu ${res.status}`), { quota: res.status === 403 && /quota/i.test(JSON.stringify(d)) });
    return d;
  }

  async findBroadcast() {
    try {
      const d = await this.call('/liveBroadcasts?part=snippet,status&broadcastStatus=active&broadcastType=all&maxResults=5', 1);
      const live = d.items?.find((b) => b.snippet?.liveChatId);
      if (!live) {
        this.status('offline', 'Pas en live pour le moment');
        return this.later(() => this.findBroadcast(), 60000);
      }
      this.chatId = live.snippet.liveChatId;
      this.videoId = live.id;
      this.pageToken = null;
      this.first = true;
      this.status('live');
      this.poll();
      this.viewers();
    } catch (e) {
      this.emit('log', e.message);
      const ours = /Quota|Reconnecte/.test(e.message);
      this.status(e.quota ? 'offline' : 'error', ours ? e.message : 'Connexion YouTube impossible. Nouvel essai dans une minute.');
      this.later(() => this.findBroadcast(), e.quota ? 30 * 60000 : 60000);
    }
  }

  async viewers() {
    if (this.stopped || !this.videoId) return;
    try {
      const d = await this.call(`/videos?part=liveStreamingDetails&id=${this.videoId}`, 1);
      this.emit('event', { type: 'viewers', amount: Number(d.items?.[0]?.liveStreamingDetails?.concurrentViewers) || 0 });
    } catch (e) { this.emit('log', e.message); }
    clearTimeout(this.viewerTimer);
    this.viewerTimer = setTimeout(() => this.viewers(), 120000);
  }

  async poll() {
    if (this.stopped) return;
    try {
      const q = new URLSearchParams({ liveChatId: this.chatId, part: 'id,snippet,authorDetails', maxResults: '200' });
      if (this.pageToken) q.set('pageToken', this.pageToken);
      const d = await this.call(`/liveChat/messages?${q}`, 5);
      this.pageToken = d.nextPageToken;
      if (!this.first) for (const item of d.items || []) { const out = normalizeApi(item); if (out) this.emit('event', out); }
      this.first = false;
      // Le quota de 10 000 unités par jour impose de ne pas descendre sous l'intervalle choisi.
      const wait = Math.max(d.pollingIntervalMillis || 5000, (this.account.pollSeconds || 12) * 1000);
      this.later(() => this.poll(), wait);
    } catch (e) {
      if (/ended|forbidden|notFound|disabled/i.test(e.message)) {
        this.status('offline', 'Le live est terminé');
        this.videoId = null;
        return this.later(() => this.findBroadcast(), 60000);
      }
      this.emit('log', e.message);
      this.later(() => this.poll(), e.quota ? 30 * 60000 : 20000);
    }
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.viewerTimer);
    try { this.live?.stop(); } catch { /* déjà arrêté */ }
    this.status('stopped');
  }

  canSend() { return this.mode === 'api'; }

  sendHint() { return this.canSend() ? '' : 'Le chat public se lit sans compte, mais pour écrire, connecte-toi avec Google dans Connexions.'; }

  async send(text) {
    if (this.mode !== 'api') throw new Error('Pour répondre sur YouTube, connecte la chaîne en mode API.');
    if (!this.chatId) throw new Error('Aucun live actif.');
    await this.call('/liveChat/messages?part=snippet', 50, {
      method: 'POST', body: JSON.stringify({ snippet: { liveChatId: this.chatId, type: 'textMessageEvent', textMessageDetails: { messageText: text.slice(0, 200) } } }),
    });
  }
}

module.exports = { YouTubeConnector, oauthFlow, normalizeApi, normalizeSimple, DAILY_QUOTA };
