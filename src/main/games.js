// Rangs, points, Chat Battle, Boss Battle et carte de rang de jeu.
const crypto = require('crypto');
const { renderTemplate } = require('./text');
const { Viewers } = require('./viewers');

const { gameById, rankLabel, nextRank, rankScore, STAT_LABEL } = require('../shared/games');

const BOSSES = [
  { id: 'golem', name: 'Golem de Basalte' }, { id: 'kraken', name: 'Kraken des Profondeurs' }, { id: 'hydre', name: 'Hydre de Néon' }, { id: 'spectre', name: 'Spectre du Lag' },
];

const rand = (n) => crypto.randomInt(n);
const BOTS = ['Lena', 'Marius', 'Kenza', 'Yanis', 'Inès', 'Théo', 'Sofia', 'Nolan', 'Maya', 'Noé', 'Zoé', 'Adam'];

const { rankImage } = require('../shared/rank-files');

class Games {
  constructor(engine) { this.e = engine; this.cool = new Map(); }

  get s() { return this.e.s; }

  stop() { clearTimeout(this.arenaTimer); clearInterval(this.bossTimer); clearTimeout(this.bossNext); }

  // ---------- Rangs ----------
  // Le jeu choisi fournit ses rangs ; « Autre jeu » garde la liste modifiable.
  rankPool() {
    const r = this.s.ranks;
    if (r.game === 'custom' || r.mode === 'points') return r.list.map((t, step) => ({ ...t, step, steps: r.list.length }));
    const images = this.e.s.gaming.rankImages?.[r.game] || {};
    const game = gameById(r.game);
    return game.ranks.map((t, step) => ({ ...t, image: rankImage(images, t.id, 1), step, steps: game.ranks.length, sides: game.sides, divisions: 0 }));
  }

  drawRank() {
    const list = this.rankPool();
    const total = list.reduce((n, r) => n + Math.max(0, r.weight), 0);
    if (!total) return list[0];
    let x = rand(total);
    for (const r of list) { x -= Math.max(0, r.weight); if (x < 0) return r; }
    return list[0];
  }

  rankForPoints(points) {
    const list = this.rankPool();
    return [...list].sort((a, b) => b.min - a.min).find((r) => points >= r.min) || list[0];
  }

  assignRank(ev, viewer) {
    const cfg = this.s.ranks;
    if (!cfg.enabled || !viewer) return null;
    const rank = cfg.mode === 'points' ? this.rankForPoints(viewer.points) : this.drawRank();
    if (viewer.rank !== rank.id) viewer.rank = rank.id;
    const roulette = cfg.reveal === 'roulette' && this.e.allowed('rankRoulette');
    const card = { user: ev.user.display, avatar: ev.user.avatar || '', platform: ev.platform, rank, roulette, pool: roulette ? this.rankPool().map((x) => ({ name: x.name, color: x.color, image: x.image, step: x.step, steps: x.steps, sides: x.sides })) : null, game: gameById(cfg.game).name };
    this.e.server.broadcast({ t: 'rank', card }, 'rankcard');
    this.e.push('rankCard', card);
    if (cfg.announce) this.e.reply(ev, renderTemplate(cfg.message, { user: ev.user.display, rank: rank.name }));
    return rank;
  }

  onEvent(ev, result) {
    if (result?.firstFollow) this.assignRank(ev, result.viewer);
    else if (ev.type === 'follow' && ev.test) this.assignRank(ev, result?.viewer);
    // Le rang suit les points quand ce mode est choisi.
    if (this.s.ranks.mode === 'points' && result?.viewer && result.gain > 0) {
      const next = this.rankForPoints(result.viewer.points);
      if (result.viewer.rank && next.id !== result.viewer.rank) this.assignRank(ev, result.viewer);
      else result.viewer.rank = next.id;
    }
    this.arenaBoost(ev);
    this.bossDamage(ev);
  }

