// Détection du jeu lancé et données de match en direct, uniquement par des accès officiels et locaux :
// Rocket League Stats API, Game State Integration de CS2, Live Client Data de League of Legends, RCON de Minecraft.
const { EventEmitter } = require('events');
const { execFile, execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const net = require('net');
const path = require('path');
const WebSocket = require('ws');
const { GAMES } = require('../shared/games');

// ---------- Rocket League ----------
function parseRl(raw, st, me) {
  let m;
  try { m = JSON.parse(raw); } catch { return []; }
  let d = m.Data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};
  const out = [];
  const mine = (n) => Boolean(me) && String(n || '').toLowerCase() === me.toLowerCase();
  switch (m.Event) {
    case 'UpdateState': {
      const g = d.Game || {};
      const p = (d.Players || []).find((x) => mine(x.Name));
      if (p) st.team = p.TeamNum;
      st.live = {
        kind: 'rl', blue: g.Teams?.find((t) => t.TeamNum === 0)?.Score ?? 0, orange: g.Teams?.find((t) => t.TeamNum === 1)?.Score ?? 0,
        time: g.TimeSeconds ?? 0, overtime: Boolean(g.bOvertime), arena: g.Arena || '', team: st.team ?? null,
        me: p ? { goals: p.Goals, assists: p.Assists, saves: p.Saves, shots: p.Shots, demos: p.Demos, score: p.Score } : null,
      };
      out.push({ state: st.live });
      break;
    }
    case 'MatchCreated': case 'MatchInitialized': st.team = null; out.push({ kind: 'start' }); break;
    case 'GoalScored':
      if (mine(d.Scorer?.Name)) out.push({ kind: 'goal', detail: `${Math.round(d.GoalSpeed || 0)} km/h` });
      else if (st.team !== undefined && st.team !== null && d.Scorer?.TeamNum !== st.team) out.push({ kind: 'conceded' });
      if (mine(d.Assister?.Name)) out.push({ kind: 'assist' });
      break;
    case 'StatfeedEvent':
      if (mine(d.MainTarget?.Name)) {
        if (/save/i.test(d.EventName)) out.push({ kind: 'save' });
        if (/demol/i.test(d.EventName)) out.push({ kind: 'demo' });
      }
      break;
    case 'MatchEnded':
      if (st.team !== undefined && st.team !== null) out.push({ kind: d.WinnerTeamNum === st.team ? 'win' : 'loss' });
      out.push({ kind: 'end' });
      break;
    case 'MatchDestroyed': out.push({ state: null }); break;
    default: break;
  }
  return out;
}

class RocketLeagueLive extends EventEmitter {
  constructor(getName, port = 49124) { super(); this.getName = getName; this.port = port; this.st = {}; this.ws = null; }

  start() {
    this.on_ = true;
    this.open();
  }

  open() {
    if (!this.on_ || this.ws) return;
    const ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
    this.ws = ws;
    ws.on('open', () => this.emit('link', true));
    ws.on('message', (raw) => { for (const o of parseRl(raw.toString(), this.st, this.getName())) this.emit('update', o); });
    ws.on('error', () => {});
    ws.on('close', () => { this.ws = null; this.emit('link', false); if (this.on_) this.timer = setTimeout(() => this.open(), 5000); });
  }

  stop() { this.on_ = false; clearTimeout(this.timer); try { this.ws?.close(); } catch { /* fermé */ } }
}

