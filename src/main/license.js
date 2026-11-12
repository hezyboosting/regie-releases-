// Licences signées Ed25519, sans serveur.
// La clé publique est dans le .exe. La clé privée n'y est JAMAIS : détenir la clé privée = être admin.
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const os = require('os');

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');

const publicKeyObj = (raw) => crypto.createPublicKey({
  key: Buffer.concat([SPKI_PREFIX, Buffer.from(raw, 'base64')]), format: 'der', type: 'spki',
});
const privateKeyObj = (seed) => crypto.createPrivateKey({
  key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed, 'base64')]), format: 'der', type: 'pkcs8',
});

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'),
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64'),
  };
}

function publicFromPrivate(seed) {
  const pub = crypto.createPublicKey(privateKeyObj(seed));
  return pub.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
}

function isValidPrivate(seed, publicKey) {
  try { return Boolean(publicKey) && publicFromPrivate(seed.trim()) === publicKey; } catch { return false; }
}

// Format : RG1.<charge utile>.<signature>
function createLicense(seed, { tier = 'pro', days = 0, name = '', machine = '' }) {
  const payload = {
    i: crypto.randomBytes(6).toString('hex'),
    t: tier === 'ultimate' ? 'u' : 'p',
    n: String(name).slice(0, 60),
    c: Date.now(),
    e: days > 0 ? Date.now() + days * 86400000 : 0,
    h: machine ? String(machine).trim() : '',
  };
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(body), privateKeyObj(seed));
  return { key: `RG1.${body}.${b64u(sig)}`, payload };
}

function verifyLicense(key, { publicKey, machineId = '', revoked = [], now = Date.now() }) {
  const invalid = (reason, extra = {}) => ({ ok: false, reason, ...extra });
  if (!key || typeof key !== 'string') return invalid('Aucune clé');
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'RG1') return invalid('Cette clé n\'a pas le bon format.');
  let verified = false;
  try { verified = crypto.verify(null, Buffer.from(parts[1]), publicKeyObj(publicKey), unb64u(parts[2])); } catch { /* clé illisible */ }
  if (!verified) return invalid('Cette clé n\'est pas valide.');
  let p;
  try { p = JSON.parse(unb64u(parts[1]).toString('utf8')); } catch { return invalid('Cette clé n\'est pas valide.'); }
  const info = { id: p.i, name: p.n, created: p.c, expires: p.e || 0, machine: p.h || '' };
  if (p.t !== 'p' && p.t !== 'u') return invalid('Cette clé n\'est pas une clé PRO ou ULTIMATE.', info);
  if (revoked.includes(p.i)) return invalid('Cette clé a été désactivée.', info);
  if (p.e && p.e < now) return invalid('Cette clé a expiré.', info);
  if (p.h && machineId && p.h !== machineId) return invalid('Cette clé est liée à un autre PC.', info);
  return { ok: true, tier: p.t === 'u' ? 'ultimate' : 'pro', ...info };
}

// Configuration diffusée par l'admin : fichier JSON signé, hébergeable n'importe où.
function signConfig(seed, config) {
  const body = b64u(JSON.stringify(config));
  return { format: 'regie-config-1', body, sig: b64u(crypto.sign(null, Buffer.from(body), privateKeyObj(seed))) };
}

function verifyConfig(file, publicKey) {
  if (!file || file.format !== 'regie-config-1' || !publicKey) return null;
  try {
    if (!crypto.verify(null, Buffer.from(file.body), publicKeyObj(publicKey), unb64u(file.sig))) return null;
    return JSON.parse(unb64u(file.body).toString('utf8'));
  } catch { return null; }
}

function machineId() {
  let raw = '';
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
      raw = (out.match(/MachineGuid\s+REG_SZ\s+(\S+)/) || [])[1] || '';
    } catch { /* repli ci-dessous */ }
  }
  if (!raw) raw = `${os.hostname()}|${os.cpus()[0]?.model || ''}|${os.platform()}`;
  const h = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16).toUpperCase();
  return h.match(/.{4}/g).join('-');
}

module.exports = {
  generateKeyPair, publicFromPrivate, isValidPrivate, createLicense, verifyLicense, signConfig, verifyConfig, machineId,
};
