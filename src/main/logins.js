// Connexions simplifiées : réglages OBS déjà présents sur le PC et fenêtre de connexion TikTok.
const fs = require('fs');
const path = require('path');
const { BrowserWindow, session } = require('electron');

function fromIni(text) {
  const part = /\[OBSWebSocket\]([\s\S]*?)(?:\n\[|$)/.exec(text);
  if (!part) return null;
  const read = (k) => (new RegExp(`^${k}=(.*)$`, 'm').exec(part[1]) || [])[1]?.trim();
  return { enabled: read('ServerEnabled') === 'true', port: Number(read('ServerPort')) || 4455, password: read('AuthRequired') === 'false' ? '' : read('ServerPassword') || '' };
}

// OBS 31 et plus range le serveur WebSocket dans plugin_config, les versions 28 à 30 dans global.ini.
function readObsConfig(dir) {
  const out = { found: fs.existsSync(dir), enabled: false, port: 4455, password: '' };
  try {
    const c = JSON.parse(fs.readFileSync(path.join(dir, 'plugin_config', 'obs-websocket', 'config.json'), 'utf8'));
    return { ...out, enabled: Boolean(c.server_enabled), port: Number(c.server_port) || 4455, password: c.auth_required === false ? '' : c.server_password || '' };
  } catch { /* version plus ancienne */ }
  for (const name of ['user.ini', 'global.ini']) {
    try {
      const c = fromIni(fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r/g, ''));
      if (c) return { ...out, ...c };
    } catch { /* fichier absent */ }
  }
  return out;
}

const handleFrom = (url) => (/tiktok\.com\/@([A-Za-z0-9._]+)/.exec(url || '') || [])[1] || '';

function loginWindow(parent) {
  const partition = 'tiktok-login';
  const ses = session.fromPartition(partition);
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const w = new BrowserWindow({ width: 480, height: 760, parent, title: 'Connexion TikTok', autoHideMenuBar: true, webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true } });
    w.webContents.setUserAgent(w.webContents.getUserAgent().replace(/ Electron\/\S+/, '').replace(/ (regie|Régie)\/\S+/i, ''));
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const finish = (handle) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      if (!w.isDestroyed()) w.close();
      ses.clearStorageData().catch(() => {});
      resolve(handle);
    };
    let onProfile = false;
    timer = setInterval(async () => {
      if (w.isDestroyed()) return;
      const here = handleFrom(w.webContents.getURL());
      if (here) { finish(here); return; }
      const logged = (await ses.cookies.get({ url: 'https://www.tiktok.com', name: 'sessionid' })).length > 0;
      if (!logged) return;
      if (!onProfile) { onProfile = true; w.loadURL('https://www.tiktok.com/profile'); return; }
      const link = await w.webContents.executeJavaScript('document.querySelector(\'a[href^="/@"][data-e2e="nav-profile"], [data-e2e="nav-profile"] a\')?.getAttribute("href") || ""').catch(() => '');
      if (handleFrom(`tiktok.com${link}`)) finish(handleFrom(`tiktok.com${link}`));
    }, 1200);
    w.on('closed', () => finish(''));
    w.loadURL('https://www.tiktok.com/login');
  });
}

module.exports = { readObsConfig, fromIni, loginWindow, handleFrom };
