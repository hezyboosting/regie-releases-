// Génère la paire de clés Ed25519 une seule fois.
// La clé publique va dans build-config.json (donc dans le .exe). La clé privée reste hors du dépôt.
const fs = require('fs');
const path = require('path');
const { generateKeyPair } = require('../src/main/license');

const cfgPath = path.join(__dirname, '../src/shared/build-config.json');
const outDir = process.argv[2] || path.join(__dirname, '../private');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : { publicKey: '', remoteConfigUrl: '', defaults: {} };

if (cfg.publicKey) {
  console.log('Une clé publique existe déjà : on ne la remplace pas, sinon toutes les licences vendues deviendraient invalides.');
  process.exit(0);
}
const { publicKey, privateKey } = generateKeyPair();
cfg.publicKey = publicKey;
fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'regie-admin-key.txt'), `Clé admin Régie. Garde ce fichier secret : il donne accès à tout et permet de créer des licences.\n\n${privateKey}\n`, { mode: 0o600 });
console.log(`Clés créées. Clé admin : ${path.join(outDir, 'regie-admin-key.txt')}`);
