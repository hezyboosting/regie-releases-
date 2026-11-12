const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const { parseSony } = require('../src/main/pads');
const { parseRl, parseCs2, parseLol, rconPacket, rconSend, detectGame } = require('../src/main/gamehub');
const { normalize } = require('../src/main/connectors/kick');
const { MiniGames } = require('../src/main/minigames');
const { Viewers, dayKey } = require('../src/main/viewers');
const { resolveFeatures, FEATURES } = require('../src/shared/features');
const { GAMES, rankLabel, nextRank, gameById, rankLook } = require('../src/shared/games');
const { adaptElements } = require('../src/main/ai');
const { finishFrom, OVERLAY_TYPES } = require('../src/shared/overlay-schema');
const { TEMPLATES } = require('../src/shared/templates');

test('manette Sony en USB : boutons, croix, sticks et gâchettes', () => {
  const r = Buffer.alloc(64);
  r[0] = 0x01; r[1] = 128; r[2] = 0; r[3] = 128; r[4] = 255;
  r[5] = 0x20 | 0x00; // bas (premier bouton) et croix vers le haut
  r[6] = 0x01; // bumper gauche
  r[7] = 0x01; // bouton central
  r[8] = 255; r[9] = 51;
  const ds4 = parseSony('ds4', r);
  assert.equal(ds4.b[0], true, 'bouton du bas');
  assert.equal(ds4.b[4], true, 'bumper gauche');
  assert.equal(ds4.b[12], true, 'croix haut');
  assert.equal(ds4.b[16], true, 'bouton central');
  assert.equal(ds4.a[1] < -0.9, true, 'stick gauche vers le haut');
  assert.equal(ds4.lt, 1);
  assert.equal(ds4.rt, 0.2);
});

test('Rocket League : score en direct, but, victoire', () => {
  const st = {};
  const update = JSON.stringify({ Event: 'UpdateState', Data: { Players: [{ Name: 'hezy', TeamNum: 1, Goals: 2, Assists: 0, Saves: 1, Shots: 3, Demos: 0, Score: 300 }], Game: { Teams: [{ TeamNum: 0, Score: 1 }, { TeamNum: 1, Score: 2 }], TimeSeconds: 120, bOvertime: false, Arena: 'Stadium' } } });
  const [o] = parseRl(update, st, 'hezy');
  assert.deepEqual([o.state.blue, o.state.orange, o.state.team, o.state.me.goals], [1, 2, 1, 2]);
  assert.deepEqual(parseRl(JSON.stringify({ Event: 'GoalScored', Data: { Scorer: { Name: 'HEZY', TeamNum: 1 }, GoalSpeed: 90 } }), st, 'hezy')[0].kind, 'goal');
  assert.deepEqual(parseRl(JSON.stringify({ Event: 'MatchEnded', Data: { WinnerTeamNum: 1 } }), st, 'hezy').map((x) => x.kind), ['win', 'end']);
  assert.deepEqual(parseRl('{pas du json', st, 'hezy'), []);
});

test('Counter-Strike 2 : kills, résultat, spectateur ignoré', () => {
  const st = {};
  const body = (kills, phase, ct, t) => ({ provider: { steamid: '1' }, player: { steamid: '1', team: 'CT', match_stats: { kills, deaths: 0, assists: 0, mvps: 0 }, state: { health: 100 } }, map: { name: 'de_dust2', phase, round: 3, team_ct: { score: ct }, team_t: { score: t } } });
  parseCs2(body(1, 'live', 3, 2), st);
  assert.equal(parseCs2(body(3, 'live', 3, 2), st)[0].amount, 2);
  const end = parseCs2(body(3, 'gameover', 13, 9), st).map((x) => x.kind);
  assert.deepEqual(end.slice(0, 2), ['win', 'end']);
  assert.deepEqual(parseCs2({ provider: { steamid: '1' }, player: { steamid: '2' }, map: {} }, {}), []);
});

