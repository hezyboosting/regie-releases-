// Dessine l'icône (le voyant d'antenne) et assemble le .ico Windows.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 256 256">
<defs><radialGradient id="g" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#FF6A5C"/><stop offset=".55" stop-color="#F0392B"/><stop offset="1" stop-color="#B51F14"/></radialGradient></defs>
<rect x="6" y="6" width="244" height="244" rx="54" fill="#262C33"/><rect x="6" y="6" width="244" height="244" rx="54" fill="none" stroke="#49525C" stroke-width="6"/>
<circle cx="128" cy="128" r="84" fill="#14181D"/><circle cx="128" cy="128" r="68" fill="url(#g)"/>
<ellipse cx="104" cy="96" rx="28" ry="16" fill="#fff" opacity=".42" transform="rotate(-28 104 96)"/></svg>`;

(async () => {
  const b = await chromium.launch();
  const out = path.join(__dirname, '../build');
  const pngs = [];
  for (const s of [...SIZES, 1024]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(s)}`);
    const buf = await p.screenshot({ omitBackground: true });
    if (s === 1024) fs.writeFileSync(path.join(out, 'icon.png'), buf); else pngs.push([s, buf]);
    await p.close();
  }
  await b.close();
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const entries = []; let offset = 6 + 16 * pngs.length;
  for (const [s, buf] of pngs) {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += buf.length;
  }
  fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, ...entries, ...pngs.map((x) => x[1])]));
  console.log('Icône créée.');
})();
