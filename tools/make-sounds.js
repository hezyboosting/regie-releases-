// Fabrique les sons d'alerte par synthèse : ils sont originaux et libres de droits.
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const out = path.join(__dirname, '../src/overlays/sounds');
fs.mkdirSync(out, { recursive: true });

function render(seconds, fn) {
  const n = Math.floor(seconds * RATE);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i += 1) data[i] = fn(i / RATE);
  return data;
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const tone = (t, f) => Math.sin(2 * Math.PI * f * t);
const bell = (t, f, start, d = 0.4) => { const x = t - start; return x < 0 ? 0 : env(x, 0.004, d) * (tone(x, f) + 0.4 * tone(x, f * 2) + 0.15 * tone(x, f * 3.01)); };

const SOUNDS = {
  chime: render(1.2, (t) => 0.4 * (bell(t, 880, 0) + bell(t, 1318.5, 0.12))),
  pop: render(0.25, (t) => 0.7 * env(t, 0.002, 0.05) * tone(t, 420 + 900 * Math.exp(-t * 30))),
  coins: render(1, (t) => { let s = 0; for (let i = 0; i < 6; i += 1) s += bell(t, 1800 + i * 310, i * 0.07, 0.12); return 0.22 * s; }),
  fanfare: render(1.6, (t) => 0.2 * ([523.25, 659.25, 783.99, 1046.5].reduce((s, f, i) => s + bell(t, f, i * 0.11, 0.6), 0))),
  horn: render(1.4, (t) => { const a = Math.min(1, t * 14) * Math.min(1, (1.4 - t) * 4); return 0.25 * a * [146.8, 220, 293.7].reduce((s, f) => s + Math.sign(tone(t, f)) * 0.3 + tone(t, f), 0); }),
  tally: render(0.5, (t) => 0.5 * (bell(t, 660, 0, 0.1) + bell(t, 660, 0.16, 0.14))),
};

function wav(data) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32000), 44 + i * 2));
  return buf;
}
for (const [name, data] of Object.entries(SOUNDS)) fs.writeFileSync(path.join(out, `${name}.wav`), wav(data));
console.log(`${Object.keys(SOUNDS).length} sons créés.`);
