// Calcule le rôle courant et gère la configuration diffusée par l'admin.
const brand = require('../shared/brand');
const { resolveFeatures } = require('../shared/features');
const lic = require('./license');

class Roles {
  constructor({ file, vault, log, onChange, publicKey = brand.publicKey }) {
    Object.assign(this, { file, vault, log, onChange, publicKey });
    this.machine = lic.machineId();
    this.adminSeed = vault.get('adminSeed') || null;
    if (this.adminSeed && !lic.isValidPrivate(this.adminSeed, this.publicKey)) { this.adminSeed = null; vault.set('adminSeed', null); }
  }

  get s() { return this.file.data; }

  isAdmin() { return Boolean(this.adminSeed) && !this.s.license.viewAs; }

  remoteConfig() {
    // Sur le poste admin, le brouillon s'applique tout de suite, sans attendre la diffusion.
    if (this.adminSeed) return this.s.adminDraft;
    return this.s.remote.config || {};
  }

  check(key = this.s.license.key) {
    return lic.verifyLicense(key, { publicKey: this.publicKey, machineId: this.machine, revoked: this.remoteConfig().revoked || [] });
  }

  realRole() {
    if (this.adminSeed) return 'admin';
    const c = this.check();
    return c.ok ? c.tier : 'free';
  }

  role() {
    if (this.adminSeed && this.s.license.viewAs) return this.s.license.viewAs;
    return this.realRole();
  }

  info() {
    const key = this.s.license.key;
    if (!key) return { active: false };
    const r = this.check(key);
    return { active: r.ok, reason: r.reason, name: r.name, expires: r.expires, created: r.created, id: r.id };
  }

  features() { return resolveFeatures(this.role(), this.remoteConfig().features || {}); }

  apiDefaults() { return { ...brand.defaults, ...(this.remoteConfig().defaults || {}) }; }

  publicRemote() {
    const c = this.remoteConfig();
    const newer = c.latestVersion && compareVersions(c.latestVersion, brand.version) > 0;
    return {
      announcement: c.announcement || '', latestVersion: c.latestVersion || '', downloadUrl: c.downloadUrl || '', updateAvailable: Boolean(newer),
      url: this.s.remote.urlOverride || brand.remoteConfigUrl, fetchedAt: this.s.remote.fetchedAt, rev: this.s.remote.rev,
    };
  }

  setAdminKey(seed) {
    if (!seed) { this.adminSeed = null; this.vault.set('adminSeed', null); return true; }
    if (!lic.isValidPrivate(seed, this.publicKey)) return false;
    this.adminSeed = seed;
    this.vault.set('adminSeed', seed);
    return true;
  }

  issue(opts) {
    if (!this.adminSeed) throw new Error('Réservé à l\'admin.');
    return lic.createLicense(this.adminSeed, opts);
  }

  publish() {
    if (!this.adminSeed) throw new Error('Réservé à l\'admin.');
    const d = this.s.adminDraft;
    d.rev = (d.rev || 0) + 1;
    this.file.save();
    return lic.signConfig(this.adminSeed, { ...d, publishedAt: Date.now() });
  }

  // Une config non signée ou plus ancienne que la version connue est ignorée.
  applyRemote(file) {
    const cfg = lic.verifyConfig(file, this.publicKey);
    if (!cfg) return { ok: false, reason: 'Signature invalide' };
    if ((cfg.rev || 0) < (this.s.remote.rev || 0)) return { ok: false, reason: 'Version plus ancienne ignorée' };
    this.s.remote.rev = cfg.rev || 0;
    this.s.remote.config = cfg;
    this.s.remote.fetchedAt = Date.now();
    this.file.save();
    return { ok: true, rev: cfg.rev };
  }

  async fetchRemote() {
    const url = this.s.remote.urlOverride || brand.remoteConfigUrl;
    if (!url) return { ok: false, reason: 'Aucune URL de configuration' };
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!res.ok) return { ok: false, reason: `Le serveur a répondu ${res.status}` };
      const out = this.applyRemote(await res.json());
      if (out.ok) this.onChange?.();
      return out;
    } catch (e) {
      this.log?.(`Configuration distante : ${e.message}`);
      return { ok: false, reason: 'Fichier de configuration injoignable' };
    }
  }
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

module.exports = { Roles, compareVersions };