  // ---------- Commandes de chat ----------
  onChat(ev, cmd, args) {
    const r = this.s.rewards;
    const a = this.s.arena;
    const b = this.s.boss;
    const low = (w) => String(w || '').toLowerCase();
    const staff = ev.user.mod || ev.user.owner;
    if (a.status === 'lobby' && cmd === low(a.joinWord)) { this.arenaJoin(ev); return true; }
    if (a.status === 'fight' && cmd === low(a.attackWord)) { this.arenaCharge(ev); return true; }
    if (b.status === 'fight' && cmd === low(b.hitWord)) { this.hitBoss(ev, b.damage.hit, 'hit'); return true; }
    if (cmd === '!boss' && staff && this.e.allowed('bossBattle')) { this.bossCommand(ev, args); return true; }
    if (r.enabled && cmd === low(r.commandPoints)) { this.e.reply(ev, `${ev.user.display} : ${this.e.viewers.points(ev).toLocaleString('fr-FR')} points`); return true; }
    if (r.enabled && cmd === low(r.commandTop)) {
      const top = this.e.viewers.board('points', 3, 'all').map((p, i) => `${i + 1}. ${p.name} (${p.value})`).join(' ');
      this.e.reply(ev, top || 'Pas encore de classement.');
      return true;
    }
    if (cmd === low(r.commandRank)) {
      const v = this.e.viewers.file.data.list[Viewers.key(ev)] || this.e.viewers.session.viewers[Viewers.key(ev)];
      const rank = this.rankPool().find((x) => x.id === v?.rank);
      this.e.reply(ev, rank ? `${ev.user.display} est ${rank.name}` : `${ev.user.display} n'a pas encore de rang`);
      return true;
    }
    if (cmd === '!niveau') { this.e.reply(ev, `${ev.user.display} est niveau ${this.e.viewers.level(ev)}`); return true; }
    if (cmd === low(this.s.gaming.command)) { this.rankCommand(ev, args); return true; }
    if (staff && ['!win', '!lose', '!kill', '!death'].includes(cmd)) { this.e.gameEvent({ '!win': 'win', '!lose': 'loss', '!kill': 'kill', '!death': 'death' }[cmd], {}); return true; }
    if (cmd === '!record') { this.e.reply(ev, this.e.gameRecord()); return true; }
    if (cmd === low(this.s.minigames.rouletteCommand) && this.e.allowed('miniGames')) { this.rouletteCommand(ev); return true; }
    const reward = r.enabled && r.list.find((x) => x.enabled !== false && low(x.command) === cmd);
    if (reward) { this.redeem(ev, reward); return true; }
    return false;
  }

  rouletteCommand(ev) {
    const m = this.s.minigames;
    if (this.e.cooled(`roulette:${ev.platform}:${ev.user.id}`, m.rouletteCooldown)) return;
    if (m.rouletteCost && !this.e.viewers.spend(ev, m.rouletteCost)) { this.e.reply(ev, `${ev.user.display}, il te faut ${m.rouletteCost} points.`); return; }
    this.e.minigames.spin(ev);
  }

  bossCommand(ev, args) {
    const b = this.s.boss;
    const sub = args.split(/\s+/)[0]?.toLowerCase();
    if (sub === 'start') this.bossStart();
    if (sub === 'stop') this.bossEnd(false);
    if (sub === 'skip' && b.status === 'fight') this.hitBoss(ev, b.hp, 'skip');
    if (sub === 'status') this.e.reply(ev, b.status === 'fight' ? `${b.name}, niveau ${b.level} : ${b.hp} sur ${b.maxHp} PV` : 'Aucun boss en cours.');
  }

  redeem(ev, reward) {
    if (!this.e.viewers.spend(ev, reward.cost)) { this.e.reply(ev, `${ev.user.display}, il te faut ${reward.cost} points pour ${reward.name}.`); return; }
    this.e.reply(ev, `${ev.user.display} utilise ${reward.name}`);
    const vars = this.e.commandVars(ev, '', null);
    (reward.actions || []).forEach((act) => this.e.runAction(act, ev, vars));
    this.e.pushLive();
  }

