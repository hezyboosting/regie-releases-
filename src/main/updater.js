// Mises à jour automatiques via GitHub Releases.
// L'installateur NSIS embarque electron-updater, la version Portable ne peut pas se mettre à jour.
const path = require('path');
const { app, dialog, Notification } = require('electron');

let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch { /* electron-updater absent en dev */ }

class Updater {
  constructor({ log, push }) {
    this.log = log;
    this.push = push;
    this.status = { state: 'idle', version: '', progress: 0, error: '' };
    this.ready = false;
  }

  start() {
    if (!autoUpdater) { this.log('Auto-updater : non disponible (mode dev ou Portable)'); return; }
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = { info: (m) => this.log(`Updater : ${m}`), warn: (m) => this.log(`Updater : ${m}`), error: (m) => this.log(`Updater : ${m}`) };

    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }));
    autoUpdater.on('update-available', (info) => {
      this.set({ state: 'available', version: info.version });
      if (Notification.isSupported()) new Notification({ title: 'Régie', body: `Nouvelle version ${info.version} disponible` }).show();
    });
    autoUpdater.on('update-not-available', () => this.set({ state: 'idle' }));
    autoUpdater.on('download-progress', (p) => this.set({ state: 'downloading', progress: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (info) => {
      this.ready = true;
      this.set({ state: 'ready', version: info.version });
    });
    autoUpdater.on('error', (e) => {
      this.log(`Updater erreur : ${e.message}`);
      this.set({ state: 'error', error: e.message });
    });

    // Vérifie toutes les 2 heures.
    this.check();
    this.timer = setInterval(() => this.check(), 2 * 3600 * 1000);
  }

  set(patch) {
    Object.assign(this.status, patch);
    this.push('updater', this.status);
  }

  async check() {
    if (!autoUpdater) return;
    try { await autoUpdater.checkForUpdates(); } catch (e) { this.log(`Updater check : ${e.message}`); }
  }

  async download() {
    if (!autoUpdater) throw new Error('Les mises à jour ne sont pas disponibles avec la version Portable.');
    await autoUpdater.downloadUpdate();
  }

  installAndRestart() {
    if (!autoUpdater || !this.ready) throw new Error('Aucune mise à jour prête.');
    autoUpdater.quitAndInstall(false, true);
  }

  stop() { clearInterval(this.timer); }
}

module.exports = { Updater };
