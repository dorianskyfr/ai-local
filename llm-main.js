/*
 * LLM local — le « grand cerveau » optionnel de l'app (v1.2).
 *
 * Fait tourner un vrai modèle de langage (open-weights, format GGUF) 100 %
 * en local via llama.cpp (node-llama-cpp), dans le processus principal.
 * Rien ne part dans le cloud : le modèle est téléchargé une fois, puis toute
 * l'inférence se fait sur la machine, hors ligne.
 *
 * Le modèle auto-appris (brain.js) n'est pas remplacé : sa mémoire de faits
 * sert de base de connaissances au LLM (les faits pertinents sont injectés
 * dans le prompt — le principe du RAG), et il reste le moteur de secours
 * complet quand aucun LLM n'est téléchargé.
 */

const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

/*
 * Catalogue de modèles proposés : uniquement des modèles ouverts sous licence
 * Apache 2.0 (redistribuables sans restriction), publiés par leurs auteurs au
 * format GGUF. Le champ « custom » permet de coller l'URL de n'importe quel
 * .gguf pour les utilisateurs avancés (« peu importe la taille »).
 */
const CATALOG = {
  'qwen2.5-0.5b': {
    label: 'Qwen 2.5 · 0,5 milliard (léger, ~500 Mo, PC modestes)',
    file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    approxMo: 500,
    license: 'Apache 2.0'
  },
  'qwen2.5-1.5b': {
    label: 'Qwen 2.5 · 1,5 milliard (recommandé, ~1,1 Go)',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    approxMo: 1100,
    license: 'Apache 2.0'
  },
  'qwen2.5-7b': {
    label: 'Qwen 2.5 · 7 milliards (le plus malin, ~4,7 Go, 8 Go de RAM min.)',
    // Miroir mono-fichier : le dépôt officiel scinde les gros GGUF en
    // plusieurs morceaux, ce que le téléchargeur intégré ne recolle pas.
    file: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    approxMo: 4700,
    license: 'Apache 2.0'
  }
};

/*
 * Personnalité et règles du LLM. Les faits appris localement arrivent dans
 * chaque message (côté renderer) ; le système reste stable pour conserver le
 * cache de contexte d'une réponse à l'autre.
 */
const SYSTEM_PROMPT = [
  "Tu es AI Local, un assistant IA qui tourne entièrement sur l'ordinateur de l'utilisateur, sans cloud : aucune donnée ne quitte la machine.",
  "Réponds toujours en français, de façon claire, naturelle et concise (2 à 6 phrases sauf si on te demande plus).",
  "Quand des « faits appris » accompagnent la question, appuie-toi dessus en priorité et mentionne la source entre parenthèses.",
  "Si tu n'es pas sûr d'une information, dis-le honnêtement plutôt que d'inventer."
].join(' ')

const state = {
  lib: null,          // module node-llama-cpp (importé à la demande)
  llama: null,
  model: null,
  context: null,
  session: null,
  currentId: null,    // id du modèle chargé
  loading: false,
  generating: false,
  abort: null,
  downloadAbort: null,
  lastError: null
};

