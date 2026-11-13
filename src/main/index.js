// Point d'entrée Electron : fenêtres, branchements et cycle de vie.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, safeStorage, session, desktopCapturer, shell, globalShortcut, Notification } = require('electron');
const brand = require('../shared/brand');
const { defaultState } = require('../shared/defaults');
const { JsonFile, Vault } = require('./store');
const { Roles } = require('./roles');
const { OverlayServer } = require('./server');
const { Engine } = require('./engine');
const { VirtualPad } = require('./vpad');
const { Stats } = require('./stats');
const { Viewers } = require('./viewers');
const { Tts } = require('./tts');
const { Spotify } = require('./spotify');
const { NowPlaying } = require('./nowplaying');
const { Obs } = require('./obs');
const { InputHub } = require('./input');
const { createApi } = require('./api');
const { GameHub, newGsiToken } = require('./gamehub');
const { Updater } = require('./updater');
const { WebChat } = require('./webchat');
const { GiftCatalog } = require('./giftcatalog');
const dockEnglish = require('../shared/translate').makeTranslator(require('../shared/i18n-en.json'));

const isDemo = process.argv.includes('--demo') || process.env.REGIE_DEMO === '1';
if (process.env.REGIE_USER_DATA) app.setPath('userData', process.env.REGIE_USER_DATA);
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

// Les overlays doivent rester vivants pendant qu'un jeu passe devant l'appli.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let dockWin = null;
let mainWin = null;
let audioWin = null;
let ctx = null;

