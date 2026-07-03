const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  version: '0.7.0',
  platform: process.platform
});

// Ponts vers le processus principal (réseau sans CORS, PDF, Discord).
contextBridge.exposeInMainWorld('native', {
  fetchText: (url) => ipcRenderer.invoke('net-fetch', url),
  fetchPdfText: (url) => ipcRenderer.invoke('fetch-pdf-text', url),
  discordPresence: (payload) => ipcRenderer.send('discord-presence', payload)
});