function modelsDir() {
  const dir = path.join(app.getPath('userData'), 'models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function settingsPath() { return path.join(app.getPath('userData'), 'llm-settings.json'); }

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch (e) { return {}; }
}

function writeSettings(patch) {
  const s = Object.assign(readSettings(), patch);
  try { fs.writeFileSync(settingsPath(), JSON.stringify(s)); } catch (e) { /* disque plein : non bloquant */ }
}

/** Nom de fichier local pour une entrée du catalogue ou une URL personnalisée. */
function fileFor(id, url) {
  if (CATALOG[id]) return CATALOG[id].file;
  const base = String(url || '').split('?')[0].split('/').pop() || 'modele.gguf';
  return base.replace(/[^\w.-]/g, '_');
}

function isDownloaded(id, url) {
  try {
    const p = path.join(modelsDir(), fileFor(id, url));
    return fs.existsSync(p) && fs.statSync(p).size > 1024 * 1024;
  } catch (e) { return false; }
}

function statusPayload() {
  const settings = readSettings();
  const models = Object.entries(CATALOG).map(([id, m]) => ({
    id, label: m.label, approxMo: m.approxMo, license: m.license,
    downloaded: isDownloaded(id)
  }));
  const customUrl = settings.customUrl || null;
  return {
    models,
    customUrl,
    customDownloaded: customUrl ? isDownloaded('custom', customUrl) : false,
    current: state.currentId,
    ready: !!state.session,
    loading: state.loading,
    generating: state.generating,
    error: state.lastError
  };
}

function broadcast(sender) {
  const payload = statusPayload();
  try { sender.send('llm-status-changed', payload); } catch (e) { /* fenêtre fermée */ }
  return payload;
}

async function ensureLib() {
  if (!state.lib) {
    // node-llama-cpp est un module ESM : import dynamique depuis ce fichier CJS.
    state.lib = await import('node-llama-cpp');
  }
  if (!state.llama) {
    // CPU uniquement : fiable partout, aucune dépendance GPU embarquée.
    state.llama = await state.lib.getLlama({ gpu: false });
  }
  return state.lib;
}

async function disposeSession() {
  try { if (state.context) await state.context.dispose(); } catch (e) { /* déjà libéré */ }
  state.context = null;
  state.session = null;
}

async function loadModel(id, url, sender) {
  if (state.loading) throw new Error('Un chargement est déjà en cours.');
  const file = fileFor(id, url);
  const modelPath = path.join(modelsDir(), file);
  if (!fs.existsSync(modelPath)) throw new Error('Modèle non téléchargé.');

  state.loading = true;
  state.lastError = null;
  broadcast(sender);
  try {
    const { LlamaChatSession } = await ensureLib();
    await disposeSession();
    if (state.model) { try { await state.model.dispose(); } catch (e) { /* déjà libéré */ } }
    state.model = await state.llama.loadModel({ modelPath });
    state.context = await state.model.createContext({
      contextSize: Math.min(4096, state.model.trainContextSize || 4096)
    });
    state.session = new LlamaChatSession({
      contextSequence: state.context.getSequence(),
      systemPrompt: SYSTEM_PROMPT
    });
    state.currentId = id;
    writeSettings({ lastModel: id, ...(id === 'custom' ? { customUrl: url } : {}) });
  } catch (e) {
    state.lastError = String(e.message || e);
    state.currentId = null;
    await disposeSession();
    throw e;
  } finally {
    state.loading = false;
    broadcast(sender);
  }
}

/** Nouvelle conversation : repart d'une session vierge (même modèle). */
async function resetSession() {
  if (!state.model) return;
  const { LlamaChatSession } = state.lib;
  await disposeSession();
  state.context = await state.model.createContext({
    contextSize: Math.min(4096, state.model.trainContextSize || 4096)
  });
  state.session = new LlamaChatSession({
    contextSequence: state.context.getSequence(),
    systemPrompt: SYSTEM_PROMPT
  });
}

async function download(id, url, sender) {
  const entry = CATALOG[id];
  const realUrl = entry ? entry.url : url;
  if (!realUrl || !/^https:\/\//.test(realUrl)) throw new Error('URL invalide (https attendu).');
  const file = fileFor(id, realUrl);
  const dest = path.join(modelsDir(), file);
  const tmp = dest + '.part';

  state.downloadAbort = new AbortController();
  const res = await fetch(realUrl, {
    redirect: 'follow',
    signal: state.downloadAbort.signal,
    headers: { 'User-Agent': 'AI-Local' }
  });
  if (!res.ok) throw new Error(`Téléchargement refusé (HTTP ${res.status}). Vérifie l'URL ou réessaie plus tard.`);

  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  let lastEmit = 0;
  const out = fs.createWriteStream(tmp);
  try {
    await new Promise((resolve, reject) => {
      const stream = Readable.fromWeb(res.body);
      stream.on('data', (chunk) => {
        received += chunk.length;
        const now = Date.now();
        if (now - lastEmit > 300) {
          lastEmit = now;
          try { sender.send('llm-progress', { id, received, total }); } catch (e) { /* fenêtre fermée */ }
        }
      });
      stream.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      stream.pipe(out);
    });
  } catch (e) {
    try { out.destroy(); fs.unlinkSync(tmp); } catch (e2) { /* déjà supprimé */ }
    throw e;
  } finally {
    state.downloadAbort = null;
  }
  if (total && received < total) {
    try { fs.unlinkSync(tmp); } catch (e) { /* déjà supprimé */ }
    throw new Error('Téléchargement incomplet — réessaie.');
  }
  fs.renameSync(tmp, dest);
  if (id === 'custom') writeSettings({ customUrl: realUrl });
  try { sender.send('llm-progress', { id, received, total: total || received, done: true }); } catch (e) { /* fenêtre fermée */ }
}

function registerLlmIpc() {
  ipcMain.handle('llm-status', () => statusPayload());

  ipcMain.handle('llm-download', async (event, { id, url }) => {
    try {
      await download(id, url, event.sender);
      broadcast(event.sender);
      return { ok: true };
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Téléchargement annulé.' : String(e.message || e);
      state.lastError = msg;
      broadcast(event.sender);
      return { ok: false, error: msg };
    }
  });

  ipcMain.on('llm-download-abort', () => {
    if (state.downloadAbort) state.downloadAbort.abort();
  });

  ipcMain.handle('llm-load', async (event, { id, url }) => {
    try {
      await loadModel(id, url || readSettings().customUrl, event.sender);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle('llm-unload', async (event) => {
    await disposeSession();
    if (state.model) { try { await state.model.dispose(); } catch (e) { /* déjà libéré */ } }
    state.model = null;
    state.currentId = null;
    broadcast(event.sender);
    return { ok: true };
  });

  ipcMain.on('llm-reset-chat', async () => {
    // Pendant une génération, on ne peut pas détruire le contexte en cours :
    // le reset est mémorisé et appliqué dès la fin de la génération (sinon
    // l'historique de l'ancienne conversation fuyait dans la nouvelle).
    if (state.generating) { state.pendingReset = true; return; }
    try { await resetSession(); } catch (e) { state.lastError = String(e.message || e); }
  });

  ipcMain.on('llm-abort', () => {
    if (state.abort) state.abort.abort();
  });

  ipcMain.handle('llm-generate', async (event, { prompt }) => {
    if (!state.session) return { ok: false, error: 'Aucun modèle chargé.' };
    if (state.generating) return { ok: false, error: 'Une réponse est déjà en cours.' };
    state.generating = true;
    state.abort = new AbortController();
    try {
      let text = '';
      const res = await state.session.prompt(String(prompt || ''), {
        temperature: 0.7,
        maxTokens: 600,
        signal: state.abort.signal,
        stopOnAbortSignal: true, // en cas d'arrêt : garde ce qui est déjà généré
        onTextChunk: (chunk) => {
          text += chunk;
          try { event.sender.send('llm-chunk', chunk); } catch (e) { /* fenêtre fermée */ }
        }
      });
      return { ok: true, text: res || text };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    } finally {
      state.generating = false;
      state.abort = null;
      if (state.pendingReset) {
        state.pendingReset = false;
        try { await resetSession(); } catch (e) { state.lastError = String(e.message || e); }
      }
    }
  });
}

/** Recharge automatiquement le dernier modèle utilisé au démarrage. */
async function autoLoad(win) {
  const { lastModel, customUrl } = readSettings();
  if (!lastModel) return;
  if (!isDownloaded(lastModel, customUrl)) return;
  try {
    await loadModel(lastModel, customUrl, win.webContents);
  } catch (e) {
    console.warn('Chargement auto du LLM impossible :', e.message);
  }
}

module.exports = { registerLlmIpc, autoLoad, CATALOG, SYSTEM_PROMPT };
