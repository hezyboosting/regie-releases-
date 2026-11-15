// Écrire dans le chat TikTok ou Kick avec ton propre compte, sans service payant.
// Tu te connectes une fois sur la vraie page du site, dans une fenêtre de Régie ; la session reste
// dans Régie, sur ce PC (partition « persist:webchat-<site> »), et n'est envoyée nulle part.
// Pour écrire, Régie ouvre la page de ton live dans une fenêtre cachée (vidéo bloquée, son coupé),
// clique dans la zone de commentaire et tape le message comme au clavier, puis Entrée.
const { BrowserWindow, session } = require('electron');

const SITES = {
  tiktok: {
    name: 'TikTok',
    home: 'https://www.tiktok.com',
    login: 'https://www.tiktok.com/login',
    logged: (cookies) => cookies.some((c) => c.name === 'sessionid' && c.value),
    page: (u) => `https://www.tiktok.com/@${u}/live`,
    // Ce que la page du live reçoit : la connexion temps réel du chat, et ses relevés de secours.
    socket: /webcast[\w.-]*\.tiktok\.com|\/webcast\/im\/(push|ws)/i,
    fetch: /\/webcast\/im\/fetch/i,
    input: ['[data-e2e="comment-input"] [contenteditable]', '[data-e2e*="comment"] [contenteditable]', 'div[contenteditable="plaintext-only"]', 'div[contenteditable="true"][placeholder]', 'div[contenteditable="true"]', 'textarea'],
    button: ['[data-e2e="comment-post"]', '[data-e2e*="send"]', 'button[aria-label*="Post" i]', 'button[aria-label*="Envoyer" i]'],
    media: /pull-[^/]*\.(tiktokcdn|tiktokcdn-[a-z]+|tiktokv)\.com|\.(flv|m3u8|m4s|ts)(\?|$)/i,
  },
  kick: {
    name: 'Kick',
    home: 'https://kick.com',
    login: 'https://kick.com/login',
    logged: (cookies) => cookies.some((c) => c.name === 'session_token' && c.value && c.value.length > 20),
    page: (u) => `https://kick.com/${u}`,
    input: ['[data-testid="chat-input"]', '#message-input', 'div[contenteditable="true"][data-placeholder]', 'div[contenteditable="true"]', 'textarea'],
    button: ['[data-testid="send-message-button"]', '#send-message-button', 'button[aria-label*="Send" i]', 'button[aria-label*="Envoyer" i]'],
    media: /live-video\.net|\.(m3u8|ts|m4s)(\?|$)/i,
  },
};

const IDLE_MS = 15 * 60 * 1000;
const GAP_MS = 1300;
const TICK_MS = 30 * 1000;
const NO_SOCKET_MS = 75 * 1000; // en live, la page ouvre sa connexion au chat en quelques secondes
const SILENT_MS = 10 * 60 * 1000; // connexion ouverte mais muette depuis 10 min : on la relance quand même
const AFTER_LIVE_MS = 4 * 60 * 1000;
const WORKERS = ['worker', 'shared_worker', 'service_worker'];
const clean = (u) => String(u || '').replace(/^@/, '').trim().toLowerCase();

class WebChat {
  constructor({ log = () => {}, parent = () => null } = {}) {
    this.log = log;
    this.parent = parent;
    this.logged = {};
    this.pages = new Map(); // `${site}:${user}` → { win, ready, idle, tapped }
    this.watchers = new Map(); // `${site}:${user}` → lecture du chat en cours
    this.queue = Promise.resolve();
    this.last = 0;
    this.prepared = new Set();
  }

  static sites() { return Object.keys(SITES); }

  ses(site) {
    const s = session.fromPartition(`persist:webchat-${site}`);
    if (!this.prepared.has(site)) {
      this.prepared.add(site);
      const ua = s.getUserAgent().replace(/ Electron\/\S+/, '').replace(/ (regie|Régie)\/\S+/i, '');
      s.setUserAgent(ua);
      // Pas de vidéo ni de son : seule la zone de chat nous intéresse.
      s.webRequest.onBeforeRequest((d, cb) => cb({ cancel: d.resourceType === 'media' || SITES[site].media.test(d.url) }));
    }
    return s;
  }

