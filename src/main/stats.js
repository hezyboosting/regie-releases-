// Stats locales : compteurs par jour et par plateforme, classement des soutiens.
const COUNTED = ['chat', 'follow', 'sub', 'resub', 'giftsub', 'bits', 'raid', 'redeem', 'gift', 'like', 'share', 'join', 'superchat', 'supersticker', 'member', 'milestone', 'superfan'];

const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class Stats {
  constructor(file) {
    this.file = file; // { days: { 'YYYY-MM-DD': { tiktok: {...}, twitch: {...}, youtube: {...}, peak } }, supporters: {} }
    this.recent = new Map(); // accountId -> horodatages pour le vumètre
    this.session = { started: Date.now(), supporters: {} };
  }

  bucket(day, platform) {
    const days = this.file.data.days;
    days[day] = days[day] || {};
    days[day][platform] = days[day][platform] || {};
    return days[day][platform];
  }

  record(ev) {
    if (!COUNTED.includes(ev.type)) return;
    const b = this.bucket(dayKey(ev.ts), ev.platform);
    const add = ev.type === 'like' ? ev.amount || 1 : 1;
    b[ev.type] = (b[ev.type] || 0) + add;
    if (ev.type === 'gift') b.coins = (b.coins || 0) + (ev.value || 0);
    if (ev.type === 'bits') b.bitsTotal = (b.bitsTotal || 0) + (ev.amount || 0);
    if (ev.type === 'superchat' || ev.type === 'supersticker') b.money = (b.money || 0) + (ev.value || 0);
    if (ev.type === 'giftsub') b.subsGifted = (b.subsGifted || 0) + (ev.amount || 1);

    const list = this.recent.get(ev.accountId) || [];
    list.push(ev.ts);
    this.recent.set(ev.accountId, list.slice(-200));

    const points = ev.type === 'gift' ? ev.value || 0
      : ev.type === 'bits' ? ev.amount || 0
        : ev.type === 'superchat' || ev.type === 'supersticker' ? (ev.value || 0) * 100
          : ev.type === 'giftsub' ? (ev.amount || 1) * 500
            : ev.type === 'sub' || ev.type === 'resub' || ev.type === 'member' ? 500 : 0;
    if (points && ev.user?.display) {
      const key = `${ev.platform}:${ev.user.id || ev.user.name}`;
      for (const box of [this.session.supporters, this.file.data.supporters]) {
        const s = box[key] || { name: ev.user.display, platform: ev.platform, points: 0 };
        s.points += points;
        s.name = ev.user.display;
        box[key] = s;
      }
    }
    this.file.save();
  }

  addLive(live) {
    const list = this.file.data.lives || (this.file.data.lives = []);
    list.unshift(live);
    if (list.length > 300) list.pop();
    this.file.save();
  }

  lives(limit = 50) { return (this.file.data.lives || []).slice(0, limit); }

  viewers(account, amount) {
    const b = this.bucket(dayKey(), account.platform);
    if (amount > (b.peak || 0)) { b.peak = amount; this.file.save(); }
  }

  activity(accountId) {
    const list = this.recent.get(accountId) || [];
    const cut = Date.now() - 60000;
    return list.filter((t) => t > cut).length;
  }

  top(n = 10, scope = 'session') {
    const box = scope === 'session' ? this.session.supporters : this.file.data.supporters;
    return Object.values(box).sort((a, b) => b.points - a.points).slice(0, n);
  }

  report(daysLimit) {
    const all = this.file.data.days;
    let keys = Object.keys(all).sort();
    if (daysLimit !== -1) {
      const cut = dayKey(Date.now() - (daysLimit - 1) * 86400000);
      keys = keys.filter((k) => k >= cut);
    }
    const series = keys.map((day) => ({ day, ...all[day] }));
    const totals = {};
    for (const row of series) {
      for (const [platform, b] of Object.entries(row)) {
        if (platform === 'day') continue;
        totals[platform] = totals[platform] || {};
        for (const [k, v] of Object.entries(b)) {
          if (k === 'peak') totals[platform].peak = Math.max(totals[platform].peak || 0, v);
          else totals[platform][k] = (totals[platform][k] || 0) + v;
        }
      }
    }
    return { series, totals, top: this.top(10, 'all'), hidden: Math.max(0, Object.keys(all).length - keys.length) };
  }

  csv(daysLimit) {
    const { series } = this.report(daysLimit);
    const cols = ['chat', 'follow', 'sub', 'resub', 'giftsub', 'subsGifted', 'bitsTotal', 'raid', 'gift', 'coins', 'like', 'share', 'superchat', 'money', 'member', 'peak'];
    const rows = [['jour', 'plateforme', ...cols].join(';')];
    for (const row of series) {
      for (const [p, b] of Object.entries(row)) {
        if (p !== 'day') rows.push([row.day, p, ...cols.map((c) => b[c] || 0)].join(';'));
      }
    }
    return rows.join('\n');
  }

  reset() { this.file.data.days = {}; this.file.data.supporters = {}; this.file.data.lives = []; this.session.supporters = {}; this.recent.clear(); this.file.save(); }
}

module.exports = { Stats, dayKey };
