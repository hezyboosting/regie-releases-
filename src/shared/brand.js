// Identité de l'appli. Pour renommer le produit, il suffit de changer `name`.
const path = require('path');
const fs = require('fs');

let build = { publicKey: '', remoteConfigUrl: '', defaults: {} };
try {
  build = { ...build, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'build-config.json'), 'utf8')) };
} catch { /* première compilation : tools/keygen.js crée ce fichier */ }

module.exports = {
  name: 'Régie',
  slug: 'regie',
  tagline: 'Ta salle de contrôle pour le direct',
  version: require('../../package.json').version,
  publicKey: build.publicKey,
  remoteConfigUrl: build.remoteConfigUrl,
  defaults: build.defaults,
  defaultPort: 7787,
  spotifyRedirect: 'http://127.0.0.1:43117/callback',
  spotifyPort: 43117,
};
