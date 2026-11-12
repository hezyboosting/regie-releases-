// Persistance JSON : écriture atomique différée + coffre chiffré pour les jetons.
const fs = require('fs');
const path = require('path');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, extra) {
  if (!isObj(base) || !isObj(extra)) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const k of Object.keys(extra)) out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
  return out;
}

class JsonFile {
  constructor(file, defaults = {}) {
    this.file = file;
    this.data = defaults;
    this.timer = null;
    try {
      this.data = deepMerge(defaults, JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Fichier abîmé : on le met de côté au lieu de l'écraser.
        try { fs.renameSync(file, `${file}.broken-${Date.now()}`); } catch { /* rien à sauver */ }
      }
    }
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }

  flush() {
    clearTimeout(this.timer);
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
}

// Jetons OAuth et clés d'API : chiffrés par le compte Windows quand c'est possible.
class Vault {
  constructor(file, safeStorage) {
    this.file = file;
    this.safe = safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage : null;
    this.data = {};
    try {
      const raw = fs.readFileSync(file);
      const text = this.safe ? this.safe.decryptString(raw) : raw.toString('utf8');
      this.data = JSON.parse(text);
    } catch { this.data = {}; }
  }

  get(key) { return this.data[key]; }

  set(key, value) {
    if (value === undefined || value === null || value === '') delete this.data[key];
    else this.data[key] = value;
    const text = JSON.stringify(this.data);
    const buf = this.safe ? this.safe.encryptString(text) : Buffer.from(text);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, buf, { mode: 0o600 });
  }
}

module.exports = { JsonFile, Vault, deepMerge };
