// File de lecture TTS. La synthèse a lieu dans une fenêtre cachée (voix Windows) ou chez ElevenLabs.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { uid } = require('../shared/defaults');
const { renderTemplate, filterText } = require('./text');

const RANK = { all: 0, sub: 1, vip: 2, mod: 3, owner: 4 };
const userRank = (u = {}) => (u.owner ? 4 : u.mod ? 3 : u.vip ? 2 : u.sub ? 1 : 0);

class Tts {
  constructor({ getConfig, getFeatures, getElevenKey, getVoices, mediaDir, overlay, engineSend, push, log }) {
    Object.assign(this, { getConfig, getFeatures, getElevenKey, getVoices, mediaDir, overlay, engineSend, push, log });
    this.queue = [];
    this.current = null;
    this.cool = new Map();
    this.ttsDir = path.join(mediaDir, 'tts');
    fs.mkdirSync(this.ttsDir, { recursive: true });
  }

  fromEvent(ev) {
    const c = this.getConfig();
    if (!c.enabled || !c.platforms?.includes(ev.platform)) return;
    const read = c.read || {};
    if (ev.type === 'chat') {
      if (read.chat && !(c.skipCommands && ev.text?.startsWith('!'))) this.say({ text: ev.text, user: ev.user, ev });
    } else if (ev.type === 'gift' && read.gift) this.say({ text: `${ev.user.display} envoie ${ev.amount} ${ev.gift?.name || 'cadeaux'}`, user: ev.user, force: true });
    else if ((ev.type === 'superchat' || ev.type === 'supersticker') && read.superchat) this.say({ text: `${ev.user.display} : ${ev.text || ''}`, user: ev.user, force: true });
    else if (ev.type === 'bits' && read.bits && (ev.amount || 0) >= (c.minBits || 0)) this.say({ text: `${ev.user.display} : ${ev.text || ''}`, user: ev.user, force: true });
    else if (['sub', 'resub'].includes(ev.type) && read.sub && ev.text) this.say({ text: `${ev.user.display} : ${ev.text}`, user: ev.user, force: true });
  }

  say({ text, user = {}, ev, viaCommand, force }) {
    const c = this.getConfig();
    if (!c.enabled) return false;
    if (viaCommand && !c.read?.command) return false;
    if (!this.permitted(user, force)) return false;
    if (!force) {
      const key = `${ev?.platform}:${user.id || user.name}`;
      if ((this.cool.get(key) || 0) > Date.now()) return false;
      this.cool.set(key, Date.now() + (c.cooldown || 0) * 1000);
    }
    const clean = filterText(text, { maxLength: c.maxLength, stripLinks: c.stripLinks, stripEmoji: c.stripEmoji, blocked: c.blocked });
    if (!clean) return false;
    const spoken = force ? clean : renderTemplate(c.template || '{text}', { user: user.display || '', text: clean });
    const f = this.getFeatures();
    const perUser = f.ttsPerUserVoice ? c.userVoices?.[(user.name || '').toLowerCase()] : null;
    this.queue.push({ id: uid('t'), text: spoken, display: clean, user: user.display || '', voice: this.voiceFor(perUser || c.voice), provider: c.provider === 'eleven' && f.ttsPremiumVoices ? 'eleven' : 'system' });
    if (this.queue.length > 30) this.queue.shift();
    this.pushState();
    this.next();
    return true;
  }

  // Liste noire d'abord, puis liste blanche, puis rôle minimum.
  permitted(user = {}, force) {
    const c = this.getConfig();
    const names = [user.name, user.display].filter(Boolean).map((n) => n.toLowerCase().replace(/^@/, ''));
    const has = (list) => (list || []).some((n) => names.includes(String(n).toLowerCase().replace(/^@/, '')));
    if (has(c.blockUsers)) return false;
    if (force) return true;
    if (has(c.allowUsers)) return true;
    return userRank(user) >= (RANK[c.perm] ?? 0);
  }

  // Gratuit : une seule voix par langue, la première proposée par Windows.
  allowedVoices() {
    const voices = this.getVoices?.() || [];
    if (this.getFeatures().ttsAllVoices) return voices;
    const seen = new Set();
    return voices.filter((v) => { const lang = (v.lang || '').slice(0, 2); if (seen.has(lang)) return false; seen.add(lang); return true; });
  }

  voiceFor(wanted) {
    const voices = this.getVoices?.() || [];
    if (!voices.length || this.getFeatures().ttsAllVoices) return wanted;
    const allowed = this.allowedVoices();
    return allowed.some((v) => v.id === wanted) ? wanted : '';
  }

  async next() {
    if (this.current || !this.queue.length) return;
    this.current = this.queue.shift();
    const job = this.current;
    const c = this.getConfig();
    this.pushState();
    this.overlay({ t: 'tts', phase: 'start', user: job.user, text: job.display });
    try {
      if (job.provider === 'eleven') {
        const file = await this.eleven(job.text, c);
        job.audio = `/media/tts/${path.basename(file)}`;
        this.engineSend('tts:audio', { id: job.id, url: pathToFileURL(file).href, volume: c.volume });
        this.overlay({ t: 'tts', phase: 'audio', url: job.audio, volume: c.volume });
      } else {
        this.engineSend('tts:speak', { id: job.id, text: job.text, voice: job.voice, rate: c.rate, pitch: c.pitch, volume: c.volume });
      }
      clearTimeout(this.guard);
      this.guard = setTimeout(() => this.done(job.id), Math.min(45000, 6000 + job.text.length * 200));
    } catch (e) {
      this.log(`TTS : ${e.message}`);
      this.done(job.id);
    }
  }

  async eleven(text, c) {
    const key = this.getElevenKey();
    if (!key) throw new Error('Ajoute ta clé ElevenLabs dans Réglages.');
    if (!c.elevenVoice) throw new Error('Choisis une voix ElevenLabs.');
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.elevenVoice)}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: c.elevenModel || 'eleven_turbo_v2_5' }),
    });
    if (!res.ok) throw new Error(`ElevenLabs a répondu ${res.status}`);
    const file = path.join(this.ttsDir, `${uid('tts')}.mp3`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    this.prune();
    return file;
  }

  prune() {
    try {
      const files = fs.readdirSync(this.ttsDir).map((f) => ({ f, t: fs.statSync(path.join(this.ttsDir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
      files.slice(20).forEach(({ f }) => fs.unlinkSync(path.join(this.ttsDir, f)));
    } catch { /* fichier en cours de lecture */ }
  }

  done(id) {
    if (!this.current || (id && this.current.id !== id)) return;
    clearTimeout(this.guard);
    this.current = null;
    this.overlay({ t: 'tts', phase: 'end' });
    this.pushState();
    this.next();
  }

  skip() { this.engineSend('tts:stop', {}); this.done(); }

  clear() { this.queue = []; this.pushState(); }

  pushState() { this.push('ttsQueue', { current: this.current, queue: this.queue.map((j) => ({ id: j.id, user: j.user, text: j.display })) }); }
}

module.exports = { Tts };
