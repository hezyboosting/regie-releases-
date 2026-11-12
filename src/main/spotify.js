// Spotify : le morceau en cours vient de Windows (sans compte) ; un compte relié ajoute la file d'attente.
const { EventEmitter } = require('events');
const crypto = require('crypto');
const http = require('http');
const brand = require('../shared/brand');

const SCOPES = 'user-read-playback-state user-read-currently-playing user-modify-playback-state';
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

function simplify(p, queue = []) {
  if (!p || !p.item) return { playing: false, track: null, queue: [] };
  const it = p.item;
  const artists = it.artists ? it.artists.map((a) => a.name).join(', ') : it.show?.name || '';
  const images = it.album?.images || it.images || it.show?.images || [];
  return {
    playing: Boolean(p.is_playing),
    progress: p.progress_ms || 0,
    device: p.device?.name || '',
    at: Date.now(),
    track: { id: it.id, uri: it.uri, title: it.name, artist: artists, album: it.album?.name || '', cover: images[0]?.url || '', duration: it.duration_ms || 0 },
    queue: queue.slice(0, 3).map((q) => ({ id: q.id, title: q.name, artist: q.artists ? q.artists.map((a) => a.name).join(', ') : '' })),
  };
}

class Spotify extends EventEmitter {
  constructor({ vault, getClientId, openExternal, local, getSource }) {
    super();
    this.vault = vault;
    this.getClientId = getClientId;
    this.openExternal = openExternal;
    this.local = local;
    this.getSource = getSource || (() => 'spotify');
    local?.on('state', (st) => { if (!this.connected) this.publish(st); });
    this.state = { playing: false, track: null, queue: [] };
    this.requests = new Map(); // uri -> pseudo qui a demandé
    this.history = [];
    this.timer = null;
    this.tick = 0;
  }

  get connected() { return Boolean(this.vault.get('spotify')); }

