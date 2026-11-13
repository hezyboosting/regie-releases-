// Serveur local des overlays : chaque overlay est un lien à coller dans OBS, Streamlabs ou TikTok LIVE Studio.
// Ce serveur est en lecture seule : le pilotage de l'appli passe uniquement par l'IPC d'Electron.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.webm': 'video/webm', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};
const PROXY_HOSTS = [/^i\.scdn\.co$/, /^mosaic\.scdn\.co$/, /^image-cdn-.*\.spotifycdn\.com$/, /tiktokcdn(-[a-z]+)?\.com$/, /\.ggpht\.com$/, /\.ytimg\.com$/];

class OverlayServer {
  constructor({ overlaysDir, mediaDir, giftsDir, port, lan, token, getOverlay, onConnect, onDisconnect, onHook, deck, onGsi, clipFile, dock }) {
    Object.assign(this, { overlaysDir, mediaDir, giftsDir, port, lan, token, getOverlay, onConnect, onDisconnect, onHook, deck, onGsi, clipFile, dock });
    this.clients = new Set();
    this.server = null;
    this.wss = null;
  }

  async start() {
    this.server = http.createServer((req, res) => this.handle(req, res).catch(() => this.send(res, 500, 'Erreur interne')));
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
    this.server.on('upgrade', (req, sock, head) => this.upgrade(req, sock, head));
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await new Promise((resolve, reject) => {
          this.server.once('error', reject);
          this.server.listen(this.port + attempt, this.lan ? '0.0.0.0' : '127.0.0.1', () => {
            this.server.removeListener('error', reject);
            resolve();
          });
        });
        this.port += attempt;
        return this.port;
      } catch (err) {
        if (err.code !== 'EADDRINUSE') throw err;
      }
    }
    throw new Error('Aucun port libre pour le serveur d\'overlays');
  }

  stop() {
    for (const c of this.clients) c.ws.terminate();
    this.wss?.close();
    this.clients.clear();
    return new Promise((r) => { if (!this.server) return r(); this.server.close(() => r()); this.server.closeAllConnections?.(); });
  }

  // Adresse à donner à un autre appareil. Les cartes virtuelles (VPN, WSL, machines virtuelles) sont évitées.
  lanHost() {
    const out = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
      for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push({ name, address: i.address });
    }
    const virtual = /vethernet|virtual|vmware|vbox|wsl|hyper-v|loopback|tailscale|zerotier|radmin|hamachi|tap|tun/i;
    const score = (i) => (virtual.test(i.name) ? 0 : 2) + (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(i.address) ? 1 : 0);
    return out.sort((x, y) => score(y) - score(x))[0]?.address || '127.0.0.1';
  }

  hookLink(id) { return `http://127.0.0.1:${this.port}/hook/${id}?k=${this.token}`; }

  // Le lien principal reste local : OBS est presque toujours sur le même PC.
  link(id) { return `http://127.0.0.1:${this.port}/o/${id}?k=${this.token}`; }

  lanLink(id) { return this.lan ? `http://${this.lanHost()}:${this.port}/o/${id}?k=${this.token}` : ''; }

  dockLink() { return `http://127.0.0.1:${this.port}/dock?k=${this.token}`; }

  // Chat unifié : la page marche dans un dock OBS, une fenêtre flottante ou un navigateur.
  async dockRoute(p, url, req, res) {
    if (url.searchParams.get('k') !== this.token) return this.send(res, 403, 'Lien invalide. Copie à nouveau le lien depuis Régie.');
    if (p === '/dock' && req.method === 'GET') return this.sendFile(res, this.overlaysDir, 'dock.html', req);
    if (p === '/dock/state' && req.method === 'GET') return this.send(res, 200, JSON.stringify(this.dock.state()), 'application/json');
    if (p === '/dock/send' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { if (body.length < 8000) body += d; });
      req.on('end', async () => {
        try {
          const { text, target } = JSON.parse(body);
          await this.dock.send(String(text || '').slice(0, 500), String(target || ''));
          this.send(res, 200, '{"ok":true}', 'application/json');
        } catch (e) { this.send(res, 200, JSON.stringify({ ok: false, error: e.message }), 'application/json'); }
      });
      return undefined;
    }
    return this.send(res, 404, 'Introuvable');
  }

  deckLink() { return `http://${this.lan ? this.lanHost() : '127.0.0.1'}:${this.port}/deck?k=${this.token}`; }

  send(res, code, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  }

  sendFile(res, root, rel, req) {
    const file = path.resolve(root, `.${path.posix.normalize(`/${rel}`)}`);
    if (file !== root && !file.startsWith(root + path.sep)) return this.send(res, 403, 'Interdit');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return this.send(res, 404, 'Introuvable');
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
        if (start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    });
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const p = decodeURIComponent(url.pathname);
    if (p === '/gsi/cs2' && req.method === 'POST') {
      // Appel local du jeu : le jeton est vérifié dans le corps, ici on limite juste la taille.
      let body = '';
      req.on('data', (d) => { if (body.length < 2e6) body += d; });
      req.on('end', () => { try { this.onGsi?.(JSON.parse(body)); } catch { /* corps illisible */ } this.send(res, 200, 'ok'); });
      return undefined;
    }
    if (p.startsWith('/deck')) return this.deckRoute(p, url, req, res);
    if (p.startsWith('/dock')) return this.dockRoute(p, url, req, res);
    if (p.startsWith('/hook/')) {
      if (url.searchParams.get('k') !== this.token) return this.send(res, 403, 'Lien invalide.');
      req.resume();
      return this.send(res, this.onHook?.(p.slice(6)) ? 200 : 404, this.onHook ? 'ok' : '');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return this.send(res, 405, 'Méthode interdite');
    if (p.startsWith('/assets/')) return this.sendFile(res, this.overlaysDir, p.slice('/assets/'.length), req);
    // Images officielles des cadeaux TikTok gardées sur le PC (publiques : rien de personnel).
    if (p.startsWith('/gifts/') && this.giftsDir) {
      const f = p.slice('/gifts/'.length);
      if (!/^[\w-]+\.(png|webp|gif|jpg)$/.test(f)) return this.send(res, 404, 'Introuvable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'max-age=604800');
      return this.sendFile(res, this.giftsDir, f, req);
    }

    if (url.searchParams.get('k') !== this.token) return this.send(res, 403, 'Lien invalide. Copie à nouveau le lien depuis Régie.');
    if (p.startsWith('/o/')) {
      const id = p.slice(3);
      if (!this.getOverlay(id)) return this.send(res, 404, 'Cet overlay n\'existe plus. Copie un nouveau lien depuis Régie.');
      return this.sendFile(res, this.overlaysDir, 'overlay.html', req);
    }
    if (p.startsWith('/media/')) return this.sendFile(res, this.mediaDir, p.slice('/media/'.length), req);
    if (p.startsWith('/clip/')) {
      const file = this.clipFile?.(p.slice(6));
      if (!file) return this.send(res, 404, 'Introuvable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return this.sendFile(res, path.dirname(file), path.basename(file), req);
    }
    if (p === '/proxy') return this.proxy(url.searchParams.get('u'), res);
    return this.send(res, 404, 'Introuvable');
  }

  deckRoute(p, url, req, res) {
    if (url.searchParams.get('k') !== this.token) return this.send(res, 403, 'Lien invalide. Copie à nouveau le lien depuis Régie.');
    if (p === '/deck') return this.sendFile(res, this.overlaysDir, 'deck.html', req);
    if (p === '/deck/state') return this.send(res, 200, JSON.stringify(this.deck?.state() || {}), 'application/json');
    if (p.startsWith('/deck/press/') && req.method === 'POST') { req.resume(); return this.send(res, this.deck?.press(p.slice(12)) ? 200 : 404, 'ok'); }
    return this.send(res, 404, 'Introuvable');
  }

  // Sert les pochettes et avatars depuis le même domaine, pour pouvoir lire leurs couleurs dans un canvas.
  proxy(target, res) {
    let u;
    try { u = new URL(target); } catch { return this.send(res, 400, 'URL invalide'); }
    if (u.protocol !== 'https:' || !PROXY_HOSTS.some((re) => re.test(u.hostname))) return this.send(res, 403, 'Hôte refusé');
    https.get(u, { timeout: 8000 }, (up) => {
      const type = String(up.headers['content-type'] || '');
      if (up.statusCode !== 200 || !type.startsWith('image/')) { up.resume(); return this.send(res, 502, 'Image indisponible'); }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=86400' });
      up.pipe(res);
    }).on('error', () => this.send(res, 502, 'Image indisponible'));
  }

  upgrade(req, socket, head) {
    const url = new URL(req.url, 'http://local');
    const reject = () => { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); };
    if (url.pathname !== '/ws' || url.searchParams.get('k') !== this.token) return reject();
    // Une page web quelconque ne doit pas pouvoir écouter le flux local.
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
      try {
        const o = new URL(origin);
        if (Number(o.port) !== this.port) return reject();
      } catch { return reject(); }
    }
    const isDock = url.searchParams.has('dock');
    const overlayId = url.searchParams.get('o');
    const overlay = isDock ? { type: 'dock' } : this.getOverlay(overlayId);
    if (!overlay) return reject();
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      const client = { ws, overlayId, type: overlay.type, alive: true };
      this.clients.add(client);
      ws.on('pong', () => { client.alive = true; });
      ws.on('close', () => { this.clients.delete(client); this.onDisconnect?.(client); });
      ws.on('error', () => ws.terminate());
      this.onConnect?.(client);
    });
  }

  sendTo(client, msg) {
    if (client.ws.readyState === 1) client.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  // types : un type d'overlay, une liste, ou rien pour tout le monde.
  broadcast(msg, types, filter) {
    const list = types ? [].concat(types) : null;
    const data = JSON.stringify(msg);
    for (const c of this.clients) {
      if (list && !list.includes(c.type)) continue;
      if (filter && !filter(c)) continue;
      this.sendTo(c, data);
    }
  }

  hasClient(type) {
    for (const c of this.clients) if (c.type === type) return true;
    return false;
  }

  connectedCount(overlayId) {
    let n = 0;
    for (const c of this.clients) if (c.overlayId === overlayId) n += 1;
    return n;
  }
}

module.exports = { OverlayServer };
