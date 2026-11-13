// Live interactif : roue de la fortune et course aux likes. Chaque résultat peut lancer des actions
// (touche dans le jeu, commande Minecraft, son, scène OBS…), donc ça marche avec n'importe quel jeu.
const crypto = require('crypto');
const { Viewers } = require('./viewers');

const rand = (n) => crypto.randomInt(Math.max(1, n));
const SPIN_TURNS = 5;

class Interactive {
  constructor(engine) {
    this.e = engine;
    this.wheel = { status: 'idle', index: 0, turns: 0, user: '', result: '', resultColor: '', spinMs: 6000, startedAt: 0, queue: [] };
    this.race = { status: 'idle', racers: {}, winner: null, round: 0, startedAt: 0 };
    this.likeAcc = 0;
    this.timers = {};
    this.counts = { spins: 0, raceWinners: [] };
  }

  get cfgWheel() { return this.e.s.tools.wheel; }

  get cfgRace() { return this.e.s.tools.likeRace; }

  stop() { for (const t of Object.values(this.timers)) clearTimeout(t); }

  later(name, ms, fn) { clearTimeout(this.timers[name]); this.timers[name] = setTimeout(fn, ms); }

  en() { return this.e.s.settings.uiLang === 'en'; }

  // ---------- Roue de la fortune ----------
  wheelView() {
    const c = this.cfgWheel;
    const w = this.wheel;
    return {
      status: w.status, index: w.index, turns: w.turns, user: w.user, result: w.result, resultColor: w.resultColor, spinMs: w.spinMs, startedAt: w.startedAt,
      queue: w.queue.length, next: w.queue.slice(0, 5).map((q) => q.user),
      segments: (c.segments || []).filter((x) => x.weight > 0).map((x) => ({ id: x.id, label: x.label, color: x.color, image: x.image || '', emoji: x.emoji || '' })),
      title: c.title || '', command: c.command || '', minCoins: c.giftId ? 0 : (c.minCoins || 0), likesEvery: c.likesEvery || 0, cost: c.cost || 0,
    };
  }

  pushWheel() {
    const view = this.wheelView();
    this.e.push('wheel', view);
    this.e.server.broadcast({ t: 'wheel', wheel: view }, 'wheel');
  }

  // Un tour de roue demandé par un viewer, un cadeau, une automatisation ou le streamer.
  wheelRequest(ev, why = '') {
    const c = this.cfgWheel;
    const segs = (c.segments || []).filter((x) => x.weight > 0);
    if (!segs.length) throw new Error('Ajoute des cases à la roue.');
    const user = ev?.user?.display || ev?.user?.name || (this.en() ? 'Streamer' : 'Le streamer');
    const w = this.wheel;
    if (w.status !== 'idle') {
      if (w.queue.length >= (c.maxQueue || 30)) return false;
      w.queue.push({ ev, user, why });
      this.pushWheel();
      return true;
    }
    this.spin(ev, user);
    return true;
  }

  spin(ev, user) {
    const c = this.cfgWheel;
    const segs = (c.segments || []).filter((x) => x.weight > 0);
    if (!segs.length) { this.wheel.status = 'idle'; this.wheel.queue = []; this.pushWheel(); return; }
    const total = segs.reduce((n, x) => n + Number(x.weight || 0), 0);
    let r = rand(Math.round(total * 100)) / 100;
    let index = 0;
    for (let i = 0; i < segs.length; i += 1) { r -= Number(segs[i].weight || 0); if (r < 0) { index = i; break; } }
    const win = segs[index];
    const spinMs = Math.max(2, Math.min(20, Number(c.spinSeconds) || 6)) * 1000;
    Object.assign(this.wheel, { status: 'spinning', index, turns: SPIN_TURNS + rand(3), user, result: '', resultColor: '', spinMs, startedAt: Date.now() });
    this.counts.spins += 1;
    this.pushWheel();
    this.fx(ev, c.spinSound);
    this.later('wheel', spinMs + 300, () => {
      Object.assign(this.wheel, { status: 'result', result: win.label, resultColor: win.color });
      this.pushWheel();
      const event = ev || { type: 'custom', platform: 'twitch', accountId: 'system', channel: 'Régie', user: { display: user } };
      const vars = { ...this.e.commandVars(event, '', null), result: win.label, user };
      if (c.announce) this.e.reply(event, this.e.expand(c.announceText || (this.en() ? '🎡 {user} landed on: {result}' : '🎡 {user} tombe sur : {result}'), vars));
      this.fx(event, c.resultSound, c.voice ? (this.en() ? `${user} landed on ${win.label}` : `${user} tombe sur ${win.label}`) : '');
      if (win.points) this.award(event, win.points);
      try { this.e.runActions(win.actions || [], event, vars); } catch (e) { this.e.log(`Roue : ${e.message}`); }
      this.e.fireType('wheel', event, (t) => !t.on.name || t.on.name.toLowerCase() === String(win.label).toLowerCase());
      this.later('wheel', Math.max(2, Number(c.resultSeconds) || 6) * 1000, () => this.wheelNext());
    });
  }