  async refresh(site) {
    try {
      const c = await this.ses(site).cookies.get({ url: SITES[site].home });
      this.logged[site] = SITES[site].logged(c);
    } catch { this.logged[site] = false; }
    return this.logged[site];
  }

  async refreshAll() {
    for (const s of Object.keys(SITES)) await this.refresh(s);
    this.pokeWatchers();
    return { ...this.logged };
  }

  status() { return Object.fromEntries(Object.keys(SITES).map((s) => [s, Boolean(this.logged[s])])); }

  // Fenêtre visible sur la vraie page de connexion. Se ferme toute seule une fois connecté.
  login(site) {
    const cfg = SITES[site];
    if (!cfg) throw new Error('Site inconnu.');
    const ses = this.ses(site);
    return new Promise((resolve) => {
      let done = false;
      const w = new BrowserWindow({ width: 500, height: 780, parent: this.parent() || undefined, title: `Connexion ${cfg.name}`, autoHideMenuBar: true, webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true } });
      w.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) w.loadURL(url); return { action: 'deny' }; });
      const finish = async () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        const ok = await this.refresh(site);
        if (!w.isDestroyed()) w.close();
        if (ok) this.pokeWatchers(site);
        resolve(ok);
      };
      const timer = setInterval(async () => {
        if (w.isDestroyed()) return;
        const c = await ses.cookies.get({ url: cfg.home }).catch(() => []);
        if (cfg.logged(c)) setTimeout(finish, 1500);
      }, 1200);
      w.on('closed', finish);
      w.loadURL(cfg.login);
    });
  }

  async logout(site) {
    for (const [k, p] of this.pages) if (k.startsWith(`${site}:`)) { if (!p.win.isDestroyed()) p.win.destroy(); this.pages.delete(k); }
    await this.ses(site).clearStorageData();
    this.logged[site] = false;
    this.pokeWatchers(site);
    return this.status();
  }

  // Ouvre (ou réutilise) la page du live, cachée, et attend la zone de commentaire.
  // Pour lire le chat, la page suffit : pas besoin d'attendre la zone de commentaire.
  async page(site, user, visible = false, { needInput = true } = {}) {
    const key = `${site}:${clean(user)}`;
    let p = this.pages.get(key);
    if (p && !p.win.isDestroyed()) {
      clearTimeout(p.idle);
      p.idle = setTimeout(() => this.closeIdle(key), IDLE_MS);
      if (visible) p.win.show();
      if (needInput && !p.input) {
        await p.ready;
        await this.waitInput(site, p.win, 25000);
        p.input = true;
      }
      return p;
    }
    const cfg = SITES[site];
    const win = new BrowserWindow({ show: visible, width: 1280, height: 860, title: `Chat ${cfg.name}`, autoHideMenuBar: true, webPreferences: { session: this.ses(site), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'document-user-activation-required' } });
    win.webContents.setAudioMuted(true);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('close', (e) => { if (!this.quitting) { e.preventDefault(); win.hide(); } });
    win.webContents.on('render-process-gone', () => this.close(key));
    p = { key, site, win, ready: null, input: false, tapped: false, loadedAt: Date.now(), idle: setTimeout(() => this.closeIdle(key), IDLE_MS) };
    this.pages.set(key, p);
    // La lecture du chat écoute la page dès son ouverture, pour ne rien rater.
    if (this.watchers.has(key)) this.tap(p);
    // TikTok redirige parfois pendant le chargement : la page est bien là, seule la promesse se plaint.
    p.ready = win.loadURL(cfg.page(clean(user))).catch((e) => { if (!/ERR_ABORTED|\(-3\)/.test(String(e?.message))) throw e; });
    try {
      await p.ready;
      if (needInput) { await this.waitInput(site, win, 25000); p.input = true; }
    } catch (e) { this.close(key); throw e; }
    return p;
  }

  close(key) {
    const p = this.pages.get(key);
    this.pages.delete(key);
    clearTimeout(p?.idle);
    if (p && !p.win.isDestroyed()) {
      try { if (p.win.webContents.debugger.isAttached()) p.win.webContents.debugger.detach(); } catch { /* déjà détaché */ }
      p.win.destroy();
    }
  }

  // Une page qui sert à lire le chat reste ouverte tant que le live dure.
  closeIdle(key) {
    const p = this.pages.get(key);
    if (!p) return;
    if (this.watchers.has(key)) { p.idle = setTimeout(() => this.closeIdle(key), IDLE_MS); return; }
    this.close(key);
  }

  closeAll() {
    this.quitting = true;
    for (const w of this.watchers.values()) clearInterval(w.timer);
    this.watchers.clear();
    for (const k of [...this.pages.keys()]) this.close(k);
  }

  // ---------- Lecture du chat avec ton compte ----------
  // TikTok n'envoie pas tous les messages à un lecteur anonyme : ceux de certains comptes (récents,
  // privés, jugés peu fiables) n'arrivent qu'aux spectateurs connectés. La page de ton live, ouverte
  // avec ton compte dans la fenêtre cachée, les reçoit. Régie lit ce que la page reçoit (sans rien y
  // modifier) et le confie au connecteur, qui écarte les doublons. Rien ne sort de ton PC.
  watch(site, user, { onData, isLive = () => true, onChange = () => {} } = {}) {
    if (!SITES[site]?.socket) throw new Error('Lecture indisponible pour ce site.');
    const key = `${site}:${clean(user)}`;
    this.unwatch(key);
    const w = { key, site, user: clean(user), onData, isLive, onChange, state: 'starting', frames: 0, last: 0, liveSeen: 0, busy: false, errors: 0 };
    this.watchers.set(key, w);
    w.timer = setInterval(() => this.watchTick(w), TICK_MS);
    setTimeout(() => this.watchTick(w), 50);
    return {
      stop: () => this.unwatch(key),
      poke: () => this.watchTick(w),
      info: () => ({ state: w.state, frames: w.frames, last: w.last }),
    };
  }

  unwatch(key) {
    const w = this.watchers.get(key);
    if (!w) return;
    w.stopped = true;
    clearInterval(w.timer);
    this.watchers.delete(key);
    const p = this.pages.get(key);
    // La page reste ouverte un moment si elle sert aussi à écrire ; sinon on libère la mémoire.
    if (p && !p.input) this.close(key);
    else if (p) this.untap(p);
  }

  pokeWatchers(site) { for (const w of this.watchers.values()) if (!site || w.site === site) this.watchTick(w); }

  setWatchState(w, state) {
    if (w.state === state) return;
    w.state = state;
    try { w.onChange(state); } catch { /* sans importance */ }
  }

  async watchTick(w) {
    if (w.stopped || w.busy) return;
    w.busy = true;
    try {
      if (this.logged[w.site] === undefined) await this.refresh(w.site);
      if (!this.logged[w.site]) { this.setWatchState(w, 'login'); return; }
      const now = Date.now();
      if (!w.isLive()) {
        // Live terminé : la page se ferme au bout de quelques minutes (elle se rouvrira au prochain live).
        if (w.liveSeen && now - w.liveSeen > AFTER_LIVE_MS) { const p = this.pages.get(w.key); if (p && !p.input) this.close(w.key); }
        this.setWatchState(w, 'waiting');
        return;
      }
      w.liveSeen = now;
      let p = this.pages.get(w.key);
      if (!p || p.win.isDestroyed()) {
        this.setWatchState(w, 'starting');
        p = await this.page(w.site, w.user, false, { needInput: false });
        if (w.stopped) return;
      } else if (!p.tapped) {
        // Page déjà ouverte pour écrire : on l'écoute et on la recharge pour capter sa connexion au chat.
        if (this.tap(p)) this.reload(p);
      }
      if (!p.tapped) { this.setWatchState(w, 'error'); return; }
      // Un live calme peut rester muet longtemps : tant que la connexion au chat est ouverte, on attend.
      const quiet = now - Math.max(w.last, p.loadedAt);
      const open = p.sockets?.size > 0;
      if ((!open && quiet > NO_SOCKET_MS) || quiet > SILENT_MS) {
        this.log(`[lecture ${w.site}:${w.user}] ${open ? 'connexion muette' : 'pas de connexion au chat'} depuis ${Math.round(quiet / 1000)} s, rechargement de la page`);
        this.reload(p);
        this.setWatchState(w, 'nodata');
        return;
      }
      this.setWatchState(w, open || (w.last && now - w.last < NO_SOCKET_MS) ? 'ok' : 'starting');
    } catch (e) {
      w.errors += 1;
      if (w.errors <= 3) this.log(`[lecture ${w.site}:${w.user}] ${e.message}`);
      this.setWatchState(w, 'error');
    } finally {
      w.busy = false;
    }
  }

  reload(p) {
    if (p.win.isDestroyed()) return;
    p.loadedAt = Date.now();
    p.input = false;
    p.sockets?.clear();
    p.win.webContents.reloadIgnoringCache();
  }

  // Écoute réseau de la page (protocole DevTools de Chromium) : on ne garde que ce qui vient du chat.
  tap(p) {
    if (p.tapped) return true;
    const wc = p.win.webContents;
    const dbg = wc.debugger;
    try { if (!dbg.isAttached()) dbg.attach('1.3'); } catch (e) { this.log(`[lecture ${p.key}] écoute impossible : ${e.message}`); return false; }
    const cfg = SITES[p.site];
    const sockets = new Set();
    const fetches = new Set();
    p.sockets = sockets;
    const id = (sid, rid) => `${sid || ''}/${rid}`;
    // Page principale : pas d'identifiant de session (Electron refuse une chaîne vide).
    const cmd = (method, params, sid) => (sid ? dbg.sendCommand(method, params, sid) : dbg.sendCommand(method, params));
    const enable = (sid) => cmd('Network.enable', {}, sid).catch(() => {});
    const deliver = (kind, buf) => {
      const w = this.watchers.get(p.key);
      if (!w || !buf?.length) return;
      w.frames += 1;
      w.last = Date.now();
      if (w.state !== 'ok') this.setWatchState(w, 'ok');
      try { w.onData(kind, buf); } catch (e) { this.log(`[lecture ${p.key}] ${e.message}`); }
    };
    p.onMessage = (_e, method, params = {}, sid) => {
      switch (method) {
        case 'Network.webSocketCreated':
          if (cfg.socket.test(params.url || '')) sockets.add(id(sid, params.requestId));
          break;
        case 'Network.webSocketFrameReceived':
          if (sockets.has(id(sid, params.requestId)) && params.response?.opcode === 2) deliver('ws', Buffer.from(params.response.payloadData || '', 'base64'));
          break;
        case 'Network.webSocketClosed':
          sockets.delete(id(sid, params.requestId));
          break;
        case 'Network.responseReceived':
          if (cfg.fetch.test(params.response?.url || '')) fetches.add(id(sid, params.requestId));
          break;
        case 'Network.loadingFinished':
          if (fetches.delete(id(sid, params.requestId))) {
            cmd('Network.getResponseBody', { requestId: params.requestId }, sid)
              .then((r) => { if (r?.base64Encoded) deliver('fetch', Buffer.from(r.body || '', 'base64')); })
              .catch(() => {});
          }
          break;
        case 'Target.attachedToTarget':
          if (WORKERS.includes(params.targetInfo?.type)) enable(params.sessionId);
          break;
        default:
      }
    };
    p.onDetach = () => { p.tapped = false; };
    dbg.on('message', p.onMessage);
    dbg.on('detach', p.onDetach);
    enable();
    cmd('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }).catch(() => {});
    p.tapped = true;
    return true;
  }

  untap(p) {
    if (!p.tapped || p.win.isDestroyed()) return;
    const dbg = p.win.webContents.debugger;
    dbg.removeListener('message', p.onMessage);
    dbg.removeListener('detach', p.onDetach);
    try { dbg.detach(); } catch { /* déjà détaché */ }
    p.tapped = false;
  }

  finder(site) {
    const cfg = SITES[site];
    return `(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 40 && r.height > 12 && st.visibility !== 'hidden' && st.display !== 'none'; };
      for (const sel of ${JSON.stringify(cfg.input)}) {
        const list = [...document.querySelectorAll(sel)].filter(vis);
        if (list.length) { const el = list[list.length - 1]; el.setAttribute('data-regie-input', '1'); return true; }
      }
      return false;
    })()`;
  }

  async waitInput(site, win, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (win.isDestroyed()) throw new Error('La fenêtre du chat a été fermée.');
      const found = await win.webContents.executeJavaScript(this.finder(site)).catch(() => false);
      if (found) return true;
      const url = win.webContents.getURL();
      if (/\/login|signup/i.test(url)) { this.logged[site] = false; throw new Error(`Reconnecte-toi à ${SITES[site].name} dans Régie (Connexions) pour écrire dans le chat.`); }
      await new Promise((r) => setTimeout(r, 700));
    }
    throw new Error(`Zone de commentaire ${SITES[site].name} introuvable : vérifie que ton live est lancé, puis réessaie.`);
  }

  // Les messages partent l'un après l'autre, avec un petit écart, comme si tu les tapais.
  send(site, user, text) {
    if (!SITES[site]) return Promise.reject(new Error('Site inconnu.'));
    if (!this.logged[site]) return Promise.reject(new Error(`Connecte-toi à ${SITES[site].name} dans Régie (Connexions › Écrire dans le chat).`));
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, site === 'tiktok' ? 150 : 500);
    if (!clean) return Promise.resolve(false);
    const job = this.queue.then(async () => {
      const wait = this.last + GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try { return await this.type(site, user, clean); } finally { this.last = Date.now(); }
    });
    this.queue = job.catch(() => {});
    return job;
  }

  async type(site, user, text) {
    const p = await this.page(site, String(user).replace(/^@/, ''));
    const wc = p.win.webContents;
    const focus = `(() => { const el = document.querySelector('[data-regie-input]') || null; if (!el || !el.isConnected) return false; el.scrollIntoView({ block: 'center' }); el.focus(); const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`;
    let ok = await wc.executeJavaScript(focus).catch(() => false);
    if (!ok) { await this.waitInput(site, p.win, 8000); ok = await wc.executeJavaScript(focus).catch(() => false); }
    if (!ok) throw new Error(`Zone de commentaire ${SITES[site].name} introuvable.`);
    wc.focus();
    await wc.insertText(text);
    await new Promise((r) => setTimeout(r, 120));
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
    wc.sendInputEvent({ type: 'char', keyCode: '\r' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    await new Promise((r) => setTimeout(r, 700));
    // Si le texte est toujours là, on essaie le bouton Envoyer de la page.
    const left = await wc.executeJavaScript(`(() => { const el = document.querySelector('[data-regie-input]'); return el ? (el.innerText || el.value || '').trim() : ''; })()`).catch(() => '');
    if (left) {
      const clicked = await wc.executeJavaScript(`(() => { for (const s of ${JSON.stringify(SITES[site].button)}) { const b = document.querySelector(s); if (b && !b.disabled) { b.click(); return true; } } return false; })()`).catch(() => false);
      if (!clicked) throw new Error(`${SITES[site].name} n'a pas accepté le message (commentaires coupés, ou message refusé).`);
    }
    return true;
  }

  // Affiche la fenêtre cachée, pour voir ce que voit Régie si un message ne part pas.
  async show(site, user) { const p = await this.page(site, String(user).replace(/^@/, ''), true, { needInput: false }); p.win.show(); return true; }
}

module.exports = { WebChat, SITES };