// ---------- Counter-Strike 2 ----------
function parseCs2(body, st) {
  const out = [];
  const p = body.player;
  if (!p || !body.map) return out;
  if (body.provider?.steamid && p.steamid !== body.provider.steamid) return out; // spectateur
  const ms = p.match_stats || {};
  const prev = st.stats;
  if (prev) {
    if (ms.kills > prev.kills) out.push({ kind: 'kill', amount: ms.kills - prev.kills });
    if (ms.deaths > prev.deaths) out.push({ kind: 'death', amount: ms.deaths - prev.deaths });
    if (ms.assists > prev.assists) out.push({ kind: 'assist', amount: ms.assists - prev.assists });
    if (ms.mvps > prev.mvps) out.push({ kind: 'mvp', amount: ms.mvps - prev.mvps });
  }
  st.stats = { kills: ms.kills || 0, deaths: ms.deaths || 0, assists: ms.assists || 0, mvps: ms.mvps || 0 };
  const ct = body.map.team_ct?.score ?? 0;
  const t = body.map.team_t?.score ?? 0;
  const mine = p.team === 'CT' ? ct : t;
  const theirs = p.team === 'CT' ? t : ct;
  if (body.map.phase === 'gameover' && st.phase !== 'gameover') {
    out.push({ kind: mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw' });
    out.push({ kind: 'end' });
  }
  if (body.map.phase === 'warmup' && st.phase && st.phase !== 'warmup') { out.push({ kind: 'start' }); st.stats = null; }
  st.phase = body.map.phase;
  out.push({ state: { kind: 'cs2', map: body.map.name, mine, theirs, team: p.team, kills: ms.kills || 0, deaths: ms.deaths || 0, assists: ms.assists || 0, mvps: ms.mvps || 0, health: p.state?.health ?? 0, round: body.map.round ?? 0 } });
  return out;
}

const gsiConfig = (url, token) => `"Regie"\r\n{\r\n "uri" "${url}"\r\n "timeout" "2.0"\r\n "buffer" "0.1"\r\n "throttle" "0.5"\r\n "heartbeat" "30.0"\r\n "auth" { "token" "${token}" }\r\n "data"\r\n {\r\n  "provider" "1"\r\n  "map" "1"\r\n  "round" "1"\r\n  "player_id" "1"\r\n  "player_state" "1"\r\n  "player_match_stats" "1"\r\n }\r\n}\r\n`;

// ---------- League of Legends ----------
function parseLol(data, st) {
  const out = [];
  const name = data.activePlayer?.riotIdGameName || data.activePlayer?.summonerName || '';
  const me = (data.allPlayers || []).find((p) => (p.riotIdGameName || p.summonerName) === name);
  if (!me) return out;
  const sc = me.scores || {};
  if (st.stats) {
    if (sc.kills > st.stats.kills) out.push({ kind: 'kill', amount: sc.kills - st.stats.kills });
    if (sc.deaths > st.stats.deaths) out.push({ kind: 'death', amount: sc.deaths - st.stats.deaths });
    if (sc.assists > st.stats.assists) out.push({ kind: 'assist', amount: sc.assists - st.stats.assists });
  } else out.push({ kind: 'start' });
  st.stats = { kills: sc.kills || 0, deaths: sc.deaths || 0, assists: sc.assists || 0 };
  for (const ev of data.events?.Events || []) {
    if (ev.EventID <= (st.lastEvent ?? -1)) continue;
    st.lastEvent = ev.EventID;
    if (ev.EventName === 'GameEnd') { out.push({ kind: ev.Result === 'Win' ? 'win' : 'loss' }); out.push({ kind: 'end' }); }
  }
  out.push({ state: { kind: 'lol', champion: me.championName, kills: sc.kills || 0, deaths: sc.deaths || 0, assists: sc.assists || 0, cs: sc.creepScore || 0, level: me.level || 0, time: data.gameData?.gameTime || 0 } });
  return out;
}

class LolLive extends EventEmitter {
  constructor(port = 2999) { super(); this.port = port; this.st = {}; }

  start() { this.on_ = true; this.tick(); }

  stop() { this.on_ = false; clearTimeout(this.timer); }

  tick() {
    if (!this.on_) return;
    // Certificat local signé par Riot : uniquement vers 127.0.0.1.
    const req = https.get({ host: '127.0.0.1', port: this.port, path: '/liveclientdata/allgamedata', rejectUnauthorized: false, timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try { for (const o of parseLol(JSON.parse(body), this.st)) this.emit('update', o); } catch { /* partie en chargement */ }
        this.timer = setTimeout(() => this.tick(), 3000);
      });
    });
    req.on('error', () => { this.st = {}; this.emit('update', { state: null }); this.timer = setTimeout(() => this.tick(), 6000); });
    req.on('timeout', () => req.destroy());
  }
}

// ---------- Minecraft (RCON) ----------
function rconPacket(id, type, body) {
  const b = Buffer.from(body, 'utf8');
  const out = Buffer.alloc(14 + b.length);
  out.writeInt32LE(10 + b.length, 0); out.writeInt32LE(id, 4); out.writeInt32LE(type, 8); b.copy(out, 12);
  return out;
}

function rconSend({ host = '127.0.0.1', port = 25575, password }, command) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    let buf = Buffer.alloc(0);
    let authed = false;
    const finish = (fn, v) => { clearTimeout(t); sock.destroy(); fn(v); };
    const t = setTimeout(() => finish(reject, new Error('Le serveur de jeu ne répond pas.')), 4000);
    sock.on('connect', () => sock.write(rconPacket(1, 3, password || '')));
    sock.on('error', () => finish(reject, new Error('Connexion au serveur de jeu impossible. Vérifie RCON.')));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 4 && buf.length >= 4 + buf.readInt32LE(0)) {
        const len = buf.readInt32LE(0);
        const id = buf.readInt32LE(4);
        const body = buf.toString('utf8', 12, 4 + len - 2);
        buf = buf.subarray(4 + len);
        if (!authed) {
          if (id === -1) return finish(reject, new Error('Mot de passe RCON refusé.'));
          authed = true;
          sock.write(rconPacket(2, 2, command));
        } else return finish(resolve, body);
      }
      return undefined;
    });
  });
}

// ---------- Détection du jeu et installations ----------
function detectGame(lines) {
  const running = new Set(lines.map((l) => l.toLowerCase()));
  // Du plus précis au moins précis : java peut tourner sans Minecraft.
  const sorted = [...GAMES].sort((a, b) => (a.id === 'minecraft') - (b.id === 'minecraft'));
  for (const g of sorted) if (g.exe.some((e) => running.has(e.toLowerCase()))) return g.id;
  return null;
}

