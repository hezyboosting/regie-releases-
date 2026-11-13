// Le chat joue et Paris.
//  - Le chat joue : des mots du chat (« saute », « gauche »…) lancent des actions dans le jeu (touche,
//    manette virtuelle, commande serveur…). Mode chaos : chaque message compte (avec un débit maximum).
//    Mode vote : on compte pendant quelques secondes et le plus demandé gagne.
//  - Paris : une question, 2 à 4 réponses, les spectateurs misent leurs points avec !parier 2 100.
//    Les gagnants se partagent la cagnotte au prorata de leur mise ; un pari annulé rembourse tout le monde.
const { Viewers } = require('./viewers');

const plain = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

class Play {
  constructor(engine) {
    this.e = engine;
    this.votes = new Map();
    this.round = null;
    this.userAt = new Map();
    this.stamps = [];
    this.recent = [];
    // Après un redémarrage : un pari ouvert dont l'heure est passée se ferme, sinon son minuteur reprend.
    const p = engine.s.prediction;
    if (p?.status === 'open' && p.closesAt) {
      const left = p.closesAt - Date.now();
      if (left <= 0) p.status = 'locked'; else this.lockTimer = setTimeout(() => this.predictionLock(), left);
    }
  }

  get cp() { return this.e.s.chatPlays; }
  get pr() { return this.e.s.prediction; }

  stop() { clearTimeout(this.roundTimer); clearTimeout(this.lockTimer); }

  // ---------------- Le chat joue ----------------
  match(text) {
    const c = this.cp;
    let t = plain(text);
    if (c.prefix) { if (!t.startsWith(plain(c.prefix))) return null; t = t.slice(plain(c.prefix).length).trim(); } else t = t.replace(/^!/, '');
    const word = t.split(/\s+/)[0];
    if (!word) return null;
    return (c.commands || []).find((x) => x.enabled !== false && [x.word, ...String(x.aliases || '').split(',')].map(plain).filter(Boolean).includes(word)) || null;
  }

  onChat(ev) {
    const c = this.cp;
    if (!c?.enabled) return false;
    const cmd = this.match(ev.text);
    if (!cmd) return false;
    const key = Viewers.key(ev);
    const now = Date.now();
    if (now - (this.userAt.get(key) || 0) < (c.userCooldown || 0) * 1000) return true;
    this.userAt.set(key, now);
    if (c.mode === 'vote') {
      this.votes.set(key, cmd.id);
      if (!this.round) this.startRound();
      this.push();
      return true;
    }
    this.stamps = this.stamps.filter((t) => now - t < 1000);
    if (this.stamps.length >= Math.max(1, c.maxPerSecond || 4)) return true;
    this.stamps.push(now);
    this.fire(cmd, ev, { user: ev.user?.display || '' });
    return true;
  }