  // !rank affiche les rangs ; un modérateur peut écrire !rank 2v2 diamant 2 1050
  rankCommand(ev, args) {
    const game = gameById(this.s.gaming.active);
    const prof = this.e.profile(game.id);
    const parts = args.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && (ev.user.mod || ev.user.owner)) {
      const modeId = game.modes.find(([id, name]) => id.toLowerCase() === parts[0].toLowerCase() || name.toLowerCase() === parts[0].toLowerCase())?.[0];
      const clean = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      // Le nom du rang peut tenir sur plusieurs mots : on essaie le plus long d'abord.
      let tier = null;
      let used = 0;
      for (let n = parts.length - 1; n >= 1 && !tier; n -= 1) {
        const words = clean(parts.slice(1, n + 1).join(' '));
        tier = game.ranks.find((t) => clean(t.name) === words || t.id === words.replace(/ /g, '-')) || null;
        if (tier) used = n;
      }
      if (modeId && tier) {
        const [divisionText, mmrText] = parts.slice(used + 1);
        const division = Math.max(1, Math.min(tier.divisions || 1, Number(divisionText) || 1));
        this.e.setRank(game.id, modeId, { tier: tier.id, division, mmr: mmrText ? Number(mmrText) || 0 : prof.modes[modeId]?.mmr || 0 });
        this.e.reply(ev, `${game.modes.find(([id]) => id === modeId)[1]} : ${rankLabel(game, tier.id, division)}`);
      }
      return;
    }
    const line = game.modes.map(([id, name]) => { const m = prof.modes[id] || {}; return `${name} ${rankLabel(game, m.tier, m.division)}`; }).join(', ');
    this.e.reply(ev, `${prof.pseudo || game.name} : ${line}`);
  }

  // ---------- Chat Battle ----------
  pushArena() {
    this.e.push('arena', this.s.arena);
    this.e.server.broadcast({ t: 'arena', arena: this.s.arena }, 'arena');
  }

  arenaOpen(cfg = {}) {
    const a = this.s.arena;
    if (a.status === 'lobby' || a.status === 'fight') return;
    Object.assign(a, cfg, { status: 'lobby', fighters: [], log: [], winner: null, endsAt: Date.now() + a.lobby * 1000 });
    clearTimeout(this.arenaTimer);
    this.arenaTimer = setTimeout(() => this.arenaStart(), a.lobby * 1000);
    this.pushArena();
  }

  fighter(key, name, avatar, platform, bot) {
    return { key, name, avatar: avatar || '', platform, hp: 100, maxHp: 100, alive: true, kills: 0, charge: 0, bot: Boolean(bot) };
  }

  arenaJoin(ev) {
    const a = this.s.arena;
    const key = Viewers.key(ev);
    if (a.fighters.length >= a.maxFighters || a.fighters.some((f) => f.key === key)) return;
    a.fighters.push(this.fighter(key, ev.user.display, ev.user.avatar, ev.platform));
    this.pushArena();
  }

  arenaBots(n = 4) {
    const a = this.s.arena;
    if (a.status !== 'lobby') return;
    const free = BOTS.filter((b) => !a.fighters.some((f) => f.name === b));
    for (let i = 0; i < n && free.length && a.fighters.length < a.maxFighters; i += 1) {
      const name = free.splice(rand(free.length), 1)[0];
      a.fighters.push(this.fighter(`bot:${name}`, name, '', ['tiktok', 'twitch', 'youtube'][rand(3)], true));
    }
    this.pushArena();
  }

  arenaStart() {
    const a = this.s.arena;
    clearTimeout(this.arenaTimer);
    if (a.status !== 'lobby') return;
    if (a.fighters.length < 2) {
      a.status = 'idle';
      a.log = [{ text: 'Pas assez de combattants.' }];
      this.pushArena();
      return;
    }
    a.status = 'fight';
    a.endsAt = 0;
    this.pushArena();
    this.arenaTimer = setTimeout(() => this.arenaRound(), a.speed);
  }

  arenaRound() {
    const a = this.s.arena;
    if (a.status !== 'fight') return;
    const alive = a.fighters.filter((f) => f.alive);
    const attacker = alive[rand(alive.length)];
    const others = alive.filter((f) => f !== attacker);
    const target = others[rand(others.length)];
    const crit = rand(100) < 15;
    let dmg = 12 + rand(19);
    if (crit) dmg *= 2;
    if (attacker.charge > 0) { dmg += 15; attacker.charge -= 1; }
    target.hp = Math.max(0, target.hp - dmg);
    const ko = target.hp === 0;
    if (ko) { target.alive = false; attacker.kills += 1; }
    a.log.push({ a: attacker.name, t: target.name, d: dmg, crit, ko });
    a.log = a.log.slice(-6);
    const left = a.fighters.filter((f) => f.alive);
    if (left.length === 1) { this.arenaEnd(left[0]); return; }
    this.pushArena();
    this.arenaTimer = setTimeout(() => this.arenaRound(), a.speed);
  }

  arenaEnd(winner) {
    const a = this.s.arena;
    clearTimeout(this.arenaTimer);
    a.status = 'ended';
    a.winner = winner || null;
    if (winner && !winner.bot) {
      const box = this.e.viewers.file.data.list[winner.key] || this.e.viewers.session.viewers[winner.key];
      if (box) box.points += a.prize;
      this.e.viewers.file.save();
    }
    this.pushArena();
    this.e.pushLive();
  }

  arenaReset() {
    const a = this.s.arena;
    clearTimeout(this.arenaTimer);
    Object.assign(a, { status: 'idle', fighters: [], log: [], winner: null, endsAt: 0 });
    this.pushArena();
  }

  arenaCharge(ev) {
    const f = this.s.arena.fighters.find((x) => x.key === Viewers.key(ev) && x.alive);
    if (!f || f.chargedAt > Date.now() - 8000) return;
    f.chargedAt = Date.now();
    f.charge = Math.min(3, f.charge + 1);
  }

  // Un soutien pendant le combat soigne le combattant concerné.
  arenaBoost(ev) {
    const a = this.s.arena;
    if (a.status !== 'fight' || ev.type === 'chat') return;
    const f = a.fighters.find((x) => x.key === Viewers.key(ev) && x.alive);
    if (!f) return;
    const heal = ev.type === 'gift' ? Math.min(60, 10 + (ev.value || 0)) : ev.type === 'like' ? 2 : 20;
    f.hp = Math.min(f.maxHp, f.hp + heal);
    this.pushArena();
  }

  // ---------- Boss Battle ----------
  pushBoss() {
    this.e.push('boss', this.s.boss);
    this.e.server.broadcast({ t: 'boss', boss: this.s.boss }, 'boss');
  }

  bossStart(cfg = {}) {
    const b = this.s.boss;
    Object.assign(b, cfg);
    const def = BOSSES.find((x) => x.id === b.bossId) || BOSSES[0];
    b.name = cfg.name || def.name;
    if (!cfg.keepLevel) b.level = 1;
    b.maxHp = Math.round(b.baseHp * 1.5 ** (b.level - 1));
    b.hp = b.maxHp;
    b.status = 'fight';
    b.players = [];
    b.log = [];
    b.endsAt = b.duration ? Date.now() + b.duration * 1000 : 0;
    clearInterval(this.bossTimer);
    clearTimeout(this.bossNext);
    this.bossTimer = setInterval(() => this.bossTick(), 1000);
    this.pushBoss();
  }

  bossTick() {
    const b = this.s.boss;
    if (b.status !== 'fight') { clearInterval(this.bossTimer); return; }
    if (b.endsAt && Date.now() >= b.endsAt) { this.bossEnd(false); return; }
    if (b.regen > 0 && b.hp < b.maxHp) { b.hp = Math.min(b.maxHp, b.hp + Math.round((b.maxHp * b.regen) / 100)); this.pushBoss(); }
  }

  bossDamage(ev) {
    const b = this.s.boss;
    if (b.status !== 'fight') return;
    const d = b.damage;
    const amount = {
      chat: d.chat, like: d.like * (ev.amount || 0), follow: d.follow, share: d.share, sub: d.sub, resub: d.sub, member: d.sub,
      giftsub: d.sub * (ev.amount || 1), gift: d.coin * (ev.value || 0), bits: d.bit * (ev.amount || 0), superchat: d.money * (ev.value || 0), supersticker: d.money * (ev.value || 0),
    }[ev.type];
    if (amount) this.hitBoss(ev, Math.round(amount), ev.type);
  }

  hitBoss(ev, amount, kind) {
    const b = this.s.boss;
    if (b.status !== 'fight' || !amount) return;
    const key = Viewers.key(ev);
    b.hp = Math.max(0, b.hp - amount);
    let p = b.players.find((x) => x.key === key);
    if (!p) { p = { key, name: ev.user.display, platform: ev.platform, damage: 0 }; b.players.push(p); }
    p.damage += amount;
    b.players.sort((x, y) => y.damage - x.damage);
    b.players = b.players.slice(0, 30);
    b.log.push({ name: ev.user.display, amount, kind, id: ev.id });
    b.log = b.log.slice(-6);
    if (b.hp === 0) this.bossEnd(true); else this.pushBoss();
  }

  bossEnd(won) {
    const b = this.s.boss;
    clearInterval(this.bossTimer);
    b.status = won ? 'won' : 'lost';
    if (won) {
      for (const p of b.players.slice(0, 3)) {
        const box = this.e.viewers.file.data.list[p.key] || this.e.viewers.session.viewers[p.key];
        if (box) box.points += b.prize;
      }
      this.e.viewers.file.save();
    }
    this.pushBoss();
    this.e.pushLive();
    if (won && b.autoNext) {
      this.bossNext = setTimeout(() => {
        const next = BOSSES[(BOSSES.findIndex((x) => x.id === b.bossId) + 1) % BOSSES.length];
        this.bossStart({ bossId: next.id, level: b.level + 1, keepLevel: true });
      }, 8000);
    }
  }

  bossReset() {
    const b = this.s.boss;
    clearInterval(this.bossTimer);
    clearTimeout(this.bossNext);
    Object.assign(b, { status: 'idle', players: [], log: [], endsAt: 0, level: 1, hp: b.baseHp, maxHp: b.baseHp });
    this.pushBoss();
  }
}

module.exports = { Games, BOSSES, gameById, rankLabel, nextRank, rankScore, STAT_LABEL };
