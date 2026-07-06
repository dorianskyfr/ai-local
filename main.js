const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const GlobalModel = require('./global-model');

const REPO = 'dorianskyfr/ai-local';

/*
 * NOUVEAU SYSTÈME v1.6 : Intégration du modèle global
 * - Plus de LLM externe (Qwen supprimé)
 * - Un seul modèle partagé par tous les utilisateurs
 * - Synchronisation automatique au démarrage
 */

// Synchroniser le modèle global au démarrage
async function syncGlobalModelOnStartup(win) {
  try {
    const result = await GlobalModel.syncWithGlobal();
    console.log('Synchronisation du modèle global :', result.message);
    
    // Envoyer l'état du modèle au renderer
    if (win && win.webContents) {
      win.webContents.send('global-model-status', {
        synced: result.synced,
        revision: GlobalModel.getStats().revision,
        contributors: GlobalModel.getStats().contributors,
        totalContributions: GlobalModel.getStats().totalContributions
      });
    }
  } catch (error) {
    console.error('Erreur de synchronisation initiale :', error);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#1a1a1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

/*
 * Passerelle réseau pour le renderer : certains sites (flux RSS, sous-titres
 * YouTube, recherche web, pages quelconques) n'autorisent pas les requêtes
 * directes depuis une page (CORS). Le processus principal, lui, n'a pas
 * cette restriction. La taille est plafonnée pour éviter qu'une page géante
 * ne bloque le rendu ou gonfle inutilement la mémoire du modèle.
 */
const MAX_FETCH_CHARS = 800000;

// Un en-tête User-Agent générique ("AI-Local") fait rejeter la requête par
// certains sites (pages HTML classiques, pas des API) qui filtrent les clients
// non-navigateurs. On s'identifie donc comme un navigateur de bureau courant —
// pratique standard pour un outil personnel qui lit des pages publiques,
// sans contourner ni CAPTCHA ni limite d'authentification.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
};

// Source unique de vérité pour la version affichée (badge, présence Discord) :
// celle de l'app elle-même — plus jamais de numéro codé en dur qui périme.
ipcMain.handle('app-version', () => app.getVersion());

ipcMain.handle('net-fetch', async (_event, url) => {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow'
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text: text.length > MAX_FETCH_CHARS ? text.slice(0, MAX_FETCH_CHARS) : text
    };
  } catch (err) {
    return { ok: false, status: 0, text: '', error: String(err) };
  }
});

/*
 * Extraction de texte d'un PDF du web, sans dépendance : on télécharge le
 * fichier, on décompresse les flux (FlateDecode via zlib) et on récupère les
 * chaînes des opérateurs texte (Tj / TJ). Couvre la majorité des PDF simples ;
 * les PDF scannés (images) sont signalés comme illisibles.
 */
