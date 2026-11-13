// Twitch sans compte : lecture du chat public par IRC, avec seulement le pseudo de la chaîne.
// Chat, abonnements, bits et raids arrivent ici. Les follows et les réponses demandent la vraie connexion Twitch.
const { EventEmitter } = require('events');
const WebSocket = require('ws');

const IRC = 'wss://irc-ws.chat.twitch.tv:443';

function parseIrc(line) {
  let rest = line;
  const tags = {};
  if (rest.startsWith('@')) {
    const end = rest.indexOf(' ');
    for (const part of rest.slice(1, end).split(';')) {
      const i = part.indexOf('=');
      tags[part.slice(0, i)] = part.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\');
    }
    rest = rest.slice(end + 1);
  }
  let prefix = '';
  if (rest.startsWith(':')) {
    const end = rest.indexOf(' ');
    prefix = rest.slice(1, end);
    rest = rest.slice(end + 1);
  }
  const colon = rest.indexOf(' :');
  const head = (colon >= 0 ? rest.slice(0, colon) : rest).split(' ');
  return { tags, prefix, command: head[0], params: head.slice(1), text: colon >= 0 ? rest.slice(colon + 2) : '' };
}

function normalizeIrc(m) {
  const t = m.tags;
  const badges = (t.badges || '').split(',').map((b) => b.split('/')[0]);
  const login = t.login || m.prefix.split('!')[0];
  const user = { id: t['user-id'] || login, name: login, display: t['display-name'] || login, avatar: '', mod: badges.includes('moderator'), sub: badges.includes('subscriber') || badges.includes('founder'), vip: badges.includes('vip'), owner: badges.includes('broadcaster') };
  if (m.command === 'PRIVMSG') {
    if (Number(t.bits) > 0) return { type: 'bits', amount: Number(t.bits), text: m.text, user };
    return { type: 'chat', text: m.text, color: t.color || '', user };
  }
  if (m.command !== 'USERNOTICE') return null;
  switch (t['msg-id']) {
    case 'sub': return { type: 'sub', months: 1, user };
    case 'resub': return { type: 'resub', months: Number(t['msg-param-cumulative-months']) || 1, text: m.text, user };
    case 'subgift': return { type: 'giftsub', amount: 1, user };
    case 'submysterygift': return { type: 'giftsub', amount: Number(t['msg-param-mass-gift-count']) || 1, user };
    case 'raid': return { type: 'raid', amount: Number(t['msg-param-viewerCount']) || 0, user };
    default: return null;
  }
}

class TwitchIrc extends EventEmitter {
  constructor(account) { super(); this.account = account; this.stopped = true; }

  status(state, detail = '') { this.emit('status', { state, detail }); }

  start() {
    this.stopped = false;
    this.status('connecting');
    const ws = new WebSocket(IRC);
    this.ws = ws;
    const channel = String(this.account.username).toLowerCase();
    ws.on('open', () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${channel}`);
    });
    ws.on('message', (raw) => {
      for (const line of String(raw).split('\r\n')) {
        if (!line) continue;
        const m = parseIrc(line);
        if (m.command === 'PING') ws.send(`PONG :${m.text}`);
        else if (m.command === 'ROOMSTATE') this.status('live', 'Chat public');
        else if (m.command === 'RECONNECT') ws.close();
        else { const out = normalizeIrc(m); if (out) this.emit('event', out); }
      }
    });
    ws.on('error', (e) => this.emit('log', e.message));
    ws.on('close', () => { if (!this.stopped) { this.status('offline', 'Connexion perdue, nouvel essai'); this.retry = setTimeout(() => this.start(), 8000); } });
  }

  stop() { this.stopped = true; clearTimeout(this.retry); try { this.ws?.close(); } catch { /* fermé */ } this.status('stopped'); }

  canSend() { return false; }

  sendHint() { return 'Avec le pseudo seul, Régie lit le chat Twitch sans pouvoir y écrire : connecte ton compte Twitch dans Connexions.'; }

  async send() { throw new Error('Connecte-toi avec Twitch pour répondre dans le chat.'); }
}

module.exports = { TwitchIrc, parseIrc, normalizeIrc };