// Journal limité à 1 Mo. Une ligne identique à la précédente n'est pas réécrite.
const recentLog = [];
let lastLine = '';
const log = (m) => {
  const line = String(m).slice(0, 600);
  console.log(line);
  if (line === lastLine) return;
  lastLine = line;
  recentLog.push({ ts: Date.now(), text: line });
  if (recentLog.length > 300) recentLog.shift();
  try {
    const file = path.join(app.getPath('userData'), 'regie.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) fs.renameSync(file, `${file}.old`);
    fs.appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch { /* journal facultatif */ }
};
process.on('uncaughtException', (e) => log(`Erreur : ${e.stack || e}`));
process.on('unhandledRejection', (e) => log(`Erreur : ${e?.stack || e}`));

function push(channel, payload) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(`push:${channel}`, payload);
}

function audioSend(channel, payload) {
  if (audioWin && !audioWin.isDestroyed()) audioWin.webContents.send(`engine:${channel}`, payload);
}

function createWindows() {
  mainWin = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1180, minHeight: 720, backgroundColor: '#00000000', backgroundMaterial: 'acrylic', title: brand.name, show: false,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#F2F5F9', height: 50 }, autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false },
  });
  mainWin.once('ready-to-show', () => {
    if (process.platform === 'win32' && ctx?.file?.data?.settings?.acrylic === false) mainWin.setBackgroundMaterial?.('none');
    if (ctx?.file?.data?.settings?.theme === 'light') mainWin.setTitleBarOverlay?.({ color: '#00000000', symbolColor: '#171B22', height: 50 });
    if (!process.env.REGIE_HIDDEN) mainWin.show();
  });
  mainWin.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWin.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWin.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWin.on('closed', () => { mainWin = null; app.quit(); });

  // Fenêtre invisible : voix système et analyse du son du PC.
  audioWin = new BrowserWindow({
    show: false, webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  audioWin.loadFile(path.join(__dirname, '../renderer/engine.html'));
}

// Chat unifié en fenêtre flottante, pour les logiciels sans dock personnalisé.
function openDock(url) {
  if (dockWin && !dockWin.isDestroyed()) { dockWin.show(); dockWin.focus(); return; }
  dockWin = new BrowserWindow({
    width: 400, height: 680, minWidth: 280, minHeight: 320, backgroundColor: '#14161B', title: `${brand.name} : chat unifié`, autoHideMenuBar: true,
    alwaysOnTop: true, icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  dockWin.setAlwaysOnTop(true, 'screen-saver');
  dockWin.loadURL(url);
  dockWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  dockWin.on('closed', () => { dockWin = null; });
}

function wantedInputs(server) {
  const hook = server.hasClient('keyboard') || server.hasClient('mouse');
  return { hook, pad: server.hasClient('gamepad') };
}

async function boot() {
  if (!primary) return;
  const dir = app.getPath('userData');
  const mediaDir = path.join(dir, 'media');
  const giftsDir = path.join(dir, 'gifts');
  fs.mkdirSync(mediaDir, { recursive: true });

  const file = new JsonFile(path.join(dir, 'state.json'), defaultState());
  const statsFile = new JsonFile(path.join(dir, 'stats.json'), { days: {}, supporters: {} });
  const vault = new Vault(path.join(dir, 'vault.dat'), safeStorage);
  log(`Démarrage ${brand.version}`);
  const stats = new Stats(statsFile);
  const viewersFile = new JsonFile(path.join(dir, 'viewers.json'), { list: {} });
  const viewers = new Viewers(viewersFile);
  const license = new Roles({ file, vault, log, onChange: () => { ctx?.engine.refreshAllOverlays(); push('snapshot', ctx?.snapshot()); } });
  const obs = new Obs();
  if (!file.data.gaming.gsiToken) file.data.gaming.gsiToken = newGsiToken();
  const hub = new GameHub({ getName: () => engine?.profile('rocketleague').pseudo, gsiToken: file.data.gaming.gsiToken, log });

  let engine;
  let api;
  const server = new OverlayServer({
    overlaysDir: path.join(__dirname, '../overlays'), mediaDir, giftsDir, port: file.data.settings.port || brand.defaultPort, lan: file.data.settings.lan, token: file.data.settings.overlayToken,
    getOverlay: (id) => file.data.overlays.find((o) => o.id === id),
    onGsi: (body) => hub.gsi(body),
    dock: {
      state: () => ({
        targets: engine.channels().filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.label, platform: c.platform, canSend: c.canSend, hint: c.sendHint ? (file.data.settings.uiLang === 'en' ? dockEnglish(c.sendHint) : c.sendHint) : '' })),
        feed: engine.feed.slice(-150),
        all: license.features().replyAllChannels,
        lang: file.data.settings.uiLang === 'en' ? 'en' : 'fr',
        tr: { enabled: !!file.data.chatTranslate?.enabled, mode: file.data.chatTranslate?.mode || 'below', showLang: file.data.chatTranslate?.showLang !== false },
      }),
      send: async (text, target) => {
        const en = file.data.settings.uiLang === 'en';
        try {
          const r = await api.sendChat(text, target);
          return { ...r, failed: (r.failed || []).map((f) => ({ ...f, error: en ? dockEnglish(f.error) : f.error })) };
        } catch (e) { throw new Error(en ? dockEnglish(e.message) : e.message); }
      },
    },
    clipFile: (id) => file.data.clips.list.find((c) => c.id === id)?.path,
    deck: {
      state: () => ({ pages: file.data.deck.pages.map((p) => ({ id: p.id, name: p.name, buttons: p.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, icon: b.icon || '' })) })), allowed: license.features().deckPhone }),
      press: (id) => license.features().deckPhone && engine.deckPress(id),
    },
    onConnect: (client) => {
      if (client.type === 'dock') return;
      const o = file.data.overlays.find((x) => x.id === client.overlayId);
      if (o) server.sendTo(client, engine.overlayInit(o));
      input.setWanted(wantedInputs(server));
      push('overlayClients', { id: client.overlayId, connected: server.connectedCount(client.overlayId) });
    },
    onDisconnect: (client) => {
      if (client.type === 'dock') return;
      input.setWanted(wantedInputs(server));
      push('overlayClients', { id: client.overlayId, connected: server.connectedCount(client.overlayId) });
    },
  });

  const input = new InputHub({
    log,
    onKey: (k) => server.broadcast({ t: 'key', ...k }, 'keyboard'),
    onMouse: (m) => server.broadcast({ t: 'mouse', ...m }, 'mouse'),
    onPad: (p) => { server.broadcast({ t: 'pad', ...p }, 'gamepad'); push('padLive', p); },
    onPads: (list) => { server.broadcast({ t: 'pads', list }, 'gamepad'); push('pads', list); },
  });
  input.paused = Boolean(file.data.settings.inputPaused);

  const spotify = new Spotify({
    vault, getClientId: () => engine.clientIds().spotify, openExternal: (u) => shell.openExternal(u),
    local: new NowPlaying({ dir: app.getPath('userData'), log }), getSource: () => file.data.spotify.source,
  });
  const tts = new Tts({
    getConfig: () => file.data.tts, getFeatures: () => license.features(), getElevenKey: () => engine.clientIds().eleven, getVoices: () => ctx?.voices || [], mediaDir,
    overlay: (msg) => server.broadcast(msg, 'tts'), engineSend: audioSend, push, log,
  });
  await server.start();
  log(`Serveur d'overlays sur le port ${server.port}`);
  engine = new Engine({ file, vault, server, spotify, tts, stats, obs, license, push, log, viewers, input, audio: audioSend });
  engine.vpad = new VirtualPad(log);
  engine.webchat = new WebChat({ log, parent: () => mainWin });
  engine.webchat.refreshAll().then(() => engine.pushChannels()).catch(() => {});
  if (file.data.vpad?.enabled) setTimeout(() => engine.vpad.start(), 3000);
  // Catalogue officiel des cadeaux TikTok : chargé au démarrage s'il est vide ou vieux de plus de trois jours.
  engine.catalog = new GiftCatalog({ dir: giftsDir, state: () => file.data, save: () => file.save(), log });
  if (file.data.giftCache) engine.gifts = file.data.giftCache;
  setTimeout(() => engine.refreshGiftCatalog(null).catch(() => {}), 12000);
  engine.input = input;
  engine.notify = (text) => { if (Notification.isSupported()) new Notification({ title: brand.name, body: text }).show(); };
  hub.on('update', (o) => { engine.onHubUpdate(o); if (o.state !== undefined) push('gameLive', o.state); });
  hub.on('links', (l) => push('gameLinks', { ...l }));
  hub.on('running', (id) => {
    push('gameRunning', id);
    if (id && file.data.gaming.auto) engine.setActiveGame(id, true);
    push('gameView', engine.gameView());
  });

  spotify.on('state', (st) => {
    server.broadcast({ t: 'spotify', spotify: st }, 'spotify');
    push('spotify', st);
  });
  spotify.on('log', log);
  obs.on('state', (st) => push('obs', st));
  obs.on('scene', (name) => push('obsScene', name));
  obs.on('scenesChanged', () => push('obsScenesChanged', true));

  const applyHotkeys = () => {
    globalShortcut.unregisterAll();
    const failed = [];
    for (const page of file.data.deck.pages) {
      for (const b of page.buttons) {
        if (!b.hotkey) continue;
        try { if (!globalShortcut.register(b.hotkey, () => engine.deckPress(b.id))) failed.push(b.hotkey); } catch { failed.push(b.hotkey); }
      }
    }
    return failed;
  };

  ipcMain.on('engine:tts-done', (_e, { id }) => tts.done(id));
  ipcMain.on('engine:voices', (_e, voices) => { ctx.voices = voices; push('voices', voices); });
  ipcMain.on('engine:audio', (_e, levels) => server.broadcast({ t: 'audio', levels }, 'spotify'));
  ipcMain.on('engine:pad', (_e, pad) => server.broadcast({ t: 'pad', ...pad }, 'gamepad'));

  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((src) => cb({ video: src[0], audio: 'loopback' })).catch(() => cb({}));
  });

  const updater = new Updater({ log, push, getSettings: () => file.data.settings });

  const created = createApi({
    file, vault, engine, server, spotify, tts, stats, obs, license, input, mediaDir, push, viewers, applyHotkeys, hub, statsFile, viewersFile, logs: () => recentLog, win: () => mainWin, openDock: () => openDock(server.dockLink()), updater,
  });  api = created.api;
  const { snapshot } = created;

  ctx = { file, statsFile, viewersFile, vault, engine, server, spotify, tts, stats, obs, license, input, hub, snapshot, updater, voices: [] };
  updater.start();
  server.onHook = (id) => engine.fireHook(id);
  applyHotkeys();
  hub.startWatch();
  api.voices = () => ctx.voices;

  ipcMain.handle('api', async (_e, method, ...args) => {
    const fn = api[method];
    if (!fn) throw new Error(`Méthode inconnue : ${method}`);
    try { return await fn(...args); } catch (err) { log(`api.${method} : ${err.message}`); throw err; }
  });

  createWindows();

  // Reprise des chaînes et services.
  for (const a of file.data.accounts) if (a.enabled !== false) engine.startAccount(a);
  spotify.start();
  if (file.data.obs.enabled) obs.connect(file.data.obs);
  license.fetchRemote();
  ctx.remoteTimer = setInterval(() => license.fetchRemote(), 3600 * 1000);

  // Vrais emblèmes de rang : installés tout seuls au premier lancement (et repris tant qu'il en manque),
  // sans jamais écraser une image choisie par le streamer.
  const RANKS_VERSION = 2;
  const autoRanks = async () => {
    const g = file.data.gaming;
    if (g.officialRanks?.version === RANKS_VERSION && !g.officialRanks.missing) return;
    try {
      const r = await api.installOfficialRanks('all', { auto: true });
      g.officialRanks = { version: RANKS_VERSION, at: Date.now(), done: r.done, missing: r.failed.length };
      file.save();
      push('gaming', file.data.gaming);
      log(`Emblèmes de rang : ${r.done} installés, ${r.failed.length} manquants`);
    } catch (e) { log(`Emblèmes de rang : ${e.message}`); }
  };
  setTimeout(autoRanks, 4000);

  // Un overlay Spotify réactif demande l'analyse audio uniquement quand il est ouvert.
  ctx.audioPoll = setInterval(() => {
    const on = engineReactive(file, engine, server);
    if (on === ctx.audioOn || !audioWin || audioWin.isDestroyed()) return;
    ctx.audioOn = on;
    // getDisplayMedia exige un geste utilisateur : executeJavaScript le fournit à cette fenêtre cachée.
    audioWin.webContents.executeJavaScript(on ? 'window.startCapture()' : 'window.stopCapture()', true).catch((e) => log(`Capture audio : ${e.message}`));
  }, 3000);

  if (isDemo) ctx.demo = setInterval(() => {
    const types = ['chat', 'chat', 'chat', 'follow', 'gift', 'bits', 'sub', 'superchat', 'like'];
    const platform = { gift: 'tiktok', like: 'tiktok', superchat: 'youtube', bits: 'twitch' };
    const t = types[Math.floor(Math.random() * types.length)];
    engine.simulate(t, platform[t] || ['tiktok', 'twitch', 'youtube'][Math.floor(Math.random() * 3)]);
  }, 3500);
}

function engineReactive(file, engine, server) {
  if (!engine.allowed('spotifyReactive')) return false;
  return [...server.clients].some((c) => c.type === 'spotify' && file.data.overlays.find((o) => o.id === c.overlayId)?.settings.reactive);
}

app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });

app.whenReady().then(boot).catch((err) => { log(`Démarrage impossible : ${err.stack}`); app.quit(); });

app.on('before-quit', () => {
  if (!ctx) return;
  clearInterval(ctx.remoteTimer);
  clearInterval(ctx.audioPoll);
  clearInterval(ctx.demo);
  ctx.updater.stop();
  ctx.engine?.webchat?.closeAll();
  ctx.engine.stop();
  try { ctx.engine.vpad?.stop(); } catch { /* déjà débranchée */ }
  ctx.hub.stop();
  ctx.spotify.stop();
  ctx.input.stop();
  ctx.obs.disconnect();
  ctx.file.flush();
  ctx.statsFile.flush();
  ctx.viewersFile.flush();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => app.quit());
