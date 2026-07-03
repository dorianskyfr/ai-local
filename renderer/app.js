/* Logique de l'interface : onglets, chat multimodal et centre d'entraînement. */

const TEXT_TRAIN_INTERVAL_MS = 5000;
const MEDIA_TRAIN_INTERVAL_MS = 1500;

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
const tabTrainingDot = document.getElementById('tab-training-dot');
const viewChat = document.getElementById('view-chat');
const viewTraining = document.getElementById('view-training');

const messagesEl = document.getElementById('messages');
const composerEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');

const trainModeEl = document.getElementById('train-mode');
const topicInputEl = document.getElementById('topic-input');
const trainStartBtn = document.getElementById('train-start');
const trainStartLabel = trainStartBtn.querySelector('.train-start-label');
const trainFeedEl = document.getElementById('train-feed');
const previewWrap = document.getElementById('preview-wrap');
const previewCanvas = document.getElementById('train-preview');

let history = [];       // { role: 'user' | 'ai', text }

/* ---------- Onglets ---------- */

function showTab(name) {
  const chat = name === 'chat';
  tabChat.classList.toggle('active', chat);
  tabTraining.classList.toggle('active', !chat);
  viewChat.hidden = !chat;
  viewTraining.hidden = chat;
  if (chat) inputEl.focus();
}

tabChat.addEventListener('click', () => showTab('chat'));
tabTraining.addEventListener('click', () => showTab('training'));

/* ---------- Affichage des messages ---------- */

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

function addMessage(role, text) {
  makeMessage(role).textContent = text;
}

function addImageMessage(text, dataUrl) {
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

function addVideoMessage(text, blobUrl) {
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
  addMessage('user', text);
  history.push({ role: 'user', text });

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
      done();
      addImageMessage(`Voici mon image pour « ${subject} » (génération ${vision.stats.generations}).`, dataUrl);
      history.push({ role: 'ai', text: `[image : ${subject}]` });
    }, 500);
    return;
  }

  if (wantsVideo) {
    brain.learn(text);
    const subject = extractSubject(text);
    vision.generateVideo(subject).then((blobUrl) => {
      done();
      addVideoMessage(`Voici ma vidéo pour « ${subject} ».`, blobUrl);
      history.push({ role: 'ai', text: `[vidéo : ${subject}]` });
    }).catch(() => {
      done();
      addMessage('ai', "Je n'ai pas réussi à générer la vidéo cette fois-ci. Réessaie !");
    });
    return;
  }

  const delay = 400 + Math.random() * 600;
  setTimeout(() => {
    const answer = brain.reply(text);
    done();
    addMessage('ai', answer);
    history.push({ role: 'ai', text: answer });
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

/* ---------- Nouvelle conversation ---------- */

newChatBtn.addEventListener('click', () => {
  history = [];
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">✳</div>
      <h1>Nouvelle conversation</h1>
      <p>Le modèle garde tout ce qu'il a appris. Continue de lui parler,
      ou passe par l'onglet <strong>S'entraîner</strong>.</p>
    </div>`;
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
}

async function textTrainingStep() {
  if (trainingBusy) return;
  trainingBusy = true;
  const topic = topicInputEl.value.trim();
  const before = brain.getStats();
  try {
    const article = topic
      ? await Trainer.fetchArticleOnTopic(topic)
      : await Trainer.fetchRandomArticle();
    if (article) {
      brain.learn(article.extract);
      const after = brain.getStats();
      feedEntry(`📖 « ${article.title} » étudié — +${after.sentencesLearned - before.sentencesLearned} phrases, vocabulaire : ${after.vocabSize} mots.`);
    } else {
      feedEntry(topic
        ? `🔍 Rien trouvé sur « ${topic} », nouvel essai au prochain cycle…`
        : '🔍 Article vide, nouvel essai au prochain cycle…');
    }
  } catch (e) {
    feedEntry('⚠ Internet inaccessible — je m\'auto-entraîne en local en attendant.', 'warn');
  }
  // Consolidation locale à chaque cycle, avec ou sans internet.
  const summary = brain.selfTrainStep(history.slice(-10).map(m => m.text));
  if (summary.best) {
    feedEntry(`🧠 Cycle ${summary.epoch} — ${summary.reinforced} phrases auto-renforcées.`);
  }
  brain.save();
  updateStats();
  trainingBusy = false;
}

function mediaTrainingStep() {
  const result = vision.trainStep();
  feedEntry(`🎨 Génération ${result.generation} — ${result.evaluated} images évaluées, score ${(result.score * 100).toFixed(0)} %.`);
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
    feedEntry(topic
      ? `🚀 Entraînement lancé sur le sujet « ${topic} » (via Wikipédia).`
      : '🚀 Entraînement lancé sur des sujets aléatoires (via Wikipédia).');
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
  document.getElementById('stat-transitions').textContent = s.transitions;
  document.getElementById('stat-sentences').textContent = s.sentencesLearned;
  document.getElementById('stat-reinforced').textContent = s.selfReinforced;
  document.getElementById('stat-generations').textContent = vision.stats.generations;
  document.getElementById('confidence-fill').style.width =
    Math.min(100, Math.round(s.confidence * 100)) + '%';
}

updateStats();
inputEl.focus();
