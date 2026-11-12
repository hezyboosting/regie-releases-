const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { NowPlaying, toState, fromTasklist, decode850 } = require('../src/main/nowplaying');
const { Spotify } = require('../src/main/spotify');
const { rankFromFile, gameFromFolder, rankImage } = require('../src/shared/rank-files');
const { GAMES, gameById } = require('../src/shared/games');

const vault = (data = {}) => ({ get: (k) => data[k], set: (k, v) => { data[k] = v; } });

test('le morceau Windows prend la forme du lecteur Spotify', () => {
  const st = toState({ title: 'Titre', artist: 'Artiste', album: 'Album', playing: true, position: 10000, duration: 60000, updated: 1000 }, 'data:image/png;base64,AA', 3000);
  assert.equal(st.playing, true);
  assert.equal(st.progress, 12000, 'la position avance depuis la dernière mise à jour');
  assert.equal(st.track.title, 'Titre');
  assert.equal(st.track.cover, 'data:image/png;base64,AA');
  assert.equal(st.track.duration, 60000);
  assert.deepEqual(st.queue, []);
});

test('pas de durée, pas de position inventée, et date Windows vide', () => {
  assert.equal(toState({ title: 'T', artist: 'A', playing: true, position: 0, duration: 0, updated: 5 }, '', 900).progress, 0);
  assert.equal(toState({ title: 'T', artist: 'A', playing: true, position: 500, duration: 9000, updated: -116444736000 }, '', 900).progress, 500);
});

test('la publicité de Spotify gratuit ne passe pas pour un morceau', () => {
  for (const title of ['Advertisement', 'Publicité', 'Spotify', 'Spotify Free']) assert.equal(toState({ title, playing: true }).track, null, title);
  assert.equal(toState({ none: true }).track, null);
  assert.equal(toState({ title: 'Spotify', artist: 'Un groupe' }).track.title, 'Spotify', 'un vrai morceau peut porter ce nom');
});

test('titre de la fenêtre Spotify, accents compris', () => {
  const raw = Buffer.concat([
    Buffer.from('"Spotify.exe","1","Console","1","10 Ko","Running","PC\\moi","0:00:01","N/A"\r\n'),
    Buffer.from('"Spotify.exe","2","Console","1","10 Ko","Running","PC\\moi","0:00:01","Ang'),
    Buffer.from([0x8a]),
    Buffer.from('le - Ensemble - Live"\r\n'),
  ]);
  assert.deepEqual(fromTasklist(decode850(raw)), { artist: 'Angèle', title: 'Ensemble - Live', playing: true });
  assert.ok(fromTasklist('"Spotify.exe","1","Console","1","10 Ko","Running","x","0:00:01","Spotify Free"').none);
  assert.equal(decode850(Buffer.from([0xff])), ' ', 'la table couvre les 128 caractères');
  assert.equal(decode850(Buffer.from([0xad])), '¡');
});

test('la pochette reste en mémoire entre deux lignes', () => {
  const np = new NowPlaying({ dir: '.' });
  const seen = [];
  np.on('state', (s) => seen.push(s));
  np.onLine('﻿{"title":"T","artist":"A","playing":true,"position":0,"duration":1000,"updated":0,"cover":"data:x"}');
  np.onLine('{"title":"T","artist":"A","playing":true,"position":1,"duration":1000,"updated":0}');
  np.onLine('pas du json');
  np.onLine('{"error":"non"}');
  assert.equal(seen.length, 2);
  assert.equal(seen[1].track.cover, 'data:x');
});

test('sans compte, le lecteur vient de Windows et les boutons passent par Windows', async () => {
  const local = new EventEmitter();
  const sent = [];
  let source = null;
  local.start = (m) => { source = m; };
  local.stop = () => {};
  local.send = (c) => sent.push(c);
  const sp = new Spotify({ vault: vault(), getClientId: () => '', openExternal: () => {}, local, getSource: () => 'any' });
  const out = [];
  sp.on('state', (s) => out.push(s));
  sp.start();
  assert.equal(source, 'any');
  local.emit('state', toState({ title: 'T', artist: 'A', playing: true, position: 0, duration: 1000, updated: 0 }, ''));
  assert.equal(sp.state.track.title, 'T');
  local.emit('state', toState({ title: 'T', artist: 'A', playing: true, position: 0, duration: 1000, updated: 0 }, 'data:x'));
  assert.equal(out.length, 2, 'la pochette arrivée après le titre est publiée');
  await sp.control('next');
  assert.deepEqual(sent, ['next']);
  await assert.rejects(sp.control('bidon'));
});

test('un compte relié garde la main sur Windows', () => {
  const local = new EventEmitter();
  local.start = () => { throw new Error('ne doit pas démarrer'); };
  local.stop = () => {};
  const sp = new Spotify({ vault: vault({ spotify: { access: 'a', refresh: 'b', expires: 0 } }), getClientId: () => '', openExternal: () => {}, local });
  local.emit('state', toState({ title: 'T', artist: 'A' }, ''));
  assert.equal(sp.state.track, null);
});

