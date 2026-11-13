// Envoi d'une commande à un serveur de jeu : RCON Source (Minecraft, ARK, Palworld, GMod, CS2…),
// WebRCON (Rust) ou telnet (7 Days to Die). Une connexion par commande : simple et sans fuite.
const net = require('net');
const WebSocket = require('ws');
const { rconSend } = require('./gamehub');

function webRcon({ host = '127.0.0.1', port = 28016, password = '' }, command) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${host}:${port}/${encodeURIComponent(password)}`, { handshakeTimeout: 4000 });
    const id = Math.floor(Math.random() * 1e6);
    const t = setTimeout(() => { ws.terminate(); reject(new Error('Le serveur Rust ne répond pas.')); }, 5000);
    ws.on('open', () => ws.send(JSON.stringify({ Identifier: id, Message: command, Name: 'Regie' })));
    ws.on('message', (raw) => {
      let m = null;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.Identifier !== id) return;
      clearTimeout(t); ws.close(); resolve(String(m.Message || ''));
    });
    ws.on('error', () => { clearTimeout(t); reject(new Error('Connexion WebRCON impossible. Vérifie l\'adresse, le port et le mot de passe.')); });
    ws.on('unexpected-response', () => { clearTimeout(t); reject(new Error('Mot de passe WebRCON refusé.')); });
  });
}

function telnetRcon({ host = '127.0.0.1', port = 8081, password = '' }, command) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    let buf = '';
    let step = 0;
    const done = (fn, v) => { clearTimeout(t); sock.destroy(); fn(v); };
    const t = setTimeout(() => (step >= 2 ? done(resolve, buf.trim().slice(-400)) : done(reject, new Error('Le serveur ne répond pas.'))), 4000);
    sock.on('error', () => done(reject, new Error('Connexion telnet impossible.')));
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      if (step === 0 && /password/i.test(buf)) { step = 1; buf = ''; sock.write(`${password}\r\n`); return; }
      if (step <= 1 && /(incorrect|wrong|invalid)/i.test(buf)) { done(reject, new Error('Mot de passe telnet refusé.')); return; }
      if (step <= 1 && /(logon successful|press 'help'|connected with)/i.test(buf)) { step = 2; buf = ''; sock.write(`${command}\r\n`); setTimeout(() => done(resolve, buf.trim().slice(-400)), 600); }
    });
  });
}

function rconCall(server, command) {
  if (!server || !command) return Promise.reject(new Error('Serveur ou commande manquant.'));
  if (server.kind === 'webrcon') return webRcon(server, command);
  if (server.kind === 'telnet') return telnetRcon(server, command);
  return rconSend(server, command);
}

module.exports = { rconCall, webRcon, telnetRcon };