function extractPdfText(buffer) {
  const zlib = require('zlib');
  const raw = buffer.toString('latin1');
  const chunks = [raw];
  const streamRe = /stream\r?\n/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end === -1) continue;
    const slice = buffer.subarray(start, end);
    try {
      chunks.push(zlib.inflateSync(slice).toString('latin1'));
    } catch (e) { /* flux non compressé ou image : ignoré */ }
  }

  const decode = (s) => s
    .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '', t: ' ', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[c]))
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

  const parts = [];
  for (const chunk of chunks) {
    const textOps = chunk.match(/\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:\\.|[^\]])*)\]\s*TJ/g);
    if (!textOps) continue;
    for (const op of textOps) {
      const strings = op.match(/\(((?:\\.|[^\\()])*)\)/g) || [];
      const text = strings.map(s => decode(s.slice(1, -1))).join('');
      if (text.trim()) parts.push(text);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

ipcMain.handle('fetch-pdf-text', async (_event, url) => {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 25 * 1024 * 1024) return { ok: false, error: 'PDF trop volumineux (max 25 Mo)' };
    const text = extractPdfText(buffer);
    if (text.length < 120) {
      return { ok: false, error: 'PDF illisible (probablement scanné ou trop complexe)' };
    }
    return { ok: true, text: text.slice(0, 12000) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

/* ---------- Modèle Global IPC ---------- */

// Synchronisation du modèle global
ipcMain.handle('global-model-sync', async () => {
  try {
    const result = await GlobalModel.syncWithGlobal();
    return {
      ok: true,
      ...result
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
});

// Obtient les statistiques du modèle global
ipcMain.handle('global-model-stats', () => {
  return GlobalModel.getStats();
});

// Ajoute des données d'apprentissage
ipcMain.handle('global-model-add-learning', (event, data) => {
  GlobalModel.addLocalLearning(data);
  return { ok: true };
});

// Publie les mises à jour
ipcMain.handle('global-model-publish', async () => {
  try {
    const result = await GlobalModel.publishUpdates();
    return {
      ok: true,
      ...result
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
});

// Exporte le modèle local
ipcMain.handle('global-model-export', () => {
  return GlobalModel.exportModel();
});

// Importe un modèle
ipcMain.handle('global-model-import', (event, data) => {
  GlobalModel.importModel(data);
  return { ok: true };
});

/* ---------- Discord Rich Presence ---------- */

/*
 * Implémentation minimale du protocole IPC local de Discord (sans dépendance) :
 * trames [opcode, longueur] + JSON sur le tube nommé discord-ipc-N.
 */
const discord = {
  socket: null,
  ready: false,
  clientId: null,

  frame(op, payload) {
    const data = Buffer.from(JSON.stringify(payload));
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(data.length, 4);
    return Buffer.concat([header, data]);
  },

  ipcPath(i) {
    if (process.platform === 'win32') return '\\\.\\pipe\\discord-ipc-' + i;
    const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp';
    return require('path').join(base, 'discord-ipc-' + i);
  },

  connect(clientId) {
    if (this.socket && this.clientId === clientId) return;
    this.disconnect();
    this.clientId = clientId;
    const net = require('net');
    const tryPipe = (i) => {
      if (i > 9) return;
      const sock = net.createConnection(this.ipcPath(i), () => {
        this.socket = sock;
        sock.write(this.frame(0, { v: 1, client_id: clientId }));
        this.ready = true;
        if (this.pendingActivity) this.sendActivity(this.pendingActivity);
      });
      sock.on('error', () => { if (this.socket !== sock) tryPipe(i + 1); });
      sock.on('close', () => { if (this.socket === sock) { this.socket = null; this.ready = false; } });
    };
    tryPipe(0);
  },

  sendActivity(activity) {
    this.pendingActivity = activity;
    if (!this.socket || !this.ready) return;
    try {
      this.socket.write(this.frame(1, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity },
        nonce: String(Date.now())
      }));
    } catch (e) { /* Discord fermé : silencieux */ }
  },

  disconnect() {
    if (this.socket) { try { this.socket.destroy(); } catch (e) { /* déjà fermé */ } }
    this.socket = null;
    this.ready = false;
  }
};

ipcMain.on('discord-presence', (_event, { clientId, details, state, startTimestamp }) => {
  if (!clientId) { discord.disconnect(); return; }
  discord.connect(clientId);
  discord.sendActivity({
    details: details || 'Discute avec son IA locale v1.6',
    state: state || 'AI Local - Modèle Unique Partagé',
    timestamps: startTimestamp ? { start: startTimestamp } : undefined
  });
});

/* ---------- Mise à jour automatique ---------- */

function isNewer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

async function checkForUpdates(win) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'AI-Local', Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return;
    const release = await res.json();
    const latest = (release.tag_name || '').replace(/^v/, '');
    const current = app.getVersion();
    if (!latest || !isNewer(latest, current)) return;

    const setupAsset = (release.assets || []).find(a => /setup.*\.exe$/i.test(a.name));
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `AI Local v${latest} est disponible (tu utilises la v${current}).`,
      detail: "La mise à jour télécharge le nouvel installateur et le lance. Ton modèle, ta mémoire et tes conversations sont conservés.",
      buttons: ['Mettre à jour maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    });
    if (response !== 0) return;

    if (!setupAsset || process.platform !== 'win32') {
      shell.openExternal(release.html_url);
      return;
    }

    const download = await fetch(setupAsset.browser_download_url, {
      headers: { 'User-Agent': 'AI-Local' },
      redirect: 'follow'
    });
    if (!download.ok) {
      shell.openExternal(release.html_url);
      return;
    }
    const installerPath = path.join(app.getPath('temp'), setupAsset.name.replace(/[^\w.-]/g, '_'));
    fs.writeFileSync(installerPath, Buffer.from(await download.arrayBuffer()));
    spawn(installerPath, [], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } catch (err) {
    console.warn('Vérification de mise à jour impossible :', err.message);
  }
}

app.whenReady().then(() => {
  const win = createWindow();
  
  // Synchroniser le modèle global au démarrage
  syncGlobalModelOnStartup(win);
  
  if (app.isPackaged) checkForUpdates(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