test('le lecteur Windows tourne, reçoit les commandes, et bascule si PowerShell échoue', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regie-np-'));
  const fake = (name, body) => fs.writeFileSync(path.join(dir, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  const previous = process.env.PATH;
  process.env.PATH = `${dir}:${previous}`;
  const wait = (fn) => new Promise((done, fail) => {
    const start = Date.now();
    const tick = () => (fn() ? done() : Date.now() - start > 4000 ? fail(new Error('délai dépassé')) : setTimeout(tick, 20));
    tick();
  });
  try {
    fake('powershell.exe', `echo '{"title":"T","artist":"A","playing":true,"position":0,"duration":1000,"updated":0,"cover":"data:x"}'
read line; echo "{\\"title\\":\\"$line\\",\\"artist\\":\\"A\\",\\"playing\\":true}"
read line`);
    const np = new NowPlaying({ dir, log: () => {} });
    const seen = [];
    np.on('state', (s) => seen.push(s));
    np.stopped = false;
    np.launch();
    assert.equal(fs.readFileSync(path.join(dir, 'nowplaying.ps1'), 'utf8').startsWith('# Lit le morceau'), true, 'script copié hors de l\'archive');
    await wait(() => seen.length === 1);
    assert.equal(np.status, 'media');
    np.send('next');
    await wait(() => seen.length === 2);
    assert.equal(seen[1].track.title, 'next', 'la commande arrive au script');
    np.stop();
    assert.equal(np.status, 'off');

    fake('powershell.exe', 'exit 1');
    fake('tasklist', `printf '"Spotify.exe","2","C","1","1 Ko","Running","x","0:00:01","Artiste - Morceau"\\r\\n'`);
    const logs = [];
    const bad = new NowPlaying({ dir, log: (l) => logs.push(l) });
    bad.retryMs = 5;
    const titles = [];
    bad.on('state', (s) => titles.push(s.track?.title));
    bad.stopped = false;
    bad.launch();
    await wait(() => titles.length > 0);
    assert.equal(titles[0], 'Morceau');
    assert.equal(bad.status, 'window');
    assert.throws(() => bad.send('next'), /pas disponible/);
    bad.stop();
  } finally {
    process.env.PATH = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('le script Windows est bien livré avec l\'appli', () => {
  const text = fs.readFileSync(path.join(__dirname, '../src/main/nowplaying.ps1'), 'utf8');
  assert.ok(text.includes('OpenStandardInput'), 'lecture non bloquante des commandes');
  assert.ok(!text.includes('[Console]::In'), '[Console]::In bloquerait la boucle');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.ok(pkg.build.files.includes('src/**/*'));
});

test('noms de fichiers de rangs, français et anglais, avec ou sans division', () => {
  const rl = gameById('rocketleague');
  const val = gameById('valorant');
  const lol = gameById('lol');
  assert.deepEqual(rankFromFile(rl, 'diamant.png'), { tier: 'diamant', division: 0 });
  assert.deepEqual(rankFromFile(rl, 'Diamond_II.png'), { tier: 'diamant', division: 2 });
  assert.deepEqual(rankFromFile(rl, 'gold3.webp'), { tier: 'or', division: 3 });
  assert.deepEqual(rankFromFile(rl, 'Grand Champion 1.png'), { tier: 'grand-champion', division: 1 });
  assert.deepEqual(rankFromFile(rl, 'rl_rank_silver-2.png'), { tier: 'argent', division: 2 });
  assert.deepEqual(rankFromFile(val, 'Immortal_3_Rank.png'), { tier: 'immortel', division: 3 });
  assert.deepEqual(rankFromFile(val, 'valorant-gold-1.png'), { tier: 'or', division: 1 });
  assert.deepEqual(rankFromFile(lol, 'Émeraude IV.png'), { tier: 'emeraude', division: 4 });
  assert.equal(rankFromFile(rl, 'vacances.png'), null);
  assert.equal(rankFromFile(rl, 'diamant-9.png'), null, 'division qui n\'existe pas');
});

test('un nom de rang qui contient un chiffre reste entier', () => {
  const game = GAMES.find((g) => g.ranks.some((t) => t.name === 'Division 10'));
  assert.deepEqual(rankFromFile(game, 'Division 10.png'), { tier: 'division-10', division: 0 });
});

test('dossiers de jeux et priorité de l\'image de division', () => {
  assert.equal(gameFromFolder(GAMES, 'Rocket League').id, 'rocketleague');
  assert.equal(gameFromFolder(GAMES, 'RL').id, 'rocketleague');
  assert.equal(gameFromFolder(GAMES, 'csgo').id, 'cs2');
  assert.equal(gameFromFolder(GAMES, 'Mes images'), null);
  const images = { or: 'or.png', 'or:2': 'or2.png' };
  assert.equal(rankImage(images, 'or', 2), 'or2.png');
  assert.equal(rankImage(images, 'or', 3), 'or.png');
  assert.equal(rankImage(images, 'argent', 1), '');
  assert.equal(rankImage(undefined, 'or', 1), '');
});
