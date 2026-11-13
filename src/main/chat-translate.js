// Traduction du chat en direct : Google Traduction (sans clé) ou DeepL (clé gratuite).
// Cache, deux requêtes à la fois au plus, et on ne traduit que les vrais messages (pas les commandes ni les emojis seuls).
const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'tr', 'ar', 'ru', 'ja', 'ko', 'zh'];

const worth = (text) => {
  const t = String(text || '').trim();
  if (t.length < 4 || t.startsWith('!')) return false;
  const letters = t.replace(/https?:\/\/\S+/g, '').replace(/[@#]\S+/g, '').match(/\p{L}/gu);
  return Boolean(letters && letters.length >= 3);
};

class ChatTranslator {
  constructor({ fetchImpl = fetch, getKey = () => '', log = () => {} } = {}) {
    this.fetch = fetchImpl;
    this.getKey = getKey;
    this.log = log;
    this.cache = new Map();
    this.busy = 0;
    this.waiting = [];
    this.failures = 0;
  }

  async google(text, target) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await this.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`Google Traduction a répondu ${r.status}`);
    const d = await r.json();
    return { text: (d[0] || []).map((x) => x[0]).join(''), from: String(d[2] || '').toLowerCase().slice(0, 5) };
  }

  async deepl(text, target) {
    const key = this.getKey();
    if (!key) throw new Error('Ajoute ta clé DeepL dans Réglages.');
    const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
    const r = await this.fetch(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, target_lang: target.toUpperCase() === 'EN' ? 'EN-GB' : target.toUpperCase() === 'PT' ? 'PT-PT' : target.toUpperCase() }).toString(),
    });
    if (!r.ok) throw new Error(`DeepL a répondu ${r.status}`);
    const d = await r.json();
    const t = d.translations?.[0];
    return { text: t?.text || '', from: String(t?.detected_source_language || '').toLowerCase() };
  }

  // Renvoie { text, from } ou null quand le message est déjà dans la bonne langue (ou pas à traduire).
  async translate(text, target, engine = 'google') {
    if (!worth(text) || !LANGS.includes(target)) return null;
    const key = `${engine}:${target}:${text}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.busy >= 2) {
      if (this.waiting.length > 20) return null;
      await new Promise((ok) => this.waiting.push(ok));
    }
    this.busy += 1;
    try {
      const out = engine === 'deepl' ? await this.deepl(text, target) : await this.google(text, target);
      this.failures = 0;
      const res = out.text && out.from && !out.from.startsWith(target) && out.text.trim().toLowerCase() !== text.trim().toLowerCase() ? out : null;
      this.cache.set(key, res);
      if (this.cache.size > 800) this.cache.delete(this.cache.keys().next().value);
      return res;
    } catch (e) {
      this.failures += 1;
      if (this.failures === 1 || this.failures % 20 === 0) this.log(`Traduction du chat : ${e.message}`);
      return null;
    } finally {
      this.busy -= 1;
      this.waiting.shift()?.();
    }
  }
}

module.exports = { ChatTranslator, LANGS, worth };
