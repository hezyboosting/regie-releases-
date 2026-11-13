// Catalogue officiel des cadeaux TikTok : noms, prix en pièces et vraies images, récupérés chez TikTok
// depuis le PC du streamer puis gardés en local (dossier « gifts » des données de l'appli). Ainsi, quand
// quelqu'un envoie une Galaxie, tous les overlays montrent l'image officielle, même si l'événement arrive
// sans image ou que le réseau de TikTok rame.
const fs = require('fs');
const path = require('path');

const GIFT_LIST = 'https://webcast.tiktok.com/webcast/gift/list/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const first = (...v) => v.find((x) => x !== undefined && x !== null && x !== '');

// Les formats varient selon la source (API web, bibliothèque, ancien cache) : on garde l'essentiel.
function normalizeList(raw) {
  const out = new Map();
  for (const g of Array.isArray(raw) ? raw : []) {
    const id = String(first(g.id, g.gift_id, g.giftId, '') || '');
    const name = String(first(g.name, g.giftName, g.describe, '') || '').trim();
    if (!id || !name) continue;
    const image = first(g.image?.url_list?.[0], g.image?.urlList?.[0], g.image?.uri && /^https?:/.test(g.image.uri) ? g.image.uri : '', g.icon?.url_list?.[0], g.icon?.urlList?.[0], typeof g.image === 'string' ? g.image : '', '');
    const cost = Number(first(g.diamond_count, g.diamondCount, g.cost, 0)) || 0;
    const prev = out.get(id);
    if (!prev || (!prev.image && image)) out.set(id, { id, name, cost, image: image || '', file: g.file || prev?.file || '' });
  }
  return [...out.values()].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}

async function fetchDirect(lang = 'fr-FR', fetchImpl = fetch) {
  const p = new URLSearchParams({
    aid: '1988', app_name: 'tiktok_web', device_platform: 'web_pc', app_language: lang, browser_language: lang, webcast_language: lang,
    browser_name: 'Mozilla', browser_platform: 'Win32', browser_version: '5.0 (Windows)', cookie_enabled: 'true', screen_width: '1920', screen_height: '1080', version_code: '270000',
  });
  const r = await fetchImpl(`${GIFT_LIST}?${p}`, { headers: { 'User-Agent': UA, Referer: 'https://www.tiktok.com/', Accept: 'application/json' } });
  if (!r.ok) throw new Error(`TikTok répond ${r.status}`);
  const j = await r.json();
  return j?.data?.gifts || j?.data?.gifts_info?.gifts || [];
}

class GiftCatalog {
  constructor({ dir, state, save, log = () => {}, fetchImpl = (...a) => fetch(...a) }) {
    Object.assign(this, { dir, state, save, log, fetchImpl });
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* dossier déjà là */ }
    this.busy = null;
  }

  get list() { return this.state().giftCache || []; }
  get updatedAt() { return this.state().giftCacheAt || 0; }

  // Adresse à donner aux overlays : l'image gardée sur le PC si on l'a, sinon celle de TikTok.
  localUrl(g) { return g?.file && fs.existsSync(path.join(this.dir, g.file)) ? `/gifts/${g.file}` : g?.image || ''; }

  find(gift) {
    if (!gift) return null;
    const id = String(gift.id || '');
    const name = String(gift.name || '').toLowerCase();
    return this.list.find((g) => (id && g.id === id)) || this.list.find((g) => name && g.name.toLowerCase() === name) || null;
  }

  stale(days = 3) { return !this.list.length || this.updatedAt < Date.now() - days * 86400000 || this.list.some((g) => g.image && !g.file); }

  // Plusieurs façons de joindre TikTok, de la plus fiable à la plus simple : la chaîne connectée,
  // la bibliothèque TikTok (même hors live), puis l'adresse publique du catalogue.
  refresh({ sources = [], lang = 'fr-FR' } = {}) {
    if (this.busy) return this.busy;
    this.busy = (async () => {
      const errors = [];
      let raw = null;
      for (const f of [...sources, () => fetchDirect(lang, this.fetchImpl)]) {
        try { raw = await f(); if (Array.isArray(raw) && raw.length) break; } catch (e) { errors.push(e.message); }
      }
      if (!raw?.length) throw new Error(`Impossible de joindre le catalogue TikTok pour le moment${errors.length ? ` (${errors[errors.length - 1]})` : ''}. Réessaie dans un moment.`);
      const old = new Map(this.list.map((g) => [g.id, g]));
      const list = normalizeList(raw).map((g) => ({ ...g, file: old.get(g.id)?.image === g.image ? old.get(g.id)?.file || '' : '' }));
      await this.download(list);
      const st = this.state();
      st.giftCache = list;
      st.giftCacheAt = Date.now();
      this.save();
      this.log(`Catalogue TikTok : ${list.length} cadeaux, ${list.filter((g) => g.file).length} images gardées sur le PC`);
      return list;
    })().finally(() => { this.busy = null; });
    return this.busy;
  }

  // Télécharge les images manquantes, six à la fois.
  async download(list) {
    const todo = list.filter((g) => g.image && !(g.file && fs.existsSync(path.join(this.dir, g.file))));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const g = todo[i++];
        try {
          const r = await this.fetchImpl(g.image, { headers: { 'User-Agent': UA, Referer: 'https://www.tiktok.com/' } });
          if (!r.ok) continue;
          const type = r.headers.get('content-type') || '';
          const ext = /webp/.test(type) || /\.webp/i.test(g.image) ? 'webp' : /gif/.test(type) ? 'gif' : /jpe?g/.test(type) ? 'jpg' : 'png';
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 64 || buf.length > 4 * 1024 * 1024) continue;
          const file = `${g.id.replace(/[^\w-]/g, '')}.${ext}`;
          fs.writeFileSync(path.join(this.dir, file), buf);
          g.file = file;
        } catch { /* image ratée : on garde l'adresse TikTok */ }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }
}

module.exports = { GiftCatalog, normalizeList, fetchDirect };
