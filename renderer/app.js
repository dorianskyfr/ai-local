/* Logique de l'interface : onglets, conversations persistantes,
   chat multimodal en streaming, centre d'entraînement et galerie. */

// Vitesses d'apprentissage : intervalle entre cycles (texte / médias).
const SPEEDS = {
  eco:      { label: 'Éco',      text: 10000, media: 3000 },
  normal:   { label: 'Normal',   text: 5000,  media: 1500 },
  fast:     { label: 'Rapide',   text: 2500,  media: 900 },
  turbo:    { label: 'Turbo',    text: 1200,  media: 500 },
  ultimate: { label: 'Ultimate', text: 700,   media: 250, caution: true },
  eclair:   { label: 'Éclair',   text: 350,   media: 120, caution: true },
  // Recalculée en direct depuis les curseurs cœurs/RAM (voir plus bas).
  custom:   { label: 'Personnalisée', text: 5000, media: 1500, isCustom: true }
};
const SPEED_KEY = 'ai-local-speed';
const CUSTOM_CORES_KEY = 'ai-local-speed-cores';
const CUSTOM_RAM_KEY = 'ai-local-speed-ram';

/**
 * Calcule la cadence pour la vitesse personnalisée à partir des cœurs et de
 * la RAM choisis par l'utilisateur. Honnêteté : ceci ne réserve pas
 * littéralement N cœurs ou N Go (une appli aussi légère n'a pas besoin de
 * les épingler) — le curseur sert à estimer la marge dont dispose ta machine
 * et à régler la cadence des cycles en conséquence, plus vite si tu indiques
 * plus de ressources disponibles.
 */
function computeCustomSpeed(cores, ramGo) {
  // Garde-fous : une valeur invalide (curseur pas encore rendu, saisie vide…)
  // ne doit jamais produire un intervalle NaN ou nul — setInterval(fn, NaN)
  // se comporte comme setInterval(fn, 0) et déclencherait une boucle
  // incontrôlée de requêtes.
  const safeCores = Number.isFinite(cores) && cores > 0 ? cores : 4;
  const safeRam = Number.isFinite(ramGo) && ramGo > 0 ? ramGo : 8;

  // Barème recalibré (v1.0) : l'ancienne interpolation linéaire exigeait
  // 16 cœurs ET 32 Go pour atteindre le haut du barème — un PC de jeu à
  // 12 cœurs/15 Go obtenait 3,8 s par cycle, PLUS LENT que le préréglage
  // Turbo, ce qui donnait l'impression que le mode ne marchait pas.
  // Désormais : 12 cœurs/16 Go ≈ Éclair, 4 cœurs/8 Go ≈ Rapide, et
  // l'interpolation est géométrique pour que chaque cran du curseur ait un
  // effet perceptible sur toute la plage.
  const power = Math.min(1, (safeCores / 12) * 0.7 + (safeRam / 16) * 0.3);
  const text = Math.round(SPEEDS.eco.text * Math.pow(SPEEDS.eclair.text / SPEEDS.eco.text, power));
  const media = Math.round(SPEEDS.eco.media * Math.pow(SPEEDS.eclair.media / SPEEDS.eco.media, power));
  // Filet de sécurité final : jamais en dessous du plancher d'Éclair.
  return {
    text: Math.max(SPEEDS.eclair.text, text),
    media: Math.max(SPEEDS.eclair.media, media)
  };
}

/** Nom du préréglage le plus proche d'une cadence donnée (pour l'affichage). */
function nearestPresetLabel(textMs) {
  let bestKey = 'normal';
  let bestDiff = Infinity;
  for (const key in SPEEDS) {
    if (SPEEDS[key].isCustom) continue;
    const diff = Math.abs(Math.log(textMs) - Math.log(SPEEDS[key].text));
    if (diff < bestDiff) { bestDiff = diff; bestKey = key; }
  }
  return SPEEDS[bestKey].label;
}

/*
 * À vitesse Turbo et au-delà, le cycle d'affichage (consolidation locale,
 * auto-renforcement) peut tourner très vite sans risque — c'est du calcul
 * local. Les vraies requêtes réseau (Wikipédia, recherche web, etc.), elles,
 * sont plafonnées à un intervalle minimum quel que soit le réglage : les
 * marteler à 350 ms ferait bloquer les services publics gratuits (DuckDuckGo
 * en particulier) pour tout le monde. Le cycle continue de tourner à la
 * vitesse choisie ; seule la requête réseau est sautée si elle est trop
 * récente.
 */
const NETWORK_MIN_INTERVAL_MS = 4000;
let lastNetworkFetchAt = 0;

/** Scanne les capacités du PC et recommande une vitesse. */
function scanPC() {
  const cores = navigator.hardwareConcurrency || 2;
  const memGo = navigator.deviceMemory || 4; // approximatif, plafonné à 8 par Chromium
  let recommended = 'normal';
  if (cores >= 8 && memGo >= 8) recommended = 'turbo';
  else if (cores >= 6) recommended = 'fast';
  else if (cores <= 2 || memGo <= 2) recommended = 'eco';
  return { cores, memGo, recommended };
}

const pcInfo = scanPC();

function currentSpeed() {
  const key = localStorage.getItem(SPEED_KEY) || pcInfo.recommended;
  return SPEEDS[key] ? key : 'normal';
}
const STREAM_WORD_MS = 45;
const CONV_STORAGE_KEY = 'ai-local-conversations-v1';
const GALLERY_STORAGE_KEY = 'ai-local-gallery-v1';
const MAX_CONVERSATIONS = 20;
const MAX_GALLERY = 40;

const brain = new Brain();

