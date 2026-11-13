// Streamer.bot : lance une de ses actions par son serveur WebSocket (Servers/Clients → WebSocket Server,
// 127.0.0.1:8080 par défaut). Régie envoie le nom de l'action et les infos de l'événement en arguments.
const WebSocket = require('ws');

function streamerBotAction(host, name, args = {}, { timeout = 4000 } = {}) {
  const target = String(host || '127.0.0.1:8080').replace(/^wss?:\/\//, '').replace(/\/+$/, '');
  if (!name) return Promise.reject(new Error('Indique le nom de l\'action.'));
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${target}/`, { handshakeTimeout: timeout });
    const id = `regie-${Date.now()}`;
    const done = (err, out) => { clearTimeout(t); try { ws.close(); } catch { /* déjà fermé */ } if (err) reject(err); else resolve(out); };
    const t = setTimeout(() => done(new Error('Streamer.bot ne répond pas. Active son serveur WebSocket.')), timeout);
    ws.on('open', () => ws.send(JSON.stringify({ request: 'DoAction', id, action: { name }, args })));
    ws.on('message', (raw) => {
      let msg = {};
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.id !== id) return;
      if (msg.status === 'error') done(new Error(msg.error || 'Action refusée par Streamer.bot.'));
      else done(null, true);
    });
    ws.on('error', () => done(new Error('Streamer.bot injoignable. Vérifie qu\'il est ouvert et que son serveur WebSocket est actif.')));
  });
}

module.exports = { streamerBotAction };
