const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { PACK_PARTS, readNames, autoMap, pngSize, layersToSvg } = require('../src/shared/pad-pack');

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/pack-test.svg'), 'utf8');

test('les calques nommés sont lus, id et noms Inkscape compris', () => {
  const names = readNames(fixture);
  for (const n of ['coque', 'stick_l', 'stick_r', 'a', 'dpad_up', 'decor']) assert.ok(names.includes(n), n);
});

test('les pièces se reconnaissent seules, y compris sous d\'autres noms', () => {
  assert.deepEqual(autoMap(['coque', 'decor', 'stick_l', 'R2', 'L1', 'Left Stick', 'dpad-up', 'BUTTON A']), { shell: 'coque', a: 'BUTTON A', lb: 'L1', rt: 'R2', stickl: 'stick_l', up: 'dpad-up' });
  assert.equal(new Set(PACK_PARTS.map((p) => p.key)).size, PACK_PARTS.length);
  assert.deepEqual(autoMap(['decor', 'fond']), {});
});

test('un dossier de PNG devient un fichier en calques', () => {
  const png = (w, h) => { const b = Buffer.alloc(33); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  assert.deepEqual(pngSize(png(1240, 840)), { width: 1240, height: 840 });
  assert.equal(pngSize(Buffer.from('pas une image, assez long pour etre lu')), null);
  const svg = layersToSvg([{ name: '01-coque.png', data: png(100, 50) }, { name: '02_stick_l.png', data: png(100, 50) }]);
  assert.match(svg, /viewBox="0 0 100 50"/);
  assert.deepEqual(readNames(svg), ['coque', 'stick_l']);
  assert.throws(() => layersToSvg([{ name: 'a.png', data: png(1, 1) }, { name: 'b.png', data: Buffer.from('faux') }]), /PNG valide/);
});

test('un nom de calque hostile ne peut pas sortir de son attribut', () => {
  const png = Buffer.alloc(33); png.writeUInt32BE(0x89504e47, 0);
  assert.ok(!layersToSvg([{ name: '"><script>x.png', data: png }]).includes('<script'));
});
