const test = require('node:test');
const assert = require('node:assert');
const lic = require('../src/main/license');
const { Roles, compareVersions } = require('../src/main/roles');
const { resolveFeatures, FEATURES } = require('../src/shared/features');
const { defaultState } = require('../src/shared/defaults');

const pair = lic.generateKeyPair();
const other = lic.generateKeyPair();
const fakeFile = () => ({ data: defaultState(), save() {} });
const fakeVault = () => { const d = {}; return { get: (k) => d[k], set: (k, v) => { d[k] = v; } }; };
const roles = (over = {}) => new Roles({ file: fakeFile(), vault: fakeVault(), publicKey: pair.publicKey, ...over });

test('une clé signée est acceptée, puis refusée si elle est modifiée', () => {
  const { key } = lic.createLicense(pair.privateKey, { name: 'Lena' });
  assert.equal(lic.verifyLicense(key, { publicKey: pair.publicKey }).ok, true);
  const [a, body, sig] = key.split('.');
  const forged = JSON.parse(Buffer.from(body, 'base64url'));
  forged.e = 0; forged.n = 'Pirate';
  const tampered = `${a}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}`;
  assert.equal(lic.verifyLicense(tampered, { publicKey: pair.publicKey }).ok, false);
});

test('une clé créée avec une autre clé privée est refusée', () => {
  const { key } = lic.createLicense(other.privateKey, {});
  assert.equal(lic.verifyLicense(key, { publicKey: pair.publicKey }).ok, false);
});

test('expiration, révocation et liaison au PC', () => {
  const expired = lic.createLicense(pair.privateKey, { days: 1 }).key;
  assert.match(lic.verifyLicense(expired, { publicKey: pair.publicKey, now: Date.now() + 2 * 86400000 }).reason, /expiré/);
  const { key, payload } = lic.createLicense(pair.privateKey, {});
  assert.match(lic.verifyLicense(key, { publicKey: pair.publicKey, revoked: [payload.i] }).reason, /désactivée/);
  const bound = lic.createLicense(pair.privateKey, { machine: 'AAAA-BBBB' }).key;
  assert.equal(lic.verifyLicense(bound, { publicKey: pair.publicKey, machineId: 'AAAA-BBBB' }).ok, true);
  assert.match(lic.verifyLicense(bound, { publicKey: pair.publicKey, machineId: 'CCCC-DDDD' }).reason, /autre PC/);
});

test('la clé admin doit correspondre à la clé publique du .exe', () => {
  assert.equal(lic.isValidPrivate(pair.privateKey, pair.publicKey), true);
  assert.equal(lic.isValidPrivate(other.privateKey, pair.publicKey), false);
  assert.equal(lic.isValidPrivate('nimportequoi', pair.publicKey), false);
});

test('FREE, PRO, ULTIMATE et Admin donnent les bons droits', () => {
  const r = roles();
  assert.equal(r.role(), 'free');
  assert.equal(r.features().channelsPerPlatform, 1);
  assert.equal(r.features().removeWatermark, false);

  r.s.license.key = lic.createLicense(pair.privateKey, {}).key;
  assert.equal(r.role(), 'pro');
  assert.equal(r.features().channelsPerPlatform, 2);
  assert.equal(r.features().removeWatermark, true);
  assert.equal(r.features().aiOverlays, false);
  assert.equal(r.isAdmin(), false);

  r.s.license.key = lic.createLicense(pair.privateKey, { tier: 'ultimate' }).key;
  assert.equal(r.role(), 'ultimate');
  assert.equal(r.features().channelsPerPlatform, -1);
  assert.equal(r.features().aiOverlays, true);

  assert.equal(r.setAdminKey(other.privateKey), false);
  assert.equal(r.setAdminKey(pair.privateKey), true);
  assert.equal(r.role(), 'admin');
  assert.equal(r.isAdmin(), true);
  for (const k of Object.keys(FEATURES)) assert.ok(r.features()[k] === true || r.features()[k] === -1, k);
});

test('l\'admin peut voir l\'appli comme un autre rôle sans perdre son accès', () => {
  const r = roles();
  r.setAdminKey(pair.privateKey);
  r.s.license.viewAs = 'free';
  assert.equal(r.role(), 'free');
  assert.equal(r.realRole(), 'admin');
  assert.equal(r.isAdmin(), false);
  assert.equal(r.features().goals, 3);
});

test('une matrice modifiée change les droits', () => {
  assert.equal(resolveFeatures('free', { goals: { free: 3 } }).goals, 3);
  assert.equal(resolveFeatures('pro', { spotifyThemes: { pro: false } }).spotifyThemes, false);
  assert.equal(resolveFeatures('admin', { spotifyThemes: { pro: false } }).spotifyThemes, true);
});

test('la configuration diffusée doit être signée et ne peut pas revenir en arrière', () => {
  const r = roles();
  const signed = lic.signConfig(pair.privateKey, { rev: 3, announcement: 'Salut', features: { goals: { free: 2 } }, revoked: [] });
  assert.equal(r.applyRemote(signed).ok, true);
  assert.equal(r.features().goals, 2);
  assert.equal(r.publicRemote().announcement, 'Salut');
  assert.equal(r.applyRemote(lic.signConfig(pair.privateKey, { rev: 2 })).ok, false);
  assert.equal(r.applyRemote(lic.signConfig(other.privateKey, { rev: 9, features: { goals: { free: 99 } } })).ok, false);
  assert.equal(r.applyRemote({ format: 'regie-config-1', body: signed.body.slice(1), sig: signed.sig }).ok, false);
  assert.equal(r.features().goals, 2);
});

test('une clé révoquée à distance repasse le client en FREE', () => {
  const r = roles();
  const { key, payload } = lic.createLicense(pair.privateKey, {});
  r.s.license.key = key;
  assert.equal(r.role(), 'pro');
  r.applyRemote(lic.signConfig(pair.privateKey, { rev: 1, revoked: [payload.i] }));
  assert.equal(r.role(), 'free');
});

test('comparaison de versions', () => {
  assert.ok(compareVersions('1.2.0', '1.1.9') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.0') === 0);
  assert.ok(compareVersions('0.9', '1.0.0') < 0);
});
