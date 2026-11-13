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

class WebChat {
  constructor({ log = () => {}, parent = () => null } = {}) {
    this.log = log;
    this.parent = parent;
    this.logged = {};
    this.pages = new Map(); // `${site}:${user}` → { win, ready, idle }
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

  async refreshAll() { for (const s of Object.keys(SITES)) await this.refresh(s); return { ...this.logged }; }

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
    return this.status();
  }

  // Ouvre (ou réutilise) la page du live, cachée, et attend la zone de commentaire.
  async page(site, user, visible = false) {
    const key = `${site}:${user.toLowerCase()}`;
    let p = this.pages.get(key);
    if (p && !p.win.isDestroyed()) {
      clearTimeout(p.idle);
      p.idle = setTimeout(() => this.close(key), IDLE_MS);
      if (visible) p.win.show();
      return p;
    }
    const cfg = SITES[site];
    const win = new BrowserWindow({ show: visible, width: 1280, height: 860, title: `Chat ${cfg.name}`, autoHideMenuBar: true, webPreferences: { session: this.ses(site), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'document-user-activation-required' } });
    win.webContents.setAudioMuted(true);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('close', (e) => { if (!this.quitting) { e.preventDefault(); win.hide(); } });
    p = { win, ready: null, idle: setTimeout(() => this.close(key), IDLE_MS) };
    this.pages.set(key, p);
    p.ready = win.loadURL(cfg.page(user)).then(() => this.waitInput(site, win, 25000));
    try { await p.ready; } catch (e) { this.close(key); throw e; }
    return p;
  }

  close(key) {
    const p = this.pages.get(key);
    this.pages.delete(key);
    if (p && !p.win.isDestroyed()) p.win.destroy();
  }

  closeAll() { this.quitting = true; for (const k of [...this.pages.keys()]) this.close(k); }

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
  async show(site, user) { const p = await this.page(site, String(user).replace(/^@/, ''), true); p.win.show(); return true; }
}

module.exports = { WebChat, SITES };
