const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('regie', {
  call: (method, ...args) => ipcRenderer.invoke('api', method, ...args),
  on: (channel, fn) => {
    const handler = (_e, payload) => fn(payload);
    ipcRenderer.on(`push:${channel}`, handler);
    return () => ipcRenderer.removeListener(`push:${channel}`, handler);
  },
  // Fenêtre moteur (voix et analyse audio)
  engineOn: (channel, fn) => ipcRenderer.on(`engine:${channel}`, (_e, payload) => fn(payload)),
  engineSend: (channel, payload) => ipcRenderer.send(`engine:${channel}`, payload),
  sendPad: (pad) => ipcRenderer.send('engine:pad', pad),
});
