// Kick : lecture du chat public par le canal Pusher utilisé par le site (non officiel, lecture seule).
const { EventEmitter } = require('events');
const WebSocket = require('ws');

const PUSHER = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false';

function normalize(event, raw) {
  let d = raw;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  const short = String(event).split('\\').pop();
  const user = (u = {}) => {
    const badges = (u.identity?.badges || []).map((b) => b.type);
    return { id: String(u.id || u.username || ''), name: u.slug || u.username || 'anonyme', display: u.username || 'Anonyme', avatar: '', color: u.identity?.color || '', mod: badges.includes('moderator'), sub: badges.includes('subscriber') || badges.includes('founder'), vip: badges.includes('vip'), owner: badges.includes('broadcaster') };
  };
  switch (short) {
    case 'ChatMessageEvent': return { type: 'chat', text: String(d.content || '').replace(/\[emote:\d+:(\w+)\]/g, ':$1:'), user: user(d.sender) };
    case 'SubscriptionEvent': return { type: 'sub', months: d.months || 1, user: { id: d.username, name: d.username, display: d.username, avatar: '' } };
    case 'GiftedSubscriptionsEvent': return { type: 'giftsub', amount: (d.gifted_usernames || []).length || 1, user: { id: d.gifter_username, name: d.gifter_username, display: d.gifter_username, avatar: '' } };
    case 'StreamHostEvent': return { type: 'raid', amount: d.number_viewers || 0, user: { id: d.host_username, name: d.host_username, display: d.host_username, avatar: '' } };
    default: return null;
  }
}

class KickConnector extends EventEmitter {
  constructor(account, { fetchImpl = fetch } = {}) { super(); this.account = account; this.fetchImpl = fetchImpl; this.stopped = true; }

  status(state, detail = '') { this.emit('status', { state, detail }); }

  async chatroomId() {
    if (this.account.chatroomId) return this.account.chatroomId;
    const res = await this.fetchImpl(`https://kick.com/api/v2/channels/${encodeURIComponent(this.account.username)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Kick refuse la recherche de la chaîne. Ajoute l\'identifiant du salon dans la chaîne.');
    const d = await res.json();
    return d.chatroom?.id;
  }

  async start() {
    this.stopped = false;
    this.status('connecting');
    try {
      const id = await this.chatroomId();
      if (!id) throw new Error('Chaîne Kick introuvable.');
      this.open(id);
    } catch (e) {
      this.status('error', e.message);
      this.retry = setTimeout(() => { if (!this.stopped) this.start(); }, 60000);
    }
  }

  open(id) {
    const ws = new WebSocket(PUSHER);
    this.ws = ws;
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (m.event === 'pusher:connection_established') {
        ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${id}.v2` } }));
        this.status('live');
      } else if (m.event === 'pusher:ping') ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      else { const out = normalize(m.event, m.data); if (out) this.emit('event', out); }
    });
    ws.on('error', (e) => this.emit('log', e.message));
    ws.on('close', () => { if (!this.stopped) { this.status('offline', 'Connexion perdue, nouvel essai'); this.retry = setTimeout(() => this.start(), 15000); } });
  }

  stop() { this.stopped = true; clearTimeout(this.retry); try { this.ws?.close(); } catch { /* fermé */ } this.status('stopped'); }

  canSend() { return false; }

  async send() { throw new Error('Répondre sur Kick n\'est pas encore possible.'); }
}

module.exports = { KickConnector, normalize };