function regValue(key, name) {
  try {
    const out = execFileSync('reg', ['query', key, '/v', name], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    return (out.match(new RegExp(`${name}\\s+REG_\\w+\\s+(.+)`, 'i')) || [])[1]?.trim() || '';
  } catch { return ''; }
}

function steamLibraries() {
  const root = regValue('HKCU\\Software\\Valve\\Steam', 'SteamPath').replace(/\//g, '\\');
  if (!root) return [];
  const libs = [root];
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.push(m[1].replace(/\\\\/g, '\\'));
  } catch { /* une seule bibliothèque */ }
  return [...new Set(libs)];
}

function findRocketLeague() {
  const dirs = [];
  try {
    const manifests = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
    for (const f of fs.readdirSync(manifests)) {
      if (!f.endsWith('.item')) continue;
      const j = JSON.parse(fs.readFileSync(path.join(manifests, f), 'utf8'));
      if (/rocket ?league/i.test(j.DisplayName || '')) dirs.push(j.InstallLocation);
    }
  } catch { /* Epic absent */ }
  for (const lib of steamLibraries()) dirs.push(path.join(lib, 'steamapps', 'common', 'rocketleague'));
  return dirs.find((d) => fs.existsSync(path.join(d, 'TAGame', 'Config')));
}

const findCs2 = () => steamLibraries().map((l) => path.join(l, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo', 'cfg')).find((d) => fs.existsSync(d));

const RL_INI = '[TAGame.MatchStatsExporter_TA]\r\nPacketSendRate=20\r\nPort=49123\r\nWebPort=49124\r\n';

function installRl() {
  const dir = findRocketLeague();
  if (!dir) return { ok: false, reason: 'Rocket League introuvable sur ce PC.', content: RL_INI, file: 'TAStatsAPI.ini' };
  const file = path.join(dir, 'TAGame', 'Config', 'TAStatsAPI.ini');
  try {
    fs.writeFileSync(file, RL_INI);
    return { ok: true, file };
  } catch { return { ok: false, reason: 'Windows refuse l\'écriture dans ce dossier.', folder: path.dirname(file), content: RL_INI, file: 'TAStatsAPI.ini' }; }
}

function installCs2(port, token) {
  const content = gsiConfig(`http://127.0.0.1:${port}/gsi/cs2`, token);
  const dir = findCs2();
  if (!dir) return { ok: false, reason: 'Counter-Strike 2 introuvable sur ce PC.', content, file: 'gamestate_integration_regie.cfg' };
  const file = path.join(dir, 'gamestate_integration_regie.cfg');
  try {
    fs.writeFileSync(file, content);
    return { ok: true, file };
  } catch { return { ok: false, reason: 'Windows refuse l\'écriture dans ce dossier.', folder: dir, content, file: 'gamestate_integration_regie.cfg' }; }
}

class GameHub extends EventEmitter {
  constructor({ getName, gsiToken, log }) {
    super();
    Object.assign(this, { getName, gsiToken, log });
    this.running = null;
    this.rl = new RocketLeagueLive(getName);
    this.lol = new LolLive();
    this.cs2 = {};
    this.linked = { rl: false, cs2: false, lol: false };
    this.rl.on('update', (o) => this.forward(o));
    this.rl.on('link', (on) => { this.linked.rl = on; this.emit('links', this.linked); });
    this.lol.on('update', (o) => { this.linked.lol = Boolean(o.state) || Boolean(o.kind) || this.linked.lol; this.forward(o); });
  }

  forward(o) { this.emit('update', o); }

  gsi(body) {
    if (body?.auth?.token !== this.gsiToken) return;
    if (!this.linked.cs2) { this.linked.cs2 = true; this.emit('links', this.linked); }
    for (const o of parseCs2(body, this.cs2)) this.forward(o);
  }

  startWatch() {
    if (process.platform !== 'win32') return;
    const tick = () => execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, timeout: 8000, maxBuffer: 4 << 20 }, (err, out) => {
      if (err) return;
      const names = out.split('\n').map((l) => (l.match(/^"([^"]+)"/) || [])[1]).filter(Boolean);
      this.setRunning(detectGame(names));
    });
    tick();
    this.watch = setInterval(tick, 12000);
  }

  setRunning(id) {
    if (id === this.running) return;
    this.running = id;
    this.emit('running', id);
    if (id === 'rocketleague') this.rl.start(); else this.rl.stop();
    if (id === 'lol') this.lol.start(); else this.lol.stop();
  }

  stop() { clearInterval(this.watch); this.rl.stop(); this.lol.stop(); }
}

const newGsiToken = () => crypto.randomBytes(12).toString('hex');

module.exports = { GameHub, RocketLeagueLive, parseRl, parseCs2, parseLol, gsiConfig, detectGame, rconSend, rconPacket, installRl, installCs2, findRocketLeague, findCs2, newGsiToken, RL_INI };
