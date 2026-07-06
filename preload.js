const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  platform: process.platform
});

// Ponts vers le processus principal (réseau sans CORS, PDF, Discord).
contextBridge.exposeInMainWorld('native', {
  fetchText: (url) => ipcRenderer.invoke('net-fetch', url),
  fetchPdfText: (url) => ipcRenderer.invoke('fetch-pdf-text', url),
  discordPresence: (payload) => ipcRenderer.send('discord-presence', payload)
});

// NOUVEAU SYSTÈME v1.6 : API du Modèle Global Unique
// Plus de LLM externe, tout le monde utilise le même modèle partagé
contextBridge.exposeInMainWorld('globalModel', {
  // Synchronisation avec le modèle global
  sync: () => ipcRenderer.invoke('global-model-sync'),
  
  // Statistiques du modèle
  stats: () => ipcRenderer.invoke('global-model-stats'),
  
  // Ajoute des données d'apprentissage
  addLearning: (data) => ipcRenderer.invoke('global-model-add-learning', data),
  
  // Publie les mises à jour locales
  publish: () => ipcRenderer.invoke('global-model-publish'),
  
  // Exporte le modèle local
  export: () => ipcRenderer.invoke('global-model-export'),
  
  // Importe un modèle
  import: (data) => ipcRenderer.invoke('global-model-import', data),
  
  // Événements de statut
  onStatus: (cb) => ipcRenderer.on('global-model-status', (_e, status) => cb(status))
});

// Anciennes API LLM - conservées pour compatibilité mais redirigées vers le modèle global
// Ces fonctions sont maintenant des alias qui utilisent le modèle partagé
contextBridge.exposeInMainWorld('llm', {
  status: () => ({ ready: false, error: 'LLM externe désactivé - Utilisez le modèle global unique' }),
  download: () => ({ ok: false, error: 'Téléchargement LLM désactivé' }),
  cancelDownload: () => {},
  load: () => ({ ok: false, error: 'Chargement LLM désactivé' }),
  unload: () => ({ ok: true }),
  generate: () => ({ ok: false, error: 'Utilisez le modèle global via brain.reply()' }),
  abort: () => {},
  resetChat: () => {},
  onChunk: (cb) => {},
  onProgress: (cb) => {},
  onStatus: (cb) => {}
});