  startRound() {
    const ms = Math.max(2, this.cp.voteSeconds || 6) * 1000;
    this.round = { n: (this.round?.n || 0) + 1, endsAt: Date.now() + ms };
    clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => this.endRound(), ms);
  }

  tallies() {
    const out = {};
    for (const id of this.votes.values()) out[id] = (out[id] || 0) + 1;
    return out;
  }

  endRound() {
    const t = this.tallies();
    const max = Math.max(0, ...Object.values(t));
    const best = Object.keys(t).filter((id) => t[id] === max);
    const id = best[Math.floor(Math.random() * best.length)];
    const cmd = (this.cp.commands || []).find((x) => x.id === id);
    const votes = this.votes.size;
    this.votes.clear();
    this.round = null;
    if (cmd) this.fire(cmd, { type: 'custom', platform: 'tiktok', user: { display: this.e.s.settings.uiLang === 'en' ? 'Chat' : 'Le chat' } }, { votes: max, total: votes });
    else this.push();
  }

  fire(cmd, ev, info) {
    this.recent.unshift({ id: cmd.id, label: cmd.label || cmd.word, emoji: cmd.emoji || '', at: Date.now(), ...info });
    this.recent = this.recent.slice(0, 8);
    this.e.runActions(cmd.actions || [], ev, { user: ev.user?.display || '', command: cmd.word });
    this.push(true);
  }

  playsView() {
    const c = this.cp;
    return {
      enabled: Boolean(c.enabled), mode: c.mode, prefix: c.prefix || '', voteSeconds: c.voteSeconds,
      commands: (c.commands || []).filter((x) => x.enabled !== false).map((x) => ({ id: x.id, word: x.word, label: x.label || x.word, emoji: x.emoji || '' })),
      tallies: this.tallies(), voters: this.votes.size, round: this.round, recent: this.recent,
    };
  }

  push(fired = false) {
    const view = this.playsView();
    this.e.server.broadcast({ t: 'chatplays', view, fired }, 'chatplays');
    this.e.push('chatPlays', view);
  }

  playsControl(action, patch) {
    if (action === 'config') { Object.assign(this.cp, patch); this.e.save(); this.push(); return this.cp; }
    if (action === 'test') {
      const cmd = (this.cp.commands || []).find((x) => x.id === patch?.id) || this.cp.commands?.[0];
      if (!cmd) throw new Error('Ajoute une commande.');
      this.fire(cmd, { type: 'custom', platform: 'tiktok', user: { display: 'Test' } }, { user: 'Test' });
      return this.cp;
    }
    if (action === 'reset') { this.votes.clear(); this.round = null; clearTimeout(this.roundTimer); this.recent = []; this.push(); return this.cp; }
    return this.cp;
  }

  // ---------------- Paris ----------------
  predictionView() {
    const p = this.pr;
    const bets = Object.values(p.bets || {});
    const total = bets.reduce((n, b) => n + b.amount, 0);
    const options = (p.options || []).map((o, i) => {
      const mine = bets.filter((b) => b.option === i);
      const sum = mine.reduce((n, b) => n + b.amount, 0);
      return { label: o.label, total: sum, count: mine.length, pct: total ? sum / total : 0, ratio: sum ? total / sum : 0, top: mine.sort((a, b) => b.amount - a.amount).slice(0, 3).map((b) => ({ name: b.name, amount: b.amount })) };
    });
    return { status: p.status, question: p.question, options, total, count: bets.length, closesAt: p.closesAt || 0, winner: p.winner ?? -1, command: this.e.s.rewards.commandBet || '!parier', history: (p.history || []).slice(0, 5) };
  }

  pushPrediction() {
    const view = this.predictionView();
    this.e.server.broadcast({ t: 'prediction', view }, 'prediction');
    this.e.push('prediction', view);
  }

  predictionOpen({ question, options, seconds }) {
    const p = this.pr;
    if (p.status === 'open' || p.status === 'locked') throw new Error('Un pari est déjà en cours : termine-le ou annule-le d\'abord.');
    const opts = (options || []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4);
    if (!String(question || '').trim()) throw new Error('Écris la question du pari.');
    if (opts.length < 2) throw new Error('Il faut au moins deux réponses.');
    Object.assign(p, { status: 'open', id: `p${Date.now()}`, question: String(question).trim(), options: opts.map((label) => ({ label })), bets: {}, winner: -1, closesAt: seconds > 0 ? Date.now() + seconds * 1000 : 0 });
    clearTimeout(this.lockTimer);
    if (seconds > 0) this.lockTimer = setTimeout(() => this.predictionLock(), seconds * 1000);
    this.e.save();
    const cmd = this.e.s.rewards.commandBet || '!parier';
    this.e.announce?.(`🎲 Pari ouvert : ${p.question} ${opts.map((o, i) => `${i + 1}. ${o}`).join(' · ')} Tape ${cmd} <numéro> <points>.`);
    this.pushPrediction();
    return this.predictionView();
  }

  predictionLock() {
    const p = this.pr;
    if (p.status !== 'open') return this.predictionView();
    p.status = 'locked';
    clearTimeout(this.lockTimer);
    this.e.save();
    this.e.announce?.('🔒 Les paris sont fermés.');
    this.pushPrediction();
    return this.predictionView();
  }

  // Les points sont pris au moment du pari ; on les rend (ou on paie) sur la fiche du spectateur.
  credit(key, amount) {
    const v = this.e.viewers;
    for (const box of [v.file.data.list, v.session.viewers]) if (box[key]) box[key].points = (box[key].points || 0) + amount;
    v.file.save();
  }

  predictionResolve(index) {
    const p = this.pr;
    if (p.status !== 'open' && p.status !== 'locked') throw new Error('Aucun pari en cours.');
    const i = Number(index);
    if (!(i >= 0 && i < p.options.length)) throw new Error('Choisis la bonne réponse.');
    clearTimeout(this.lockTimer);
    const bets = Object.entries(p.bets || {});
    const total = bets.reduce((n, [, b]) => n + b.amount, 0);
    const winners = bets.filter(([, b]) => b.option === i);
    const winPool = winners.reduce((n, [, b]) => n + b.amount, 0);
    let paid = 0;
    if (!winPool) for (const [k, b] of bets) this.credit(k, b.amount);
    else for (const [k, b] of winners) { const g = Math.floor((b.amount * total) / winPool); paid += g; this.credit(k, g); }
    p.status = 'done';
    p.winner = i;
    p.history = [{ question: p.question, winner: p.options[i].label, total, winners: winners.length, at: Date.now() }, ...(p.history || [])].slice(0, 20);
    this.e.save();
    this.e.announce?.(winPool ? (winners.length > 1 ? `🏆 ${p.options[i].label} ! ${winners.length} gagnants se partagent ${paid} points.` : `🏆 ${p.options[i].label} ! ${winners[0][1].name} remporte ${paid} points.`) : `${p.options[i].label} : personne n'avait misé dessus, tout le monde est remboursé.`);
    this.pushPrediction();
    return this.predictionView();
  }

  predictionCancel() {
    const p = this.pr;
    if (p.status !== 'open' && p.status !== 'locked') return this.predictionView();
    clearTimeout(this.lockTimer);
    for (const [k, b] of Object.entries(p.bets || {})) this.credit(k, b.amount);
    p.status = 'cancelled';
    this.e.save();
    this.e.announce?.('Pari annulé : tout le monde est remboursé.');
    this.pushPrediction();
    return this.predictionView();
  }

  // Des mises de faux spectateurs, pour voir l'overlay et le partage de la cagnotte sans attendre le live.
  predictionSimulate() {
    const p = this.pr;
    if (p.status !== 'open') throw new Error('Ouvre un pari pour simuler des mises.');
    for (const n of ['Léna', 'Marius', 'Kenza', 'Yanis', 'Inès', 'Tom', 'Sarah', 'Noah']) {
      const k = `sim:${n}`;
      if (!p.bets[k]) p.bets[k] = { name: n, platform: 'tiktok', option: Math.floor(Math.random() * p.options.length), amount: [50, 100, 150, 250, 500, 1000][Math.floor(Math.random() * 6)], sim: true };
    }
    this.e.save();
    this.pushPrediction();
    return this.predictionView();
  }

  // !parier 2 100 · !parier 2 tout
  onBet(ev, args) {
    const p = this.pr;
    if (p.status !== 'open') { this.e.reply(ev, 'Aucun pari ouvert pour le moment.'); return true; }
    const [a, b] = String(args || '').trim().split(/\s+/);
    const i = Number(a) - 1;
    if (!(i >= 0 && i < p.options.length)) { this.e.reply(ev, `${ev.user.display}, choisis une réponse de 1 à ${p.options.length}.`); return true; }
    const key = Viewers.key(ev);
    const v = this.e.viewers.file.data.list[key] || this.e.viewers.session.viewers[key];
    const have = Math.floor(v?.points || 0);
    const amount = /^(tout|all|max)$/i.test(b || '') ? have : Math.floor(Number(b));
    const min = Math.max(1, this.e.s.rewards.minBet || 1);
    if (!(amount >= min)) { this.e.reply(ev, `${ev.user.display}, mise au moins ${min} points.`); return true; }
    const prev = p.bets[key];
    if (prev && prev.option !== i) { this.e.reply(ev, `${ev.user.display}, tu as déjà parié sur ${prev.option + 1}.`); return true; }
    if (!this.e.viewers.spend(ev, amount)) { this.e.reply(ev, `${ev.user.display}, tu n'as que ${have} points.`); return true; }
    p.bets[key] = { name: ev.user.display, platform: ev.platform, option: i, amount: (prev?.amount || 0) + amount };
    this.e.save();
    this.pushPrediction();
    return true;
  }
}

module.exports = { Play };
