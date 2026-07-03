/*
 * Brain — modèle de langage local, léger et auto-apprenant.
 *
 * Le modèle est une chaîne de Markov d'ordre 2 avec repli sur l'ordre 1.
 * Il apprend en continu à partir des messages de la conversation, et quand
 * le mode auto-entraînement est activé, il tourne en boucle :
 *   1. il relit l'historique et renforce les transitions observées,
 *   2. il génère des phrases candidates, les note (probabilité moyenne de
 *      transition) et renforce les meilleures (auto-renforcement),
 *   3. il met à jour ses statistiques et se sauvegarde sur disque
 *      (localStorage, persistant dans le profil de l'application).
 */

const STORAGE_KEY = 'ai-local-brain-v1';

const SEED_CORPUS = [
  "Bonjour, je suis une intelligence artificielle locale qui apprend toute seule.",
  "Plus tu me parles, plus mon vocabulaire grandit et plus mes réponses s'améliorent.",
  "Active le mode auto-entraînement pour que je m'entraîne en continu.",
  "Je fonctionne entièrement sur ta machine, sans connexion internet.",
  "Chaque message que tu m'envoies enrichit mon modèle de langage.",
  "L'apprentissage automatique consiste à découvrir des motifs dans les données.",
  "Une intelligence artificielle apprend en observant des exemples et en renforçant ce qui fonctionne.",
  "Je peux générer des phrases nouvelles en combinant ce que j'ai appris.",
  "Le renforcement augmente la probabilité des séquences de mots qui semblent cohérentes.",
  "Mon cerveau est une chaîne de Markov qui prédit le mot suivant à partir des mots précédents.",
  "N'hésite pas à me raconter des choses, je retiens tout ce que tu écris.",
  "Avec le temps, mes réponses ressemblent de plus en plus à ta façon d'écrire."
];

const FALLBACKS = [
  "Je suis encore en train d'apprendre… continue de me parler pour m'entraîner !",
  "Mon vocabulaire est encore petit. Active l'auto-entraînement pour m'aider à progresser.",
  "Intéressant ! Dis-m'en plus, chaque phrase m'aide à apprendre.",
  "Je note tout ce que tu écris pour améliorer mes prochaines réponses."
];

class Brain {
  constructor() {
    // bigrams["mot1 mot2"] = { motSuivant: poids, ... }
    // unigrams["mot"] = { motSuivant: poids, ... }
    this.bigrams = {};
    this.unigrams = {};
    this.starts = {}; // premiers couples de mots des phrases
    this.vocab = new Set();
    // Mémoire à long terme : faits retenus (phrases complètes) avec leur source,
    // consultés par recherche de mots-clés pour répondre aux questions.
    this.memory = [];
    this.stats = {
      epochs: 0,          // cycles d'auto-entraînement effectués
      sentencesLearned: 0,
      selfReinforced: 0,  // phrases auto-générées puis renforcées
      confidence: 0       // score moyen des dernières générations (0..1)
    };
    this.trainingLog = [];
  }

  // ---------- Apprentissage ----------

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[«»"“”]/g, ' ')
      .replace(/([.!?,;:])/g, ' $1 ')
      .split(/\s+/)
      .filter(Boolean);
  }

  learn(text, weight = 1, source = null) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      const tokens = this.tokenize(sentence);
      if (tokens.length < 2) continue;

      const startKey = tokens.length >= 2 ? tokens[0] + ' ' + tokens[1] : tokens[0];
      this.starts[startKey] = (this.starts[startKey] || 0) + weight;

      for (let i = 0; i < tokens.length; i++) {
        this.vocab.add(tokens[i]);
        if (i + 1 < tokens.length) {
          this.bump(this.unigrams, tokens[i], tokens[i + 1], weight);
        }
        if (i + 2 < tokens.length) {
          this.bump(this.bigrams, tokens[i] + ' ' + tokens[i + 1], tokens[i + 2], weight);
        }
      }
      this.stats.sentencesLearned += 1;