// NOUVEAU SYSTÈME v1.6 : État du modèle global
let globalModelStats = null;
let lastGlobalSync = 0;

// Synchroniser automatiquement au démarrage
window.globalModel.sync().then(result => {
  if (result.ok) {
    console.log('Modèle global synchronisé au démarrage :', result.message);
    updateGlobalStats();
  }
}).catch(error => {
  console.error('Erreur de synchronisation initiale :', error);
});
if (!brain.load()) {
  brain.bootstrap();
  brain.save();
}

const vision = new Vision();
vision.load();

/* ---------- Éléments ---------- */

const tabChat = document.getElementById('tab-chat');
const tabTraining = document.getElementById('tab-training');
const tabGallery = document.getElementById('tab-gallery');
const tabTrainingDot = document.getElementById('tab-training-dot');
const viewChat = document.getElementById('view-chat');
const viewTraining = document.getElementById('view-training');
const viewGallery = document.getElementById('view-gallery');

const messagesEl = document.getElementById('messages');
const composerEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const conversationListEl = document.getElementById('conversation-list');

const trainModeEl = document.getElementById('train-mode');
const trainSourceEl = document.getElementById('train-source');
const sourceRowEl = document.getElementById('source-row');
const topicInputEl = document.getElementById('topic-input');
// NOUVEAU SYSTÈME v1.6 : Plus besoin de jeton GitHub pour le modèle global
const shareStatusEl = document.getElementById('share-status');
const trainSpeedEl = document.getElementById('train-speed');
const pcScanEl = document.getElementById('pc-scan');
const tokenNoteEl = document.getElementById('token-note');
const discordAppIdEl = document.getElementById('discord-appid');
const discordSaveBtn = document.getElementById('discord-save');
const discordStatusEl = document.getElementById('discord-status');
const trainStartBtn = document.getElementById('train-start');
const trainStartLabel = trainStartBtn.querySelector('.train-start-label');
const trainFeedEl = document.getElementById('train-feed');
const previewWrap = document.getElementById('preview-wrap');
const previewCanvas = document.getElementById('train-preview');
const galleryGridEl = document.getElementById('gallery-grid');

/* ---------- Onglets ---------- */

function showTab(name) {
  tabChat.classList.toggle('active', name === 'chat');
  tabTraining.classList.toggle('active', name === 'training');
  tabGallery.classList.toggle('active', name === 'gallery');
  viewChat.hidden = name !== 'chat';
  viewTraining.hidden = name !== 'training';
  viewGallery.hidden = name !== 'gallery';
  if (name === 'chat') inputEl.focus();
  if (name === 'gallery') renderGallery();
}

tabChat.addEventListener('click', () => showTab('chat'));
tabTraining.addEventListener('click', () => showTab('training'));
tabGallery.addEventListener('click', () => showTab('gallery'));

/* ---------- Conversations persistantes ---------- */

let conversations = [];
let currentConvId = null;

function loadConversations() {
  try {
    const raw = localStorage.getItem(CONV_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      conversations = data.conversations || [];
      currentConvId = data.currentConvId || null;
    }
  } catch (e) { /* stockage corrompu : on repart de zéro */ }
  if (!conversations.length) createConversation();
  if (!conversations.some(c => c.id === currentConvId)) {
    currentConvId = conversations[0].id;
  }
}

function saveConversations() {
  try {
    localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify({ conversations, currentConvId }));
  } catch (e) {
    // Quota dépassé : on retire les plus anciennes conversations et on réessaie.
    if (conversations.length > 1) {
      conversations = conversations.slice(0, Math.ceil(conversations.length / 2));
      try {
        localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify({ conversations, currentConvId }));
      } catch (e2) { console.warn('Sauvegarde des conversations impossible :', e2); }
    }
  }
}

function createConversation() {
  const conv = {
    id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
    title: 'Nouvelle conversation',
    createdAt: Date.now(),
    messages: []
  };
  conversations.unshift(conv);
  while (conversations.length > MAX_CONVERSATIONS) conversations.pop();
  currentConvId = conv.id;
  resetChatContext(); // LLM et sujet de suivi repartent de zéro
  return conv;
}

/** Une conversation = un contexte : ni l'historique LLM ni le sujet de
 *  suivi du rappel de faits ne doivent fuir d'une conversation à l'autre. */
function resetChatContext() {
  brain.lastTopic = [];
  if (window.llm) window.llm.resetChat();
}

function currentConv() {
  return conversations.find(c => c.id === currentConvId) || conversations[0];
}

function switchConversation(id) {
  currentConvId = id;
  resetChatContext();
  saveConversations();
  renderConversationList();
  renderMessages();
  showTab('chat');
}

function deleteConversation(id, event) {
  event.stopPropagation();
  const idx = conversations.findIndex(c => c.id === id);
  if (idx === -1) return;
  conversations.splice(idx, 1);
  if (!conversations.length) createConversation();
  if (currentConvId === id) {
    currentConvId = conversations[0].id;
    resetChatContext(); // la conversation affichée change : contexte remis à zéro
  }
  saveConversations();
  renderConversationList();
  renderMessages();
}

function renderConversationList() {
  conversationListEl.innerHTML = '';
  for (const conv of conversations) {
    const item = document.createElement('div');
    item.className = 'conversation-item' + (conv.id === currentConvId ? ' active' : '');
    item.addEventListener('click', () => switchConversation(conv.id));

    const title = document.createElement('span');
    title.className = 'conversation-title';
    title.textContent = conv.title;

    const del = document.createElement('button');
    del.className = 'conversation-delete';
    del.textContent = '×';
    del.title = 'Supprimer la conversation';
    del.addEventListener('click', (e) => deleteConversation(conv.id, e));

    item.append(title, del);
    conversationListEl.appendChild(item);
  }
}

