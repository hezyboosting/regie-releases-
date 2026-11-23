// Assemble l'icône Windows (.ico) et les PNG de l'appli à partir de build/icon-source.png,
// le rendu 3D de la touche (voir tools/icon/ pour le refaire).
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'build/icon-source.png')).toString('base64');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  // Réduction de qualité (lissage haut de gamme du navigateur), taille par taille.
  const shrink = (s) => p.evaluate(async ([data, size]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/png').split(',')[1];
  }, [src, s]);
  const pngs = [];
  for (const s of SIZES) pngs.push([s, Buffer.from(await shrink(s), 'base64')]);
  fs.writeFileSync(path.join(root, 'src/renderer/logo.png'), Buffer.from(await shrink(96), 'base64'));
  await b.close();
  fs.copyFileSync(path.join(root, 'build/icon-source.png'), path.join(root, 'build/icon.png'));
  fs.copyFileSync(path.join(root, 'build/icon-source.png'), path.join(root, 'src/assets/icon.png'));
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const entries = []; let offset = 6 + 16 * pngs.length;
  for (const [s, buf] of pngs) {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += buf.length;
  }
  fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([head, ...entries, ...pngs.map((x) => x[1])]));
  console.log('Icône créée.');
})();
