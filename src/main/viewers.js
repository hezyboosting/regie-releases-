// Mémoire des spectateurs : cumul à vie, session en cours, et suivi des cadeaux.
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const POINTS = { gift: (e) => e.value || 0, bits: (e) => e.amount || 0, superchat: (e) => (e.value || 0) * 100, supersticker: (e) => (e.value || 0) * 100, giftsub: (e) => (e.amount || 1) * 500 };

const emptySession = () => ({
  started: Date.now(), viewers: {}, counts: {},
  gifts: { coins: 0, count: 0, byGift: {}, log: [] }, topGift: null, topStreak: null,
  last: {},
});

class Viewers {
  constructor(file) {
    this.file = file; // { list: { 'plateforme:id': {...} }, days: { 'AAAA-MM-JJ': { clé: {...} } } }
    if (!file.data.days) file.data.days = {};
    this.session = emptySession();
  }

  reset() { this.session = emptySession(); }

  static key(ev) { return `${ev.platform}:${ev.user?.id || ev.user?.name || 'anonyme'}`; }

  row(box, key, ev) {
    const r = box[key] || { key, name: '', platform: ev.platform, avatar: '', messages: 0, likes: 0, coins: 0, gifts: 0, points: 0, follows: 0, shares: 0, subs: 0, first: Date.now() };
    r.name = ev.user?.display || ev.user?.name || r.name;
    if (ev.user?.avatar) r.avatar = ev.user.avatar;
    box[key] = r;
    return r;
  }

  gain(ev, cfg) {
    if (!cfg?.enabled) return 0;
    switch (ev.type) {
      case 'chat': return cfg.perMessage;
      case 'like': return cfg.perLike * (ev.amount || 0);
      case 'follow': return cfg.perFollow;
      case 'share': return cfg.perShare;
      case 'sub': case 'resub': case 'member': case 'milestone': return cfg.perSub;
      case 'giftsub': return cfg.perSub * (ev.amount || 1);
      case 'gift': return cfg.perCoin * (ev.value || 0);
      case 'bits': return cfg.perBit * (ev.amount || 0);
      case 'superchat': case 'supersticker': return cfg.perEuro * (ev.value || 0);
      default: return 0;
    }
  }

  // Les essais comptent pour la session (pour voir les overlays bouger), jamais pour le cumul.
  record(ev, rewards) {
    const s = this.session;
    if (!ev.user?.display && !ev.user?.name) return null;
    if (ev.type === 'join' || ev.type === 'goal') { s.counts[ev.type] = (s.counts[ev.type] || 0) + 1; return null; }
    const key = Viewers.key(ev);
    const today = dayKey();
    if (!ev.test) { this.file.data.days[today] = this.file.data.days[today] || {}; this.prune(); }
    const boxes = ev.test ? [s.viewers] : [s.viewers, this.file.data.list, this.file.data.days[today]];
    const add = ev.type === 'like' ? ev.amount || 1 : 1;
    s.counts[ev.type] = (s.counts[ev.type] || 0) + add;
    const gain = this.gain(ev, rewards);
    let viewer = null;
    let firstFollow = false;
    for (const box of boxes) {
      const r = this.row(box, key, ev);
      if (ev.type === 'chat') r.messages += 1;
      if (ev.type === 'like') r.likes += ev.amount || 0;
      if (ev.type === 'follow') { if (!r.follows) firstFollow = true; r.follows += 1; }
      if (ev.type === 'share') r.shares = (r.shares || 0) + 1;
      if (['sub', 'resub', 'member', 'milestone'].includes(ev.type)) r.subs = (r.subs || 0) + 1;
      if (POINTS[ev.type]) r.coins += POINTS[ev.type](ev);
      if (ev.type === 'gift') r.gifts += ev.amount || 1;
      r.points += gain;
      viewer = r;
    }
    if (ev.type !== 'chat' && ev.type !== 'like') s.last[ev.type] = { name: ev.user.display, value: ev.value || ev.amount || 0, gift: ev.gift?.name || '', platform: ev.platform };
    if (POINTS[ev.type]) this.trackGift(ev);
    if (!ev.test) this.file.save();
    return { viewer: this.file.data.list[key] || viewer, firstFollow, gain };
  }