/* ---------- Affichage des messages ---------- */

function welcomeHtml() {
  return `
    <div class="welcome">
      <div class="welcome-icon">✳</div>
      <h1>Bonjour !</h1>
      <p>Je suis une IA locale qui apprend toute seule. Parle-moi ici, entraîne-moi
      dans l'onglet <strong>S'entraîner</strong>, et pose-moi des questions sur ce que
      j'ai étudié : je réponds avec ma mémoire et je cite mes sources.</p>
      <p class="welcome-tip">Astuce : « dessine un coucher de soleil », « fais une
      vidéo de l'océan », « combien font 127 × 43 ? » ou « quelle heure il est ? ».</p>
    </div>`;
}

function clearWelcome() {
  const welcome = messagesEl.querySelector('.welcome');
  if (welcome) welcome.remove();
}

function makeMessage(role) {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'Toi' : 'IA';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  wrap.append(avatar, bubble);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function renderTextMessage(role, text) {
  makeMessage(role).textContent = text;
}

function renderImageMessage(text, dataUrl) {
  const bubble = makeMessage('ai');
  const p = document.createElement('p');
  p.textContent = text;
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = text;
  img.className = 'generated-media';
  bubble.append(p, img);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderVideoMessage(text, blobUrl) {
  const bubble = makeMessage('ai');
  const p = document.createElement('p');
  p.textContent = text;
  const video = document.createElement('video');
  video.src = blobUrl;
  video.controls = true;
  video.loop = true;
  video.autoplay = true;
  video.muted = true;
  video.className = 'generated-media';
  bubble.append(p, video);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessages() {
  const conv = currentConv();
  messagesEl.innerHTML = '';
  if (!conv.messages.length) {
    messagesEl.innerHTML = welcomeHtml();
    return;
  }
  for (const m of conv.messages) {
    if (m.kind === 'image' && m.dataUrl) renderImageMessage(m.text, m.dataUrl);
    else if (m.kind === 'video') renderTextMessage('ai', m.text + ' (vidéo disponible le temps de la session)');
    else renderTextMessage(m.role, m.text);
  }
}

function pushMessage(message) {
  const conv = currentConv();
  conv.messages.push(message);
  if (conv.title === 'Nouvelle conversation' && message.role === 'user') {
    conv.title = message.text.length > 34 ? message.text.slice(0, 34) + '…' : message.text;
    renderConversationList();
  }
  saveConversations();
}

/** Affiche la réponse mot à mot, façon machine à écrire. */
function streamTextMessage(text, done) {
  const bubble = makeMessage('ai');
  const words = text.split(' ');
  let i = 0;
  const tick = () => {
    bubble.textContent = words.slice(0, i + 1).join(' ');
    messagesEl.scrollTop = messagesEl.scrollHeight;
    i += 1;
    if (i < words.length) setTimeout(tick, STREAM_WORD_MS);
    else if (done) done();
  };
  tick();
}

function addTypingIndicator() {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = 'message ai typing';
  wrap.innerHTML = `
    <div class="avatar">IA</div>
    <div class="bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

/* ---------- Galerie ---------- */

let gallery = [];

function loadGallery() {
  try {
    gallery = JSON.parse(localStorage.getItem(GALLERY_STORAGE_KEY)) || [];
  } catch (e) { gallery = []; }
}

function saveGallery() {
  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(gallery));
  } catch (e) {
    gallery = gallery.slice(0, Math.ceil(gallery.length / 2));
    try { localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(gallery)); }
    catch (e2) { console.warn('Sauvegarde de la galerie impossible :', e2); }
  }
}

function addToGallery(subject, dataUrl) {
  gallery.unshift({ subject, dataUrl, date: Date.now() });
  while (gallery.length > MAX_GALLERY) gallery.pop();
  saveGallery();
}

function renderGallery() {
  galleryGridEl.innerHTML = '';
  if (!gallery.length) {
    galleryGridEl.innerHTML = `<p class="feed-empty">Aucune image pour le moment —
      demande « dessine … » dans le chat, ou lance un entraînement d'images.</p>`;
    return;
  }
  for (const item of gallery) {
    const card = document.createElement('figure');
    card.className = 'gallery-card';
    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = item.subject;
    const caption = document.createElement('figcaption');
    caption.textContent = item.subject;
    card.append(img, caption);
    galleryGridEl.appendChild(card);
  }
}

/* ---------- Détection d'intention image / vidéo ---------- */

const IMAGE_RE = /\b(dessine|dessine-moi|génère|genere|crée|cree|fais(?:-moi)?)\b.*\b(image|dessin|illustration|tableau|logo)\b|\bdessine\b/i;
const VIDEO_RE = /\b(vidéo|video|animation|clip|film)\b/i;

function extractSubject(text) {
  // « fais une vidéo d'un volcan en éruption » → « volcan en éruption »
  const m = text.match(/(?:\bde\b|\bdu\b|\bdes\b|\bsur\b|d'|d’)\s*(?:un\b|une\b|le\b|la\b|les\b|l'|l’)?\s*(.{2,60})$/i);
  if (m) return m[1].replace(/[.!?]+$/, '').trim();
  return text
    .replace(IMAGE_RE, '')
    .replace(VIDEO_RE, '')
    .replace(/\b(dessine|génère|genere|crée|cree|fais|moi|une?|le|la|les)\b/gi, '')
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim() || 'création libre';
}

/* ---------- Envoi d'un message ---------- */

function handleSend() {
  // Garde anti-réentrance : Entrée pendant qu'une réponse est en cours
  // déclenchait un second envoi concurrent (double indicateur de frappe,
  // générations LLM en collision).
  if (sendBtn.disabled) return;
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  autoResize();
  renderTextMessage('user', text);
  pushMessage({ role: 'user', kind: 'text', text });

  sendBtn.disabled = true;
  const typing = addTypingIndicator();
  const done = () => {
    typing.remove();
    brain.save();
    updateStats();
    sendBtn.disabled = false;
    inputEl.focus();
  };

  const wantsVideo = VIDEO_RE.test(text);
  const wantsImage = !wantsVideo && IMAGE_RE.test(text);

  if (wantsImage) {
    brain.learn(text);
    const subject = extractSubject(text);
    // On étudie d'abord de vraies images du sujet pour des couleurs crédibles.
    learnPalettesFromWeb(subject).catch(() => {}).then(() => {
      const dataUrl = vision.generateImage(subject);
      const caption = `Voici mon image pour « ${subject} » (génération ${vision.stats.generations}).`;
      done();
      renderImageMessage(caption, dataUrl);
      pushMessage({ role: 'ai', kind: 'image', text: caption, dataUrl });
      addToGallery(subject, dataUrl);
    });
    return;
  }

  if (wantsVideo) {
    brain.learn(text);
    const subject = extractSubject(text);
    learnPalettesFromWeb(subject).catch(() => {}).then(() => vision.generateVideo(subject)).then((blobUrl) => {
      const caption = `Voici ma vidéo pour « ${subject} ».`;
      done();
      renderVideoMessage(caption, blobUrl);
      pushMessage({ role: 'ai', kind: 'video', text: caption });
    }).catch(() => {
      done();
      renderTextMessage('ai', "Je n'ai pas réussi à générer la vidéo cette fois-ci. Réessaie !");
    });
    return;
  }

  const finishWith = (answer) => {
    typing.remove();
    streamTextMessage(answer, () => {
      pushMessage({ role: 'ai', kind: 'text', text: answer });
      brain.save();
      updateStats();
      sendBtn.disabled = false;
      inputEl.focus();
    });
  };

  const delay = 300 + Math.random() * 500;
  setTimeout(async () => {
    // Outils exacts d'abord : calcul et date/heure ont UNE bonne réponse,
    // déterministe — mieux qu'un LLM pour ça.
    const exact = brain.dateTimeAnswer(text) || brain.mathAnswer(text);
    if (exact) { finishWith(exact); return; }

      // NOUVEAU SYSTÈME v1.6 : Plus de LLM, on utilise directement le modèle amélioré
    const answer = brain.reply(text);

    // Question inconnue → recherche prioritaire sur toutes les sources en
    // parallèle, apprentissage immédiat, puis vraie réponse.
    if (brain.lastUnknown) {
      const query = brain.keywords(text).join(' ');
      if (query) {
        typing.querySelector('.bubble').insertAdjacentHTML('beforeend',
          '<span class="searching-note">🔎 je cherche sur internet…</span>');
        try {
          // fullText : pour répondre à une question précise, il faut lire
          // l'article en entier — la population d'un village, une date, un
          // chiffre ne sont presque jamais dans l'intro.
          const { results } = await Trainer.fetchBatch(Trainer.resolveSources('all', query), query, { fullText: true });
          for (const r of results) brain.learn(r.extract, 1, r.title);
          const learned = brain.answerFromMemory(text) || brain.answerFromMemory(query);
          if (learned) {
            finishWith(`Je viens de me renseigner ! ${learned}`);
            return;
          }
          if (results.length) {
            finishWith(`J'ai étudié ${results.length} source(s) sur le sujet mais je n'ai pas trouvé de réponse claire. Reformule ta question, ou entraîne-moi plus longuement dessus !`);
            return;
          }
        } catch (e) { /* hors ligne : on garde la réponse honnête */ }
      }
    }
    finishWith(answer);
  }, delay);
}

/**
 * NOUVEAU SYSTÈME v1.6 : Fonction de synchronisation avec le modèle global
 * Synchronise automatiquement le modèle local avec le modèle partagé
 */
async function syncGlobalModel() {
  try {
    const result = await window.globalModel.sync();
    if (result.ok && result.synced) {
      feedEntry(`✅ Modèle synchronisé : révision ${result.revision}`, 'success');
      updateGlobalStats();
    } else if (result.ok) {
      feedEntry(`ℹ️ Modèle déjà à jour : révision ${result.revision}`, 'info');
    } else {
      feedEntry(`⚠️ Synchronisation échouée : ${result.error || result.message}`, 'error');
    }
    return result;
  } catch (error) {
    feedEntry(`❌ Erreur de synchronisation : ${error.message}`, 'error');
    return { ok: false, error: error.message };
  }
}

/**
 * Met à jour les statistiques du modèle global dans l'UI
 */
async function updateGlobalStats() {
  try {
    const stats = await window.globalModel.stats();
    if (globalStatsEl) {
      globalStatsEl.innerHTML = `
        <strong>Modèle Global v1.6</strong><br>
        Révision : ${stats.revision}<br>
        Contributeurs : ${stats.contributors}<br>
        Contributions : ${stats.totalContributions}<br>
        Vocabulaire : ${stats.vocabSize} mots<br>
        Mémoire : ${stats.memorySize} souvenirs
      `;
    }
  } catch (error) {
    console.error('Erreur de mise à jour des stats :', error);
  }
}

composerEl.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend();
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
}
inputEl.addEventListener('input', autoResize);

newChatBtn.addEventListener('click', () => {
  const conv = currentConv();
  if (conv && !conv.messages.length) {
    switchConversation(conv.id);
    return;
  }
  createConversation();
  saveConversations();
  renderConversationList();
  renderMessages();
  showTab('chat');
});

/* ---------- Centre d'entraînement ---------- */

let trainingTimer = null;
let previewAnim = null;
let trainingBusy = false;

function feedEntry(text, kind = '') {
  const empty = trainFeedEl.querySelector('.feed-empty');
  if (empty) empty.remove();
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (kind ? ' ' + kind : '');
  entry.textContent = text;
  trainFeedEl.prepend(entry);
  while (trainFeedEl.children.length > 30) trainFeedEl.lastChild.remove();
}

function setTrainingUI(active) {
  trainStartBtn.classList.toggle('active', active);
  trainStartLabel.textContent = active ? "Arrêter l'entraînement" : "Lancer l'entraînement";
  tabTrainingDot.hidden = !active;
  trainModeEl.disabled = active;
  trainSourceEl.disabled = active;
}

// Le choix de sources ne concerne que l'entraînement texte.
trainModeEl.addEventListener('change', () => {
  sourceRowEl.hidden = trainModeEl.value !== 'text';
});

/* ---------- Vitesse d'apprentissage (scan du PC + personnalisée) ---------- */

const customCoresEl = document.getElementById('custom-cores');
const customCoresValEl = document.getElementById('custom-cores-val');
const customRamEl = document.getElementById('custom-ram');
const customRamValEl = document.getElementById('custom-ram-val');
const customCoresRowEl = document.getElementById('custom-cores-row');
const customRamRowEl = document.getElementById('custom-ram-row');
const customSpeedNoteEl = document.getElementById('custom-speed-note');

for (const key in SPEEDS) {
  const opt = document.createElement('option');
  opt.value = key;
  const s = SPEEDS[key];
  opt.textContent = s.isCustom
    ? `${s.label} — réglable avec les curseurs ci-dessous`
    : `${s.label} — 1 cycle toutes les ${(s.text / 1000).toLocaleString('fr-FR')} s`;
  if (key === pcInfo.recommended) opt.textContent += ' (recommandé pour ton PC)';
  else if (s.caution) opt.textContent += ' (sollicite fortement les sources — à réserver aux bons PC)';
  trainSpeedEl.appendChild(opt);
}
trainSpeedEl.value = currentSpeed();
pcScanEl.textContent = `🖥 Scan de ton PC : ${pcInfo.cores} cœurs, ~${pcInfo.memGo} Go de mémoire → vitesse recommandée : ${SPEEDS[pcInfo.recommended].label}.`;

customCoresEl.max = String(Math.max(16, pcInfo.cores));
customCoresEl.value = localStorage.getItem(CUSTOM_CORES_KEY) || String(pcInfo.cores);
customRamEl.value = localStorage.getItem(CUSTOM_RAM_KEY) || String(pcInfo.memGo);

function refreshCustomSpeed() {
  const cores = parseInt(customCoresEl.value, 10);
  const ram = parseInt(customRamEl.value, 10);
  customCoresValEl.textContent = String(cores);
  customRamValEl.textContent = ram + ' Go';
  Object.assign(SPEEDS.custom, computeCustomSpeed(cores, ram));
  customSpeedNoteEl.textContent = `⚙ Cadence : 1 cycle toutes les ${(SPEEDS.custom.text / 1000).toLocaleString('fr-FR')} s (texte) / ${(SPEEDS.custom.media / 1000).toLocaleString('fr-FR')} s (médias) — équivalent ≈ ${nearestPresetLabel(SPEEDS.custom.text)}. Ceci règle la cadence, ça ne réserve pas littéralement ces ressources.`;
}
refreshCustomSpeed();

function updateCustomRowVisibility() {
  const isCustom = trainSpeedEl.value === 'custom';
  customCoresRowEl.hidden = !isCustom;
  customRamRowEl.hidden = !isCustom;
  customSpeedNoteEl.hidden = !isCustom;
}
updateCustomRowVisibility();

/** Si un entraînement tourne, le recale sur la cadence actuelle. */
function restartTrainingInterval(logMessage) {
  if (!trainingTimer) return;
  const mode = trainModeEl.value;
  clearInterval(trainingTimer);
  trainingTimer = setInterval(
    mode === 'text' ? textTrainingStep : mediaTrainingStep,
    mode === 'text' ? SPEEDS[currentSpeed()].text : SPEEDS[currentSpeed()].media
  );
  if (logMessage) feedEntry(logMessage);
}

function applySpeedChange() {
  localStorage.setItem(SPEED_KEY, trainSpeedEl.value);
  updateCustomRowVisibility();
  restartTrainingInterval(`⚙ Vitesse d'apprentissage réglée sur ${SPEEDS[currentSpeed()].label}.`);
}

trainSpeedEl.addEventListener('change', applySpeedChange);

let customSpeedDebounce = null;

for (const [el, key] of [[customCoresEl, CUSTOM_CORES_KEY], [customRamEl, CUSTOM_RAM_KEY]]) {
  el.addEventListener('input', () => {
    localStorage.setItem(key, el.value);
    refreshCustomSpeed();
    if (trainSpeedEl.value !== 'custom') return;
    // Anti-rebond : glisser un curseur déclenche des dizaines d'événements
    // « input ». Sans ça, chaque pixel de mouvement redémarrait le cycle
    // d'entraînement et spammait le journal. On attend un court silence
    // (300 ms) avant de recaler l'intervalle pour de vrai.
    clearTimeout(customSpeedDebounce);
    customSpeedDebounce = setTimeout(() => {
      restartTrainingInterval(`⚙ Vitesse personnalisée mise à jour : 1 cycle toutes les ${(SPEEDS.custom.text / 1000).toLocaleString('fr-FR')} s.`);
    }, 300);
  });
}

async function textTrainingStep() {
  if (trainingBusy) return;
  trainingBusy = true;
  const topic = topicInputEl.value.trim();
  const sources = Trainer.resolveSources(trainSourceEl.value, topic);

  // Aux vitesses élevées, le cycle tourne vite mais les vraies requêtes
  // réseau restent plafonnées (voir NETWORK_MIN_INTERVAL_MS) — les cycles
  // « sautés » côté réseau font quand même tourner la consolidation locale.
  const now = Date.now();
  const canFetch = now - lastNetworkFetchAt >= NETWORK_MIN_INTERVAL_MS;

  if (canFetch) {
    lastNetworkFetchAt = now;
    try {
      const before = brain.getStats();
      const { results, errors } = await Trainer.fetchBatch(sources, topic);
      for (const r of results) {
        const b = brain.getStats();
        brain.learn(r.extract, 1, r.title);
        const a = brain.getStats();
        feedEntry(`📖 [${r.sourceLabel}] « ${r.title} » — +${a.sentencesLearned - b.sentencesLearned} phrases, +${a.memories - b.memories} souvenirs.`);
        if (r.images && r.images.length) {
          learnImagesPalette(topic || r.sourceLabel, r.images).then((n) => {
            if (n) feedEntry(`🖼 ${n} image(s) de « ${r.sourceLabel} » apprise(s) pour les couleurs.`);
          });
        }
      }
      if (results.length > 1) {
        const after = brain.getStats();
        feedEntry(`⚡ ${results.length} sources étudiées en parallèle — vocabulaire : ${after.vocabSize} mots (+${after.sentencesLearned - before.sentencesLearned} phrases ce cycle).`);
      }
      if (!results.length) {
        if (errors.length) {
          feedEntry(`⚠ ${errors[0].error} — je m'auto-entraîne en local en attendant.`, 'warn');
        } else {
          feedEntry(topic
            ? `🔍 Rien trouvé sur « ${topic} », nouvel essai au prochain cycle…`
            : '🔍 Articles vides, nouvel essai au prochain cycle…');
        }
      }
      // Une vidéo YouTube s'apprend en une fois : inutile de boucler dessus.
      if (sources.includes('youtube') && results.length) {
        feedEntry('🎬 Sous-titres de la vidéo appris — entraînement terminé pour cette vidéo.');
        brain.save();
        updateStats();
        stopTraining();
        trainingBusy = false;
        return;
      }
    } catch (e) {
      feedEntry('⚠ Internet inaccessible — je m\'auto-entraîne en local en attendant.', 'warn');
    }
  }

  // Consolidation locale à chaque cycle, avec ou sans requête réseau ce tour-ci.
  const conv = currentConv();
  const summary = brain.selfTrainStep(conv.messages.slice(-10).map(m => m.text));
  if (summary.best) {
    feedEntry(`🧠 Cycle ${summary.epoch} — ${summary.reinforced} phrases auto-renforcées.`);
  }
  brain.save();
  updateStats();
  maybePublishSharedModel();
  trainingBusy = false;
}

let paletteFetchedFor = null;

/** Charge une liste d'URLs d'images et en apprend la palette de couleurs. */
async function learnImagesPalette(topic, urls) {
  let learned = 0;
  for (const url of urls) {
    await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { if (vision.learnPaletteFromImage(topic, img)) learned += 1; resolve(); };
      img.onerror = resolve;
      img.src = url;
    });
  }
  return learned;
}

