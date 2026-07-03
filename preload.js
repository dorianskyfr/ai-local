const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  version: '0.4.0',
  platform: process.platform
});

// Requêtes réseau relayées par le processus principal (sans restriction CORS).
contextBridge.exposeInMainWorld('native', {
  fetchText: (url) => ipcRenderer.invoke('net-fetch', url)
});