  login() {
    const clientId = this.getClientId();
    if (!clientId) throw new Error('Ajoute ton Client ID Spotify avant de te connecter.');
    return new Promise((resolve, reject) => {
      const verifier = crypto.randomBytes(48).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const state = crypto.randomBytes(16).toString('hex');
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<meta charset=utf-8><body style="font:18px sans-serif;background:#262C33;color:#ECE8DE;display:grid;place-items:center;height:100vh;margin:0">Spotify est connecté. Tu peux revenir dans Régie.</body>');
        server.close();
        clearTimeout(timeout);
        if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) return reject(new Error('Connexion Spotify annulée.'));
        try {
          const r = await fetch(`${ACCOUNTS}/api/token`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: brand.spotifyRedirect, code_verifier: verifier }).toString(),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error_description || 'Spotify a refusé la connexion.');
          this.vault.set('spotify', { access: d.access_token, refresh: d.refresh_token, expires: Date.now() + d.expires_in * 1000 });
          this.start();
          resolve(true);
        } catch (e) { reject(e); }
      });
      const timeout = setTimeout(() => { server.close(); reject(new Error('Connexion Spotify expirée. Réessaie.')); }, 5 * 60000);
      server.on('error', () => reject(new Error(`Le port ${brand.spotifyPort} est déjà utilisé.`)));
      server.listen(brand.spotifyPort, '127.0.0.1', () => {
        const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: brand.spotifyRedirect, scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge, state });
        this.openExternal(`${ACCOUNTS}/authorize?${q}`);
      });
    });
  }

  logout() { this.vault.set('spotify', null); this.stop(); this.publish({ playing: false, track: null, queue: [] }); this.start(); }

  async token() {
    const t = this.vault.get('spotify');
    if (!t) throw new Error('Spotify n\'est pas connecté.');
    if (t.expires - 30000 > Date.now()) return t.access;
    const r = await fetch(`${ACCOUNTS}/api/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.getClientId(), grant_type: 'refresh_token', refresh_token: t.refresh }).toString(),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('La session Spotify a expiré. Reconnecte-toi.');
    this.vault.set('spotify', { access: d.access_token, refresh: d.refresh_token || t.refresh, expires: Date.now() + d.expires_in * 1000 });
    return d.access_token;
  }

  async call(path, opts = {}) {
    const res = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${await this.token()}`, ...(opts.headers || {}) } });
    if (res.status === 204) return null;
    if (res.status === 429) { this.cooldown = Date.now() + (Number(res.headers.get('retry-after')) || 5) * 1000; throw new Error('Spotify limite les requêtes pour le moment.'); }
    const text = await res.text();
    let d = null;
    try { d = text ? JSON.parse(text) : null; } catch { d = null; }
    if (!res.ok) {
      if (res.status === 403) throw new Error('Spotify refuse : le compte du Client ID doit être Premium et cet utilisateur doit être autorisé sur l\'appli.');
      throw new Error(d?.error?.message || `Spotify a répondu ${res.status}`);
    }
    return d;
  }

  publish(next) {
    const merged = { ...next, requester: next.track ? this.requests.get(next.track.uri) || '' : '' };
    const changed = merged.track?.id !== this.state.track?.id || merged.track?.cover !== this.state.track?.cover || merged.playing !== this.state.playing
      || Math.abs((merged.progress || 0) - ((this.state.progress || 0) + (Date.now() - (this.state.at || 0)))) > 2500
      || JSON.stringify(merged.queue) !== JSON.stringify(this.state.queue);
    if (merged.track && merged.track.id !== this.state.track?.id) {
      this.history.unshift({ title: merged.track.title, artist: merged.track.artist, at: Date.now() });
      this.history = this.history.slice(0, 50);
    }
    this.state = merged;
    if (changed) this.emit('state', merged);
  }

  start() {
    this.stop();
    if (!this.connected) { this.local?.start(this.getSource()); return; }
    const loop = async () => {
      if (Date.now() >= (this.cooldown || 0)) {
        try {
          const p = await this.call('/me/player?additional_types=track,episode');
          this.tick += 1;
          if (this.tick % 6 === 1 && p?.item) {
            const q = await this.call('/me/player/queue').catch(() => null);
            this.lastQueue = q?.queue || [];
          }
          this.publish(simplify(p, this.lastQueue));
        } catch (e) { this.emit('log', e.message); }
      }
      this.timer = setTimeout(loop, 2500);
    };
    loop();
  }

  stop() { clearTimeout(this.timer); this.timer = null; this.local?.stop(); }

  async control(action) {
    const map = { play: ['/me/player/play', 'PUT'], pause: ['/me/player/pause', 'PUT'], next: ['/me/player/next', 'POST'], previous: ['/me/player/previous', 'POST'] };
    if (!map[action]) throw new Error('Commande inconnue');
    if (!this.connected) { if (!this.local) throw new Error('Spotify n\'est pas connecté.'); return this.local.send(action); }
    return this.call(map[action][0], { method: map[action][1] });
  }

  async request(query, requester, { maxLengthMin = 8, blocked = [] } = {}) {
    const clean = String(query).trim();
    if (!clean) throw new Error('Donne un titre ou un lien Spotify.');
    let track;
    const m = clean.match(/track[/:]([A-Za-z0-9]{22})/);
    if (m) track = await this.call(`/tracks/${m[1]}`);
    else {
      const d = await this.call(`/search?type=track&limit=5&q=${encodeURIComponent(clean)}`);
      track = d?.tracks?.items?.find((t) => t && !t.explicit) || d?.tracks?.items?.[0];
    }
    if (!track) throw new Error(`Rien trouvé pour « ${clean} ».`);
    const artist = (track.artists || []).map((a) => a.name).join(', ');
    if (track.duration_ms > maxLengthMin * 60000) throw new Error(`Ce morceau dépasse ${maxLengthMin} minutes.`);
    const hay = `${track.name} ${artist}`.toLowerCase();
    if (blocked.some((b) => b && hay.includes(String(b).toLowerCase()))) throw new Error('Ce morceau n\'est pas autorisé ici.');
    await this.call(`/me/player/queue?uri=${encodeURIComponent(track.uri)}`, { method: 'POST' });
    this.requests.set(track.uri, requester);
    if (this.requests.size > 100) this.requests.delete(this.requests.keys().next().value);
    return { title: track.name, artist };
  }
}

module.exports = { Spotify, simplify };