/** Apprend les palettes de vraies images du web (Wikimedia Commons) sur le sujet. */
async function learnPalettesFromWeb(topic) {
  if (!topic || paletteFetchedFor === topic) return;
  paletteFetchedFor = topic;
  try {
    const urls = await Trainer.fetchCommonsImages(topic);
    const learned = await learnImagesPalette(topic, urls);
    if (learned) {
      feedEntry(`🖼 ${learned} vraie(s) image(s) du web étudiée(s) : j'ai appris les couleurs de « ${topic} ».`);
    }
  } catch (e) { /* hors ligne : le générateur garde ses palettes */ }
}

function mediaTrainingStep() {
  const result = vision.trainStep();
  feedEntry(`🎨 Génération ${result.generation} — ${result.evaluated} images évaluées, score ${(result.score * 100).toFixed(0)} %.`);
  const topic = topicInputEl.value.trim();
  if (topic) learnPalettesFromWeb(topic);
  // Un instantané rejoint la galerie régulièrement pour suivre les progrès.
  if (result.generation % 10 === 0) {
    const subject = topic || 'entraînement libre';
    addToGallery(`${subject} — génération ${result.generation}`, vision.generateImage(subject));
  }
  updateStats();
}

function startPreview(animated) {
  previewWrap.hidden = false;
  const ctx = previewCanvas.getContext('2d');
  const subject = () => topicInputEl.value.trim() || 'entraînement libre';
  if (animated) {
    const start = performance.now();
    const loop = () => {
      vision.paint(ctx, previewCanvas.width, previewCanvas.height, vision.genome, subject(), (performance.now() - start) / 1000);
      previewAnim = requestAnimationFrame(loop);
    };
    loop();
  } else {
    previewAnim = setInterval(() => {
      vision.paint(ctx, previewCanvas.width, previewCanvas.height, vision.genome, subject(), 0);
    }, SPEEDS[currentSpeed()].media);
  }
}