  wheelNext() {
    const next = this.wheel.queue.shift();
    if (next) { this.spin(next.ev, next.user); return; }
    Object.assign(this.wheel, { status: 'idle', result: '', resultColor: '' });
    this.pushWheel();
  }

  award(ev, points) {
    const key = Viewers.key(ev);
    const box = this.e.viewers.file.data.list[key] || this.e.viewers.session.viewers[key];
    if (box) { box.points += Number(points) || 0; this.e.viewers.file.save(); }
  }

  wheelControl(action, arg) {
    const c = this.cfgWheel;
    if (action === 'spin') this.wheelRequest(null, 'manual');
    if (action === 'clear') { this.wheel.queue = []; }
    if (action === 'skip') { clearTimeout(this.timers.wheel); this.wheelNext(); }
    if (action === 'config' && arg && typeof arg === 'object') {
      for (const k of ['title', 'command', 'cost', 'cooldown', 'giftId', 'minCoins', 'likesEvery', 'onFollow', 'onSub', 'onShare', 'spinSeconds', 'resultSeconds', 'announce', 'announceText', 'maxQueue', 'segments', 'enabled', 'spinSound', 'resultSound', 'voice']) {
        if (arg[k] !== undefined) c[k] = arg[k];
      }
      this.e.save();
    }
    this.pushWheel();
    return c;
  }

  // Son et voix : jouent comme les actions (sortie choisie dans Sons), sans bloquer la roue si ça échoue.
  fx(ev, sound, say = '') {
    const event = ev || { type: 'custom', platform: 'twitch', accountId: 'system', channel: 'Régie', user: { display: 'Régie' } };
    const list = [];
    if (sound) list.push({ type: 'sound', sound, volume: 85 });
    if (say) list.push({ type: 'tts', text: say });
    if (list.length) { try { this.e.runActions(list, event, this.e.commandVars(event, '', null)); } catch (e) { this.e.log(`Son : ${e.message}`); } }
  }

