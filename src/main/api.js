// Toutes les actions disponibles pour l'interface, via IPC. Les droits sont vérifiés ici, pas dans l'interface.
const fs = require('fs');
const path = require('path');
const { dialog, shell, clipboard, session: eSession, app } = require('electron');
const { readObsConfig, loginWindow } = require('./logins');
const { uid, EVENT_TYPES, ALL, makeOverlay } = require('../shared/defaults');
const { OVERLAY_TYPES, COLORWAYS, FINISH_GROUPS, finishFrom, PAD_ZONES, PAD_ZONE_NAMES } = require('../shared/overlay-schema');
const { GAMES, STAT_LABEL } = require('../shared/games');
const { rankFromFile, gameFromFolder } = require('../shared/rank-files');
const { PACK_PARTS, RIGHTS, readNames, autoMap, layersToSvg } = require('../shared/pad-pack');
const { FEATURES, TIERS, withinLimit } = require('../shared/features');
const brand = require('../shared/brand');
const lic = require('./license');
const twitch = require('./connectors/twitch');
const { oauthFlow, DAILY_QUOTA } = require('./connectors/youtube');
const { TEMPLATES } = require('../shared/templates');
const { THEMES } = require('../shared/themes');
const { generateOverlay, sanitize, assistant, adaptElements } = require('./ai');
const { BOSSES } = require('./games');
const { installRl, installCs2, rconSend, findRocketLeague, findCs2 } = require('./gamehub');

const MEDIA_EXT = { image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], sound: ['mp3', 'wav', 'ogg', 'm4a'], video: ['mp4', 'webm'], visual: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm'] };

const MODULES = [['goals', 'Goals'], ['battles', 'Battles'], ['chatgames', 'Mini-jeux et combats'], ['gifts', 'Cadeaux'], ['ranks', 'Classements et rangs'], ['gaming', 'Jeux'], ['sounds', 'Sons'], ['tts', 'TTS'], ['spotify', 'Spotify'], ['deck', 'Stream Deck'], ['scenes', 'Scènes OBS'], ['clips', 'Clips'], ['automations', 'Automatisations'], ['shop', 'Boutique'], ['assistant', 'Assistant IA']];