function stopPreview() {
  if (typeof previewAnim === 'number' && previewAnim > 0) {
    cancelAnimationFrame(previewAnim);
    clearInterval(previewAnim);
  }
  previewAnim = null;
  previewWrap.hidden = true;
}

function startTraining() {
  const mode = trainModeEl.value;
  const topic = topicInputEl.value.trim();
  setTrainingUI(true);

  if (mode === 'text') {
    const sources = Trainer.resolveSources(trainSourceEl.value, topic);
    const labels = sources.map(Trainer.sourceLabel).join(', ');
    feedEntry(topic
      ? `🚀 Entraînement lancé sur « ${topic} » — sources : ${labels}.`
      : `🚀 Entraînement lancé sur des sujets aléatoires — sources : ${labels}.`);
    textTrainingStep();
    trainingTimer = setInterval(textTrainingStep, SPEEDS[currentSpeed()].text);
  } else {
    const label = mode === 'image' ? "la génération d'images" : 'la génération de vidéos';
    feedEntry(`🚀 Entraînement lancé sur ${label}${topic ? ` (thème : « ${topic} »)` : ''}.`);
    startPreview(mode === 'video');
    mediaTrainingStep();
    trainingTimer = setInterval(mediaTrainingStep, SPEEDS[currentSpeed()].media);
  }

  const presenceTopic = topic || 'sujets aléatoires';
  updatePresence(
    mode === 'text' ? `S'entraîne : ${presenceTopic}` : `Apprend à générer des ${mode === 'image' ? 'images' : 'vidéos'}`,
    `AI Local — vitesse ${SPEEDS[currentSpeed()].label}`
  );
}

