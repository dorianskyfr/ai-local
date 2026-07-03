const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const REPO = 'dorianskyfr/ai-local';

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
 * YouTube) n'autorisent pas les requêtes directes depuis une page (CORS).
 * Le processus principal, lui, n'a pas cette restriction.
 */
ipcMain.handle('net-fetch', async (_event, url) => {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AI-Local' },
      redirect: 'follow'
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (err) {
    return { ok: false, status: 0, text: '', error: String(err) };
  }
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
  if (app.isPackaged) checkForUpdates(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
