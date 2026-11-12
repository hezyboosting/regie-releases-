const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');
const { OverlayServer } = require('../src/main/server');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regie-'));
const media = path.join(dir, 'media');
fs.mkdirSync(media);
fs.writeFileSync(path.join(media, 'son.mp3'), 'audio');
fs.writeFileSync(path.join(dir, 'secret.txt'), 'ne pas lire');

const overlays = { o1: { id: 'o1', type: 'alerts' } };

async function start(extra = {}) {
  const s = new OverlayServer({ overlaysDir: path.join(__dirname, '../src/overlays'), mediaDir: media, port: 0, lan: false, token: 'tok', getOverlay: (id) => overlays[id], ...extra });
  s.port = 39000 + Math.floor(Math.random() * 2000);
  await s.start();
  return s;
}
const get = (port, url, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: url, headers }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
  }).on('error', reject);
});

test('un overlay exige le bon jeton', async () => {
  const s = await start();
  assert.equal((await get(s.port, '/o/o1?k=tok')).status, 200);
  assert.equal((await get(s.port, '/o/o1?k=faux')).status, 403);
  assert.equal((await get(s.port, '/o/o1')).status, 403);
  assert.equal((await get(s.port, '/o/absent?k=tok')).status, 404);
  await s.stop();
});

test('impossible de sortir du dossier des médias', async () => {
  const s = await start();
  assert.equal((await get(s.port, '/media/son.mp3?k=tok')).status, 200);
  for (const u of ['/media/../secret.txt?k=tok', '/media/%2e%2e/secret.txt?k=tok', '/media/..%2Fsecret.txt?k=tok', '/assets/../../main/index.js', '/assets/%2e%2e%2f%2e%2e%2fmain/index.js']) {
    const r = await get(s.port, u);
    assert.notEqual(r.status, 200, u);
    assert.ok(!r.body.includes('ne pas lire'));
  }
  await s.stop();
});

test('le proxy d\'images n\'accepte que les hôtes prévus', async () => {
  const s = await start();
  assert.equal((await get(s.port, '/proxy?k=tok&u=https://evil.example/a.png')).status, 403);
  assert.equal((await get(s.port, '/proxy?k=tok&u=http://i.scdn.co/a.png')).status, 403);
  assert.equal((await get(s.port, '/proxy?k=tok&u=https://127.0.0.1/a')).status, 403);
  assert.equal((await get(s.port, '/proxy?k=tok&u=nimportequoi')).status, 400);
  await s.stop();
});

test('le flux WebSocket refuse un mauvais jeton et les pages web étrangères', async () => {
  const opened = [];
  const s = await start({ onConnect: (c) => opened.push(c) });
  const tryWs = (url, origin) => new Promise((resolve) => {
    const ws = new WebSocket(url, origin ? { origin } : {});
    ws.on('open', () => { ws.close(); resolve('open'); });
    ws.on('error', () => resolve('refused'));
  });
  const base = `ws://127.0.0.1:${s.port}/ws`;
  assert.equal(await tryWs(`${base}?k=tok&o=o1`), 'open');
  assert.equal(await tryWs(`${base}?k=faux&o=o1`), 'refused');
  assert.equal(await tryWs(`${base}?k=tok&o=absent`), 'refused');
  assert.equal(await tryWs(`${base}?k=tok&o=o1`, 'https://site-malveillant.example'), 'refused');
  assert.equal(await tryWs(`${base}?k=tok&o=o1`, `http://127.0.0.1:${s.port}`), 'open');
  assert.equal(opened.length, 2);
  await s.stop();
});

test('le serveur écoute seulement sur la machine par défaut', async () => {
  const s = await start();
  assert.equal(s.server.address().address, '127.0.0.1');
  assert.match(s.link('o1'), /^http:\/\/127\.0\.0\.1:\d+\/o\/o1\?k=tok$/);
  await s.stop();
});

test('si le port est pris, le serveur prend le suivant', async () => {
  const a = await start();
  const b = new OverlayServer({ overlaysDir: path.join(__dirname, '../src/overlays'), mediaDir: media, port: a.port, lan: false, token: 'tok', getOverlay: () => null });
  await b.start();
  assert.equal(b.port, a.port + 1);
  await b.stop();
  await a.stop();
});

test('webhook entrant : jeton obligatoire, POST accepté', async () => {
  const fired = [];
  const s = await start({ onHook: (id) => { fired.push(id); return id === 'ok'; } });
  const post = (url) => new Promise((resolve) => { const r = http.request({ host: '127.0.0.1', port: s.port, path: url, method: 'POST' }, (res) => { res.resume(); resolve(res.statusCode); }); r.end('{}'); });
  assert.equal(await post('/hook/ok?k=faux'), 403);
  assert.deepEqual(fired, []);
  assert.equal(await post('/hook/ok?k=tok'), 200);
  assert.equal(await post('/hook/autre?k=tok'), 404);
  assert.equal((await get(s.port, '/hook/ok?k=tok')).status, 200);
  await s.stop();
});