function stopTraining() {
  clearInterval(trainingTimer);
  trainingTimer = null;
  stopPreview();
  setTrainingUI(false);
  feedEntry('⏹ Entraînement arrêté. Le modèle a conservé tout ce qu\'il a appris.');
  updatePresence('Discute avec son IA locale', appVersionLabel);
}

trainStartBtn.addEventListener('click', () => {
  if (trainingTimer) stopTraining();
  else startTraining();
});

/* ---------- Statistiques ---------- */

function updateStats() {
  const s = brain.getStats();
  document.getElementById('stat-epochs').textContent = s.epochs;
  document.getElementById('stat-vocab').textContent = s.vocabSize;
  document.getElementById('stat-memories').textContent = s.memories;
  document.getElementById('stat-sentences').textContent = s.sentencesLearned;
  document.getElementById('stat-generations').textContent = vision.stats.generations;
  document.getElementById('confidence-fill').style.width =
    Math.min(100, Math.round(s.confidence * 100)) + '%';
  updateMilestones();
}

/* ---------- Paliers de progression (texte + images) ---------- */

const MILESTONE_TEXT_KEY = 'ai-local-milestone-text';
const MILESTONE_IMAGE_KEY = 'ai-local-milestone-image';

function renderMilestone(kind, milestone, badgeEl, nameEl, storageKey) {
  badgeEl.querySelector('.milestone-icon').textContent = milestone.icon;
  nameEl.textContent = milestone.name;
  const seenIndex = parseInt(localStorage.getItem(storageKey) || '0', 10);
  if (milestone.index > seenIndex) {
    localStorage.setItem(storageKey, String(milestone.index));
    badgeEl.classList.add('level-up');
    setTimeout(() => badgeEl.classList.remove('level-up'), 2400);
    const domaine = kind === 'text' ? "à l'écrit" : 'en génération visuelle';
    feedEntry(`🏆 Nouveau palier ${domaine} : ${milestone.icon} ${milestone.name} ! (palier interne et ludique, pas une comparaison avec de vrais modèles d'IA)`);
  }
}

