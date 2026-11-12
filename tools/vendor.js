// Copie les bibliothèques d'interface et la police dans src/, pour que l'appli marche hors ligne, sans étape de bundling.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const out = path.join(root, 'src/renderer/vendor');
const overlayFonts = path.join(root, 'src/overlays/fonts');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(overlayFonts, { recursive: true });

fs.copyFileSync(nm('preact/dist/preact.mjs'), path.join(out, 'preact.mjs'));
fs.copyFileSync(nm('preact/hooks/dist/hooks.mjs'), path.join(out, 'hooks.mjs'));
fs.copyFileSync(nm('htm/dist/htm.mjs'), path.join(out, 'htm.mjs'));

let hooks = fs.readFileSync(path.join(out, 'hooks.mjs'), 'utf8');
hooks = hooks.replace(/from\s*["']preact["']/g, 'from "./preact.mjs"');
fs.writeFileSync(path.join(out, 'hooks.mjs'), hooks);

for (const dir of [out, overlayFonts]) {
  fs.copyFileSync(nm('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'), path.join(dir, 'archivo.woff2'));
  fs.copyFileSync(nm('@fontsource-variable/archivo/files/archivo-latin-ext-wdth-normal.woff2'), path.join(dir, 'archivo-ext.woff2'));
}
for (const [pkg, name] of [['geist', 'geist'], ['syne', 'syne']]) {
  for (const dir of [out, overlayFonts]) {
    fs.copyFileSync(nm(`@fontsource-variable/${pkg}/files/${pkg}-latin-wght-normal.woff2`), path.join(dir, `${name}.woff2`));
    fs.copyFileSync(nm(`@fontsource-variable/${pkg}/files/${pkg}-latin-ext-wght-normal.woff2`), path.join(dir, `${name}-ext.woff2`));
  }
}
console.log('Bibliothèques copiées.');