function createApi(ctx) {
  const { file, vault, engine, server, spotify, tts, stats, obs, license, input, mediaDir, push, win, viewers, applyHotkeys, hub, logs, statsFile, viewersFile, openDock, updater } = ctx;
  const s = () => file.data;
  const need = (key, msg) => { if (!engine.allowed(key)) throw new Error(msg || 'Cette fonction est réservée à PRO.'); };
  const needAdmin = () => { if (license.realRole() !== 'admin') throw new Error('Réservé à l\'admin.'); };
  const find = (list, id, what) => { const x = list.find((i) => i.id === id); if (!x) throw new Error(`${what} introuvable.`); return x; };

  const snapshot = () => ({
    brand: { name: brand.name, tagline: brand.tagline, version: brand.version, spotifyRedirect: brand.spotifyRedirect },
    role: license.role(), realRole: license.realRole(), licenseInfo: license.info(), machineId: license.machine, features: engine.features(), featureDefs: FEATURES,
    remote: license.publicRemote(), channels: engine.channels(), overlays: s().overlays.map(overlayView), overlayTypes: OVERLAY_TYPES,
    alerts: s().alerts, eventTypes: EVENT_TYPES, goals: s().goals, battle: s().battle, commands: s().commands, triggers: s().triggers, tts: s().tts,
    spotify: { ...s().spotify, connected: spotify.connected, state: spotify.state }, tools: s().tools, poll: engine.pollView(),
    timers: s().tools.timers.map((t) => engine.timerView(t)), obs: { ...s().obs, password: '', hasPassword: Boolean(s().obs.password), state: obs.state, detail: obs.detail, streaming: obs.streaming },
    settings: s().settings, keys: keyStatus(), feed: engine.feed.slice(-120), gifts: engine.gifts, port: server.port, quota: { used: engine.quota().used(), max: DAILY_QUOTA }, inputAvailable: input.available,
    media: listMedia(), admin: license.realRole() === 'admin' && license.isAdmin() ? { draft: s().adminDraft, issued: s().issuedKeys } : null,
    ranks: s().ranks, rewards: s().rewards, arena: s().arena, boss: s().boss, gaming: s().gaming, sounds: s().sounds, deck: s().deck, clips: s().clips, scenes: s().scenes, keysCfg: s().keys,
    session: viewers.giftView(), boards: viewers.boards(10), vars: engine.liveVars(), templates: allTemplates(), themes: THEMES, bosses: BOSSES, keyNames: keyNames(), overlayToken: s().settings.overlayToken,
    gameCatalog: GAMES, statLabels: STAT_LABEL, gameView: engine.gameView(), gameRunning: hub.running, gameLinks: hub.linked, gameLive: engine.gameLive, goalHistory: s().goalHistory, minigame: engine.minigames.view(), minigames: s().minigames,
    padPacks: s().padPacks || [], packParts: PACK_PARTS.map(({ key, label }) => ({ key, label })), packRights: RIGHTS, pads: input.pads(), colorways: COLORWAYS, finishGroups: FINISH_GROUPS, padZones: PAD_ZONES, padZoneNames: PAD_ZONE_NAMES, modules: MODULES, tiers: TIERS, deckLink: server.deckLink(), spotifyHistory: spotify.history,
    updater: updater ? updater.status : { state: 'idle' }, brb: engine.brb || { active: false, startedAt: 0, elapsed: 0 },
  });

  const allTemplates = () => [...TEMPLATES, ...(license.remoteConfig().templates || []).map((t) => ({ ...t, community: true }))];

  const keyNames = () => {
    try { return Object.keys(require('uiohook-napi').UiohookKey).filter((k) => !/^Numpad(End|Arrow|Page|Home|Insert|Delete)/.test(k)); } catch { return []; }
  };

  const customList = () => s().overlays.filter((o) => o.type === 'custom');

  const newCustom = (name, elements, format) => {
    if (!withinLimit(engine.features().customOverlays, customList().length)) throw new Error(`Tu as utilisé tes ${engine.features().customOverlays} emplacements d'overlays personnalisés. Passe en PRO ou libère une place.`);
    const o = makeOverlay('custom', name);
    o.settings = { elements: JSON.parse(JSON.stringify(elements || [])), confetti: false, format: format || '16:9', versions: [] };
    s().overlays.push(o);
    file.save();
    return overlayView(o);
  };

  const overlayView = (o) => ({ ...o, link: server.link(o.id), lanLink: server.lanLink(o.id), connected: server.connectedCount(o.id) });

  const keyStatus = () => {
    const d = license.apiDefaults();
    const has = (k) => Boolean(vault.get(`key:${k}`));
    const out = {};
    for (const k of ['twitchClientId', 'youtubeClientId', 'spotifyClientId']) out[k] = vault.get(`key:${k}`) || '';
    for (const k of ['youtubeClientSecret', 'eulerKey', 'elevenKey', 'anthropicKey']) out[k] = has(k);
    out.provided = { twitchClientId: Boolean(d.twitchClientId), youtubeClientId: Boolean(d.youtubeClientId), spotifyClientId: Boolean(d.spotifyClientId) };
    return out;
  };

  const PACK_MAX = 60 * 1024 * 1024;

  const saveRankImage = (game, src, out, tierId) => {
    const hit = tierId ? { tier: tierId, division: 0 } : rankFromFile(game, path.basename(src));
    if (!hit || fs.statSync(src).size > 20 * 1024 * 1024) { out.missed.push(path.basename(src)); return; }
    const name = `${uid('r')}${path.extname(src).toLowerCase()}`;
    fs.copyFileSync(src, path.join(mediaDir, name));
    const store = s().gaming.rankImages[game.id] || (s().gaming.rankImages[game.id] = {});
    store[hit.division ? `${hit.tier}:${hit.division}` : hit.tier] = name;
    out.done += 1;
  };

  const listMedia = () => {
    try { return fs.readdirSync(mediaDir).filter((f) => !f.startsWith('.') && f !== 'tts'); } catch { return []; }
  };

  const refreshRole = () => {
    engine.refreshAllOverlays();
    push('snapshot', snapshot());
  };

  const api = {
    snapshot,
    copy(text) { clipboard.writeText(String(text)); return true; },
    openExternal(url) { if (/^https:\/\//.test(url)) shell.openExternal(url); return true; },
    finishOnboarding() { s().settings.onboarded = true; file.save(); return true; },

    // ---- Rôles
    activateLicense(key) {
      const r = license.check(key);
      if (!r.ok) throw new Error(r.reason);
      s().license.key = key.trim();
      file.save();
      refreshRole();
      return r;
    },
    removeLicense() { s().license.key = ''; file.save(); refreshRole(); return true; },
    async importAdminKey() {
      const r = await dialog.showOpenDialog(win(), { title: 'Ouvrir la clé admin', filters: [{ name: 'Clé admin', extensions: ['txt', 'key'] }], properties: ['openFile'] });
      if (r.canceled) return false;
      const raw = fs.readFileSync(r.filePaths[0], 'utf8');
      const seed = (raw.match(/[A-Za-z0-9+/]{43}=/) || [])[0];
      if (!seed || !license.setAdminKey(seed)) throw new Error('Cette clé admin ne correspond pas à cette version de Régie.');
      refreshRole();
      return true;
    },
    removeAdminKey() { needAdmin(); license.setAdminKey(null); s().license.viewAs = ''; file.save(); refreshRole(); return true; },
    setViewAs(role) {
      if (license.realRole() !== 'admin') throw new Error('Réservé à l\'admin.');
      s().license.viewAs = role === 'admin' ? '' : role;
      file.save();
      refreshRole();
      return true;
    },

    // ---- Admin
    createKey({ days, name, machine, tier }) {
      needAdmin();
      const { key, payload } = license.issue({ days: Number(days) || 0, name, machine, tier });
      s().issuedKeys.unshift({ id: payload.i, name: payload.n, tier: tier === 'ultimate' ? 'ULTIMATE' : 'PRO', created: payload.c, expires: payload.e, machine: payload.h, key, revoked: false });
      file.save();
      return { key, issued: s().issuedKeys };
    },
    revokeKey(id, revoked = true) {
      needAdmin();
      const k = find(s().issuedKeys, id, 'Clé');
      k.revoked = revoked;
      const set = new Set(s().adminDraft.revoked);
      if (revoked) set.add(id); else set.delete(id);
      s().adminDraft.revoked = [...set];
      file.save();
      return s().issuedKeys;
    },
    saveAdminDraft(patch) {
      needAdmin();
      Object.assign(s().adminDraft, patch);
      file.save();
      refreshRole();
      return s().adminDraft;
    },
    async publishConfig() {
      needAdmin();
      const signed = license.publish();
      const r = await dialog.showSaveDialog(win(), { title: 'Enregistrer la configuration signée', defaultPath: 'regie-config.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (r.canceled) return { saved: false };
      fs.writeFileSync(r.filePath, JSON.stringify(signed));
      refreshRole();
      return { saved: true, path: r.filePath, rev: s().adminDraft.rev };
    },
    async refreshRemote() { const out = await license.fetchRemote(); refreshRole(); return out; },
    setRemoteUrl(url) { s().remote.urlOverride = String(url || '').trim(); file.save(); return license.fetchRemote(); },

    // ---- Clés d'API
    setKey(name, value) {
      const allowed = ['twitchClientId', 'youtubeClientId', 'youtubeClientSecret', 'spotifyClientId', 'eulerKey', 'elevenKey', 'anthropicKey'];
      if (!allowed.includes(name)) throw new Error('Clé inconnue');
      vault.set(`key:${name}`, String(value || '').trim());
      return keyStatus();
    },

    // ---- Chaînes
    addAccount(cfg) {
      const { platform } = cfg;
      if (!['tiktok', 'twitch', 'youtube', 'kick'].includes(platform)) throw new Error('Plateforme inconnue');
      const used = s().accounts.filter((a) => a.platform === platform).length;
      if (!withinLimit(engine.features().channelsPerPlatform, used)) throw new Error('La version FREE gère une chaîne par plateforme. Passe en PRO pour en ajouter.');
      const a = { id: uid('a'), platform, enabled: true, label: cfg.label || 'Nouvelle chaîne', muted: false };
      if (platform === 'tiktok') {
        a.username = String(cfg.username || '').replace(/^@/, '').trim();
        if (!a.username) throw new Error('Entre ton pseudo TikTok.');
        a.label = `@${a.username}`;
      }
      if (platform === 'twitch') {
        a.mode = 'pseudo';
        a.username = String(cfg.username || '').replace(/^@/, '').trim().toLowerCase();
        if (!/^[a-z0-9_]{2,30}$/.test(a.username)) throw new Error('Entre ton pseudo Twitch.');
        a.label = a.username;
      }
      if (platform === 'kick') {
        a.username = String(cfg.username || '').trim().toLowerCase();
        a.chatroomId = String(cfg.chatroomId || '').trim();
        if (!a.username) throw new Error('Entre ton pseudo Kick.');
        a.label = a.username;
      }
      if (platform === 'youtube') {
        a.mode = cfg.mode || 'simple';
        a.channel = String(cfg.channel || '').trim();
        a.pollSeconds = 12;
        if (a.mode === 'simple' && !a.channel) throw new Error('Entre ton @pseudo ou ton ID de chaîne YouTube.');
        a.label = a.channel || 'YouTube';
      }
      s().accounts.push(a);
      file.save();
      engine.startAccount(a);
      return engine.channels();
    },
    removeAccount(id) {
      engine.stopAccount(id);
      s().accounts = s().accounts.filter((a) => a.id !== id);
      vault.set(`twitch:${id}`, null); vault.set(`youtube:${id}`, null); vault.set(`tiktok:${id}`, null);
      file.save();
      delete engine.status[id];
      engine.pushChannels();
      return engine.channels();
    },
    toggleAccount(id) {
      const a = find(s().accounts, id, 'Chaîne');
      a.enabled = !(a.enabled !== false);
      file.save();
      if (a.enabled) engine.startAccount(a); else engine.stopAccount(a.id);
      return engine.channels();
    },
    muteAccount(id) { const a = find(s().accounts, id, 'Chaîne'); a.muted = !a.muted; file.save(); engine.pushChannels(); return engine.channels(); },
    reconnectAccount(id) { engine.startAccount(find(s().accounts, id, 'Chaîne')); return true; },
    setTikTokSession(id, sessionId, ttTargetIdc) {
      find(s().accounts, id, 'Chaîne');
      vault.set(`tiktok:${id}`, sessionId ? { sessionId: sessionId.trim(), ttTargetIdc: ttTargetIdc.trim() } : null);
      return true;
    },
    async twitchDeviceStart() {
      const used = s().accounts.filter((a) => a.platform === 'twitch').length;
      if (!withinLimit(engine.features().channelsPerPlatform, used)) throw new Error('La version FREE gère une chaîne par plateforme. Passe en PRO pour en ajouter.');
      const { twitch: clientId } = engine.clientIds();
      if (!clientId) throw new Error('Ajoute le Client ID Twitch dans Réglages.');
      const d = await twitch.deviceStart(clientId);
      return { deviceCode: d.device_code, userCode: d.user_code, url: d.verification_uri, interval: d.interval || 5, expiresIn: d.expires_in };
    },
    async twitchDevicePoll(deviceCode) {
      const { twitch: clientId } = engine.clientIds();
      const r = await twitch.devicePoll(clientId, deviceCode);
      if (!r.done) return r;
      const a = { id: uid('a'), platform: 'twitch', enabled: true, label: 'Twitch', muted: false };
      vault.set(`twitch:${a.id}`, r.tokens);
      s().accounts.push(a);
      file.save();
      engine.startAccount(a);
      return { done: true, channels: engine.channels() };
    },
    async youtubeLogin() {
      const used = s().accounts.filter((a) => a.platform === 'youtube').length;
      if (!withinLimit(engine.features().channelsPerPlatform, used)) throw new Error('La version FREE gère une chaîne par plateforme. Passe en PRO pour en ajouter.');
      const { ytId, ytSecret } = engine.clientIds();
      if (!ytId || !ytSecret) throw new Error('Ajoute le Client ID et le secret Google dans Réglages.');
      const tokens = await oauthFlow({ clientId: ytId, clientSecret: ytSecret, openExternal: (u) => shell.openExternal(u) });
      const a = { id: uid('a'), platform: 'youtube', enabled: true, label: 'YouTube', mode: 'api', pollSeconds: 12, muted: false };
      vault.set(`youtube:${a.id}`, tokens);
      s().accounts.push(a);
      file.save();
      engine.startAccount(a);
      return engine.channels();
    },

    async sendChat(text, target) {
      const list = target === 'all' ? [...engine.connectors.values()] : [engine.connectors.get(target)].filter(Boolean);
      if (target === 'all') need('replyAllChannels', 'Écrire sur toutes les chaînes est réservé à PRO.');
      if (!list.length) throw new Error('Choisis une chaîne pour envoyer ce message.');
      const usable = list.filter((c) => c.canSend?.());
      if (!usable.length) throw new Error('Cette chaîne ne peut pas écrire dans le chat.');
      await Promise.all(usable.map((c) => c.send(text)));
      return true;
    },

    // ---- Overlays
    addOverlay(type, name) { const o = engine.addOverlay(type, name); return overlayView(o); },
    setOverlayEnabled(id, on) {
      const o = find(s().overlays, id, 'Overlay');
      o.enabled = Boolean(on);
      file.save();
      engine.pushOverlayConfig(o);
      return overlayView(o);
    },
    // Fait vivre un overlay à la demande, depuis sa carte.
    testOverlay(type) {
      const sim = { alerts: ['follow', 'twitch'], chat: ['chat', 'twitch'], giftfeed: ['gift', 'tiktok'], gifttracker: ['gift', 'tiktok'], topgift: ['gift', 'tiktok'], topstreak: ['gift', 'tiktok'], leaderboard: ['gift', 'tiktok'], rankcard: ['follow', 'twitch'], ticker: ['follow', 'twitch'], webcam: ['gift', 'tiktok'], custom: ['follow', 'twitch'] }[type];
      if (sim) engine.simulate(sim[0], sim[1]);
      if (type === 'stage') server.broadcast({ t: 'show', item: { kind: 'text', text: 'Ceci est un essai', file: '', seconds: 4 } }, 'stage');
      if (type === 'gamecard') engine.pushGame();
      if (type === 'transition') server.broadcast({ t: 'transition', style: s().scenes.transitionStyle, ms: s().scenes.transitionMs }, 'transition');
      return true;
    },
    removeOverlay(id) { s().overlays = s().overlays.filter((o) => o.id !== id); file.save(); return s().overlays.map(overlayView); },
    duplicateOverlay(id) {
      const src = find(s().overlays, id, 'Overlay');
      const o = engine.addOverlay(src.type, `${src.name} (copie)`);
      o.settings = JSON.parse(JSON.stringify(src.settings));
      file.save();
      return overlayView(o);
    },
    async importPadPack(kind) {
      need('gamepadSkin', 'La bibliothèque de manettes est réservée à PRO.');
      const folder = kind === 'png';
      const r = await dialog.showOpenDialog(win(), folder ? { properties: ['openDirectory'] } : { filters: [{ name: 'SVG', extensions: ['svg'] }], properties: ['openFile'] });
      if (r.canceled) return null;
      const src = r.filePaths[0];
      let text;
      if (folder) {
        const files = fs.readdirSync(src).filter((f) => /\.png$/i.test(f)).sort();
        if (!files.length) throw new Error('Ce dossier ne contient aucun PNG.');
        text = layersToSvg(files.map((name) => ({ name, data: fs.readFileSync(path.join(src, name)) })));
      } else {
        if (fs.statSync(src).size > PACK_MAX) throw new Error('Ce fichier dépasse 60 Mo.');
        text = fs.readFileSync(src, 'utf8');
      }
      if (Buffer.byteLength(text) > PACK_MAX) throw new Error('Ce modèle dépasse 60 Mo.');
      const names = readNames(text);
      if (!names.length) throw new Error('Aucun calque nommé dans ce fichier. Nomme chaque pièce dans ton logiciel de dessin.');
      const saved = `${uid('p')}.svg`;
      fs.writeFileSync(path.join(mediaDir, saved), text);
      const pack = { id: uid('p'), name: path.basename(src, path.extname(src)).slice(0, 60), file: saved, names, map: autoMap(names), rights: { status: 'unverified', source: '', note: '' } };
      s().padPacks = [...(s().padPacks || []), pack];
      file.save();
      return pack;
    },
    updatePadPack(id, patch) {
      const pack = find(s().padPacks || [], id, 'Modèle');
      if (typeof patch.name === 'string') pack.name = patch.name.trim().slice(0, 60) || pack.name;
      if (patch.map) pack.map = Object.fromEntries(Object.entries(patch.map).filter(([k, v]) => v && pack.names.includes(v) && PACK_PARTS.some((p) => p.key === k)));
      if (patch.rights) {
        const status = RIGHTS.some((x) => x.value === patch.rights.status) ? patch.rights.status : pack.rights.status;
        pack.rights = { status, source: String(patch.rights.source ?? pack.rights.source).slice(0, 300), note: String(patch.rights.note ?? pack.rights.note).slice(0, 500) };
      }
      file.save();
      engine.refreshAllOverlays();
      return pack;
    },
    removePadPack(id) {
      const pack = find(s().padPacks || [], id, 'Modèle');
      s().padPacks = s().padPacks.filter((p) => p.id !== id);
      for (const o of s().overlays) if (o.settings.pack === id) o.settings.pack = '';
      fs.rmSync(path.join(mediaDir, pack.file), { force: true });
      file.save();
      engine.refreshAllOverlays();
      return s().padPacks;
    },
    renameOverlay(id, name) { find(s().overlays, id, 'Overlay').name = name; file.save(); return true; },
    applyColorway(id, name) {
      const o = find(s().overlays, id, 'Overlay');
      o.settings.finish = finishFrom(name);
      o.settings.colorway = name;
      file.save();
      engine.pushOverlayConfig(o);
      return { settings: o.settings };
    },
    updateOverlay(id, patch) {
      const o = find(s().overlays, id, 'Overlay');
      Object.assign(o.settings, patch);
      file.save();
      engine.pushOverlayConfig(o);
      return { settings: o.settings, effective: engine.effectiveSettings(o) };
    },
    resetOverlayToken() {
      const token = uid('') + uid('');
      s().settings.overlayToken = token;
      server.token = token;
      file.save();
      return s().overlays.map(overlayView);
    },
    setLan(lan) { s().settings.lan = Boolean(lan); file.save(); return { restart: true }; },
    setInputPaused(p) { s().settings.inputPaused = Boolean(p); input.setPaused(Boolean(p)); file.save(); return true; },

    // ---- Overlays personnalisés
    addCustomOverlay(name, elements, format) { return newCustom(name || 'Mon overlay', elements || [], format); },
    saveVersion(id, name) {
      need('overlayVersions', 'Les versions sont réservées à PRO.');
      const o = find(s().overlays, id, 'Overlay');
      o.settings.versions = [{ id: uid('v'), name: name || `Version ${(o.settings.versions || []).length + 1}`, at: Date.now(), elements: JSON.parse(JSON.stringify(o.settings.elements)) }, ...(o.settings.versions || [])].slice(0, 20);
      file.save();
      return overlayView(o);
    },
    restoreVersion(id, versionId) {
      const o = find(s().overlays, id, 'Overlay');
      const v = find(o.settings.versions || [], versionId, 'Version');
      o.settings.elements = JSON.parse(JSON.stringify(v.elements));
      file.save();
      engine.pushOverlayConfig(o);
      return overlayView(o);
    },
    adaptCustom(id) {
      const o = find(s().overlays, id, 'Overlay');
      const to = o.settings.format === '9:16' ? '16:9' : '9:16';
      return newCustom(`${o.name} (${to})`, adaptElements(o.settings.elements, to), to);
    },
    saveCustom(id, elements, confetti) {
      const o = find(s().overlays, id, 'Overlay');
      o.settings.elements = elements;
      if (confetti !== undefined) o.settings.confetti = confetti;
      file.save();
      engine.pushOverlayConfig(o);
      return true;
    },
    installTemplate(id) {
      const t = allTemplates().find((x) => x.id === id);
      if (!t) throw new Error('Modèle introuvable.');
      if (t.premium) need('premiumTemplates', 'Ce modèle est réservé à PRO.');
      return newCustom(t.name, t.elements, t.format);
    },
    async exportOverlay(id) {
      const o = find(s().overlays, id, 'Overlay');
      const r = await dialog.showSaveDialog(win(), { defaultPath: `${o.name.replace(/[^\w-]+/g, '-')}.regie.json`, filters: [{ name: 'Overlay Régie', extensions: ['json'] }] });
      if (r.canceled) return false;
      fs.writeFileSync(r.filePath, JSON.stringify({ format: 'regie-overlay-1', name: o.name, type: o.type, settings: o.settings }, null, 1));
      return true;
    },
    async importOverlay() {
      const r = await dialog.showOpenDialog(win(), { filters: [{ name: 'Overlay Régie', extensions: ['json'] }], properties: ['openFile'] });
      if (r.canceled) return null;
      let d;
      try { d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch { throw new Error('Ce fichier n\'est pas un overlay Régie.'); }
      if (d.format !== 'regie-overlay-1') throw new Error('Ce fichier n\'est pas un overlay Régie.');
      if (d.type === 'custom') return newCustom(d.name, sanitize({ name: d.name, elements: d.settings.elements.filter((e) => e.kind !== 'image') }).elements);
      if (!OVERLAY_TYPES[d.type]) throw new Error('Type d\'overlay inconnu.');
      const o = engine.addOverlay(d.type, d.name);
      o.settings = { ...o.settings, ...d.settings, customCss: '' };
      file.save();
      return overlayView(o);
    },
    publishTemplate(id, premium) {
      needAdmin();
      const o = find(s().overlays, id, 'Overlay');
      const list = s().adminDraft.templates || [];
      s().adminDraft.templates = [...list.filter((t) => t.id !== `c-${o.id}`), { id: `c-${o.id}`, name: o.name, blurb: 'Publié par Régie.', premium: Boolean(premium), elements: o.settings.elements }];
      file.save();
      return s().adminDraft.templates;
    },
    async aiGenerate(prompt, format = '16:9') {
      need('aiOverlays', 'La création par IA est réservée à PRO.');
      const out = await generateOverlay({ key: vault.get('key:anthropicKey'), prompt, format });
      return newCustom(out.name, out.elements, format);
    },
    async aiAssist(kind, prompt) {
      need('aiAssistant', 'L\'assistant est réservé à ULTIMATE.');
      const context = { jeu: engine.gameView().name, lives: stats.lives(10).map((l) => ({ duree_min: Math.round((l.end - l.start) / 60000), pic: l.peak, follows: l.follows, messages: l.messages, pieces: l.coins })), commandes: s().commands.map((c) => c.trigger), overlays: s().overlays.filter((o) => o.enabled !== false).length, automatisations: s().triggers.length };
      return assistant({ key: vault.get('key:anthropicKey'), kind, prompt, context });
    },
    applyTheme(id) { engine.applyTheme(id); return s().overlays.map(overlayView); },

    // ---- Spectateurs, rangs, récompenses
    resetSession() { viewers.reset(); engine.pushLive(); return true; },
    updateRanks(patch) { Object.assign(s().ranks, patch); file.save(); return s().ranks; },
    testRank() { engine.simulate('follow', 'twitch'); return true; },
    updateRewards(patch) { Object.assign(s().rewards, patch); file.save(); return s().rewards; },
    saveReward(r) {
      const list = s().rewards.list;
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = { ...list[i], ...r }; else list.push({ enabled: true, actions: [], ...r, id: uid('w') });
      file.save();
      return s().rewards;
    },
    removeReward(id) { s().rewards.list = s().rewards.list.filter((r) => r.id !== id); file.save(); return s().rewards; },

    // ---- Chat Battle et Boss Battle
    arena(action, cfg) {
      const g = engine.games;
      if (action === 'config') { Object.assign(s().arena, cfg); file.save(); g.pushArena(); }
      if (action === 'open') g.arenaOpen(cfg);
      if (action === 'start') g.arenaStart();
      if (action === 'bots') g.arenaBots(cfg?.n || 4);
      if (action === 'reset') g.arenaReset();
      return s().arena;
    },
    boss(action, cfg) {
      const g = engine.games;
      if (action === 'config') { Object.assign(s().boss, cfg); file.save(); g.pushBoss(); }
      if (action === 'start') g.bossStart(cfg);
      if (action === 'stop') g.bossEnd(false);
      if (action === 'reset') g.bossReset();
      if (action === 'hit') g.hitBoss({ id: uid('e'), platform: 'twitch', user: { id: 'test', display: 'Test' } }, cfg?.amount || 100, 'hit');
      return s().boss;
    },

    // ---- Gaming
    gameViewOf(id) { return engine.gameView(id); },
    setActiveGame(id) {
      const used = Object.entries(s().gaming.profiles).filter(([, p]) => p.used).map(([k]) => k);
      if (!used.includes(id) && !withinLimit(engine.features().gameProfiles, used.length)) throw new Error(`La version FREE garde ${engine.features().gameProfiles} jeux. Passe en PRO pour en ajouter.`);
      engine.profile(id).used = true;
      engine.setActiveGame(id);
      push('gameView', engine.gameView());
      return s().gaming;
    },
    updateGaming(patch) { Object.assign(s().gaming, patch); file.save(); return s().gaming; },
    updateProfile(id, patch) { Object.assign(engine.profile(id), patch); engine.pushGame(); push('gameView', engine.gameView()); return s().gaming; },
    setRank(game, mode, patch) { engine.setRank(game, mode, patch); push('gameView', engine.gameView()); return s().gaming; },
    // Images du streamer pour ses rangs. Le nom du fichier indique le rang : diamant.png, grand-champion.webp.
    async importRankImages(gameId, tierId) {
      const r = await dialog.showOpenDialog(win(), { filters: [{ name: 'Images', extensions: MEDIA_EXT.image }], properties: tierId ? ['openFile'] : ['openFile', 'multiSelections'] });
      if (r.canceled) return null;
      const game = GAMES.find((g) => g.id === gameId);
      const out = { done: 0, missed: [] };
      for (const src of r.filePaths) saveRankImage(game, src, out, tierId);
      file.save();
      engine.pushGame();
      return { gaming: s().gaming, ...out };
    },
    async importRankFolder(gameId) {
      const r = await dialog.showOpenDialog(win(), { properties: ['openDirectory'] });
      if (r.canceled) return null;
      const current = GAMES.find((g) => g.id === gameId);
      const out = { done: 0, missed: [] };
      const walk = (dir, game, depth) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { if (depth < 3) walk(full, gameFromFolder(GAMES, entry.name) || game, depth + 1); continue; }
          if (MEDIA_EXT.image.includes(path.extname(entry.name).slice(1).toLowerCase())) saveRankImage(game, full, out);
        }
      };
      walk(r.filePaths[0], gameFromFolder(GAMES, path.basename(r.filePaths[0])) || current, 0);
      file.save();
      engine.pushGame();
      return { gaming: s().gaming, ...out };
    },
    removeRankImage(gameId, tierId) {
      const images = s().gaming.rankImages[gameId] || {};
      for (const key of Object.keys(images)) if (key === tierId || key.startsWith(`${tierId}:`)) delete images[key];
      file.save();
      engine.pushGame();
      return s().gaming;
    },
    gameManual(kind) { engine.gameEvent(kind, {}); push('gameView', engine.gameView()); return true; },
    resetGameSession(id) { engine.profile(id).session = {}; engine.pushGame(); push('gameView', engine.gameView()); return true; },
    installGameLink(kind) {
      need('gameLive', 'Les données en direct sont réservées à PRO.');
      return kind === 'rl' ? installRl() : installCs2(server.port, s().gaming.gsiToken);
    },
    showFolder(p2) { shell.openPath(p2); return true; },
    gameLinkStatus() {
      const rl = findRocketLeague();
      const cs = findCs2();
      return { rl: Boolean(rl) && fs.existsSync(path.join(rl, 'TAGame', 'Config', 'TAStatsAPI.ini')), rlFound: Boolean(rl), cs2: Boolean(cs) && fs.existsSync(path.join(cs, 'gamestate_integration_regie.cfg')), cs2Found: Boolean(cs) };
    },
    async testRcon() {
      need('rcon', 'Les actions Minecraft sont réservées à PRO.');
      return rconSend(s().gaming.rcon, 'list');
    },

    // ---- Mini-jeux
    startGuess(cfg) { need('miniGames', 'Les mini-jeux sont réservés à PRO.'); engine.minigames.startGuess(cfg); return true; },
    startQuiz(cfg) { need('miniGames', 'Les mini-jeux sont réservés à PRO.'); engine.minigames.startQuiz(cfg); return true; },
    spinRoulette() { need('miniGames', 'Les mini-jeux sont réservés à PRO.'); engine.minigames.spin(null); return true; },
    resetMiniGame() { engine.minigames.reset(); return true; },
    updateMiniGames(patch) { Object.assign(s().minigames, patch); file.save(); return s().minigames; },

    // ---- Sons
    setSoundField(id, patch) { Object.assign(find(s().sounds.library, id, 'Son'), patch); file.save(); return s().sounds; },
    setSoundCfg(patch) { Object.assign(s().sounds, patch); file.save(); return s().sounds; },
    async addSound() {
      need('customMedia', 'L\'import de sons est réservé à PRO.');
      const r = await dialog.showOpenDialog(win(), { filters: [{ name: 'Sons', extensions: MEDIA_EXT.sound }], properties: ['openFile', 'multiSelections'] });
      if (r.canceled) return null;
      for (const src of r.filePaths) {
        if (fs.statSync(src).size > 30 * 1024 * 1024) throw new Error('Ce fichier dépasse 30 Mo.');
        const name = `${uid('m')}${path.extname(src).toLowerCase()}`;
        fs.copyFileSync(src, path.join(mediaDir, name));
        s().sounds.library.push({ id: uid('s'), name: path.basename(src, path.extname(src)).slice(0, 40), file: name });
      }
      file.save();
      return s().sounds;
    },
    renameSound(id, name) { find(s().sounds.library, id, 'Son').name = name; file.save(); return s().sounds; },
    removeSound(id) {
      const snd = find(s().sounds.library, id, 'Son');
      try { fs.unlinkSync(path.join(mediaDir, snd.file)); } catch { /* déjà absent */ }
      s().sounds.library = s().sounds.library.filter((x) => x.id !== id);
      file.save();
      return s().sounds;
    },
    playSound(sound, volume) { engine.playSound(sound, volume); return true; },
    setSoundOutput(output) { s().sounds.output = output === 'overlay' ? 'overlay' : 'app'; file.save(); return s().sounds; },

    // ---- Touches simulées
    setKeysEnabled(enabled) { s().keys.enabled = Boolean(enabled); file.save(); return s().keys; },
    testKey(key) { if (!engine.pressKey(key, 60)) throw new Error('Active d\'abord les touches simulées.'); return true; },

    // ---- Stream Deck
    saveDeck(deck) {
      const total = deck.pages.reduce((n, p) => n + p.buttons.length, 0);
      if (!withinLimit(engine.features().deckButtons, total - 1)) throw new Error('Limite de boutons atteinte. Passe en PRO pour en ajouter.');
      s().deck = deck;
      file.save();
      return { deck, hotkeys: applyHotkeys() };
    },
    deckPress(id) { return engine.deckPress(id); },

    // ---- Clips
    async createClip() { const c = await engine.createClip('Régie'); return { clip: c, clips: s().clips }; },
    async saveReplay() { await obs.saveReplay(); await new Promise((r) => setTimeout(r, 1200)); const p = await obs.lastReplay().catch(() => ''); if (p) { s().clips.list.unshift({ id: uid('c'), path: p, by: 'Régie', at: Date.now(), source: 'obs' }); file.save(); } return s().clips; },
    startReplayBuffer() { return obs.startReplay(); },
    updateClips(patch) { Object.assign(s().clips, patch); file.save(); return s().clips; },
    removeClip(id) { s().clips.list = s().clips.list.filter((c) => c.id !== id); file.save(); return s().clips; },
    showClip(p) { shell.showItemInFolder(p); return true; },

    // ---- Médias
    async importMedia(kind) {
      need('customMedia', 'L\'import d\'images et de sons est réservé à PRO.');
      const r = await dialog.showOpenDialog(win(), { filters: [{ name: { sound: 'Sons', video: 'Vidéos', visual: 'Images et vidéos' }[kind] || 'Images', extensions: MEDIA_EXT[kind] }], properties: ['openFile'] });
      if (r.canceled) return null;
      const src = r.filePaths[0];
      const st = fs.statSync(src);
      if (st.size > 200 * 1024 * 1024) throw new Error('Ce fichier dépasse 200 Mo.');
      const name = `${uid('m')}${path.extname(src).toLowerCase()}`;
      fs.copyFileSync(src, path.join(mediaDir, name));
      return { name, media: listMedia() };
    },

    // ---- Alertes
    updateRule(id, patch) { Object.assign(find(s().alerts.rules, id, 'Alerte'), patch); file.save(); return s().alerts; },
    addRule(type, fromId) {
      need('alertRulesCustom', 'Les alertes supplémentaires sont réservées à PRO.');
      const base = s().alerts.rules.find((r) => r.id === fromId) || s().alerts.rules.find((r) => r.type === type);
      s().alerts.rules.push({ ...base, id: uid('r'), base: false, minAmount: (base.minAmount || 0) + 100 });
      file.save();
      return s().alerts;
    },
    removeRule(id) { s().alerts.rules = s().alerts.rules.filter((r) => r.id !== id || r.base); file.save(); return s().alerts; },
    setAlertsPaused(paused) { s().alerts.paused = Boolean(paused); file.save(); if (!paused) engine.pumpAlerts(); return s().alerts; },
    setAlertGap(gap) { s().alerts.gap = Number(gap) || 0; file.save(); return s().alerts; },
    skipAlert() { engine.skipAlert(); return true; },
    clearAlerts() { engine.clearAlerts(); return true; },
    simulate(type, platform, extra) { engine.simulate(type, platform, extra); return true; },

    // ---- Goals
    addGoal(cfg) {
      if (!withinLimit(engine.features().goals, s().goals.length)) throw new Error('La version FREE gère un goal. Passe en PRO pour en ajouter.');
      const g = { id: uid('g'), title: cfg.title || 'Objectif', metric: cfg.metric || 'follow', platforms: cfg.platforms || [], current: Number(cfg.current) || 0, target: Number(cfg.target) || 100, autoStep: Number(cfg.autoStep) || 0, reached: false };
      s().goals.push(g);
      let o = null;
      try {
        o = engine.addOverlay('goal', g.title);
        o.settings.goalId = g.id;
      } catch { /* la limite d'overlays n'empêche pas de créer le goal */ }
      file.save();
      engine.pushGoals();
      return { goals: s().goals, overlay: o ? overlayView(o) : null };
    },
    updateGoal(id, patch) {
      const g = find(s().goals, id, 'Goal');
      Object.assign(g, patch);
      if (g.current < g.target) g.reached = false;
      engine.pushGoals();
      return s().goals;
    },
    removeGoal(id) {
      s().goals = s().goals.filter((g) => g.id !== id);
      s().overlays = s().overlays.filter((o) => !(o.type === 'goal' && o.settings.goalId === id));
      engine.pushGoals();
      return { goals: s().goals, overlays: s().overlays.map(overlayView) };
    },

    // ---- Battles
    updateBattle(patch) {
      if (patch.mode && patch.mode !== 'chat') need('battleAllModes', 'Ce mode de battle est réservé à PRO.');
      Object.assign(s().battle, patch);
      engine.pushBattle();
      return s().battle;
    },
    startBattle(cfg) { engine.startBattle(cfg); return s().battle; },
    endBattle() { engine.endBattle(); return s().battle; },
    resetBattle() { engine.resetBattle(); return s().battle; },
    addBattlePoints(teamId, points) {
      const t = find(s().battle.teams, teamId, 'Équipe');
      t.score = Math.max(0, t.score + Number(points));
      engine.pushBattle();
      return s().battle;
    },

    // ---- Commandes et déclencheurs
    saveCommand(cmd) {
      const list = s().commands;
      const i = list.findIndex((c) => c.id === cmd.id);
      if (!cmd.trigger?.trim()) throw new Error('Entre le mot qui déclenche la commande.');
      cmd.trigger = cmd.trigger.trim().split(/\s+/)[0];
      if (cmd.replyTo === 'all') need('replyAllChannels', 'Répondre sur toutes les chaînes est réservé à PRO.');
      if (i >= 0) list[i] = { ...list[i], ...cmd };
      else {
        if (!withinLimit(engine.features().commands, list.length)) throw new Error('Limite de commandes atteinte. Passe en PRO pour en ajouter.');
        list.push({ enabled: true, perm: 'all', cooldown: 30, userCooldown: 60, platforms: ALL, replyTo: 'origin', perPlatform: {}, actions: [], uses: 0, ...cmd, id: uid('k') });
      }
      file.save();
      return list;
    },
    removeCommand(id) { s().commands = s().commands.filter((c) => c.id !== id); file.save(); return s().commands; },
    saveTrigger(t) {
      const list = s().triggers;
      if (t.on?.giftId) need('giftTriggers', 'Les déclencheurs par cadeau sont réservés à PRO.');
      if (t.actions?.some((a) => a.type === 'webhook') || t.on?.type === 'webhook') need('webhooks', 'Les webhooks sont réservés à PRO.');
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) list[i] = { ...list[i], ...t };
      else {
        if (!withinLimit(engine.features().triggers, list.length)) throw new Error('Limite de déclencheurs atteinte. Passe en PRO pour en ajouter.');
        list.push({ enabled: true, cooldown: 0, actions: [], ...t, id: uid('d') });
      }
      file.save();
      return list;
    },
    removeTrigger(id) { s().triggers = s().triggers.filter((t) => t.id !== id); file.save(); return s().triggers; },
    fireTrigger(id) { engine.fireTrigger(find(s().triggers, id, 'Déclencheur')); return true; },
    hookLink(id) { return server.hookLink(id); },

    // ---- TTS
    allowedVoices() { return tts.allowedVoices(); },
    updateTts(patch) {
      if (patch.provider === 'eleven') need('ttsPremiumVoices', 'Les voix ElevenLabs sont réservées à PRO.');
      if (patch.userVoices) need('ttsPerUserVoice');
      Object.assign(s().tts, patch);
      file.save();
      return s().tts;
    },
    ttsTest(text) {
      const was = s().tts.enabled;
      s().tts.enabled = true;
      tts.say({ text, user: { display: 'Test' }, force: true });
      s().tts.enabled = was;
      return true;
    },
    ttsSkip() { tts.skip(); return true; },
    ttsClear() { tts.clear(); return true; },
    async elevenVoices() {
      need('ttsPremiumVoices');
      const key = engine.clientIds().eleven;
      if (!key) throw new Error('Ajoute ta clé ElevenLabs dans Réglages.');
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      if (!r.ok) throw new Error(`ElevenLabs a répondu ${r.status}`);
      const d = await r.json();
      return (d.voices || []).map((v) => ({ id: v.voice_id, name: v.name }));
    },

    // ---- Spotify
    async spotifyLogin() { await spotify.login(); s().spotify.connected = true; file.save(); return true; },
    spotifyLogout() { spotify.logout(); s().spotify.connected = false; file.save(); return true; },
    spotifyControl(action) { return spotify.control(action); },
    updateSpotify(patch) {
      if (patch.requests?.enabled) need('songRequests', 'Les demandes de musique sont réservées à PRO.');
      s().spotify.requests = { ...s().spotify.requests, ...(patch.requests || {}) };
      if (patch.source) {
        s().spotify.source = patch.source === 'any' ? 'any' : 'spotify';
        spotify.start();
      }
      file.save();
      return s().spotify;
    },
    wishDone(id) {
      s().spotify.wishlist = (s().spotify.wishlist || []).filter((w) => w.id !== id);
      file.save();
      return s().spotify.wishlist;
    },

    // ---- Outils
    addCounter(name) { const c = { id: uid('c'), name: name || 'Compteur', value: 0, step: 1 }; s().tools.counters.push(c); file.save(); return s().tools; },
    setCounter(id, value) { engine.setCounter(find(s().tools.counters, id, 'Compteur'), Number(value) || 0); return s().tools; },
    updateCounter(id, patch) { Object.assign(find(s().tools.counters, id, 'Compteur'), patch); file.save(); return s().tools; },
    removeCounter(id) { s().tools.counters = s().tools.counters.filter((c) => c.id !== id); file.save(); return s().tools; },
    addTimer(name, mode) {
      const t = { id: uid('t'), name: name || 'Minuteur', mode: mode || 'countdown', seconds: 600, running: false, endsAt: 0, remaining: mode === 'stopwatch' ? 0 : 600, subathon: { enabled: false, follow: 30, sub: 300, coins: 1, bits: 1, money: 60 } };
      s().tools.timers.push(t);
      engine.pushTimers();
      return s().tools;
    },
    updateTimer(id, patch) {
      if (patch.subathon?.enabled) need('subathon', 'Le minuteur Giftathon est réservé à PRO.');
      const t = find(s().tools.timers, id, 'Minuteur');
      if (patch.subathon) patch.subathon = { ...t.subathon, ...patch.subathon };
      Object.assign(t, patch);
      engine.pushTimers();
      return s().tools;
    },
    removeTimer(id) { s().tools.timers = s().tools.timers.filter((t) => t.id !== id); engine.pushTimers(); return s().tools; },
    timerControl(id, action, seconds) { engine.controlTimer(id, action, Number(seconds)); return true; },
    timerAdd(id, seconds) { engine.addTime(find(s().tools.timers, id, 'Minuteur'), Number(seconds)); return true; },
    startPoll(cfg) { engine.startPoll(cfg); return engine.pollView(); },
    endPoll() { engine.endPoll(); return engine.pollView(); },
    giveaway(action, cfg) { engine.giveawayControl(action, cfg); return s().tools.giveaway; },

    // ---- OBS
    openDock() { openDock(); return true; },
    dockLink() { return server.dockLink(); },

    // OBS se connecte tout seul avec les réglages déjà présents sur ce PC.
    obsAuto() {
      const c = readObsConfig(path.join(process.env.APPDATA || '', 'obs-studio'));
      if (!c.found) throw new Error('OBS Studio n\'est pas trouvé sur ce PC. Lance-le une première fois, puis réessaie.');
      if (!c.enabled) return { connected: false, reason: 'disabled' };
      Object.assign(s().obs, { enabled: true, host: '127.0.0.1', port: c.port, password: c.password });
      file.save();
      obs.connect(s().obs);
      return { connected: true };
    },
    obsDisconnect() { s().obs.enabled = false; file.save(); obs.disconnect(); return true; },

    // Connexion TikTok sur le vrai site. Régie ne lit que le pseudo public, jamais le mot de passe ni la session.
    async tiktokLogin() {
      const username = await loginWindow(win());
      if (!username) return null;
      return api.addAccount({ platform: 'tiktok', username });
    },

    obsConnect(cfg) {
      if (cfg.password) s().obs.password = cfg.password;
      Object.assign(s().obs, { enabled: true, host: cfg.host || '127.0.0.1', port: Number(cfg.port) || 4455 });
      file.save();
      obs.connect(s().obs);
      return true;
    },
    obsDisconnect() { s().obs.enabled = false; file.save(); obs.disconnect(); return true; },
    obsScenes() { return obs.scenes(); },
    obsSetScene(name) { return engine.switchScene(name); },
    obsSources(scene) { return obs.sources(scene); },
    obsSetSource(scene, id, on) { return obs.setSource(scene, id, on); },
    obsThumb(name) { return obs.thumbnail(name); },
    obsTransitions() { return obs.transitions(); },
    obsSetTransition(name) { return obs.setTransition(name); },
    obsToggleStream() { return obs.toggleStream(); },
    obsToggleRecord() { return obs.toggleRecord(); },
    obsCreateScene(name) { return obs.createScene(name); },
    obsRemoveScene(name) { return obs.removeScene(name); },
    obsDuplicateScene(name) { return obs.duplicateScene(name, `${name} (copie)`); },
    obsToggleMic() { return obs.toggleMute(); },
    async obsAddOverlay(id) {
      const o = find(s().overlays, id, 'Overlay');
      const [width, height] = o.type === 'custom' && o.settings.format === '9:16' ? [1080, 1920] : OVERLAY_TYPES[o.type].size;
      return obs.addBrowserSource({ name: `Régie ${o.name}`, url: server.link(o.id), width, height });
    },
    updateScenes(patch) { if (patch.useTransition) need('customTransitions', 'Les transitions personnalisées sont réservées à PRO.'); Object.assign(s().scenes, patch); file.save(); return s().scenes; },

    // ---- Cadeaux
    async loadGifts() {
      const c = [...engine.connectors.values()].find((x) => x.fetchGifts);
      const account = s().accounts.find((a) => a.platform === 'tiktok');
      if (!c && !account) throw new Error('Connecte une chaîne TikTok pour charger le catalogue.');
      const list = await (c || engine.makeConnector(account)).fetchGifts();
      engine.gifts = list;
      s().giftCache = list;
      file.save();
      return list;
    },

    // ---- Stats
    statsReport() { return stats.report(engine.features().statsDays); },
    async statsExport() {
      need('statsExport', 'L\'export CSV est réservé à PRO.');
      const r = await dialog.showSaveDialog(win(), { defaultPath: 'regie-stats.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (r.canceled) return false;
      fs.writeFileSync(r.filePath, `﻿${stats.csv(engine.features().statsDays)}`);
      return r.filePath;
    },
    statsReset() { stats.reset(); return true; },
    statsLives() { return stats.lives(50); },
    async automationsExport() {
      const r = await dialog.showSaveDialog(win(), { defaultPath: 'regie-automatisations.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (r.canceled) return false;
      fs.writeFileSync(r.filePath, JSON.stringify({ format: 'regie-automations-1', list: s().triggers }, null, 1));
      return true;
    },
    async automationsImport() {
      const r = await dialog.showOpenDialog(win(), { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
      if (r.canceled) return null;
      let d;
      try { d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch { throw new Error('Ce fichier n\'est pas lisible.'); }
      if (d.format !== 'regie-automations-1') throw new Error('Ce fichier n\'est pas un export Régie.');
      for (const t of d.list || []) if (t?.on?.type) s().triggers.push({ enabled: true, cooldown: 0, actions: [], conditions: [], ...t, id: uid('d') });
      file.save();
      return s().triggers;
    },

    // ---- Réglages avancés
    updateSettings(patch) {
      const allowed = ['theme', 'accent', 'economy', 'devMode', 'profileName', 'navCollapsed', 'acrylic'];
      for (const k of allowed) if (patch[k] !== undefined) s().settings[k] = patch[k];
      file.save();
      const w = win();
      if (w && process.platform === 'win32') {
        if (patch.theme) w.setTitleBarOverlay?.({ color: '#00000000', symbolColor: patch.theme === 'light' ? '#171B22' : '#F2F5F9', height: 50 });
        if (patch.acrylic !== undefined) w.setBackgroundMaterial?.(patch.acrylic ? 'acrylic' : 'none');
      }
      return s().settings;
    },
    setModule(id, on) { s().settings.modules[id] = Boolean(on); file.save(); return s().settings; },
    logs() { return logs().slice(-300).reverse().map((l) => (typeof l === 'string' ? l : `${new Date(l.ts).toLocaleTimeString('fr-FR')}  ${l.text}`)); },
    async clearCache() {
      await eSession.defaultSession.clearCache();
      try { for (const f of fs.readdirSync(path.join(mediaDir, 'tts'))) fs.unlinkSync(path.join(mediaDir, 'tts', f)); } catch { /* rien à effacer */ }
      return true;
    },
    diagnostics() {
      const row = (name, ok, detail) => ({ name, ok, detail });
      const out = [row('Serveur d\'overlays', true, `Port ${server.port}`)];
      for (const c of engine.channels()) out.push(row(c.label, ['live', 'offline'].includes(c.status.state), c.status.detail || c.status.state));
      out.push(row('OBS', obs.state === 'connected' ? true : obs.detail ? false : null, obs.state === 'connected' ? 'Connecté' : obs.detail || 'Non connecté'));
      const music = spotify.local?.status;
      out.push(row('Musique', spotify.connected || music === 'media' || music === 'window' ? true : null, spotify.connected ? 'Compte Spotify relié' : music === 'media' ? 'Lue depuis Windows' : music === 'window' ? 'Lue depuis la fenêtre Spotify' : 'En attente de lecture'));
      out.push(row('Lecture des manettes', input.available.xinput === false ? false : input.pads().length > 0 ? true : null, input.pads().length ? input.pads().map((p) => p.name).join(', ') : 'Aucune manette détectée. Ouvre l\'overlay Manette puis appuie sur un bouton.'));
      out.push(row('Capture clavier et souris', input.available.hook !== false, input.available.hook !== false ? 'Disponible' : 'Indisponible'));
      out.push(row('Jeu détecté', hub.running ? true : null, hub.running || 'Aucun jeu du catalogue lancé'));
      return out;
    },
    async backup() {
      const r = await dialog.showSaveDialog(win(), { defaultPath: `regie-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Sauvegarde Régie', extensions: ['json'] }] });
      if (r.canceled) return false;
      const { issuedKeys, adminDraft, ...state } = s();
      fs.writeFileSync(r.filePath, JSON.stringify({ format: 'regie-backup-1', version: brand.version, state, stats: statsFile.data, viewers: viewersFile.data }));
      return true;
    },
    async restore() {
      const r = await dialog.showOpenDialog(win(), { filters: [{ name: 'Sauvegarde Régie', extensions: ['json'] }], properties: ['openFile'] });
      if (r.canceled) return false;
      let d;
      try { d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch { throw new Error('Cette sauvegarde n\'est pas lisible.'); }
      if (d.format !== 'regie-backup-1') throw new Error('Ce fichier n\'est pas une sauvegarde Régie.');
      Object.assign(file.data, d.state);
      statsFile.data = d.stats;
      viewersFile.data = d.viewers;
      file.flush(); statsFile.flush(); viewersFile.flush();
      app.relaunch();
      app.exit(0);
      return true;
    },
    resetAll() {
      for (const f of ['state.json', 'stats.json', 'viewers.json']) { try { fs.unlinkSync(path.join(app.getPath('userData'), f)); } catch { /* absent */ } }
      file.flush = () => {}; statsFile.flush = () => {}; viewersFile.flush = () => {};
      app.relaunch();
      app.exit(0);
      return true;
    },

    // ---- Mises à jour
    async checkUpdate() { if (updater) await updater.check(); return updater ? updater.status : { state: 'idle' }; },
    async downloadUpdate() { if (!updater) throw new Error('Les mises à jour ne sont pas disponibles.'); await updater.download(); return updater.status; },
    installUpdate() { if (!updater) throw new Error('Les mises à jour ne sont pas disponibles.'); updater.installAndRestart(); return true; },

    // ---- Écran de pause (BRB)
    toggleBrb() {
      const active = !engine.brb?.active;
      engine.brb = active ? { active: true, startedAt: Date.now(), elapsed: 0 } : { active: false, startedAt: 0, elapsed: engine.brb ? Math.floor((Date.now() - engine.brb.startedAt) / 1000) : 0 };
      server.broadcast({ t: 'brb', ...engine.brb }, 'brb');
      push('brb', engine.brb);
      return engine.brb;
    },
  };

  return { api, snapshot, overlayView, makeOverlay };
}

module.exports = { createApi };