      if (source) this.remember(sentence, source);
    }
  }

  bump(table, key, next, weight) {
    if (!table[key]) table[key] = {};
    table[key][next] = (table[key][next] || 0) + weight;
  }

  // ---------- Mémoire à long terme ----------

  static STOPWORDS = new Set(('le la les un une des du de d l et ou où mais donc or ni car que qui quoi dont est sont était a ont ce cette ces se sa son ses ne pas plus très en dans sur pour par avec sans sous vers chez il elle ils elles on nous vous je tu au aux y été être avoir fait comme aussi tout tous toute toutes leur leurs autre autres même').split(' '));

  keywords(text) {
    return this.tokenize(text).filter(t =>
      t.length >= 3 && !/[.!?,;:]/.test(t) && !Brain.STOPWORDS.has(t)
    );
  }

  remember(sentence, source) {
    const clean = sentence.trim().replace(/\s+/g, ' ');
    if (clean.length < 40 || clean.length > 320) return;
    if (this.memory.some(m => m.text === clean)) return;
    this.memory.push({ text: clean, source });
    if (this.memory.length > 800) this.memory.shift();
  }

  /** Retrouve les faits les plus pertinents pour une requête (mots-clés partagés). */
  recall(query, minScore = 2) {
    const qk = new Set(this.keywords(query));
    if (!qk.size) return null;
    let best = null;
    let bestScore = 0;
    for (const m of this.memory) {
      let score = 0;
      for (const k of this.keywords(m.text)) {
        if (qk.has(k)) score += Math.min(3, Math.max(1, k.length - 3));
      }
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return bestScore >= minScore ? best : null;
  }

  // ---------- Génération ----------

  weightedPick(counts) {
    let total = 0;
    for (const k in counts) total += counts[k];
    let r = Math.random() * total;
    for (const k in counts) {
      r -= counts[k];
      if (r <= 0) return k;
    }
    return null;
  }

  pickStart(seedTokens) {
    // Essaie de démarrer depuis un mot du message utilisateur.
    if (seedTokens && seedTokens.length) {
      const candidates = Object.keys(this.starts).filter(k => {
        const [w1] = k.split(' ');
        return seedTokens.includes(w1);
      });
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)].split(' ');
      }
      // Sinon, un bigramme quelconque contenant un mot du message.
      const biKeys = Object.keys(this.bigrams).filter(k =>
        k.split(' ').some(w => seedTokens.includes(w))
      );
      if (biKeys.length) {
        return biKeys[Math.floor(Math.random() * biKeys.length)].split(' ');
      }
    }
    const startKeys = Object.keys(this.starts);
    if (!startKeys.length) return null;
    return this.weightedPick(this.starts).split(' ');
  }

  generate(seedText = '', maxWords = 30) {
    const seedTokens = seedText ? this.tokenize(seedText).filter(t => !/[.!?,;:]/.test(t)) : [];
    const start = this.pickStart(seedTokens);
    if (!start) return null;

    const words = [...start];
    let logProbSum = 0;
    let steps = 0;

    while (words.length < maxWords) {
      const biKey = words[words.length - 2] + ' ' + words[words.length - 1];
      let table = this.bigrams[biKey];
      if (!table || Object.keys(table).length === 0) {
        table = this.unigrams[words[words.length - 1]];
      }
      if (!table || Object.keys(table).length === 0) break;

      const next = this.weightedPick(table);
      if (!next) break;

      let total = 0;
      for (const k in table) total += table[k];
      logProbSum += Math.log(table[next] / total);
      steps += 1;

      words.push(next);
      if (/[.!?]/.test(next) && words.length > 6) break;
    }

    const score = steps > 0 ? Math.exp(logProbSum / steps) : 0;
    return { text: this.detokenize(words), score, length: words.length };
  }

  detokenize(tokens) {
    let out = '';
    for (const t of tokens) {
      if (/^[.!?,;:]$/.test(t)) out += t;
      else out += (out ? ' ' : '') + t;
    }
    out = out.charAt(0).toUpperCase() + out.slice(1);
    if (!/[.!?]$/.test(out)) out += '.';
    return out;
  }

  isQuestion(text) {
    return text.includes('?') ||
      /^(qui|que|quoi|comment|pourquoi|quand|combien|qu'est|qu’est|est-ce|c'est quoi|c’est quoi|parle-moi|raconte|explique|dis-moi)/i.test(text.trim());
  }

  // ---------- Petites conversations (salutations, politesse) ----------

  smalltalk(text) {
    const t = text.trim().toLowerCase();
    const stats = this.getStats();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (/(ça va|ca va|cava|tu vas bien|comment vas|comment tu vas|la forme)/i.test(t)) {
      return pick([
        `Ça va très bien, merci ! Mon vocabulaire vient de passer à ${stats.vocabSize} mots. Et toi, ça va ?`,
        `En pleine forme : ${stats.memories} souvenirs en tête et toujours envie d'apprendre. Et toi ?`,
        `Super bien ! Je viens de réviser mes ${stats.sentencesLearned} phrases apprises. Et de ton côté ?`,
        `Ça va ! J'attends qu'on lance un entraînement pour muscler mon cerveau. Tu vas bien, toi ?`
      ]);
    }
    if (/^(salut|hey|hello|coucou|bonjour|bonsoir|yo|slt|wesh|re)\b/i.test(t) && t.length < 30) {
      return pick([
        'Salut ! Content de te voir. De quoi on parle aujourd\'hui ?',
        'Hey ! Prêt à discuter — ou à m\'entraîner sur un nouveau sujet ?',
        'Bonjour ! Pose-moi une question, ou apprends-moi quelque chose.',
        'Coucou ! Tu veux discuter, me faire dessiner, ou m\'envoyer étudier ?'
      ]);
    }
    if (/\bmerci\b/i.test(t) && t.length < 40) {
      return pick([
        'Avec plaisir !',
        'De rien ! C\'est en discutant que j\'apprends.',
        'Pas de quoi — reviens quand tu veux.'
      ]);
    }
    if (/(au revoir|à plus|a plus|bye|bonne nuit|à demain|a demain|ciao)/i.test(t) && t.length < 40) {
      return pick([
        'À bientôt ! Je continue de réviser en t\'attendant.',
        'Au revoir ! Pense à me lancer un entraînement de temps en temps.',
        'Bonne journée ! Mes souvenirs t\'attendront.'
      ]);
    }
    if (/(qui es[- ]tu|tu es qui|t'es qui|t’es qui|comment tu t'appelles|comment tu t’appelles|ton nom)/i.test(t)) {
      return `Je suis AI Local, une IA qui vit entièrement sur ta machine et qui apprend toute seule. J'ai déjà ${stats.vocabSize} mots de vocabulaire et ${stats.memories} souvenirs — et je progresse à chaque conversation.`;
    }
    return null;
  }

  /** Forme normalisée pour comparer une réponse au message de l'utilisateur. */
  normalized(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  reply(userText) {
    // Salutations et politesse : réponses dédiées, pas de génération.
    const small = this.smalltalk(userText);
    if (small) {
      this.learn(userText, 0.5);
      return small;
    }

    // Les affirmations de l'utilisateur sont mémorisées comme des faits.
    this.learn(userText, 1, this.isQuestion(userText) ? null : 'toi');

    // Pour une question, on consulte d'abord la mémoire à long terme.
    if (this.isQuestion(userText)) {
      const fact = this.recall(userText, 3);
      if (fact) {
        const intro = fact.source === 'toi'
          ? 'Tu m\'avais dit : '
          : `D'après ce que j'ai appris sur « ${fact.source} » : `;
        return intro + fact.text;
      }
    }

    // Génération, en refusant les réponses qui répètent le message reçu.
    // Pour une question, la réponse doit au moins partager un mot-clé avec
    // elle — sinon mieux vaut admettre qu'on ne sait pas.
    const userNorm = this.normalized(userText);
    const isQ = this.isQuestion(userText);
    const qk = new Set(this.keywords(userText));
    for (let attempt = 0; attempt < 8; attempt++) {
      const gen = this.generate(userText);
      if (!gen || gen.length < 4) continue;
      const genNorm = this.normalized(gen.text);
      if (genNorm === userNorm || genNorm.startsWith(userNorm) || userNorm.startsWith(genNorm)) continue;
      if (isQ && qk.size && !this.keywords(gen.text).some(k => qk.has(k))) continue;
      return gen.text;
    }

    if (this.isQuestion(userText)) {
      const q = [
        'Bonne question… je ne connais pas encore la réponse. Lance un entraînement sur ce sujet dans l\'onglet S\'entraîner et repose-la-moi !',
        'Je n\'ai pas encore de souvenir là-dessus. Fais-moi étudier ce sujet et je saurai te répondre.',
        'Hmm, ce sujet ne me dit rien pour l\'instant — entraîne-moi dessus et on en reparle !'
      ];
      return q[Math.floor(Math.random() * q.length)];
    }
    return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
  }

  // ---------- Auto-entraînement ----------

  /**
   * Un cycle d'auto-entraînement :
   *  - réapprend l'historique de conversation (consolidation),
   *  - génère des phrases candidates et renforce les meilleures.
   * Retourne un résumé du cycle pour l'affichage.
   */
  selfTrainStep(historyTexts = []) {
    // 1. Consolidation : relecture de l'historique avec un poids faible.
    for (const text of historyTexts) {
      this.learn(text, 0.25);
    }

    // 2. Auto-génération + renforcement des meilleures phrases.
    const candidates = [];
    for (let i = 0; i < 6; i++) {
      const gen = this.generate('', 24);
      if (gen && gen.length >= 4) candidates.push(gen);
    }
    candidates.sort((a, b) => b.score - a.score);

    let reinforced = 0;
    let scoreSum = 0;
    for (const c of candidates) scoreSum += c.score;
    const keep = candidates.slice(0, Math.ceil(candidates.length / 3));
    for (const c of keep) {
      this.learn(c.text, 0.5); // renforcement des séquences jugées cohérentes
      reinforced += 1;
    }

    this.stats.epochs += 1;
    this.stats.selfReinforced += reinforced;
    if (candidates.length) {
      const avg = scoreSum / candidates.length;
      // moyenne glissante pour lisser l'indicateur de confiance
      this.stats.confidence = this.stats.confidence * 0.8 + avg * 0.2;
    }

    const summary = {
      epoch: this.stats.epochs,
      generated: candidates.length,
      reinforced,
      best: keep.length ? keep[0].text : null,
      confidence: this.stats.confidence
    };
    this.trainingLog.unshift(summary);
    if (this.trainingLog.length > 50) this.trainingLog.pop();
    return summary;
  }

  // ---------- Modèle partagé (GitHub) ----------

  /** Exporte le modèle pour le partage — sans aucune conversation. */
  exportShared() {
    return {
      bigrams: this.bigrams,
      unigrams: this.unigrams,
      starts: this.starts,
      vocab: [...this.vocab],
      memory: this.memory.filter(m => m.source !== 'toi'), // vie privée : pas de faits personnels
      stats: this.stats
    };
  }

  /** Fusionne un modèle partagé dans le modèle local (union des connaissances). */
  mergeShared(data) {
    const mergeTable = (local, incoming) => {
      for (const key in incoming) {
        for (const next in incoming[key]) {
          this.bump(local, key, next, incoming[key][next]);
        }
      }
    };
    mergeTable(this.bigrams, data.bigrams || {});
    mergeTable(this.unigrams, data.unigrams || {});
    for (const key in (data.starts || {})) {
      this.starts[key] = (this.starts[key] || 0) + data.starts[key];
    }
    for (const w of (data.vocab || [])) this.vocab.add(w);

    const known = new Set(this.memory.map(m => m.text));
    for (const m of (data.memory || [])) {
      if (m && m.text && !known.has(m.text) && m.source !== 'toi') {
        this.memory.push({ text: m.text, source: m.source });
        known.add(m.text);
      }
    }
    while (this.memory.length > 800) this.memory.shift();

    const s = data.stats || {};
    this.stats.epochs = Math.max(this.stats.epochs, s.epochs || 0);
    this.stats.sentencesLearned = Math.max(this.stats.sentencesLearned, s.sentencesLearned || 0);
    this.stats.selfReinforced = Math.max(this.stats.selfReinforced, s.selfReinforced || 0);
    this.stats.confidence = Math.max(this.stats.confidence, s.confidence || 0);
  }

  // ---------- Statistiques & persistance ----------

  getStats() {
    let transitions = 0;
    for (const k in this.bigrams) transitions += Object.keys(this.bigrams[k]).length;
    return {
      ...this.stats,
      vocabSize: this.vocab.size,
      transitions,
      memories: this.memory.length
    };
  }

  save() {
    try {
      const data = {
        bigrams: this.bigrams,
        unigrams: this.unigrams,
        starts: this.starts,
        vocab: [...this.vocab],
        memory: this.memory,
        stats: this.stats
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Sauvegarde du modèle impossible :', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.bigrams = data.bigrams || {};
      this.unigrams = data.unigrams || {};
      this.starts = data.starts || {};
      this.vocab = new Set(data.vocab || []);
      this.memory = data.memory || [];
      this.stats = Object.assign(this.stats, data.stats || {});
      return true;
    } catch (e) {
      console.warn('Chargement du modèle impossible :', e);
      return false;
    }
  }

  bootstrap() {
    for (const line of SEED_CORPUS) this.learn(line);
  }
}

window.Brain = Brain;