test('League of Legends : KDA et fin de partie', () => {
  const st = {};
  const data = (kills, events = []) => ({ activePlayer: { riotIdGameName: 'hezy' }, allPlayers: [{ riotIdGameName: 'hezy', championName: 'Ahri', level: 7, scores: { kills, deaths: 1, assists: 2, creepScore: 40 } }], gameData: { gameTime: 300 }, events: { Events: events } });
  assert.equal(parseLol(data(0), st)[0].kind, 'start');
  assert.equal(parseLol(data(2), st)[0].amount, 2);
  const out = parseLol(data(2, [{ EventID: 4, EventName: 'GameEnd', Result: 'Win' }]), st).map((x) => x.kind);
  assert.deepEqual(out.slice(0, 2), ['win', 'end']);
});

test('RCON Minecraft : paquet correct et échange avec un faux serveur', async () => {
  const p = rconPacket(7, 3, 'abc');
  assert.equal(p.readInt32LE(0), 13);
  assert.equal(p.readInt32LE(4), 7);
  assert.equal(p.toString('utf8', 12, 15), 'abc');
  const server = net.createServer((c) => {
    c.on('data', (d) => {
      const id = d.readInt32LE(4);
      const type = d.readInt32LE(8);
      if (type === 3) c.write(rconPacket(d.toString('utf8', 12, d.length - 2) === 'secret' ? id : -1, 2, ''));
      else c.write(rconPacket(id, 0, 'il y a 3 joueurs'));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  assert.equal(await rconSend({ host: '127.0.0.1', port, password: 'secret' }, 'list'), 'il y a 3 joueurs');
  await assert.rejects(rconSend({ host: '127.0.0.1', port, password: 'faux' }, 'list'), /[Mm]ot de passe/);
  server.close();
});

test('détection du jeu lancé parmi les processus', () => {
  assert.equal(detectGame(['obs64.exe', 'rocketleague.exe']), 'rocketleague');
  assert.equal(detectGame(['explorer.exe', 'obs64.exe']), null);
});

test('Kick : message, abonnement et événement inconnu', () => {
  const m = normalize('App\\Events\\ChatMessageEvent', JSON.stringify({ content: 'salut [emote:1:Kappa]', sender: { id: 9, username: 'Lena', slug: 'lena', identity: { badges: [{ type: 'moderator' }] } } }));
  assert.equal(m.type, 'chat');
  assert.equal(m.text, 'salut :Kappa:');
  assert.equal(m.user.mod, true);
  assert.equal(normalize('App\\Events\\SubscriptionEvent', { username: 'Nolan', months: 3 }).months, 3);
  assert.equal(normalize('App\\Events\\Autre', {}), null);
});

function miniRig() {
  const state = { minigame: { kind: '', status: 'idle' }, minigames: { quiz: [], roulette: [{ id: 'a', label: 'Rien', color: '#000', weight: 1, points: 0 }, { id: 'b', label: 'Jackpot', color: '#fff', weight: 0, points: 500 }] } };
  const viewers = { file: { data: { list: {} }, save() {} }, session: { viewers: {} } };
  const engine = { s: state, viewers, save() {}, push() {}, server: { broadcast() {} }, fireCustom() {} };
  return { game: new MiniGames(engine), state, viewers };
}
const chatter = (id = 'u1') => ({ platform: 'twitch', user: { id, name: id, display: id } });

test('devinette : le bon nombre gagne et le mot est masqué', () => {
  const { game, state, viewers } = miniRig();
  viewers.file.data.list[Viewers.key(chatter())] = { points: 0 };
  game.startGuess({ secret: 42, min: 1, max: 100, seconds: 60, prize: 25 });
  assert.equal(game.onChat(chatter(), 'pas un nombre'), false);
  game.onChat(chatter(), '10');
  assert.equal(state.minigame.near, 'Plus que 10');
  assert.equal(game.view().secret, undefined, 'le secret ne part jamais vers l\'overlay');
  game.onChat(chatter(), '42');
  assert.equal(state.minigame.status, 'ended');
  assert.equal(state.minigame.winner.name, 'u1');
  assert.equal(viewers.file.data.list[Viewers.key(chatter())].points, 25);
  game.startGuess({ mode: 'word', secret: 'Fusée', seconds: 60 });
  assert.equal(game.view().hint, '•••••');
  game.onChat(chatter(), 'fusee');
  assert.equal(state.minigame.status, 'ended');
  game.stop();
});

test('quiz : une réponse par personne, comptée', () => {
  const { game, state } = miniRig();
  game.startQuiz({ questions: [{ q: 'Q', a: ['a', 'b'], c: 1 }], seconds: 30 });
  game.onChat(chatter(), '2');
  game.onChat(chatter(), '1');
  assert.deepEqual(state.minigame.counts, [0, 1]);
  assert.equal(Object.values(state.minigame.scores)[0].points, 1);
  game.stop();
});

test('roulette : une case à poids nul ne sort jamais', () => {
  const { game, state } = miniRig();
  for (let i = 0; i < 20; i += 1) { game.spin(null); assert.equal(state.minigame.segments[state.minigame.index].label, 'Rien'); }
  game.stop();
});

test('classement : les périodes comptent seulement les bons jours', () => {
  const file = { data: { list: {}, days: {} }, save() {} };
  const v = new Viewers(file);
  const today = dayKey();
  const old = dayKey(Date.now() - 12 * 86400000);
  file.data.days[today] = { 'twitch:1': { name: 'Lena', platform: 'twitch', coins: 10, points: 0, messages: 0, likes: 0 } };
  file.data.days[old] = { 'twitch:1': { name: 'Lena', platform: 'twitch', coins: 90, points: 0, messages: 0, likes: 0 }, 'twitch:2': { name: 'Nolan', platform: 'twitch', coins: 5, points: 0, messages: 0, likes: 0 } };
  assert.deepEqual(v.board('coins', 5, 'today').map((x) => [x.name, x.value]), [['Lena', 10]]);
  assert.equal(v.board('coins', 5, 'week').length, 1);
  assert.deepEqual(v.board('coins', 5, 'month').map((x) => [x.name, x.value]), [['Lena', 100], ['Nolan', 5]]);
});

test('offres : chaque fonction a une valeur pour FREE, PRO et ULTIMATE, et monte toujours', () => {
  const rank = (v) => (v === -1 ? Infinity : v === true ? 1 : v === false ? 0 : v);
  for (const [k, f] of Object.entries(FEATURES)) {
    assert.ok(rank(f.free) <= rank(f.pro), `${k} PRO`);
    assert.ok(rank(f.pro) <= rank(f.ultimate), `${k} ULTIMATE`);
  }
  assert.equal(resolveFeatures('premium').removeWatermark, true, 'les anciennes clés restent valables');
  assert.equal(resolveFeatures('ultimate').webhooks, true);
  assert.equal(resolveFeatures('pro').webhooks, false);
});

test('catalogue des jeux : ids uniques, rangs ordonnés et libellés', () => {
  assert.ok(GAMES.length >= 15);
  assert.equal(new Set(GAMES.map((g) => g.id)).size, GAMES.length);
  for (const g of GAMES) for (const r of g.ranks) assert.match(r.color, /^#[0-9A-Fa-f]{6}$/, g.id);
  const rl = gameById('rocketleague');
  assert.equal(rankLabel(rl, 'diamant', 2), 'Diamant II');
  assert.equal(nextRank(rl, 'diamant', 2).name, 'Diamant III');
  assert.equal(gameById('inconnu').id, 'custom');
});

test('passage en 9:16 : tout reste dans le cadre', () => {
  const out = adaptElements([{ kind: 'text', x: 1500, y: 1000, w: 400, h: 60, size: 60 }], '9:16');
  assert.ok(out[0].x + out[0].w <= 1080);
  assert.ok(out[0].y < 1920);
});

test('finitions de manette : un coloris remplit toutes les pièces', () => {
  const f = finishFrom('rouge');
  assert.deepEqual(Object.keys(f).sort(), ['buttons', 'grips', 'light', 'shell', 'sticks', 'triggers']);
  assert.equal(f.shell.c1, '#FF8A8A');
  assert.equal(f.shell.alpha, 100, 'la coque est pleine');
  assert.ok(finishFrom('verre').shell.alpha < 50, 'le coloris Verre reste translucide');
  assert.ok(OVERLAY_TYPES.gamepad.fields.find((x) => x.key === 'finish').default.shell);
});

test('blasons : chaque rang en montre plus, et rien d\'injecté', async () => {
  const { crest } = await import('../src/overlays/crest.js');
  const size = (step) => crest({ color: '#FFC53D', step, steps: 8 }).length;
  assert.ok(size(7) > size(4) && size(4) > size(1) && size(1) >= size(0), 'la montée se voit');
  assert.notEqual(crest({ sides: 5 }).replace(/crest\d+/g, ''), crest({ sides: 8 }).replace(/crest\d+/g, ''), 'chaque jeu a sa coupe');
  const pips = crest({ color: '#57B8FF', step: 2, steps: 5, pips: 2, divisions: 3 });
  assert.equal((pips.match(/r="2\.7"/g) || []).length, 3, 'une perle par division');
  const evil = crest({ color: '"><script>alert(1)</script>' });
  assert.ok(!evil.includes('<script'), 'une couleur invalide est ignorée');
  const first = crest({}).match(/id="(crest\d+)a"/)[1];
  const second = crest({}).match(/id="(crest\d+)a"/)[1];
  assert.notEqual(first, second, 'identifiants uniques sur une même page');
});

test('blason : division dans le bon sens selon le jeu', () => {
  const rl = gameById('rocketleague');
  const lol = gameById('lol');
  assert.deepEqual(rankLook(rl, 'or', 2), { step: 2, steps: rl.ranks.length, divisions: 3, pips: 2, sides: rl.sides });
  assert.equal(rankLook(lol, 'or', 1).pips, 4, 'Or I est le plus haut palier');
  assert.equal(rankLook(lol, 'or', 4).pips, 1);
  assert.equal(rankLook(rl, 'supersonic-legend').pips, 0);
  assert.equal(rankLook(rl, 'inconnu').step, 0);
  for (const g of GAMES) assert.ok(g.sides >= 5 && g.sides <= 8, g.id);
});

test('modèles : ids uniques, catégorie présente, format vertical cohérent', () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(t.cat, t.id);
    const maxX = Math.max(...t.elements.map((e) => e.x + e.w));
    if (t.format === '9:16') assert.ok(maxX <= 1080, t.id);
  }
});

test('Twitch sans compte : message, bits, abonnement et raid', () => {
  const { parseIrc, normalizeIrc } = require('../src/main/connectors/twitch-irc');
  const chat = parseIrc('@badges=moderator/1;color=#FF0000;display-name=Lena;user-id=42 :lena!lena@lena.tmi.twitch.tv PRIVMSG #hezy :salut tout le monde');
  const m = normalizeIrc(chat);
  assert.deepEqual([m.type, m.text, m.user.display, m.user.mod, m.color], ['chat', 'salut tout le monde', 'Lena', true, '#FF0000']);
  assert.equal(normalizeIrc(parseIrc('@bits=100;display-name=Nolan :nolan!n@n PRIVMSG #hezy :cheer100')).amount, 100);
  const raid = normalizeIrc(parseIrc('@msg-id=raid;msg-param-viewerCount=37;display-name=Inès;login=ines USERNOTICE #hezy'));
  assert.deepEqual([raid.type, raid.amount, raid.user.name], ['raid', 37, 'ines']);
  assert.equal(normalizeIrc(parseIrc('@msg-id=resub;msg-param-cumulative-months=6;login=a USERNOTICE #hezy :merci')).months, 6);
  assert.equal(normalizeIrc(parseIrc(':tmi.twitch.tv 001 justinfan :Welcome')), null);
});

test('OBS : réglages lus dans les deux formats', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const Module = require('module');
  const load = Module._load;
  Module._load = (n, ...r) => (n === 'electron' ? {} : load(n, ...r));
  const { readObsConfig, fromIni, handleFrom } = require('../src/main/logins');
  Module._load = load;
  assert.deepEqual(fromIni('[Basic]\nX=1\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4456\nAuthRequired=true\nServerPassword=abc\n'), { enabled: true, port: 4456, password: 'abc' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-'));
  assert.deepEqual(readObsConfig(path.join(dir, 'absent')).found, false);
  fs.mkdirSync(path.join(dir, 'plugin_config', 'obs-websocket'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin_config', 'obs-websocket', 'config.json'), JSON.stringify({ server_enabled: true, server_port: 4455, auth_required: false, server_password: 'x' }));
  const c = readObsConfig(dir);
  assert.deepEqual([c.found, c.enabled, c.port, c.password], [true, true, 4455, '']);
  assert.equal(handleFrom('https://www.tiktok.com/@hezytv?lang=fr'), 'hezytv');
  assert.equal(handleFrom('https://www.tiktok.com/login'), '');
});
