// Lecture directe des manettes PlayStation (HID). Elle marche même quand un jeu a le focus,
// là où l'API navigateur s'arrête. Les manettes Xbox passent par XInput, dans input.js.
const SONY = 0x054c;
const PRODUCTS = { 0x05c4: 'ds4', 0x09cc: 'ds4', 0x0ba0: 'ds4', 0x0ce6: 'ds5', 0x0df2: 'ds5' };

const axis = (v) => { const n = Math.max(-1, Math.min(1, (v - 128) / 127)); return Math.abs(n) < 0.06 ? 0 : Math.round(n * 1000) / 1000; };

function layout(kind, r) {
  if (kind === 'ds5') {
    if (r[0] === 0x31) return { x: 2, l2: 7, r2: 8, b: 10 }; // Bluetooth complet
    if (r[0] === 0x01 && r.length >= 32) return { x: 1, l2: 5, r2: 6, b: 8 }; // USB
    if (r[0] === 0x01) return { x: 1, l2: 8, r2: 9, b: 5 }; // Bluetooth réduit
    return null;
  }
  if (r[0] === 0x11) return { x: 3, l2: 10, r2: 11, b: 7 }; // Bluetooth complet
  if (r[0] === 0x01) return { x: 1, l2: 8, r2: 9, b: 5 }; // USB ou Bluetooth réduit
  return null;
}

// Rapport brut vers le format standard à 18 boutons utilisé par l'overlay (fonction pure, testée).
function parseSony(kind, r) {
  const l = layout(kind, r);
  if (!l || r.length < l.b + 3) return null;
  const [b0, b1, b2] = [r[l.b], r[l.b + 1], r[l.b + 2]];
  const hat = b0 & 0x0f;
  const bit = (v, n) => Boolean(v & (1 << n));
  return {
    b: [bit(b0, 5), bit(b0, 6), bit(b0, 4), bit(b0, 7), bit(b1, 0), bit(b1, 1), bit(b1, 2), bit(b1, 3), bit(b1, 4), bit(b1, 5), bit(b1, 6), bit(b1, 7),
      [7, 0, 1].includes(hat), [3, 4, 5].includes(hat), [5, 6, 7].includes(hat), [1, 2, 3].includes(hat), bit(b2, 0), bit(b2, 1)],
    a: [axis(r[l.x]), axis(r[l.x + 1]), axis(r[l.x + 2]), axis(r[l.x + 3])],
    lt: r[l.l2] / 255,
    rt: r[l.r2] / 255,
  };
}

const sameState = (x, y) => x && y && x.lt === y.lt && x.rt === y.rt && x.a.every((v, i) => v === y.a[i]) && x.b.every((v, i) => v === y.b[i]);

class SonyPads {
  constructor({ onPad, onChange, log }) {
    Object.assign(this, { onPad, onChange, log });
    this.open = new Map();
    this.timer = null;
    this.hid = null;
    this.failed = false;
  }

  start() {
    if (this.timer || this.failed) return;
    try { this.hid = require('node-hid'); } catch (e) { this.failed = true; this.log?.(`Lecture HID indisponible : ${e.message}`); return; }
    this.scan();
    this.timer = setInterval(() => this.scan(), 3000);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    for (const p of this.open.values()) { try { p.dev.close(); } catch { /* déjà fermée */ } }
    this.open.clear();
    this.onChange?.();
  }

  async scan() {
    let list = [];
    try { list = await this.hid.devicesAsync(); } catch { return; }
    const found = list.filter((d) => d.vendorId === SONY && PRODUCTS[d.productId] && (d.usagePage === undefined || d.usagePage === 1) && (d.usage === undefined || d.usage === 5));
    for (const d of found) if (!this.open.has(d.path)) await this.attach(d);
    for (const path of [...this.open.keys()]) if (!found.some((d) => d.path === path)) this.drop(path);
  }

  async attach(d) {
    const kind = PRODUCTS[d.productId];
    try {
      const dev = await this.hid.HIDAsync.open(d.path);
      const p = { dev, kind, name: d.product || (kind === 'ds5' ? 'Manette PS5' : 'Manette PS4'), last: null };
      this.open.set(d.path, p);
      // En Bluetooth, cette lecture active le rapport complet (gâchettes analogiques comprises).
      dev.getFeatureReport(kind === 'ds5' ? 0x05 : 0x02, kind === 'ds5' ? 41 : 37).catch(() => {});
      dev.on('data', (buf) => this.onData(d.path, p, buf));
      dev.on('error', () => this.drop(d.path));
      this.onChange?.();
    } catch (e) { this.log?.(`Manette ${d.product || ''} : ${e.message}`); }
  }

  onData(path, p, buf) {
    const st = parseSony(p.kind, buf);
    if (!st || sameState(st, p.last)) return;
    p.last = st;
    this.onPad?.(path, st);
  }

  drop(path) {
    const p = this.open.get(path);
    if (!p) return;
    try { p.dev.close(); } catch { /* déjà fermée */ }
    this.open.delete(path);
    this.onChange?.();
  }

  list() { return [...this.open.entries()].map(([path, p]) => ({ key: path, kind: 'playstation', name: p.name })); }
}

module.exports = { SonyPads, parseSony };
