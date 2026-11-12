// Twitch : connexion par code d'appareil (pas de secret dans le .exe) et EventSub WebSocket.
const { EventEmitter } = require('events');
const WebSocket = require('ws');

const SCOPES = [
  'moderator:read:followers', 'channel:read:subscriptions', 'bits:read', 'channel:read:redemptions',
  'channel:read:hype_train', 'user:read:chat', 'user:write:chat', 'clips:edit', 'channel:read:vips',
].join(' ');

const ID_URL = 'https://id.twitch.tv/oauth2';
const API_URL = 'https://api.twitch.tv/helix';
const WS_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';

const form = (obj) => new URLSearchParams(obj).toString();
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

async function jsonOf(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function deviceStart(clientId) {
  const res = await fetch(`${ID_URL}/device`, { method: 'POST', headers: FORM, body: form({ client_id: clientId, scopes: SCOPES }) });
  const data = await jsonOf(res);
  if (!res.ok) throw new Error(data.message || 'Twitch a refusé la demande. Vérifie le Client ID.');
  return data;
}

async function devicePoll(clientId, deviceCode) {
  const res = await fetch(`${ID_URL}/token`, {
    method: 'POST', headers: FORM,
    body: form({ client_id: clientId, scopes: SCOPES, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
  });
  const data = await jsonOf(res);
  if (res.ok) return { done: true, tokens: tokenSet(data) };
  if (/pending/i.test(data.message || '')) return { done: false };
  if (/slow/i.test(data.message || '')) return { done: false, slow: true };
  throw new Error(data.message || 'La connexion Twitch a échoué.');
}

const tokenSet = (d) => ({ access: d.access_token, refresh: d.refresh_token, expires: Date.now() + (d.expires_in || 0) * 1000 });

// Transforme une notification EventSub en événement unifié (fonction pure, testée dans test/).
function normalize(subType, e) {
  const user = (id, login, name, extra = {}) => ({ id: String(id || ''), name: String(login || name || 'anonyme'), display: String(name || login || 'Anonyme'), avatar: '', ...extra });
  switch (subType) {
    case 'channel.chat.message': {
      const ids = (e.badges || []).map((b) => b.set_id);
      return {
        type: 'chat', text: e.message?.text || '', color: e.color || '',
        user: user(e.chatter_user_id, e.chatter_user_login, e.chatter_user_name, {
          mod: ids.includes('moderator'), sub: ids.includes('subscriber') || ids.includes('founder'), vip: ids.includes('vip'), owner: ids.includes('broadcaster'),
        }),
      };
    }
    case 'channel.follow': return { type: 'follow', user: user(e.user_id, e.user_login, e.user_name) };
    case 'channel.subscribe':
      if (e.is_gift) return null; // comptabilisé par channel.subscription.gift
      return { type: 'sub', tier: e.tier, months: 1, user: user(e.user_id, e.user_login, e.user_name) };
    case 'channel.subscription.message':
      return { type: 'resub', tier: e.tier, months: e.cumulative_months || 1, text: e.message?.text || '', user: user(e.user_id, e.user_login, e.user_name) };
    case 'channel.subscription.gift':
      return { type: 'giftsub', tier: e.tier, amount: e.total || 1, user: e.is_anonymous ? user('', '', 'Anonyme') : user(e.user_id, e.user_login, e.user_name) };
    case 'channel.cheer':
      return { type: 'bits', amount: e.bits || 0, text: e.message || '', user: e.is_anonymous ? user('', '', 'Anonyme') : user(e.user_id, e.user_login, e.user_name) };
    case 'channel.raid':
      return { type: 'raid', amount: e.viewers || 0, user: user(e.from_broadcaster_user_id, e.from_broadcaster_user_login, e.from_broadcaster_user_name) };
    case 'channel.channel_points_custom_reward_redemption.add':
      return { type: 'redeem', reward: e.reward?.title || 'une récompense', amount: e.reward?.cost || 0, text: e.user_input || '', user: user(e.user_id, e.user_login, e.user_name) };
    case 'channel.vip.add': return { type: 'vip', user: user(e.user_id, e.user_login, e.user_name) };
    case 'channel.hype_train.begin': return { type: 'hypetrain', amount: e.level || 1, user: user('', '', 'Le chat') };
    case 'stream.online': return { type: 'streamstate', live: true };
    case 'stream.offline': return { type: 'streamstate', live: false };
    default: return null;
  }
}

class TwitchConnector extends EventEmitter {
  constructor(account, { vault, clientId, endpoints = {} }) {
    super();
    this.account = account;
    this.vault = vault;
    this.clientId = clientId;
    this.api = endpoints.api || API_URL;
    this.idUrl = endpoints.id || ID_URL;
    this.wsUrl = endpoints.ws || WS_URL;
    this.ws = null;
    this.stopped = true;
    this.watchdog = null;
    this.viewerTimer = null;
    this.userId = account.userId;
    this.backoff = 2000;
  }

  get key() { return `twitch:${this.account.id}`; }

  status(state, detail = '') { this.emit('status', { state, detail }); }

  async token() {
    const t = this.vault.get(this.key);
    if (!t) throw new Error('Reconnecte cette chaîne Twitch.');
    if (t.expires - 60000 > Date.now()) return t.access;
    return this.refresh(t);
  }

  async refresh(t) {
    const res = await fetch(`${this.idUrl}/token`, { method: 'POST', headers: FORM, body: form({ client_id: this.clientId, grant_type: 'refresh_token', refresh_token: t.refresh }) });
    const data = await jsonOf(res);
    if (!res.ok) throw new Error('La session Twitch a expiré. Reconnecte cette chaîne.');
    const next = tokenSet(data);
    this.vault.set(this.key, next);
    return next.access;
  }

  async helix(path, opts = {}, retried = false) {
    const res = await fetch(`${this.api}${path}`, {
      ...opts, headers: { Authorization: `Bearer ${await this.token()}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (res.status === 401 && !retried) {
      await this.refresh(this.vault.get(this.key));
      return this.helix(path, opts, true);
    }
    const data = await jsonOf(res);
    if (!res.ok) throw new Error(data.message || `Twitch a répondu ${res.status}`);
    return data;
  }

  async start() {
    this.stopped = false;
    this.status('connecting');
    try {
      if (!this.clientId) throw new Error('Ajoute le Client ID Twitch dans Réglages.');
      const me = await this.helix('/users');
      this.userId = me.data?.[0]?.id;
      this.login = me.data?.[0]?.login;
      this.emit('profile', { userId: this.userId, login: this.login, display: me.data?.[0]?.display_name, avatar: me.data?.[0]?.profile_image_url });
      this.open(this.wsUrl);
    } catch (err) {
      this.emit('log', err.message);
      const ours = /Reconnecte|Ajoute|session/.test(err.message);
      this.status('error', ours ? err.message : 'Connexion Twitch impossible. Nouvel essai bientôt.');
      this.later();
    }
  }

  open(url, previous) {
    const ws = new WebSocket(url);
    ws.on('message', (raw) => this.onMessage(ws, raw, previous));
    ws.on('close', () => { if (ws === this.ws && !this.stopped) { this.status('offline', 'Connexion perdue, nouvelle tentative'); this.later(); } });
    ws.on('error', (e) => this.emit('log', e.message));
    if (!previous) this.ws = ws;
    this.pendingWs = ws;
  }

  later() {
    clearTimeout(this.reopen);
    if (this.stopped) return;
    this.reopen = setTimeout(() => { if (!this.stopped) this.start(); }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 60000);
  }

  beat(timeoutSec) {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => { this.emit('log', 'keepalive manqué'); this.ws?.terminate(); }, (timeoutSec + 8) * 1000);
  }

  async onMessage(ws, raw, previous) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const kind = msg.metadata?.message_type;
    if (kind === 'session_welcome') {
      this.keepalive = msg.payload.session.keepalive_timeout_seconds || 30;
      this.beat(this.keepalive);
      if (previous) {
        // Reconnexion demandée par Twitch : les abonnements suivent, on ferme l'ancien socket.
        this.ws = ws;
        previous.removeAllListeners('close');
        previous.close();
      } else {
        await this.subscribeAll(msg.payload.session.id);
      }
      this.backoff = 2000;
      this.status('live');
      this.startViewers();
    } else if (kind === 'session_keepalive') {
      this.beat(this.keepalive);
    } else if (kind === 'notification') {
      this.beat(this.keepalive);
      const out = normalize(msg.metadata.subscription_type, msg.payload.event);
      if (out) this.emit('event', out);
    } else if (kind === 'session_reconnect') {
      this.open(msg.payload.session.reconnect_url, ws);
    }
  }

  subscriptions() {
    const me = this.userId;
    const b = { broadcaster_user_id: me };
    return [
      ['channel.chat.message', '1', { ...b, user_id: me }], ['channel.follow', '2', { ...b, moderator_user_id: me }],
      ['channel.subscribe', '1', b], ['channel.subscription.message', '1', b], ['channel.subscription.gift', '1', b],
      ['channel.cheer', '1', b], ['channel.raid', '1', { to_broadcaster_user_id: me }],
      ['channel.channel_points_custom_reward_redemption.add', '1', b], ['channel.hype_train.begin', '2', b],
      ['channel.vip.add', '1', b], ['stream.online', '1', b], ['stream.offline', '1', b],
    ];
  }

  async subscribeAll(sessionId) {
    const results = await Promise.allSettled(this.subscriptions().map(([type, version, condition]) => this.helix('/eventsub/subscriptions', {
      method: 'POST', body: JSON.stringify({ type, version, condition, transport: { method: 'websocket', session_id: sessionId } }),
    })));
    // Un compte non affilié n'a pas droit à tout : on continue avec ce qui passe.
    results.forEach((r, i) => { if (r.status === 'rejected') this.emit('log', `${this.subscriptions()[i][0]} : ${r.reason.message}`); });
    if (results.every((r) => r.status === 'rejected')) throw new Error(results[0].reason.message);
  }

  startViewers() {
    clearInterval(this.viewerTimer);
    const tick = async () => {
      try {
        const d = await this.helix(`/streams?user_id=${this.userId}`);
        this.emit('event', { type: 'viewers', amount: d.data?.[0]?.viewer_count || 0 });
        this.emit('event', { type: 'streamstate', live: Boolean(d.data?.[0]) });
      } catch (e) { this.emit('log', e.message); }
    };
    tick();
    this.viewerTimer = setInterval(tick, 60000);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.watchdog);
    clearTimeout(this.reopen);
    clearInterval(this.viewerTimer);
    try { this.ws?.close(); } catch { /* déjà fermé */ }
    this.ws = null;
    this.status('stopped');
  }

  canSend() { return true; }

  async createClip() {
    let d;
    try {
      d = await this.helix(`/clips?broadcaster_id=${this.userId}`, { method: 'POST' });
    } catch (e) {
      if (/scope|authoriz/i.test(e.message)) throw new Error('Reconnecte ta chaîne Twitch pour autoriser les clips.');
      throw new Error('Twitch ne peut pas créer de clip maintenant. Es-tu bien en direct ?');
    }
    const id = d.data?.[0]?.id;
    return { id, url: `https://clips.twitch.tv/${id}`, editUrl: d.data?.[0]?.edit_url };
  }

  async send(text) {
    await this.helix('/chat/messages', { method: 'POST', body: JSON.stringify({ broadcaster_id: this.userId, sender_id: this.userId, message: text.slice(0, 480) }) });
  }
}

module.exports = { TwitchConnector, normalize, deviceStart, devicePoll, SCOPES };
