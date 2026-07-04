const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  version: '1.2.0',
  platform: process.platform
});

// Ponts vers le processus principal (réseau sans CORS, PDF, Discord).
contextBridge.exposeInMainWorld('native', {
  fetchText: (url) => ipcRenderer.invoke('net-fetch', url),
  fetchPdfText: (url) => ipcRenderer.invoke('fetch-pdf-text', url),
  discordPresence: (payload) => ipcRenderer.send('discord-presence', payload)
});

// Pont vers le LLM local (llama.cpp dans le processus principal).
contextBridge.exposeInMainWorld('llm', {
  status: () => ipcRenderer.invoke('llm-status'),
  download: (id, url) => ipcRenderer.invoke('llm-download', { id, url }),
  cancelDownload: () => ipcRenderer.send('llm-download-abort'),
  load: (id, url) => ipcRenderer.invoke('llm-load', { id, url }),
  unload: () => ipcRenderer.invoke('llm-unload'),
  generate: (prompt) => ipcRenderer.invoke('llm-generate', { prompt }),
  abort: () => ipcRenderer.send('llm-abort'),
  resetChat: () => ipcRenderer.send('llm-reset-chat'),
  onChunk: (cb) => ipcRenderer.on('llm-chunk', (_e, chunk) => cb(chunk)),
  onProgress: (cb) => ipcRenderer.on('llm-progress', (_e, p) => cb(p)),
  onStatus: (cb) => ipcRenderer.on('llm-status-changed', (_e, s) => cb(s))
});