  trackGift(ev) {
    const s = this.session;
    const value = POINTS[ev.type](ev);
    const count = ev.amount || 1;
    const name = ev.gift?.name || (ev.type === 'bits' ? 'Bits' : ev.type === 'giftsub' ? 'Abonnements offerts' : 'Super Chat');
    const id = ev.gift?.id || ev.type;
    const g = s.gifts;
    g.coins += value;
    g.count += count;
    const e = g.byGift[id] || { id, name, image: ev.gift?.image || '', count: 0, coins: 0, platform: ev.platform };
    e.count += count;
    e.coins += value;
    g.byGift[id] = e;
    g.log.unshift({ id: ev.id, user: ev.user.display, avatar: ev.user.avatar || '', platform: ev.platform, name, image: ev.gift?.image || '', count, value, ts: ev.ts });
    g.log = g.log.slice(0, 200);
    if (!s.topGift || value > s.topGift.value) s.topGift = { user: ev.user.display, avatar: ev.user.avatar || '', platform: ev.platform, name, image: ev.gift?.image || '', count, value };
    this.streak(ev.user.display, ev.user.avatar, ev.platform, name, ev.gift?.image || '', count);
  }

  streak(user, avatar, platform, name, image, count) {
    const s = this.session;
    if (!s.topStreak || count > s.topStreak.count) s.topStreak = { user, avatar: avatar || '', platform, name, image, count };
  }

  points(ev) { return Math.floor(this.file.data.list[Viewers.key(ev)]?.points ?? this.session.viewers[Viewers.key(ev)]?.points ?? 0); }

  spend(ev, cost) {
    const r = this.file.data.list[Viewers.key(ev)] || this.session.viewers[Viewers.key(ev)];
    if (!r || r.points < cost) return false;
    r.points -= cost;
    this.file.save();
    return true;
  }

  prune() {
    const keys = Object.keys(this.file.data.days).sort();
    while (keys.length > 62) delete this.file.data.days[keys.shift()];
  }

  // Cumul sur une période : aujourd'hui, 7 jours ou 30 jours.
  window(daysBack) {
    const out = {};
    for (let i = 0; i < daysBack; i += 1) {
      const day = this.file.data.days[dayKey(Date.now() - i * 86400000)] || {};
      for (const [key, r] of Object.entries(day)) {
        const t = out[key] || { name: r.name, platform: r.platform, avatar: r.avatar, messages: 0, likes: 0, coins: 0, gifts: 0, points: 0, follows: 0, shares: 0, subs: 0 };
        for (const m of ['messages', 'likes', 'coins', 'gifts', 'points', 'follows', 'shares', 'subs']) t[m] += r[m] || 0;
        out[key] = t;
      }
    }
    return out;
  }

  board(metric = 'coins', n = 10, scope = 'session') {
    const box = scope === 'session' ? this.session.viewers : scope === 'all' ? this.file.data.list : this.window({ today: 1, week: 7, month: 30 }[scope] || 1);
    return Object.values(box).filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric]).slice(0, n)
      .map((r) => ({ name: r.name, platform: r.platform, avatar: r.avatar, value: Math.floor(r[metric]) }));
  }

  boards(n = 10) {
    const out = {};
    for (const scope of ['session', 'today', 'week', 'month', 'all']) for (const m of ['coins', 'likes', 'points', 'messages', 'shares', 'subs', 'follows']) out[`${m}:${scope}`] = this.board(m, n, scope);
    return out;
  }

  level(ev) {
    const pts = this.file.data.list[Viewers.key(ev)]?.points ?? this.session.viewers[Viewers.key(ev)]?.points ?? 0;
    return Math.floor(Math.sqrt(Math.max(0, pts) / 50)) + 1;
  }

  giftView() {
    const { gifts, topGift, topStreak, counts } = this.session;
    return { coins: gifts.coins, count: gifts.count, byGift: Object.values(gifts.byGift).sort((a, b) => b.coins - a.coins), log: gifts.log.slice(0, 200), topGift, topStreak, counts };
  }
}

module.exports = { Viewers, dayKey };
