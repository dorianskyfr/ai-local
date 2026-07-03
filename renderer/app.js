/* Logique de l'interface : chat + pilotage du mode auto-entraînement. */

const TRAIN_INTERVAL_MS = 3000;

const brain = new Brain();
if (!brain.load()) {
  brain.bootstrap();
  brain.save();
}

const messagesEl = document.getElementById('messages');
const composerEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const trainToggle = document.getElementById('train-toggle');
const trainLabel = trainToggle.querySelector('.train-label');
const trainingLogEl = document.getElementById('training-log');
const resetBtn = document.getElementById('reset-brain-btn');

let history = [];       // { role: 'user' | 'ai', text }
let trainingTimer = null;

/* ---------- Affichage des messages ---------- */

function clearWelcome() {
  const welcome = messagesEl.querySelector('.welcome');
  if (welcome) welcome.remove();
}

function addMessage(role, text) {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'Toi' : 'IA';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  wrap.append(avatar, bubble);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
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

  // Petit délai pour un rendu naturel de la réponse.
  const delay = 400 + Math.random() * 600;
  setTimeout(() => {
    const answer = brain.reply(text);
    typing.remove();
    addMessage('ai', answer);
    history.push({ role: 'ai', text: answer });
    brain.save();
    updateStats();
    sendBtn.disabled = false;
    inputEl.focus();
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
      <p>Le modèle garde tout ce qu'il a appris. Continue de lui parler
      ou active le <strong>mode auto-entraînement</strong>.</p>
    </div>`;
  inputEl.focus();
});

/* ---------- Mode auto-entraînement ---------- */

function setTraining(active) {
  if (active && !trainingTimer) {
    trainToggle.classList.add('active');
    trainToggle.setAttribute('aria-pressed', 'true');
    trainLabel.textContent = 'Entraînement en cours…';
    trainingTimer = setInterval(runTrainingStep, TRAIN_INTERVAL_MS);
    runTrainingStep();
  } else if (!active && trainingTimer) {
    clearInterval(trainingTimer);
    trainingTimer = null;
    trainToggle.classList.remove('active');
    trainToggle.setAttribute('aria-pressed', 'false');
    trainLabel.textContent = "Activer l'entraînement";
  }
}

trainToggle.addEventListener('click', () => setTraining(!trainingTimer));

function runTrainingStep() {
  const recentTexts = history.slice(-10).map(m => m.text);
  const summary = brain.selfTrainStep(recentTexts);
  brain.save();
  updateStats();
  logTraining(summary);
}

function logTraining(summary) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const best = summary.best
    ? `« ${summary.best.length > 70 ? summary.best.slice(0, 70) + '…' : summary.best} »`
    : 'aucune phrase retenue';
  entry.textContent = `Cycle ${summary.epoch} — ${summary.generated} générées, ${summary.reinforced} renforcées. ${best}`;
  trainingLogEl.prepend(entry);
  while (trainingLogEl.children.length > 20) {
    trainingLogEl.lastChild.remove();
  }
}

/* ---------- Statistiques ---------- */

function updateStats() {
  const s = brain.getStats();
  document.getElementById('stat-epochs').textContent = s.epochs;
  document.getElementById('stat-vocab').textContent = s.vocabSize;
  document.getElementById('stat-transitions').textContent = s.transitions;
  document.getElementById('stat-sentences').textContent = s.sentencesLearned;
  document.getElementById('stat-reinforced').textContent = s.selfReinforced;
  document.getElementById('confidence-fill').style.width =
    Math.min(100, Math.round(s.confidence * 100)) + '%';
}

/* ---------- Réinitialisation ---------- */

resetBtn.addEventListener('click', () => {
  if (!confirm('Effacer tout ce que le modèle a appris ?')) return;
  setTraining(false);
  brain.reset();
  trainingLogEl.innerHTML = '';
  updateStats();
});

updateStats();
inputEl.focus();
