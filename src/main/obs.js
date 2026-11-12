// Client minimal pour obs-websocket v5, intégré à OBS 28 et plus.
const { EventEmitter } = require('events');
const crypto = require('crypto');
const WebSocket = require('ws');

const sha = (s) => crypto.createHash('sha256').update(s).digest('base64');

function authString(password, salt, challenge) {
  return sha(sha(password + salt) + challenge);
}

class Obs extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.state = 'off';
    this.streaming = false;
    this.pending = new Map();
    this.counter = 0;
  }

  setState(state, detail = '') { this.state = state; this.detail = detail; this.emit('state', { state, detail, streaming: this.streaming }); }

  connect({ host, port, password }) {
    this.disconnect();
    this.wanted = { host, port, password };
    this.setState('connecting');
    const ws = new WebSocket(`ws://${host}:${port}`, 'obswebsocket.json');
    this.ws = ws;
    ws.on('message', (raw) => this.onMessage(ws, raw));
    ws.on('close', (code) => {
      if (ws !== this.ws) return;
      this.ws = null;
      this.streaming = false;
      if (code === 4009) { this.wanted = null; return this.setState('error', 'Mot de passe OBS incorrect'); }
      this.setState('off', 'OBS n\'est pas joignable');
      if (this.wanted) this.retry = setTimeout(() => this.wanted && this.connect(this.wanted), 10000);
    });
    ws.on('error', () => { /* géré par close */ });
  }

  disconnect() {
    clearTimeout(this.retry);
    this.wanted = null;
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(); } catch { /* déjà fermé */ }
    this.streaming = false;
    this.setState('off');
  }

  onMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.op === 0) {
      const d = { rpcVersion: 1, eventSubscriptions: 4 | 64 | 128 }; // scènes, sorties, éléments de scène
      if (m.d.authentication) d.authentication = authString(this.wanted?.password || '', m.d.authentication.salt, m.d.authentication.challenge);
      ws.send(JSON.stringify({ op: 1, d }));
    } else if (m.op === 2) {
      this.setState('connected');
      this.request('GetStreamStatus').then((r) => { this.streaming = Boolean(r.outputActive); this.setState('connected'); }).catch(() => {});
    } else if (m.op === 5 && m.d.eventType === 'StreamStateChanged') {
      this.streaming = Boolean(m.d.eventData.outputActive);
      this.setState('connected');
    } else if (m.op === 5 && m.d.eventType === 'CurrentProgramSceneChanged') {
      this.current = m.d.eventData.sceneName;
      this.emit('scene', this.current);
    } else if (m.op === 5 && ['SceneListChanged', 'SceneItemEnableStateChanged', 'SceneItemListReindexed', 'SceneItemCreated', 'SceneItemRemoved'].includes(m.d.eventType)) {
      this.emit('scenesChanged');
    } else if (m.op === 7) {
      const p = this.pending.get(m.d.requestId);
      if (!p) return;
      this.pending.delete(m.d.requestId);
      if (m.d.requestStatus.result) p.resolve(m.d.responseData || {});
      else p.reject(new Error(m.d.requestStatus.comment || 'OBS a refusé la demande'));
    }
  }

  request(requestType, requestData) {
    if (!this.ws || this.state !== 'connected') return Promise.reject(new Error('OBS n\'est pas connecté.'));
    const requestId = String((this.counter += 1));
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      setTimeout(() => { if (this.pending.delete(requestId)) reject(new Error('OBS ne répond pas.')); }, 4000);
    });
  }

  setScene(sceneName) { return this.request('SetCurrentProgramScene', { sceneName }); }

  async scenes() {
    const r = await this.request('GetSceneList');
    this.current = r.currentProgramSceneName;
    return { current: r.currentProgramSceneName, scenes: (r.scenes || []).map((s) => s.sceneName).reverse() };
  }

  async sources(sceneName) {
    const r = await this.request('GetSceneItemList', { sceneName });
    return (r.sceneItems || []).map((i) => ({ id: i.sceneItemId, name: i.sourceName, enabled: i.sceneItemEnabled })).reverse();
  }

  async setSource(sceneName, sceneItemId, sceneItemEnabled) { await this.request('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled }); }

  async toggleSource(sceneName, sourceName) {
    const { sceneItemId } = await this.request('GetSceneItemId', { sceneName, sourceName });
    const { sceneItemEnabled } = await this.request('GetSceneItemEnabled', { sceneName, sceneItemId });
    await this.setSource(sceneName, sceneItemId, !sceneItemEnabled);
  }

  createScene(sceneName) { return this.request('CreateScene', { sceneName }); }

  removeScene(sceneName) { return this.request('RemoveScene', { sceneName }); }

  // OBS n'a pas de duplication directe : on recrée la scène en copiant ses éléments.
  async duplicateScene(sceneName, copyName) {
    await this.createScene(copyName);
    const { sceneItems } = await this.request('GetSceneItemList', { sceneName });
    for (const it of [...(sceneItems || [])].sort((a, b) => a.sceneItemIndex - b.sceneItemIndex)) {
      await this.request('DuplicateSceneItem', { sceneName, sceneItemId: it.sceneItemId, destinationSceneName: copyName });
    }
  }

  // Micro : la première entrée audio, sauf si un nom précis est donné.
  async audioInputs() {
    const { inputs } = await this.request('GetInputList');
    return (inputs || []).filter((i) => /wasapi_input|coreaudio_input|pulse_input|alsa_input/.test(i.inputKind)).map((i) => i.inputName);
  }

  async toggleMute(name) {
    const target = name || (await this.audioInputs())[0];
    if (!target) throw new Error('Aucun micro trouvé dans OBS.');
    return this.request('ToggleInputMute', { inputName: target });
  }

  async addBrowserSource({ scene, name, url, width, height }) {
    const sceneName = scene || (await this.request('GetCurrentProgramScene')).currentProgramSceneName;
    await this.request('CreateInput', { sceneName, inputName: name, inputKind: 'browser_source', inputSettings: { url, width, height, shutdown: false, restart_when_active: false }, sceneItemEnabled: true });
    return sceneName;
  }

  async thumbnail(sourceName) {
    const r = await this.request('GetSourceScreenshot', { sourceName, imageFormat: 'jpg', imageWidth: 320, imageCompressionQuality: 60 });
    return r.imageData;
  }

  async transitions() {
    const r = await this.request('GetSceneTransitionList');
    return { current: r.currentSceneTransitionName, list: (r.transitions || []).map((t) => t.transitionName) };
  }

  setTransition(transitionName) { return this.request('SetCurrentSceneTransition', { transitionName }); }

  saveReplay() { return this.request('SaveReplayBuffer'); }

  async replayStatus() { return (await this.request('GetReplayBufferStatus')).outputActive; }

  startReplay() { return this.request('StartReplayBuffer'); }

  async lastReplay() { return (await this.request('GetLastReplayBufferReplay')).savedReplayPath; }

  toggleStream() { return this.request('ToggleStream'); }

  toggleRecord() { return this.request('ToggleRecord'); }
}

module.exports = { Obs, authString };