  // ---------- Course aux likes ----------
  raceView() {
    const c = this.cfgRace;
    const r = this.race;
    const list = Object.values(r.racers).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(10, c.lanes || 5)));
    return {
      status: r.status, round: r.round, target: c.target || 1000, startedAt: r.startedAt, title: c.title || '',
      racers: list.map((x) => ({ key: x.key, name: x.name, avatar: x.avatar, platform: x.platform, score: Math.floor(x.score) })),
      winner: r.winner, total: Object.keys(r.racers).length,
    };
  }

  pushRace() {
    const view = this.raceView();
    this.e.push('likeRace', view);
    this.e.server.broadcast({ t: 'likerace', race: view }, 'likerace');
  }

  raceStart() {
    clearTimeout(this.timers.race);
    this.fx(null, this.cfgRace.startSound);
    this.race = { status: 'running', racers: {}, winner: null, round: (this.race.round || 0) + 1, startedAt: Date.now() };
    this.pushRace();
  }

  raceStop() {
    clearTimeout(this.timers.race);
    this.race = { ...this.race, status: 'idle', racers: {}, winner: null };
    this.pushRace();
  }

  raceAdd(ev, points) {
    const c = this.cfgRace;
    if (!c.enabled || points <= 0) return;
    if (this.race.status === 'idle' && c.autoStart) this.raceStart();
    if (this.race.status !== 'running') return;
    const key = Viewers.key(ev);
    const r = this.race.racers[key] || (this.race.racers[key] = { key, name: ev.user.display || ev.user.name || '?', avatar: '', platform: ev.platform, score: 0 });
    if (ev.user.avatar) r.avatar = ev.user.avatar;
    r.score += points;
    if (r.score >= (c.target || 1000)) {
      this.race.status = 'won';
      this.race.winner = { name: r.name, avatar: r.avatar, platform: r.platform, score: Math.floor(r.score) };
      this.counts.raceWinners.push(r.name);
      const vars = { ...this.e.commandVars(ev, '', null), winner: r.name };
      if (c.announce) this.e.reply(ev, this.e.expand(c.announceText || (this.en() ? '🏁 {winner} wins the like race!' : '🏁 {winner} gagne la course aux likes !'), vars));
      this.fx(ev, c.winSound, c.voice ? (this.en() ? `${r.name} wins the like race!` : `${r.name} gagne la course aux likes !`) : '');
      try { this.e.runActions(c.actions || [], ev, vars); } catch (e) { this.e.log(`Course : ${e.message}`); }
      if (c.prize) this.award(ev, c.prize);
      this.pushRace();
      if (c.autoRestart) this.later('race', Math.max(3, Number(c.restartSeconds) || 15) * 1000, () => this.raceStart());
      return;
    }
    // Pas plus de 4 envois par seconde vers les overlays, même sous une pluie de likes.
    if (!this.timers.raceThrottle) this.timers.raceThrottle = setTimeout(() => { this.timers.raceThrottle = null; this.pushRace(); }, 250);
  }

  raceControl(action, arg) {
    const c = this.cfgRace;
    if (action === 'start') this.raceStart();
    if (action === 'stop') this.raceStop();
    if (action === 'config' && arg && typeof arg === 'object') {
      for (const k of ['enabled', 'title', 'target', 'lanes', 'autoStart', 'autoRestart', 'restartSeconds', 'chatPoints', 'coinPoints', 'sharePoints', 'followPoints', 'announce', 'announceText', 'prize', 'actions', 'startSound', 'winSound', 'voice']) {
        if (arg[k] !== undefined) c[k] = arg[k];
      }
      this.e.save();
    }
    this.pushRace();
    return c;
  }

  // ---------- Branchements ----------
  onEvent(ev) {
    const w = this.cfgWheel;
    if (w.enabled !== false) {
      if (ev.type === 'gift' && ((w.giftId && ev.gift?.id === w.giftId) || (!w.giftId && w.minCoins > 0 && (ev.value || 0) >= w.minCoins))) this.safeSpin(ev);
      if (ev.type === 'follow' && w.onFollow) this.safeSpin(ev);
      if (['sub', 'resub', 'giftsub', 'member'].includes(ev.type) && w.onSub) this.safeSpin(ev);
      if (ev.type === 'share' && w.onShare) this.safeSpin(ev);
      if (ev.type === 'like' && w.likesEvery > 0) {
        this.likeAcc += ev.amount || 0;
        while (this.likeAcc >= w.likesEvery) { this.likeAcc -= w.likesEvery; this.safeSpin(ev); }
      }
    }
    const c = this.cfgRace;
    if (c.enabled) {
      const pts = ev.type === 'like' ? (ev.amount || 0)
        : ev.type === 'chat' ? (c.chatPoints || 0)
          : ev.type === 'gift' ? (ev.value || 0) * (c.coinPoints || 0)
            : ev.type === 'share' ? (c.sharePoints || 0)
              : ev.type === 'follow' ? (c.followPoints || 0) : 0;
      if (pts > 0 && ev.user) this.raceAdd(ev, pts);
    }
  }

  safeSpin(ev) { try { this.wheelRequest(ev, ev.type); } catch (e) { this.e.log(`Roue : ${e.message}`); } }

  onChat(ev, cmd) {
    const w = this.cfgWheel;
    if (w.enabled === false || !w.command || cmd !== String(w.command).toLowerCase()) return false;
    if (this.e.cooled(`wheel:${ev.platform}:${ev.user.id || ev.user.name}`, w.cooldown || 0)) return true;
    if (w.cost > 0) {
      const key = Viewers.key(ev);
      const box = this.e.viewers.file.data.list[key] || this.e.viewers.session.viewers[key];
      if (!box || box.points < w.cost) {
        this.e.reply(ev, this.en() ? `${ev.user.display}, you need ${w.cost} points to spin the wheel.` : `${ev.user.display}, il te faut ${w.cost} points pour lancer la roue.`);
        return true;
      }
      box.points -= w.cost;
      this.e.viewers.file.save();
    }
    this.safeSpin(ev);
    return true;
  }
}

module.exports = { Interactive };
