// Discord : un message dans un salon quand le live commence, et le récap quand il se termine.
// Passe par un webhook Discord (Paramètres du serveur › Intégrations › Webhooks), gardé dans le coffre chiffré.
const HOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;
const COLORS = { tiktok: 0xFE2C55, twitch: 0x9146FF, youtube: 0xFF0000, kick: 0x53FC18 };

function liveUrl(a) {
  const u = String(a.username || a.channel || '').replace(/^@/, '').trim();
  if (!u) return '';
  return {
    tiktok: `https://www.tiktok.com/@${u}/live`, twitch: `https://www.twitch.tv/${u}`, kick: `https://kick.com/${u}`,
    youtube: /^UC[\w-]{20,}$/.test(u) ? `https://www.youtube.com/channel/${u}/live` : `https://www.youtube.com/@${u}/live`,
  }[a.platform] || '';
}

const dur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const num = (n) => Number(n || 0).toLocaleString('fr-FR');

class Discord {
  constructor(engine) { this.e = engine; }

  get c() { return this.e.s.discord; }
  get hook() { return this.e.vault.get('key:discordWebhook') || ''; }
  static valid(url) { return HOOK.test(String(url || '').trim()); }

  async post(payload) {
    const url = this.hook;
    if (!Discord.valid(url)) throw new Error('Colle d\'abord le lien du webhook Discord.');
    const r = await fetch(`${url}?wait=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: this.c.botName || 'Régie', allowed_mentions: { parse: ['everyone', 'roles'] }, ...payload }) });
    if (r.status === 429) throw new Error('Discord demande de patienter un peu avant le prochain message.');
    if (!r.ok) throw new Error(r.status === 404 || r.status === 401 ? 'Ce webhook n\'existe plus : recrée-le dans Discord.' : `Discord répond ${r.status}.`);
    return true;
  }

  mention() {
    const m = this.c.mention;
    if (m === 'everyone') return '@everyone ';
    if (m === 'here') return '@here ';
    if (m === 'role' && /^\d{5,}$/.test(this.c.roleId || '')) return `<@&${this.c.roleId}> `;
    return '';
  }

  liveAccounts() {
    const live = this.e.s.accounts.filter((a) => this.e.liveSince?.[a.id]);
    return live.length ? live : this.e.s.accounts.filter((a) => a.enabled !== false);
  }

  livePayload(test = false) {
    const accs = this.liveAccounts();
    const main = accs[0] || { platform: 'tiktok', label: 'Ma chaîne' };
    const name = this.e.s.settings.profileName || main.label || 'Je';
    const links = accs.map((a) => ({ a, url: liveUrl(a) })).filter((x) => x.url);
    const game = this.e.gameName ? this.e.gameName() : '';
    const vars = { name, game, link: links[0]?.url || '', title: this.c.liveTitle || '' };
    const text = String(this.c.liveText || '🔴 {name} est en live !').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
    return {
      content: `${test ? '' : this.mention()}${text}`.trim(),
      embeds: [{
        title: this.c.liveTitle || `${name} est en direct`, url: links[0]?.url || undefined, color: COLORS[main.platform] || 0x3DF0C2,
        description: links.map((x) => `▶️ [${x.a.platform === 'tiktok' ? 'TikTok' : x.a.platform[0].toUpperCase() + x.a.platform.slice(1)}](${x.url})`).join('\n') || undefined,
        fields: game ? [{ name: 'Jeu', value: game, inline: true }] : undefined,
        thumbnail: main.avatar && /^https:/.test(main.avatar) ? { url: main.avatar } : undefined,
        footer: { text: test ? 'Message d\'essai envoyé par Régie' : 'Envoyé par Régie' }, timestamp: new Date().toISOString(),
      }],
    };
  }

  recapPayload(r, test = false) {
    const top = (r.top || []).slice(0, 3).map((t, i) => `${['🥇', '🥈', '🥉'][i]} **${t.name}** · ${num(t.points)} pts`).join('\n');
    const fields = [
      { name: 'Durée', value: dur(r.duration || 0), inline: true },
      { name: 'Pic de spectateurs', value: num(r.peak), inline: true },
      { name: 'Nouveaux suivis', value: num(r.follows), inline: true },
      { name: 'Cadeaux', value: `${num(r.gifts)} (${num(r.coins)} pièces)`, inline: true },
      { name: 'Likes', value: num(r.likes), inline: true },
      { name: 'Messages', value: num(r.messages), inline: true },
    ];
    if (top) fields.push({ name: 'Meilleurs soutiens', value: top });
    if (r.biggestGift) fields.push({ name: 'Plus gros cadeau', value: `${r.biggestGift.user} · ${r.biggestGift.gift} (${num(r.biggestGift.value)} pièces)` });
    return {
      content: this.c.recapText ? String(this.c.recapText).replace(/\{top\}/g, (r.top || []).slice(0, 3).map((t) => t.name).join(', ')) : undefined,
      embeds: [{ title: `Récap du live${r.game ? ` · ${r.game}` : ''}`, color: 0x3DF0C2, fields, footer: { text: test ? 'Récap d\'essai envoyé par Régie' : 'Envoyé par Régie' }, timestamp: new Date().toISOString() }],
    };
  }

  // Appelé par le moteur. Pas plus d'une annonce par demi-heure, pour les coupures de connexion.
  async onLiveStart() {
    const c = this.c;
    if (!c.enabled || !c.onLive || !this.hook) return;
    if (Date.now() - (c.lastLiveAt || 0) < 30 * 60 * 1000) return;
    c.lastLiveAt = Date.now();
    this.e.save();
    try { await this.post(this.livePayload()); this.e.log('Discord : annonce du live envoyée'); } catch (err) { this.e.log(`Discord : ${err.message}`); }
  }

  async onLiveEnd(recap) {
    if (!this.c.enabled || !this.c.onRecap || !this.hook || !recap) return;
    try { await this.post(this.recapPayload(recap)); this.e.log('Discord : récap envoyé'); } catch (err) { this.e.log(`Discord : ${err.message}`); }
  }

  async test(kind) {
    if (kind === 'recap') {
      const r = this.e.buildRecap();
      if (!r.top?.length) r.top = [{ name: 'Léna', points: 1840 }, { name: 'Marius', points: 920 }, { name: 'Kenza', points: 610 }];
      if (!r.duration || r.duration < 60000) r.duration = 2 * 3600 * 1000 + 14 * 60000;
      return this.post(this.recapPayload(r, true));
    }
    return this.post(this.livePayload(true));
  }
}

module.exports = { Discord, liveUrl };
