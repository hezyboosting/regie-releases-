// Plinko : chaque cadeau (ou chaque mise en points avec !plinko 100) lâche une balle qui rebondit
// sur des clous jusqu'à une case. La case donne des points, joue un son ou lance des actions.
// Le trajet est tiré ici puis envoyé à l'overlay, qui l'anime : le résultat ne dépend pas de l'affichage
// et reste le même si l'overlay est ouvert à plusieurs endroits.
const { Viewers } = require('./viewers');
const { defaultBins, naturalOdds } = require('../shared/plinko-bins');

const STEP_MS = 260; // durée d'un rebond dans l'overlay
const LAND_PAD_MS = 700;

function shuffle(a) { for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

class Plinko {
  constructor(engine) {
    this.e = engine;
    this.queue = [];
    this.inFlight = 0;
    this.recent = [];
    this.n = 0;
    this.lastBet = {};
    this.timers = new Set();
  }

  get c() { return this.e.s.plinko; }

  odds() {
    const c = this.c;
    if (c.mode === 'weights') {
      const total = c.bins.reduce((n, b) => n + Math.max(0, Number(b.weight) || 0), 0) || 1;
      return c.bins.map((b) => Math.max(0, Number(b.weight) || 0) / total);
    }
    return naturalOdds(c.rows);
  }

  // Trajet : une suite de 0 (gauche) et 1 (droite), une par rangée. La case est le nombre de 1.
  path() {
    const rows = this.c.rows;
    if (this.c.mode !== 'weights') {
      const p = Array.from({ length: rows }, () => (Math.random() < 0.5 ? 0 : 1));
      return { path: p, bin: p.reduce((n, x) => n + x, 0) };
    }
    const odds = this.odds();
    let r = Math.random();
    let bin = odds.length - 1;
    for (let i = 0; i < odds.length; i += 1) { r -= odds[i]; if (r <= 0) { bin = i; break; } }
    return { path: shuffle([...Array(bin).fill(1), ...Array(rows - bin).fill(0)]), bin };
  }

  view() {
    const c = this.c;
    const odds = this.odds();
    return { enabled: c.enabled, rows: c.rows, mode: c.mode, command: c.bet.command, bins: c.bins.map((b, i) => ({ label: b.label, color: b.color, mult: b.mult, points: b.points, odds: odds[i] || 0 })), recent: this.recent.slice(0, 8), stepMs: STEP_MS };
  }

  pushView() {
    const v = this.view();
    this.e.server.broadcast({ t: 'plinko', view: v }, 'plinko');
    this.e.push('plinko', v);
  }

  // Cadeaux : une balle par cadeau (ou plus), avec l'image officielle du cadeau.
  onEvent(ev) {
    const c = this.c;
    if (!c.enabled || !c.gifts.enabled || ev.type !== 'gift') return;
    if (c.gifts.giftId && String(ev.gift?.id) !== String(c.gifts.giftId)) return;
    const unit = Number(ev.gift?.cost) || (ev.amount ? (ev.value || 0) / ev.amount : ev.value || 0);
    if (unit < (c.gifts.minCoins || 1)) return;
    const balls = Math.max(1, Math.min(c.gifts.maxPerGift || 10, (Number(ev.amount) || 1) * Math.max(1, c.gifts.perGift || 1)));
    for (let i = 0; i < balls; i += 1) this.enqueue({ ev, image: ev.gift?.image || '', label: ev.gift?.name || '' });
  }

  // !plinko 100 : le spectateur mise ses points, la case multiplie sa mise.
  onBet(ev, args) {
    const c = this.c;
    if (!c.enabled || !c.bet.enabled) return false;
    const key = Viewers.key(ev);
    const wait = (c.bet.cooldown || 0) * 1000 - (Date.now() - (this.lastBet[key] || 0));
    if (wait > 0) { this.e.reply(ev, `${ev.user.display}, attends encore ${Math.ceil(wait / 1000)} s.`); return true; }
    const v = this.e.viewers.file.data.list[key] || this.e.viewers.session.viewers[key];
    const have = Math.floor(v?.points || 0);
    const raw = String(args || '').trim().split(/\s+/)[0];
    let amount = /^(tout|all|max)$/i.test(raw) ? have : Math.floor(Number(raw || c.bet.min));
    if (c.bet.max > 0) amount = Math.min(amount, c.bet.max);
    if (!(amount >= (c.bet.min || 1))) { this.e.reply(ev, `${ev.user.display}, mise au moins ${c.bet.min || 1} points.`); return true; }
    if (!this.e.viewers.spend(ev, amount)) { this.e.reply(ev, `${ev.user.display}, tu n'as que ${have} points.`); return true; }
    this.lastBet[key] = Date.now();
    this.enqueue({ ev, bet: amount, image: ev.user.avatar || '', label: `${amount}` });
    return true;
  }

  test(n = 1) {
    const sample = this.e.giftSample ? this.e.giftSample(6) : [];
    for (let i = 0; i < Math.max(1, Math.min(20, n)); i += 1) {
      const g = sample[Math.floor(Math.random() * sample.length)] || { name: 'Rose', image: '' };
      this.enqueue({ ev: { type: 'gift', test: true, platform: 'tiktok', user: { id: 'test', name: 'test', display: ['Léna', 'Marius', 'Kenza', 'Yanis'][i % 4], avatar: '' } }, image: g.image, label: g.name, test: true });
    }
    return this.view();
  }

  enqueue(ball) {
    if (this.queue.length > 200) return;
    this.queue.push(ball);
    this.pump();
  }

  pump() {
    const max = Math.max(1, this.c.maxBalls || 25);
    while (this.queue.length && this.inFlight < max) this.drop(this.queue.shift());
    if (this.queue.length && !this.pumpTimer) this.pumpTimer = setTimeout(() => { this.pumpTimer = null; this.pump(); }, 250);
  }

  drop(ball) {
    const { path, bin } = this.path();
    const id = `b${(this.n += 1)}`;
    const user = ball.ev.user?.display || '';
    this.inFlight += 1;
    this.e.server.broadcast({ t: 'plinko', drop: { id, path, bin, image: ball.image, user, bet: ball.bet || 0, label: ball.label } }, 'plinko');
    const t = setTimeout(() => { this.timers.delete(t); this.land(id, ball, bin, user); }, path.length * STEP_MS + LAND_PAD_MS);
    this.timers.add(t);
  }

  land(id, ball, binIndex, user) {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const b = this.c.bins[binIndex];
    if (!b) return;
    const payout = ball.bet ? Math.floor(ball.bet * (Number(b.mult) || 0)) : Math.max(0, Math.floor(Number(b.points) || 0));
    const key = Viewers.key(ball.ev);
    if (payout > 0 && !ball.test) this.e.play.credit(key, payout);
    if (b.actions?.length) this.e.runActions(b.actions, ball.ev, { ...this.e.commandVars(ball.ev, '', null), case: b.label, points: payout });
    const entry = { id, user, bin: binIndex, label: b.label, color: b.color, payout, bet: ball.bet || 0, image: ball.image, at: Date.now() };
    this.recent.unshift(entry);
    this.recent.length = Math.min(this.recent.length, 20);
    this.e.server.broadcast({ t: 'plinko', land: entry }, 'plinko');
    this.e.push('plinkoLand', entry);
    if (ball.bet && this.c.bet.announce && !ball.test) {
      const gain = payout - ball.bet;
      this.e.reply(ball.ev, gain > 0 ? `🎯 ${user} : ${b.label}, +${payout} points !` : `🎯 ${user} : ${b.label}, ${payout} points récupérés.`);
    }
    this.pump();
  }

  control(action, patch = {}) {
    const c = this.c;
    if (action === 'config') {
      for (const k of ['enabled', 'mode', 'maxBalls']) if (patch[k] !== undefined) c[k] = patch[k];
      if (patch.rows !== undefined) {
        const rows = Math.max(6, Math.min(16, Math.round(Number(patch.rows) || 12)));
        if (rows !== c.rows) { c.rows = rows; c.bins = defaultBins(rows + 1, patch.preset || 'equilibre'); }
      }
      if (patch.preset && patch.rows === undefined) c.bins = defaultBins(c.rows + 1, patch.preset);
      if (Array.isArray(patch.bins) && patch.bins.length === c.rows + 1) c.bins = patch.bins;
      if (patch.gifts) Object.assign(c.gifts, patch.gifts);
      if (patch.bet) Object.assign(c.bet, patch.bet);
      this.e.save();
      this.pushView();
      return c;
    }
    if (action === 'test') return this.test(patch.n || 1);
    if (action === 'clear') { this.recent = []; this.queue = []; this.pushView(); return this.view(); }
    return this.view();
  }

  stop() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); clearTimeout(this.pumpTimer); }
}

module.exports = { Plinko, defaultBins, naturalOdds, STEP_MS };