function updateMilestones() {
  renderMilestone('text', brain.getMilestone(),
    document.getElementById('milestone-text'), document.getElementById('milestone-text-name'), MILESTONE_TEXT_KEY);
  renderMilestone('image', vision.getMilestone(),
    document.getElementById('milestone-image'), document.getElementById('milestone-image-name'), MILESTONE_IMAGE_KEY);

  // Taille réelle du modèle sur disque + échelle honnête. Comparer les
  // paliers à GPT ou Claude comme des égaux serait un mensonge affiché :
  // on donne plutôt les vrais ordres de grandeur, et la fierté de ce que
  // CE modèle-là a réellement appris.
  const bytes = (localStorage.getItem('ai-local-brain-v1') || '').length +
    (localStorage.getItem('ai-local-vision-v1') || '').length;
  const size = bytes > 1048576
    ? (bytes / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo'
    : Math.max(1, Math.round(bytes / 1024)) + ' Ko';
  const scaleEl = document.getElementById('scale-note');
  if (scaleEl) {
    scaleEl.textContent = `Taille du modèle : ${size} · ${brain.getStats().vocabSize.toLocaleString('fr-FR')} mots de vocabulaire. Échelle honnête : GPT-4 pèse ~3 000 000× plus — les paliers mesurent TA progression, pas une équivalence.`;
  }
}

/* ---------- Modèle Global v1.6 ---------- */

// NOUVEAU SYSTÈME : Plus besoin de jeton GitHub, tout est automatique
function setShareStatus(text) {
  if (shareStatusEl) {
    shareStatusEl.textContent = text;
  }
}

// Mettre à jour le statut avec les infos du modèle global
async function updateShareStatus() {
  try {
    const stats = await window.globalModel.stats();
    setShareStatus(`✓ Modèle Global v1.6 : révision ${stats.revision}, ${stats.contributors} contributeurs`);
  } catch (error) {
    setShareStatus('Modèle Global : synchronisation en cours…');
  }
}

// Mettre à jour automatiquement
updateShareStatus();
setInterval(updateShareStatus, 30000);

refreshTokenUI();

/* ---------- Discord Rich Presence ---------- */

const DISCORD_KEY = 'ai-local-discord-appid';
const presenceStart = Date.now();

// Libellé de version dynamique (badge + présence Discord) — jamais codé en dur.
let appVersionLabel = 'AI Local';
if (window.appInfo && window.appInfo.getVersion) {
  window.appInfo.getVersion().then((v) => {
    appVersionLabel = 'AI Local v' + v;
    const badge = document.querySelector('.version-badge');
    if (badge) badge.textContent = 'v' + v.split('.').slice(0, 2).join('.');
  }).catch(() => {});
}

function updatePresence(details, state) {
  const clientId = (localStorage.getItem(DISCORD_KEY) || '').trim();
  if (!clientId || !window.native || !window.native.discordPresence) return;
  window.native.discordPresence({
    clientId,
    details,
    state,
    startTimestamp: Math.floor(presenceStart / 1000)
  });
}

discordAppIdEl.value = localStorage.getItem(DISCORD_KEY) || '';
discordSaveBtn.addEventListener('click', () => {
  const id = discordAppIdEl.value.trim();
  localStorage.setItem(DISCORD_KEY, id);
  if (id) {
    discordStatusEl.textContent = '✓ Présence activée (Discord doit être ouvert sur ce PC).';
    updatePresence('Discute avec son IA locale', appVersionLabel);
  } else {
    discordStatusEl.textContent = 'Présence désactivée.';
    if (window.native && window.native.discordPresence) window.native.discordPresence({ clientId: '' });
  }
});

/* ---------- Modèle Global v1.6 (panneau latéral) ---------- */

// NOUVEAU SYSTÈME : Un seul modèle partagé par tous les utilisateurs
const globalStatsEl = document.getElementById('global-model-stats');
const globalSyncBtn = document.getElementById('global-sync-btn');
const globalContribEl = document.getElementById('global-contrib-stats');

/**
 * NOUVEAU : Met à jour l'affichage des statistiques du modèle global
 */
async function refreshGlobalModelPanel() {
  try {
    const stats = await window.globalModel.stats();
    
    if (globalStatsEl) {
      globalStatsEl.innerHTML = `
        <strong>🌍 Modèle Global v1.6</strong><br>
        <span class="global-stat">Révision : ${stats.revision}</span><br>
        <span class="global-stat">Vocabulaire : ${stats.vocabSize} mots</span><br>
        <span class="global-stat">Mémoire : ${stats.memorySize} souvenirs</span><br>
        <span class="global-stat">Confiance : ${(stats.confidence * 100).toFixed(1)}%</span>
      `;
    }
    
    if (globalContribEl) {
      globalContribEl.innerHTML = `
        <strong>👥 Contributeurs</strong><br>
        <span class="global-stat">Nombre : ${stats.contributors}</span><br>
        <span class="global-stat">Contributions : ${stats.totalContributions}</span>
      `;
    }
    
    if (globalSyncBtn) {
      globalSyncBtn.disabled = false;
      globalSyncBtn.textContent = 'Synchroniser maintenant';
    }
    
  } catch (error) {
    if (globalStatsEl) {
      globalStatsEl.innerHTML = '<strong>⚠️ Modèle Global</strong><br>Impossible de charger les statistiques';
    }
    console.error('Erreur de chargement des stats globales :', error);
  }
}

/**
 * NOUVEAU : Synchronise manuellement avec le modèle global
 */
async function handleGlobalSync() {
  if (globalSyncBtn) {
    globalSyncBtn.disabled = true;
    globalSyncBtn.textContent = 'Synchronisation…';
  }
  
  try {
    const result = await syncGlobalModel();
    
    if (result.ok && result.synced) {
      feedEntry(`✅ Modèle global synchronisé : révision ${result.revision}`, 'success');
    } else if (result.ok) {
      feedEntry(`ℹ️ Modèle déjà à jour : révision ${result.revision}`, 'info');
    } else {
      feedEntry(`⚠️ Échec de synchronisation : ${result.error || result.message}`, 'error');
    }
    
    await refreshGlobalModelPanel();
    
  } catch (error) {
    feedEntry(`❌ Erreur : ${error.message}`, 'error');
    if (globalSyncBtn) {
      globalSyncBtn.disabled = false;
      globalSyncBtn.textContent = 'Synchroniser maintenant';
    }
  }
}

// Initialiser le panneau du modèle global
if (window.globalModel) {
  refreshGlobalModelPanel();
  
  // Synchroniser automatiquement toutes les 5 minutes
  setInterval(() => {
    window.globalModel.sync().then(result => {
      if (result.ok && result.synced) {
        console.log('Synchronisation automatique réussie :', result.revision);
        refreshGlobalModelPanel();
      }
    }).catch(error => {
      console.error('Synchronisation automatique échouée :', error);
    });
  }, 5 * 60 * 1000);
  
  // Bouton de synchronisation manuelle
  if (globalSyncBtn) {
    globalSyncBtn.addEventListener('click', handleGlobalSync);
  }
}

/* ---------- Démarrage ---------- */

// NOUVEAU SYSTÈME v1.6 : Plus de LLM, on utilise le modèle global
refreshGlobalModelPanel();
loadConversations();
loadGallery();
renderConversationList();
renderMessages();
updateStats();
updatePresence('Discute avec son IA locale v1.6', appVersionLabel);
inputEl.focus();
