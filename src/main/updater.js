// Mises à jour automatiques via GitHub Releases (dépôt indiqué dans package.json > build.publish).
// L'installateur NSIS se met à jour tout seul : la nouvelle version se télécharge en fond et s'installe
// à la fermeture de Régie, ou tout de suite avec « Redémarrer ». La version Portable ne peut pas se mettre à jour.
const { app, Notification } = require('electron');

let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch { /* electron-updater absent : mode développement */ }

const portable = () => Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);

class Updater {
  constructor({ log, push, getSettings }) {
    this.log = log;
    this.push = push;
    this.getSettings = getSettings || (() => ({}));
    this.status = { state: 'idle', version: '', progress: 0, error: '', current: app.getVersion(), checkedAt: 0, notes: '', mode: 'auto' };
    this.ready = false;
  }

  get available() { return Boolean(autoUpdater) && app.isPackaged && !portable(); }

  start() {
    if (!this.available) {
      this.set({ mode: portable() ? 'portable' : 'dev' });
      this.log(`Mises à jour : ${portable() ? 'version Portable, pas de mise à jour automatique' : 'mode développement'}`);
      return;
    }
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = Boolean(this.getSettings().betaUpdates);
    autoUpdater.logger = { info: (m) => this.log(`Mises à jour : ${m}`), warn: (m) => this.log(`Mises à jour : ${m}`), error: (m) => this.log(`Mises à jour : ${m}`), debug: () => {} };

    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking', error: '' }));
    autoUpdater.on('update-available', (info) => this.set({ state: 'downloading', version: info.version, progress: 0, notes: notesOf(info) }));
    autoUpdater.on('update-not-available', () => this.set({ state: 'idle', checkedAt: Date.now() }));
    autoUpdater.on('download-progress', (p) => this.set({ state: 'downloading', progress: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (info) => {
      this.ready = true;
      this.set({ state: 'ready', version: info.version, progress: 100, checkedAt: Date.now(), notes: notesOf(info) });
      if (Notification.isSupported()) new Notification({ title: 'Régie', body: `La version ${info.version} est prête. Elle s'installe quand tu fermes Régie.` }).show();
    });
    autoUpdater.on('error', (e) => {
      const msg = String(e?.message || e).split('\n')[0];
      this.log(`Mises à jour, erreur : ${msg}`);
      this.set({ state: 'error', error: friendly(msg), checkedAt: Date.now() });
    });

    // Première vérification peu après le lancement, puis toutes les 2 heures.
    this.first = setTimeout(() => this.check(), 8000);
    this.timer = setInterval(() => this.check(), 2 * 3600 * 1000);
  }

  set(patch) {
    Object.assign(this.status, patch);
    this.push('updater', { ...this.status });
  }

  setBeta(on) {
    if (autoUpdater) autoUpdater.allowPrerelease = Boolean(on);
    if (this.available) this.check();
  }

  async check() {
    if (!this.available) return this.status;
    if (this.status.state === 'downloading' || this.ready) return this.status;
    try { await autoUpdater.checkForUpdates(); } catch (e) { this.log(`Mises à jour : ${e.message}`); }
    return this.status;
  }

  async download() {
    if (!this.available) throw new Error('La version Portable ne se met pas à jour toute seule : installe Régie avec l\'installateur.');
    await autoUpdater.downloadUpdate();
  }

  installAndRestart() {
    if (!this.available || !this.ready) throw new Error('Aucune mise à jour prête.');
    // isSilent = true : pas d'assistant d'installation, Régie se relance tout seul.
    autoUpdater.quitAndInstall(true, true);
  }

  stop() { clearTimeout(this.first); clearInterval(this.timer); }
}

function notesOf(info) {
  const n = info?.releaseNotes;
  if (!n) return '';
  const text = Array.isArray(n) ? n.map((x) => x.note || '').join('\n') : String(n);
  return text.replace(/<[^>]+>/g, '').trim().slice(0, 2000);
}

function friendly(msg) {
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|getaddrinfo|network/i.test(msg)) return 'Pas de connexion internet pour vérifier les mises à jour.';
  if (/404|latest\.yml|Cannot find/i.test(msg)) return 'Aucune version publiée pour le moment.';
  if (/sha512|checksum/i.test(msg)) return 'Le téléchargement est abîmé, Régie réessaiera plus tard.';
  return msg;
}

module.exports = { Updater, portable };
