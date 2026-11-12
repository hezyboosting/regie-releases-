// Morceau en cours lu depuis Windows : aucun compte, aucune clé, et Spotify gratuit suffit.
// Si PowerShell est bloqué sur le PC, le titre de la fenêtre Spotify prend le relais.
const { EventEmitter } = require('events');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const IDLE = { playing: false, track: null, queue: [] };
const NOT_MUSIC = /^(advertisement|publicité|spotify( free| premium)?)$/i;

function toState(o, cover, now = Date.now()) {
  if (!o || o.none || !o.title || (NOT_MUSIC.test(o.title) && !o.artist)) return { ...IDLE };
  const position = Number(o.position) || 0;
  const updated = Number(o.updated) || now;
  const moved = o.playing && updated > 0 ? Math.max(0, now - updated) : 0;
  const duration = Number(o.duration) || 0;
  return {
    playing: Boolean(o.playing), progress: duration ? Math.min(duration, position + moved) : 0, device: 'Ce PC', at: now,
    track: { id: `${o.title}|${o.artist || ''}`, uri: '', title: o.title, artist: o.artist || '', album: o.album || '', cover: cover || '', duration },
    queue: [],
  };
}

const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
const decode850 = (buf) => Array.from(buf, (b) => (b < 128 ? String.fromCharCode(b) : CP850[b - 128])).join('');

// La fenêtre de Spotify s'appelle « Artiste - Titre » pendant la lecture.
function fromTasklist(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const cells = line.match(/"([^"]*)"/g)?.map((c) => c.slice(1, -1));
    const title = cells?.[cells.length - 1] || '';
    const i = title.indexOf(' - ');
    if (i > 0) return { artist: title.slice(0, i), title: title.slice(i + 3), playing: true };
  }
  return { none: true };
}

class NowPlaying extends EventEmitter {
  constructor({ dir, log = () => {} }) {
    super();
    Object.assign(this, { dir, log, child: null, stopped: true, failures: 0, cover: '', mode: 'spotify', retryMs: 5000 });
  }

  start(mode = 'spotify') {
    this.stop();
    this.mode = mode;
    this.stopped = false;
    if (process.platform !== 'win32') return;
    this.launch();
  }

  launch() {
    const file = path.join(this.dir, 'nowplaying.ps1');
    try {
      fs.writeFileSync(file, fs.readFileSync(path.join(__dirname, 'nowplaying.ps1')));
    } catch (e) { this.log(`Lecture en cours : ${e.message}`); return this.fallback(); }
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, '-Mode', this.mode], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdin.on('error', () => {});
    readline.createInterface({ input: child.stdout }).on('line', (line) => this.onLine(line));
    let errors = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { errors += d; });
    child.on('error', (e) => { this.log(`Lecture en cours : ${e.message}`); });
    child.on('close', () => {
      if (this.child === child) this.child = null;
      if (this.stopped) return;
      if (errors) this.log(`Lecture en cours : ${errors.slice(0, 300)}`);
      this.failures += 1;
      if (this.failures >= 3) this.fallback(); else this.retry = setTimeout(() => this.launch(), this.retryMs);
    });
    return undefined;
  }

  onLine(line) {
    let o;
    try { o = JSON.parse(line.replace(/^\uFEFF/, '')); } catch { return; }
    if (o.error) { this.log(`Lecture en cours : ${o.error}`); return; }
    this.failures = 0;
    if (o.cover !== undefined) this.cover = o.cover;
    this.emit('state', toState(o, this.cover));
  }

  fallback() {
    clearInterval(this.poll);
    this.log('Lecture en cours : lecture du titre de la fenêtre Spotify');
    const tick = () => execFile('tasklist', ['/v', '/fi', 'imagename eq Spotify.exe', '/fo', 'csv', '/nh'], { windowsHide: true, encoding: 'buffer' }, (err, out) => {
      if (!err && !this.stopped) this.emit('state', toState(fromTasklist(decode850(out)), ''));
    });
    this.poll = setInterval(tick, 3000);
    tick();
  }

  get status() { return this.poll ? 'window' : this.child ? 'media' : 'off'; }

  send(command) {
    if (!this.child) throw new Error('Le contrôle de la lecture n\'est pas disponible pour le moment.');
    this.child.stdin.write(`${command}\n`);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.poll);
    this.poll = null;
    const c = this.child;
    this.child = null;
    if (c) { try { c.stdin.end(); } catch { /* déjà fermé */ } setTimeout(() => { try { c.kill(); } catch { /* terminé */ } }, 1500).unref?.(); }
  }
}

module.exports = { NowPlaying, toState, fromTasklist, decode850 };
