/* Logique de l'interface : onglets, conversations persistantes,
   chat multimodal en streaming, centre d'entraînement et galerie. */

const TEXT_TRAIN_INTERVAL_MS = 5000;
const MEDIA_TRAIN_INTERVAL_MS = 1500;
const STREAM_WORD_MS = 45;
const CONV_STORAGE_KEY = 'ai-local-conversations-v1';
const GALLERY_STORAGE_KEY = 'ai-local-gallery-v1';
const MAX_CONVERSATIONS = 20;
const MAX_GALLERY = 40;

const brain = new Brain();
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
const shareStatusEl = document.getElementById('share-status');
const githubTokenEl = document.getElementById('github-token');
const tokenSaveBtn = document.getElementById('token-save');
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
  return conv;
}

function currentConv() {
  return conversations.find(c => c.id === currentConvId) || conversations[0];
}

function switchConversation(id) {
  currentConvId = id;
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
  if (currentConvId === id) currentConvId = conversations[0].id;
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
      <p class="welcome-tip">Astuce : demande-moi « dessine un coucher de soleil »
      ou « fais une vidéo de l'océan ».</p>
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
  const m = text.match(/\b(?:de|d'|du|des|sur|d’)\s+(.{2,60})$/i);
  if (m) return m[1].replace(/[.!?]+$/, '').trim();
  return text
    .replace(IMAGE_RE, '')
    .replace(VIDEO_RE, '')
    .replace(/\b(dessine|génère|genere|crée|cree|fais|moi|une?|le|la|les)\b/gi, '')
    .replace(/[.!?]+$/, '')
    .trim() || 'création libre';
}

/* ---------- Envoi d'un message ---------- */

function handleSend() {
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
    setTimeout(() => {
      const dataUrl = vision.generateImage(subject);
      const caption = `Voici mon image pour « ${subject} » (génération ${vision.stats.generations}).`;
      done();
      renderImageMessage(caption, dataUrl);
      pushMessage({ role: 'ai', kind: 'image', text: caption, dataUrl });
      addToGallery(subject, dataUrl);
    }, 500);
    return;
  }

  if (wantsVideo) {
    brain.learn(text);
    const subject = extractSubject(text);
    vision.generateVideo(subject).then((blobUrl) => {
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

  const delay = 300 + Math.random() * 500;
  setTimeout(() => {
    const answer = brain.reply(text);
    typing.remove();
    streamTextMessage(answer, () => {
      pushMessage({ role: 'ai', kind: 'text', text: answer });
      brain.save();
      updateStats();
      sendBtn.disabled = false;
      inputEl.focus();
    });
  }, delay);
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

async function textTrainingStep() {
  if (trainingBusy) return;
  trainingBusy = true;
  const topic = topicInputEl.value.trim();
  const sources = Trainer.resolveSources(trainSourceEl.value, topic);
  try {
    const before = brain.getStats();
    const { results, errors } = await Trainer.fetchBatch(sources, topic);
    for (const r of results) {
      const b = brain.getStats();
      brain.learn(r.extract, 1, r.title);
      const a = brain.getStats();
      feedEntry(`📖 [${r.sourceLabel}] « ${r.title} » — +${a.sentencesLearned - b.sentencesLearned} phrases, +${a.memories - b.memories} souvenirs.`);
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
  // Consolidation locale à chaque cycle, avec ou sans internet.
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

function mediaTrainingStep() {
  const result = vision.trainStep();
  feedEntry(`🎨 Génération ${result.generation} — ${result.evaluated} images évaluées, score ${(result.score * 100).toFixed(0)} %.`);
  // Un instantané rejoint la galerie régulièrement pour suivre les progrès.
  if (result.generation % 10 === 0) {
    const subject = topicInputEl.value.trim() || 'entraînement libre';
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
    }, MEDIA_TRAIN_INTERVAL_MS);
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
    const labels = sources.map(s => s === 'rss' ? 'Actualités' : s === 'youtube' ? 'YouTube' : Trainer.MEDIAWIKI_SOURCES[s].label).join(', ');
    feedEntry(topic
      ? `🚀 Entraînement lancé sur « ${topic} » — sources : ${labels}.`
      : `🚀 Entraînement lancé sur des sujets aléatoires — sources : ${labels}.`);
    textTrainingStep();
    trainingTimer = setInterval(textTrainingStep, TEXT_TRAIN_INTERVAL_MS);
  } else {
    const label = mode === 'image' ? "la génération d'images" : 'la génération de vidéos';
    feedEntry(`🚀 Entraînement lancé sur ${label}${topic ? ` (thème : « ${topic} »)` : ''}.`);
    startPreview(mode === 'video');
    mediaTrainingStep();
    trainingTimer = setInterval(mediaTrainingStep, MEDIA_TRAIN_INTERVAL_MS);
  }
}

function stopTraining() {
  clearInterval(trainingTimer);
  trainingTimer = null;
  stopPreview();
  setTrainingUI(false);
  feedEntry('⏹ Entraînement arrêté. Le modèle a conservé tout ce qu\'il a appris.');
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
}

/* ---------- Modèle partagé (GitHub) ---------- */

const PUBLISH_EVERY_SENTENCES = 300; // « grande avancée » = 300 phrases apprises
let lastPublishedAt = parseInt(localStorage.getItem('ai-local-last-published') || '0', 10);
let publishing = false;

function setShareStatus(text) {
  shareStatusEl.textContent = text;
}

async function syncSharedModel() {
  try {
    const info = await Shared.syncDown(brain, vision);
    if (info.merged) {
      setShareStatus(`✓ Modèle communautaire fusionné (révision ${info.revision}).`);
      updateStats();
    } else {
      setShareStatus(`✓ À jour avec le modèle communautaire${info.revision ? ` (révision ${info.revision})` : ''}.`);
    }
  } catch (e) {
    setShareStatus('Modèle communautaire inaccessible (hors ligne ?). Nouvel essai au prochain lancement.');
  }
}

async function maybePublishSharedModel() {
  if (publishing || !Shared.getToken()) return;
  const learned = brain.getStats().sentencesLearned;
  if (learned - lastPublishedAt < PUBLISH_EVERY_SENTENCES) return;
  publishing = true;
  try {
    const { revision } = await Shared.publish(brain, vision);
    lastPublishedAt = learned;
    localStorage.setItem('ai-local-last-published', String(learned));
    setShareStatus(`⬆ Grande avancée publiée sur GitHub (révision ${revision}).`);
    feedEntry(`⬆ Grande avancée : modèle publié sur GitHub (révision ${revision}) — sans les conversations.`);
  } catch (e) {
    setShareStatus('Publication impossible : ' + (e.message || e));
  }
  publishing = false;
}

githubTokenEl.value = Shared.getToken();
tokenSaveBtn.addEventListener('click', () => {
  Shared.setToken(githubTokenEl.value);
  setShareStatus(Shared.getToken()
    ? '✓ Jeton enregistré : les grandes avancées seront publiées sur GitHub.'
    : 'Jeton retiré : le modèle est seulement téléchargé, plus publié.');
});

/* ---------- Démarrage ---------- */

loadConversations();
loadGallery();
renderConversationList();
renderMessages();
updateStats();
syncSharedModel();
inputEl.focus();
