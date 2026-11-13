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
  // Pour chaque jeu, le streamer choisit les rangs qui peuvent sortir et leur chance (ranks.picks).
  rankPool(all = false) {
    const r = this.s.ranks;
    if (r.game === 'custom' || r.mode === 'points') return r.list.map((t, step) => ({ ...t, step, steps: r.list.length }));
    const images = this.e.s.gaming.rankImages?.[r.game] || {};
    const game = gameById(r.game);
    const picks = r.picks?.[r.game] || {};
    const list = game.ranks.map((t, step) => {
      const p = picks[t.id] || {};
      return { ...t, weight: p.weight ?? t.weight, on: p.on !== false, image: rankImage(images, t.id, 1), step, steps: game.ranks.length, sides: game.sides, divisions: 0 };
    });
    if (all) return list;
    const on = list.filter((t) => t.on && t.weight > 0);
    return on.length ? on : list;
  }

  rankById(id) { return this.rankPool(true).find((x) => x.id === id) || null; }

  // Données de l'overlay Suivi = Rang : la bande de la caisse et l'aperçu montrent les rangs du jeu choisi.
  rankOverlayData() {
    const cfg = this.s.ranks;
    const pool = this.rankPool();
    const total = pool.reduce((n, x) => n + Math.max(0, x.weight || 0), 0) || 1;
    return {
      pool: pool.map((x) => ({ id: x.id, name: x.name, color: x.color, image: x.image, step: x.step, steps: x.steps, sides: x.sides, chance: cfg.mode === 'points' ? 0 : Math.max(0, x.weight || 0) / total })),
      game: cfg.game === 'custom' || cfg.mode === 'points' ? '' : gameById(cfg.game).name,
      reveal: cfg.reveal === 'roulette' && this.e.allowed('rankRoulette') ? 'roulette' : 'classic',
    };
  }

  // Le rang d'un spectateur pour le jeu en cours : chaque jeu garde le sien.
  viewerRank(viewer) {
    if (!viewer) return null;
    const game = this.s.ranks.mode === 'points' ? 'points' : this.s.ranks.game;
    const id = viewer.ranks?.[game] ?? (viewer.rankGame === game || !viewer.rankGame ? viewer.rank : null);
    return id ? this.rankById(id) : null;
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

  // forced : un rang choisi à la main (essai, « Donner un rang », commande des modos).
  // again : on remontre le rang déjà obtenu dans ce jeu au lieu d'en tirer un nouveau.
  assignRank(ev, viewer, { forced = null, again = false } = {}) {
    const cfg = this.s.ranks;
    if ((!cfg.enabled && !forced && !ev.test) || !viewer) return null;
    const kept = again ? this.viewerRank(viewer) : null;
    const rank = (forced && this.rankById(forced)) || kept || (cfg.mode === 'points' ? this.rankForPoints(viewer.points) : this.drawRank());
    const gameKey = cfg.mode === 'points' ? 'points' : cfg.game;
    viewer.rank = rank.id;
    viewer.rankGame = gameKey;
    viewer.ranks = { ...(viewer.ranks || {}), [gameKey]: rank.id };
    viewer.rankShownAt = Date.now();
    const roulette = cfg.reveal === 'roulette' && this.e.allowed('rankRoulette');
    const pool = this.rankPool();
    const total = pool.reduce((n, x) => n + Math.max(0, x.weight || 0), 0) || 1;
    const chance = (x) => (cfg.mode === 'points' ? 0 : Math.max(0, x.weight || 0) / total);
    const lite = (x) => ({ id: x.id, name: x.name, color: x.color, image: x.image, step: x.step, steps: x.steps, sides: x.sides, chance: chance(x) });
    const card = { user: ev.user.display, avatar: ev.user.avatar || '', platform: ev.platform, rank: { ...rank, chance: chance(rank) }, roulette, pool: roulette ? pool.map(lite) : null, game: cfg.game === 'custom' || cfg.mode === 'points' ? '' : gameById(cfg.game).name };
    this.e.server.broadcast({ t: 'rank', card }, 'rankcard');
    this.e.push('rankCard', card);
    if (cfg.announce) this.e.reply(ev, renderTemplate(cfg.message, { user: ev.user.display, rank: rank.name }));
    return rank;
  }

  // Donner un rang précis à quelqu'un (bouton de l'appli ou commande des modos).
  giveRank(name, rankId, platform = '') {
    const want = String(rankId || '').toLowerCase().trim();
    const rank = this.rankById(rankId) || (want && this.rankPool(true).find((x) => String(x.name).toLowerCase().startsWith(want)));
    if (!rank) throw new Error('Rang inconnu.');
    const who = String(name || '').replace(/^@/, '').trim();
    if (!who) throw new Error('Indique un pseudo.');
    const list = this.e.viewers.file.data.list;
    const key = Object.keys(list).find((k) => [list[k].name, list[k].display].some((n) => String(n || '').toLowerCase() === who.toLowerCase()) && (!platform || k.startsWith(`${platform}:`)));
    const viewer = key ? list[key] : { name: who, points: 0 };
    const ev = { type: 'follow', platform: platform || key?.split(':')[0] || 'twitch', user: { display: viewer.display || viewer.name || who, name: who, avatar: viewer.avatar || '' } };
    this.assignRank(ev, viewer, { forced: rank.id });
    if (key) this.e.viewers.file.save();
    return rank;
  }

  onEvent(ev, result) {
    const cfg = this.s.ranks;
    if (result?.firstFollow) this.assignRank(ev, result.viewer);
    else if (ev.type === 'follow' && ev.test) this.assignRank(ev, result?.viewer || { name: ev.user.display, points: 0 }, { forced: ev.forceRank || null });
    // Quelqu'un qui suit à nouveau : on remontre son rang, on en tire un nouveau, ou rien, au choix.
    // Un rang obtenu dans un autre jeu ne compte pas : il en reçoit un du jeu actuel.
    // Dix minutes minimum entre deux révélations pour la même personne : pas de spam si TikTok répète le suivi.
    else if (ev.type === 'follow' && result?.viewer && cfg.enabled && cfg.again !== 'off' && Date.now() - (result.viewer.rankShownAt || 0) > 600000) this.assignRank(ev, result.viewer, { again: cfg.again !== 'new' });
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
      const rank = this.viewerRank(v);
      this.e.reply(ev, rank ? `${ev.user.display} est ${rank.name}` : `${ev.user.display} n'a pas encore de rang`);
      return true;
    }
    // Les modos choisissent le rang de quelqu'un : !donnerang @pseudo Diamant
    if (staff && this.s.ranks.giveCommand && cmd === low(this.s.ranks.giveCommand)) {
      const [who, ...rest] = String(args || '').trim().split(/\s+/);
      try { const rank = this.giveRank(who, rest.join(' '), ev.platform); this.e.reply(ev, `${String(who).replace(/^@/, '')} reçoit le rang ${rank.name}`); } catch (e) { this.e.reply(ev, e.message); }
      return true;
    }
    if (cmd === '!niveau') { this.e.reply(ev, `${ev.user.display} est niveau ${this.e.viewers.level(ev)}`); return true; }
    if (cmd === low(this.s.gaming.command)) { this.rankCommand(ev, args); return true; }
    if (staff && ['!win', '!lose', '!kill', '!death'].includes(cmd)) { this.e.gameEvent({ '!win': 'win', '!lose': 'loss', '!kill': 'kill', '!death': 'death' }[cmd], {}); return true; }
    if (cmd === '!record') { this.e.reply(ev, this.e.gameRecord()); return true; }
    if (cmd === low(this.s.minigames.rouletteCommand) && this.e.allowed('miniGames')) { this.rouletteCommand(ev); return true; }
    if (r.enabled && r.commandShop && cmd === low(r.commandShop)) { this.shopList(ev); return true; }
    if (r.enabled && r.commandBuy && cmd === low(r.commandBuy)) {
      const [what, ...rest] = args.trim().split(/\s+/);
      const items = this.shopItems();
      const n = Number(what);
      const reward = Number.isInteger(n) && n > 0 ? items[n - 1] : items.find((x) => low(x.name).startsWith(low(what)) && what);
      if (!reward) { this.e.reply(ev, this.e.s.settings.uiLang === 'en' ? `${ev.user.display}, type ${r.commandBuy} followed by a number from ${r.commandShop}.` : `${ev.user.display}, tape ${r.commandBuy} suivi d'un numéro de ${r.commandShop}.`); return true; }
      this.redeem(ev, reward, rest.join(' '));
      return true;
    }
    const reward = r.enabled && r.list.find((x) => x.enabled !== false && x.command && low(x.command) === cmd);
    if (reward) { this.redeem(ev, reward, args); return true; }
    return false;
  }

  // ---- Boutique de points : la liste numérotée que le chat voit et que l'overlay affiche.
  shopItems() { return this.s.rewards.list.filter((x) => x.enabled !== false); }

  shopView() {
    const r = this.s.rewards;
    this.shopSold = this.shopSold || {};
    return {
      enabled: r.enabled, shopCmd: r.commandShop || '', buyCmd: r.commandBuy || '',
      items: this.shopItems().map((x, i) => ({ n: i + 1, id: x.id, name: x.name, emoji: x.emoji || '🎁', cost: x.cost, desc: x.desc || '', left: x.stock > 0 ? Math.max(0, x.stock - (this.shopSold[x.id] || 0)) : null, command: x.command || '' })),
      log: (this.shopLog || []).slice(0, 12),
    };
  }

  pushShop(purchase = null) {
    const view = this.shopView();
    this.e.push('shop', view);
    this.e.server.broadcast({ t: 'shop', shop: view, purchase }, 'pointshop');
  }

  shopList(ev) {
    const items = this.shopItems();
    const r = this.s.rewards;
    const en = this.s.settings.uiLang === 'en';
    if (!items.length) { this.e.reply(ev, en ? 'The shop is empty for now.' : 'La boutique est vide pour l\'instant.'); return; }
    if (this.e.cooled('shop:list', 15)) return;
    const line = items.map((x, i) => `${i + 1}. ${x.emoji || ''}${x.name} (${x.cost})`).join(' · ');
    this.e.reply(ev, `🛒 ${line.slice(0, 380)} — ${en ? 'type' : 'tape'} ${r.commandBuy} 1`);
  }

  resetShop() { this.shopSold = {}; this.shopLog = []; }

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

  redeem(ev, reward, args = '') {
    this.shopSold = this.shopSold || {};
    const en = this.s.settings.uiLang === 'en';
    if (reward.stock > 0 && (this.shopSold[reward.id] || 0) >= reward.stock) { this.e.reply(ev, en ? `${reward.name} is sold out for this live.` : `${reward.name} est épuisé pour ce live.`); return; }
    if (reward.needsText && !String(args).trim()) { this.e.reply(ev, en ? `${ev.user.display}, add your text after the command.` : `${ev.user.display}, ajoute ton texte après la commande.`); return; }
    if (reward.cooldown > 0 && this.e.cooled(`reward:${reward.id}`, reward.cooldown)) { this.e.reply(ev, en ? `${reward.name} is recharging, try again soon.` : `${reward.name} se recharge, réessaie bientôt.`); return; }
    if (reward.userCooldown > 0 && this.e.cooled(`reward:${reward.id}:${ev.platform}:${ev.user.id || ev.user.name}`, reward.userCooldown)) return;
    if (!this.e.viewers.spend(ev, reward.cost)) { this.e.reply(ev, `${ev.user.display}, il te faut ${reward.cost} points pour ${reward.name}.`); return; }
    this.shopSold[reward.id] = (this.shopSold[reward.id] || 0) + 1;
    if (this.s.rewards.announce !== false) this.e.reply(ev, en ? `🛒 ${ev.user.display} buys ${reward.name}` : `🛒 ${ev.user.display} achète ${reward.name}`);
    const vars = { ...this.e.commandVars(ev, String(args).slice(0, 200), null), reward: reward.name };
    this.e.runActions(reward.actions || [], ev, vars);
    const purchase = { user: ev.user.display || ev.user.name, avatar: ev.user.avatar || '', platform: ev.platform, reward: reward.name, emoji: reward.emoji || '🎁', cost: reward.cost, text: reward.needsText ? String(args).slice(0, 120) : '', at: Date.now() };
    this.shopLog = [purchase, ...(this.shopLog || [])].slice(0, 30);
    this.pushShop(purchase);
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
