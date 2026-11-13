// Génère les dictionnaires anglais de Régie à partir de tools/i18n/en.tsv :
//   src/renderer/i18n.js et src/overlays/i18n.js (modules ES), src/shared/i18n-en.json (processus principal).
// Lancer : node tools/i18n/build.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const EN = {};
for (const line of fs.readFileSync(path.join(__dirname, 'en.tsv'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const i = line.indexOf('\t');
  if (i < 0) continue;
  const fr = line.slice(0, i);
  const en = line.slice(i + 1);
  if (fr && en && fr !== en) EN[fr] = en;
}
const json = JSON.stringify(EN);
const head = '// Généré par tools/i18n/build.js depuis tools/i18n/en.tsv : ne pas modifier à la main.\n';
fs.writeFileSync(path.join(ROOT, 'src/renderer/i18n.js'), `${head}export const EN = ${json};\n`);
fs.writeFileSync(path.join(ROOT, 'src/overlays/i18n.js'), `${head}export const EN = ${json};\n`);
fs.writeFileSync(path.join(ROOT, 'src/shared/i18n-en.json'), json);
// Le traducteur, en module ES pour l'interface et les overlays.
const tr = fs.readFileSync(path.join(ROOT, 'src/shared/translate.js'), 'utf8').replace("'use strict';\n", '').replace('module.exports = { makeTranslator };', 'export { makeTranslator };');
const trHead = '// Copie générée de src/shared/translate.js par tools/i18n/build.js : modifier l\'original.\n';
fs.writeFileSync(path.join(ROOT, 'src/renderer/translate.js'), trHead + tr);
fs.writeFileSync(path.join(ROOT, 'src/overlays/translate.js'), trHead + tr);
console.log(`${Object.keys(EN).length} traductions`);
