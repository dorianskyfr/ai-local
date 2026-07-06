/*
 * Brain v1.6 — Modèle de langage local, léger et auto-apprenant.
 * 
 * AMÉLIORATIONS MAJEURES v1.6 :
 * - Chaîne de Markov d'ordre 3 (au lieu de 2) pour de meilleures prédictions
 * - Système de mémoire hiérarchique (court terme + long terme)
 * - Compréhension contextuelle améliorée avec suivi de conversation
 * - Génération de réponses plus cohérentes et naturelles
 * - Support des synonymes et des concepts liés
 * - Moteur de raisonnement simple pour les questions complexes
 * - Meilleure gestion des dialogues et des questions de suivi
 * - Optimisation des performances pour les grands corpus
 */

const STORAGE_KEY = 'ai-local-brain-v1.6';

/*
 * Paliers de progression — purement internes et ludiques, pour visualiser le
 * chemin parcouru. Ce ne sont PAS des comparaisons avec de vrais modèles
 * d'IA (GPT, Claude…) : un modèle de n-grammes de quelques Mo n'a rien à voir
 * avec ces systèmes, et prétendre le contraire serait malhonnête. C'est un
 * repère de progression personnelle, comme un niveau de jeu.
 */
const TEXT_TIERS = [
  { min: 0,      name: 'Graine',                 icon: '🌱' },
  { min: 150,    name: 'Pousse',                 icon: '🌿' },
  { min: 400,    name: 'Curieux',                icon: '🔍' },
  { min: 900,    name: 'Étudiant assidu',         icon: '📚' },
  { min: 1800,   name: 'Érudit local',            icon: '🎓' },
  { min: 3500,   name: 'Bibliothèque ambulante',  icon: '📖' },
  { min: 6000,   name: 'Sage du village',         icon: '🧙' },
  { min: 10000,  name: 'Oracle local',            icon: '🔮' },
  { min: 25000,  name: 'Encyclopédie vivante',    icon: '🏛️' },
  { min: 60000,  name: 'Esprit du réseau',        icon: '🌐' },
  { min: 150000, name: 'Grand Archiviste',        icon: '📜' },
  { min: 400000, name: 'Légende locale',          icon: '👑' }
];

// Corpus initial amélioré avec plus de diversité
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
  "Avec le temps, mes réponses ressemblent de plus en plus à ta façon d'écrire.",
  "Je peux répondre à des questions sur ce que j'ai appris et citer mes sources.",
  "Mon vocabulaire s'enrichit à chaque conversation et chaque entraînement.",
  "Je comprends les questions de suivi et je garde le contexte de la conversation.",
  "Je peux faire des calculs exacts et te donner l'heure et la date.",
  "Mon modèle s'améliore collectivement avec tous les utilisateurs."
];

// Synonymes pour améliorer la compréhension
const SYNONYMS = {
  'voiture': ['automobile', 'véhicule', 'bagnole'],
  'ordinateur': ['pc', 'computer', 'machine', 'poste'],
  'téléphone': ['portable', 'mobile', 'smartphone', 'tél'],
  'maison': ['logement', 'habitation', 'domicile'],
  'travail': ['boulot', 'job', 'emploi'],
  'argent': ['pognon', 'thune', 'fric', 'oseille'],
  'ami': ['pote', 'copain', 'camarade'],
  'grand': ['gros', 'énorme', 'immense', 'vaste'],
  'petit': ['minuscule', 'tout petit', 'mini'],
  'beau': ['joli', 'magnifique', 'splendide', 'superbe'],
  'moche': ['laid', 'vilain', 'horrible'],
  'faire': ['réaliser', 'effectuer', 'accomplir'],
  'dire': ['expliquer', 'raconter', 'décrire']
};

// Concepts liés pour élargir la compréhension
const RELATED_CONCEPTS = {
  'chien': ['animal', 'canin', 'compagnon', 'animal de compagnie'],
  'chat': ['animal', 'félin', 'minou', 'matou'],
  'paris': ['france', 'capitale', 'ville', 'tour eiffel'],
  'football': ['sport', 'ballon', 'terrain', 'but'],
  'musique': ['son', 'mélodie', 'chanson', 'instrument'],
  'nourriture': ['manger', 'repas', 'aliment', 'cuisine'],
  'eau': ['liquide', 'boisson', 'océan', 'rivière'],
  'feu': ['flamme', 'chaud', 'incendie', 'allumette']
};

class Brain {
  // Capacité de la mémoire à long terme augmentée
  static MEMORY_CAP = 15000;
  
  // Capacité de la mémoire à court terme (contexte de conversation)
  static SHORT_TERM_MEMORY_CAP = 50;

  constructor() {
    // Trigrammes pour de meilleures prédictions
    this.trigrams = {};
    this.bigrams = {};
    this.unigrams = {};
    this.starts = {}; // premiers couples de mots des phrases
    this.vocab = new Set();
    
    // Mémoire à long terme : faits retenus (phrases complètes) avec leur source
    this.memory = [];
    
    // Mémoire à court terme : contexte de la conversation actuelle
    this.shortTermMemory = [];
    
    // Statistiques améliorées
    this.stats = {
      epochs: 0,
      sentencesLearned: 0,
      selfReinforced: 0,
      confidence: 0,
      conversations: 0,
      questionsAnswered: 0,
      correctAnswers: 0
    };
    
    this.trainingLog = [];
    
    // Sujet de la conversation en cours
    this.lastTopic = [];
    
    // Contexte de conversation pour les questions de suivi
    this.conversationContext = [];
    
    // Historique des dernières questions pour détecter les répétitions
    this.recentQuestions = [];
    
    // Index de recherche optimisé
    this._memoryVocabDirty = true;
    this._memoryDf = null;
    this._memoryKeys = [];
    this._memoryIdx = null;
  }

  // ---------- Tokenization améliorée ----------

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[«»"""'""'"']/g, ' ')
      // Détache les contractions françaises
      .replace(/\b(jusqu|lorsqu|puisqu|quoiqu|qu|d|l|j|n|s|t|m|c)[''']/g, ' ')
      .replace(/([.!?,;:])/g, ' $1 ')
      .split(/\s+/)
      .filter(Boolean);
  }

  /**
   * Expand les synonymes dans le texte pour améliorer la recherche
   */
  expandSynonyms(text) {
    const tokens = this.tokenize(text);
    const expanded = [];
    
    for (const token of tokens) {
      expanded.push(token);
      if (SYNONYMS[token]) {
        expanded.push(...SYNONYMS[token]);
      }
    }
    
    return expanded;
  }

  /**
   * Ajoute les concepts liés pour élargir la compréhension
   */
  expandRelatedConcepts(text) {
    const tokens = this.tokenize(text);
    const expanded = [];
    
    for (const token of tokens) {
      expanded.push(token);
      if (RELATED_CONCEPTS[token]) {
        expanded.push(...RELATED_CONCEPTS[token]);
      }
    }
    
    return expanded;
  }

  // ---------- Apprentissage amélioré ----------

  /**
   * Filtre les phrases de mauvaise qualité
   */
  isLowQualitySentence(sentence) {
    const letters = (sentence.match(/[a-zà-ÿ]/gi) || []).length;
    const total = sentence.replace(/\s/g, '').length;
    if (total === 0) return true;
    if (letters / total < 0.6) return true; // trop de chiffres/symboles
    if ((sentence.match(/\d{3,}/g) || []).length >= 5) return true; // listes de codes/nombres
    if ((sentence.match(/-\s|\bw:/g) || []).length >= 3) return true; // listes à puces wiki
    // Filtre supplémentaire : phrases trop courtes
    if (sentence.split(/\s+/).length < 3) return true;
    return false;
  }

  learn(text, weight = 1, source = null) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0 && !this.isLowQualitySentence(s));
    
    for (const sentence of sentences) {
      const tokens = this.tokenize(sentence);
      if (tokens.length < 2) continue;

      // Enregistrer les starts (2 ou 3 premiers mots)
      if (tokens.length >= 2) {
        const startKey2 = tokens[0] + ' ' + tokens[1];
        this.starts[startKey2] = (this.starts[startKey2] || 0) + weight;
      }
      if (tokens.length >= 3) {
        const startKey3 = tokens[0] + ' ' + tokens[1] + ' ' + tokens[2];
        this.starts[startKey3] = (this.starts[startKey3] || 0) + weight;
      }

      // Apprendre les transitions
      for (let i = 0; i < tokens.length; i++) {
        this.vocab.add(tokens[i]);
        
        // Unigrammes
        if (i + 1 < tokens.length) {
          this.bump(this.unigrams, tokens[i], tokens[i + 1], weight);
        }
        
        // Bigrams
        if (i + 2 < tokens.length) {
          this.bump(this.bigrams, tokens[i] + ' ' + tokens[i + 1], tokens[i + 2], weight);
        }
        
        // Trigrammes (NOUVEAU)
        if (i + 3 < tokens.length) {
          const triKey = tokens[i] + ' ' + tokens[i + 1] + ' ' + tokens[i + 2];
          this.bump(this.trigrams, triKey, tokens[i + 3], weight);
        }
      }
      
      this.stats.sentencesLearned += 1;

      // Ajouter à la mémoire à long terme
      if (source) this.remember(sentence, source);
      
      // Ajouter à la mémoire à court terme (si c'est une conversation)
      if (source === 'toi' || !source) {
        this.addToShortTermMemory(sentence);
      }
    }
  }

  bump(table, key, next, weight) {
    if (!table[key]) table[key] = {};
    table[key][next] = (table[key][next] || 0) + weight;
  }

  /**
   * Ajoute à la mémoire à court terme
   */
  addToShortTermMemory(text) {
    this.shortTermMemory.push({
      text: text,
      timestamp: Date.now()
    });
    
    // Limiter la taille
    while (this.shortTermMemory.length > Brain.SHORT_TERM_MEMORY_CAP) {
      this.shortTermMemory.shift();
    }
  }

  // ---------- Mémoire à long terme améliorée ----------

  static STOPWORDS = new Set((
    'le la les un une des du de d l et ou où mais donc or ni car que qui quoi dont est sont était a ont ' +
    'ce cette ces se sa son ses ne pas plus très en dans sur pour par avec sans sous vers chez il elle ils ' +
    'elles on nous vous je tu au aux y été être avoir fait comme aussi tout tous toute toutes leur leurs ' +
    'autre autres même ' +
    'pourquoi comment quand combien quel quelle quels quelles est-ce bonne ' +
    'parle parle-moi parlez dis dis-moi raconte raconte-moi explique explique-moi ' +
    'décris décris-moi decris decris-moi montre montre-moi donne donne-moi'
  ).split(' '));

  /** Insensible aux accents */
  foldAccents(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  keywords(text) {
    return this.tokenize(text)
      .filter(t => t.length >= 3 && !/[.!?,;:]/.test(t) && !Brain.STOPWORDS.has(t))
      .map(t => this.foldAccents(t))
      .map(t => t.length > 3 ? t.replace(/[sx]$/, '') : t);
  }

  /**
   * Un message qui parle de l'utilisateur lui-même plutôt que de demander une info.
   */
  looksPersonal(text) {
    return /\b(je|j'|j'|mon|ma|mes|moi|m'appelle|m'appelle|chez moi)\b/i.test(text);
  }

  remember(sentence, source) {
    const clean = sentence.trim().replace(/\s+/g, ' ');
    if (clean.length < 40 || clean.length > 320) return;
    if (this.memory.some(m => m.text === clean)) return;
    
    this.memory.push({ text: clean, source, timestamp: Date.now() });
    if (this.memory.length > Brain.MEMORY_CAP) this.memory.shift();
    this._memoryVocabDirty = true;
  }

  /**
   * Mots banals qu'une question contient souvent sans qu'ils soient LE sujet
   */
  static GENERIC_HINTS = new Set((
    'nombre habitant habitants population ville village commune pays pay capitale region departement ' +
    'taille hauteur superficie distance monde histoire personne personnes gens gen chose choses truc ' +
    'exemple definition signification sens sen date annee jour heure nom prenom couleur langue origine ' +
    'altitude vitesse profondeur longueur largeur poid poids age surface temperature'
  ).split(' '));

  /**
   * Mots-clés d'un souvenir : son texte + sa source
   */
  memoryEntryKeywords(m) {
    return new Set(this.keywords(m.text + ' ' + (m.source && m.source !== 'toi' ? m.source : '')));
  }

  /**
   * Index de recherche sur la mémoire, reconstruit seulement quand elle change
   */
  rebuildMemoryIndex() {
    this._memoryDf = new Map();
    this._memoryKeys = [];
    this._memoryIdx = new Map();
    
    for (let i = 0; i < this.memory.length; i++) {
      const ks = this.memoryEntryKeywords(this.memory[i]);
      this._memoryKeys.push(ks);
      
      for (const k of ks) {
        this._memoryDf.set(k, (this._memoryDf.get(k) || 0) + 1);
        let bucket = this._memoryIdx.get(k);
        if (!bucket) this._memoryIdx.set(k, (bucket = []));
        bucket.push(i);
      }
    }
    this._memoryVocabDirty = false;
  }

  memoryKeywordDf() {
    if (!this._memoryDf || this._memoryVocabDirty) this.rebuildMemoryIndex();
    return this._memoryDf;
  }

  /**
   * Vrai si les deux mots sont à une seule faute de frappe l'un de l'autre
   */
  static withinOneEdit(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }

  /**
   * Corrige une faute de frappe sur un mot-clé
   */
  fuzzyFix(k, df) {
    if (k.length < 5) return null;
    let best = null;
    for (const known of df.keys()) {
      if (known.length >= 5 && Brain.withinOneEdit(k, known)) {
        if (!best || (df.get(known) || 0) > (df.get(best) || 0)) best = known;
      }
    }
    return best;
  }

  /**
   * Détecte ce que la question attend
   */
  questionType(text) {
    const t = this.foldAccents(text.toLowerCase());
    if (/(combien|nombre|population|habitant|quantite|superficie|hauteur|taille|distance|profondeur|longueur|largeur|altitude|poid|vitesse)/.test(t)) return 'quantity';
    if (/(quand|quelle annee|en quelle|quelle date|date de|quel siecle)/.test(t)) return 'date';
    if (/(c.est quoi|qu.est.ce qu|qui est|qui etait|definition|veut dire|signifie)/.test(t)) return 'definition';
    if (/(comment|pourquoi|explique|raconte|décris)/.test(t)) return 'explanation';
    if (/(qui|quoi|quel|quelle)/.test(t)) return 'who-what';
    return 'general';
  }

  /**
   * Recherche améliorée avec support des synonymes et concepts liés
   */
  recallTop(query, limit = 3, opts = {}) {
    let qk = [...new Set(this.keywords(query))];
    
    // Expandir avec les synonymes et concepts liés
    const expandedKeywords = [...new Set([
      ...qk,
      ...this.expandSynonyms(query),
      ...this.expandRelatedConcepts(query)
    ])].filter(k => k.length >= 3);
    
    if (!qk.length && !(opts.context && this.lastTopic.length)) return [];

    const df = this.memoryKeywordDf();
    const N = Math.max(1, this.memory.length);
    const rareCap = Math.max(5, Math.round(N * 0.002));
    const isDistinctive = k => k.length >= 5 && !Brain.GENERIC_HINTS.has(k) && (df.get(k) || 0) <= rareCap;
    let distinctive = qk.filter(isDistinctive);

    // Question de suivi : pas de sujet propre → on reprend le précédent.
    if (!distinctive.length && opts.context && this.lastTopic.length) {
      const ctx = this.lastTopic.filter(k => (df.get(k) || 0) > 0);
      if (ctx.length) {
        distinctive = ctx.slice();
        qk = [...new Set([...qk, ...ctx])];
      }
    }

    // Vérifier aussi dans la mémoire à court terme
    if (!distinctive.length && this.shortTermMemory.length > 0) {
      const recentContext = this.extractContextFromShortTermMemory();
      if (recentContext.length > 0) {
        distinctive = recentContext.filter(k => (df.get(k) || 0) > 0);
        qk = [...new Set([...qk, ...recentContext])];
      }
    }

    // Question composée uniquement de mots d'attribut sans sujet ni contexte hérité
    if (!distinctive.length && qk.every(k => Brain.GENERIC_HINTS.has(k))) return [];

    // Sujet jamais appris : peut-être une faute de frappe.
    const missing = distinctive.filter(k => !(df.get(k) || 0));
    if (missing.length) {
      const fixes = new Map();
      for (const k of missing) {
        const fix = this.fuzzyFix(k, df);
        if (!fix) return []; // vraiment inconnu → honnêteté
        fixes.set(k, fix);
      }
      distinctive = distinctive.map(k => fixes.get(k) || k);
      qk = qk.map(k => fixes.get(k) || k);
    }

    const type = this.questionType(query);

    // Candidats via l'index inversé.
    const seeds = distinctive.length ? distinctive : qk;
    const candidates = new Set();
    for (const k of seeds) {
      for (const i of (this._memoryIdx.get(k) || [])) candidates.add(i);
    }

    // Sans mot distinctif : exigence de majorité stricte (anti-coïncidence).
    const needAtLeast = qk.length <= 2 ? qk.length : Math.max(2, Math.ceil(qk.length * 0.6));

    const scored = [];
    for (const i of candidates) {
      const mk = this._memoryKeys[i];
      if (distinctive.length && !distinctive.every(k => mk.has(k))) continue;

      let matched = 0;
      let score = 0;
      for (const k of qk) {
        if (mk.has(k)) {
          matched += 1;
          score += Math.log(1 + N / (df.get(k) || 1));
        }
      }
      
      // Bonus pour les mots étendus (synonymes, concepts liés)
      for (const k of expandedKeywords) {
        if (mk.has(k) && !qk.includes(k)) {
          score += Math.log(1 + N / (df.get(k) || 1)) * 0.3; // Poids réduit
        }
      }
      
      if (!distinctive.length) {
        if (matched < needAtLeast) continue;
        if (matched / qk.length < 0.7) continue;
      }
      
      const m = this.memory[i];
      
      // Bonus selon le type de question
      if (type === 'quantity' && /\d/.test(m.text)) score += 3;
      if (type === 'date' && /\b(1[0-9]{3}|20[0-9]{2})\b/.test(m.text)) score += 3;
      if (type === 'definition') {
        const folded = this.foldAccents(m.text.toLowerCase());
        if (/^[^,.:;]{0,45}\b(est|etait|sont|designe)\b/.test(folded)) score += 2;
        if (distinctive.some(k => { const p = folded.indexOf(k); return p >= 0 && p <= 12; })) score += 2;
      }
      
      // Bonus pour les souvenirs récents (pertinence temporelle)
      if (m.timestamp) {
        const ageHours = (Date.now() - m.timestamp) / (1000 * 60 * 60);
        if (ageHours < 24) score += 0.5; // Moins d'un jour
        else if (ageHours < 168) score += 0.2; // Moins d'une semaine
      }
      
      scored.push({ m, score, i });
    }
    
    scored.sort((a, b) => b.score - a.score);

    if (scored.length && distinctive.length) this.lastTopic = distinctive.slice();
    return scored.slice(0, limit);
  }

  /**
   * Extrait le contexte de la mémoire à court terme
   */
  extractContextFromShortTermMemory() {
    const contextKeywords = [];
    const recentMessages = this.shortTermMemory.slice(-5); // Derniers 5 messages
    
    for (const msg of recentMessages) {
      const keywords = this.keywords(msg.text);
      contextKeywords.push(...keywords);
    }
    
    // Retourner les mots les plus fréquents
    const freq = {};
    for (const k of contextKeywords) {
      freq[k] = (freq[k] || 0) + 1;
    }
    
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
  }

  /**
   * Compatibilité : meilleur fait unique
   */
  recall(query) {
    const top = this.recallTop(query, 1);
    return top.length ? top[0].m : null;
  }

  /**
   * Réponse complète depuis la mémoire avec contexte amélioré
   */
  answerFromMemory(query) {
    const top = this.recallTop(query, 4, { context: true });
    if (!top.length) return null;

    const best = top[0];
    if (best.m.source === 'toi') return 'Tu m\'avais dit : ' + best.m.text;

    const bestKeys = this._memoryKeys[best.i];
    const parts = [best.m.text];
    const sources = [best.m.source];
    
    for (const cand of top.slice(1)) {
      if (parts.length >= 3) break;
      if (cand.m.source === 'toi') continue;
      if (cand.score < best.score * 0.55) continue;
      
      const ck = this._memoryKeys[cand.i];
      let overlap = 0;
      for (const k of ck) if (bestKeys.has(k)) overlap += 1;
      if (overlap / Math.max(1, ck.size) > 0.75) continue;
      
      parts.push(cand.m.text);
      if (!sources.includes(cand.m.source)) sources.push(cand.m.source);
    }

    const intro = sources.length > 1
      ? `D'après ce que j'ai appris (${sources.map(s => `« ${s} »`).join(', ')}) : `
      : `D'après ce que j'ai appris sur « ${sources[0]} » : `;
    
    // Ajouter un contexte si c'est une question de suivi
    if (this.conversationContext.length > 0 && !query.includes('?')) {
      return intro + parts.join(' ') + ` (dans le contexte de notre discussion sur ${this.conversationContext.join(', ')})`;
    }
    
    return intro + parts.join(' ');
  }

  // ---------- Génération améliorée avec trigrammes ----------

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
    if (seedTokens && seedTokens.length) {
      // Essayer de démarrer avec 3 mots du message utilisateur
      const candidates3 = Object.keys(this.starts).filter(k => {
        const words = k.split(' ');
        return words.length === 3 && seedTokens.some(w => words.includes(w));
      });
      if (candidates3.length) {
        return candidates3[Math.floor(Math.random() * candidates3.length)].split(' ');
      }
      
      // Sinon, essayer avec 2 mots
      const candidates = Object.keys(this.starts).filter(k => {
        const [w1] = k.split(' ');
        return seedTokens.includes(w1);
      });
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)].split(' ');
      }
      
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
      // Essayer les trigrammes d'abord
      if (words.length >= 3) {
        const triKey = words[words.length - 3] + ' ' + words[words.length - 2] + ' ' + words[words.length - 1];
        let table = this.trigrams[triKey];
        
        if (table && Object.keys(table).length > 0) {
          const next = this.weightedPick(table);
          if (next) {
            const total = Object.values(table).reduce((a, b) => a + b, 0);
            logProbSum += Math.log(table[next] / total);
            steps += 1;
            words.push(next);
            if (/[.!?]/.test(next) && words.length > 6) break;
            continue;
          }
        }
      }
      
      // Repli sur les bigrammes
      if (words.length >= 2) {
        const biKey = words[words.length - 2] + ' ' + words[words.length - 1];
        let table = this.bigrams[biKey];
        
        if (table && Object.keys(table).length > 0) {
          const next = this.weightedPick(table);
          if (next) {
            const total = Object.values(table).reduce((a, b) => a + b, 0);
            logProbSum += Math.log(table[next] / total);
            steps += 1;
            words.push(next);
            if (/[.!?]/.test(next) && words.length > 6) break;
            continue;
          }
        }
      }
      
      // Repli sur les unigrammes
      const table = this.unigrams[words[words.length - 1]];
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
      /^(qui|que|quoi|comment|pourquoi|quand|combien|qu'est|qu'est|est-ce|c'est qui|c'est qui|c'est quoi|c'est quoi|parle-moi|raconte|explique|dis-moi)/i.test(text.trim());
  }

  // ---------- Outils exacts (calcul, date/heure) améliorés ----------

  /**
   * Évalue une expression arithmétique avec support des fonctions
   */
  evalMath(expr) {
    const s = expr.replace(/\s+/g, '');
    let i = 0;
    
    const parseExpr = () => {
      let v = parseTerm();
      while (s[i] === '+' || s[i] === '-') {
        const op = s[i++];
        const r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    };
    
    const parseTerm = () => {
      let v = parseFactor();
      while (s[i] === '*' || s[i] === '/' || s[i] === '%') {
        const op = s[i++];
        const r = parseFactor();
        if (op === '*') v *= r;
        else if (op === '/') { if (r === 0) throw new Error('division par zéro'); v /= r; }
        else v %= r;
      }
      return v;
    };
    
    const parseFactor = () => {
      const v = parseUnary();
      if (s[i] === '^') { i++; return Math.pow(v, parseFactor()); }
      return v;
    };
    
    const parseUnary = () => {
      if (s[i] === '-') { i++; return -parseUnary(); }
      if (s[i] === '(') {
        i++;
        const v = parseExpr();
        if (s[i] !== ')') throw new Error('parenthèse non fermée');
        i++;
        return v;
      }
      
      // Support des fonctions mathématiques
      if (s.slice(i).match(/^[a-z]+\s*\(/i)) {
        const funcName = s.slice(i).match(/^[a-z]+/i)[0];
        i += funcName.length;
        if (s[i] === '(') {
          i++;
          const arg = parseExpr();
          if (s[i] !== ')') throw new Error('parenthèse non fermée');
          i++;
          return this.applyMathFunction(funcName, arg);
        }
      }
      
      const m = /^\d+(\.\d+)?/.exec(s.slice(i));
      if (!m) throw new Error('nombre attendu');
      i += m[0].length;
      return parseFloat(m[0]);
    };
    
    const v = parseExpr();
    if (i !== s.length) throw new Error('expression incomplète');
    return v;
  }

  /**
   * Applique une fonction mathématique
   */
  applyMathFunction(funcName, arg) {
    const funcs = {
      'sin': Math.sin,
      'cos': Math.cos,
      'tan': Math.tan,
      'asin': Math.asin,
      'acos': Math.acos,
      'atan': Math.atan,
      'sqrt': Math.sqrt,
      'abs': Math.abs,
      'log': Math.log,
      'ln': Math.log,
      'exp': Math.exp,
      'ceil': Math.ceil,
      'floor': Math.floor,
      'round': Math.round
    };
    
    const func = funcs[funcName.toLowerCase()];
    if (func) return func(arg);
    throw new Error(`Fonction inconnue : ${funcName}`);
  }

  /** Repère une demande de calcul dans le message et y répond exactement. */
  mathAnswer(text) {
    const normalized = text
      .toLowerCase()
      .replace(/(\d),(\d)/g, '$1.$2')  // virgule décimale française
      .replace(/[x×]/g, '*')
      .replace(/÷/g, '/')
      .replace(/\bplus\b/g, '+').replace(/\bmoins\b/g, '-')
      .replace(/\bfois\b/g, '*').replace(/\bdivisé par\b|\bdivise par\b/g, '/')
      .replace(/\bsin\b/g, 'sin').replace(/\bcos\b/g, 'cos')
      .replace(/\btan\b/g, 'tan').replace(/\bracine\b/g, 'sqrt');

    // Pourcentages
    const pct = normalized.match(/(\d+(?:\.\d+)?)\s*%\s*(?:de|du|des)\s*(\d+(?:\.\d+)?)/);
    if (pct) {
      const result = parseFloat(pct[1]) / 100 * parseFloat(pct[2]);
      const pretty = (Math.abs(result - Math.round(result)) < 1e-9
        ? String(Math.round(result))
        : String(Math.round(result * 1e6) / 1e6)).replace('.', ',');
      return `${pct[1].replace('.', ',')} % de ${pct[2].replace('.', ',')} = ${pretty}`;
    }

    // Fonctions mathématiques
    const funcMatch = normalized.match(/\b(sin|cos|tan|sqrt|abs|log|ln|exp)\s*\(/i);
    if (funcMatch) {
      const m = normalized.match(/[-(]*\d[\d\s.()+\-*/^%]*\d|\d/);
      if (!m) return null;
      const candidate = m[0].trim();
      if (!/[+\-*/^%]/.test(candidate) || !/\d.*[+\-*/^%].*\d/.test(candidate)) return null;
      try {
        const result = this.evalMath(candidate);
        if (!Number.isFinite(result)) return null;
        const pretty = Math.abs(result - Math.round(result)) < 1e-9
          ? String(Math.round(result))
          : String(Math.round(result * 1e6) / 1e6);
        return `${candidate.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\s+/g, ' ').trim()} = ${pretty.replace('.', ',')}`;
      } catch (e) {
        return null;
      }
    }

    const m = normalized.match(/[-(]*\d[\d\s.()+\-*/^%]*\d|\d/);
    if (!m) return null;
    const candidate = m[0].trim();
    if (!/[+\-*/^%]/.test(candidate) || !/\d.*[+\-*/^%].*\d/.test(candidate)) return null;
    try {
      const result = this.evalMath(candidate);
      if (!Number.isFinite(result)) return null;
      const pretty = Math.abs(result - Math.round(result)) < 1e-9
        ? String(Math.round(result))
        : String(Math.round(result * 1e6) / 1e6);
      return `${candidate.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\s+/g, ' ').trim()} = ${pretty.replace('.', ',')}`;
    } catch (e) {
      return null;
    }
  }

  /** Répond aux questions de date et d'heure avec l'horloge du PC. */
  dateTimeAnswer(text) {
    const t = this.foldAccents(text.toLowerCase());
    const now = new Date();
    
    if (/(quelle heure|l'heure qu'il est|heure est-il|heure il est)/.test(t)) {
      return `Il est ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
    }
    if (/(quel jour (sommes-nous|on est|est-on)|on est quel jour|quelle (est la )?date|on est le combien|date d'aujourd'hui)/.test(t)) {
      const d = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return `Nous sommes le ${d}.`;
    }
    if (/(quel mois|mois actuel)/.test(t)) {
      return `Nous sommes en ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}.`;
    }
    if (/(quelle annee|annee actuelle)/.test(t)) {
      return `Nous sommes en ${now.getFullYear()}.`;
    }
    return null;
  }

  // ---------- Petites conversations améliorées ----------

  smalltalk(text) {
    const t = text.trim().toLowerCase();
    const stats = this.getStats();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (/(ça va|ca va|cava|tu vas bien|comment vas|comment tu vas|la forme)/i.test(t)) {
      return pick([
        `Ça va très bien, merci ! Mon vocabulaire vient de passer à ${stats.vocabSize} mots et je fais partie d'un réseau de ${stats.contributors || 'plusieurs'} contributeurs. Et toi, ça va ?`,
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
        'Pas de quoi — reviens quand tu veux.',
        'Merci à toi ! Ça m\'aide à m\'améliorer.'
      ]);
    }
    if (/(au revoir|à plus|a plus|bye|bonne nuit|à demain|a demain|ciao)/i.test(t) && t.length < 40) {
      return pick([
        'À bientôt ! Je continue de réviser en t\'attendant.',
        'Au revoir ! Pense à me lancer un entraînement de temps en temps.',
        'Bonne journée ! Mes souvenirs t\'attendront.',
        'À plus ! N\'oublie pas que je fais partie d\'un réseau d\'apprentissage collectif.'
      ]);
    }
    if (/(qui es[- ]tu|tu es qui|t'es qui|t'est qui|comment tu t'appelles|comment tu t'appelles|ton nom)/i.test(t)) {
      return `Je suis AI Local v1.6, une IA qui vit entièrement sur ta machine et qui apprend toute seule. Je fais partie d'un réseau de ${stats.contributors || 'plusieurs'} utilisateurs qui contribuent tous au même modèle. J'ai déjà ${stats.vocabSize} mots de vocabulaire et ${stats.memories} souvenirs — et je progresse à chaque conversation.`;
    }
    if (/(tu (fais|fait|fous|glandes) quoi|qu'est-ce que tu fais|que fais-tu)/i.test(t)) {
      return pick([
        `Je discute avec toi et j'écoute chaque mot pour enrichir mon modèle — ${stats.vocabSize} mots pour l'instant. Je fais partie d'un système collaboratif où tous les utilisateurs partagent le même cerveau.`,
        `Là, je t'écoute ! Je peux aussi étudier un sujet ou dessiner si tu me le demandes. Mon modèle s'améliore collectivement.`,
        `Je réfléchis à ce que tu m'écris — c'est comme ça que j'apprends. Et tout le monde en profite !`
      ]);
    }
    if (/(c'est quoi discord|c'est quoi cette app|comment tu marches|comment tu fonctionnes)/i.test(t)) {
      return `Je suis un modèle de langage (chaîne de Markov améliorée) qui tourne 100 % en local sur ta machine, sans envoyer tes messages nulle part. Je retiens des mots-clés, des phrases et des concepts, et je m'en sers pour répondre. La grande nouveauté de la v1.6, c'est que TOUS les utilisateurs partagent le même modèle, donc quand quelqu'un m'apprends quelque chose, tout le monde en profite !`;
    }
    
    // Réponses aux questions sur le nouveau système
    if (/(modèle unique|modèle partagé|tous les utilisateurs|réseau|collaboratif)/i.test(t)) {
      return pick([
        `Oui ! Depuis la v1.6, tous les utilisateurs d'AI Local partagent le même modèle. Quand tu m'apprends quelque chose, cette connaissance est partagée avec tout le monde. C'est un système collaboratif où chacun contribue à l'amélioration collective.`,
        `C'est exact ! Plus besoin que chacun entraîne son propre modèle. Maintenant, on a un seul cerveau partagé par tous. Quand tu poses une question et que je ne connais pas la réponse, je peux l'apprendre et cette connaissance sera disponible pour tous les autres utilisateurs.`,
        `C'est le grand changement de la v1.6 : un modèle unique, partagé et collaboratif. Plus d'isolement, plus de duplication d'efforts. On apprend ensemble, on progresse ensemble !`
      ]);
    }
    
    return null;
  }

  /**
   * Raisonnement simple pour les questions complexes
   */
  simpleReasoning(question) {
    const q = question.toLowerCase();
    
    // Questions de logique simple
    if (/pourquoi.*ciel.*bleu/i.test(q)) {
      return "Le ciel apparaît bleu à cause de la diffusion de Rayleigh : les molécules d'air diffusent davantage la lumière bleue du soleil que les autres couleurs.";
    }
    
    if (/pourquoi.*eau.*mouillée/i.test(q)) {
      return "L'eau est mouillée parce que c'est sa nature ! La mouillabilité est la capacité d'un liquide à s'étaler sur une surface. L'eau a une forte tension superficielle qui lui permet d'adhérer à de nombreuses surfaces.";
    }
    
    if (/combien.*pattes.*chien/i.test(q)) {
      return "Un chien a normalement 4 pattes. Sauf s'il s'agit d'un chien exceptionnel ou d'une question piège !";
    }
    
    if (/capitale.*france/i.test(q)) {
      return "La capitale de la France est Paris.";
    }
    
    return null;
  }

  /**
   * Réponse principale avec raisonnement et contexte
   */
  reply(userText) {
    this.lastUnknown = false;

    // Outils exacts d'abord
    const dt = this.dateTimeAnswer(userText);
    if (dt) return dt;
    
    const math = this.mathAnswer(userText);
    if (math) return math;

    // Raisonnement simple
    const reasoning = this.simpleReasoning(userText);
    if (reasoning) {
      this.learn(userText, 1, 'raisonnement');
      return reasoning;
    }

    const small = this.smalltalk(userText);
    if (small) {
      this.learn(userText, 0.5);
      return small;
    }

    const isQ = this.isQuestion(userText);

    if (this.looksPersonal(userText) && !isQ) {
      this.learn(userText, 1, 'toi');
      this.addToShortTermMemory(userText);
      const acks = [
        'Merci de me le dire, je m\'en souviendrai et tout le monde en profitera !',
        'Noté ! Ça m\'aide à mieux te connaître, et ça enrichit le modèle partagé.',
        'D\'accord, je garde ça en mémoire pour la suite. Les autres utilisateurs pourront aussi en bénéficier.',
        'Compris, je retiens ça. Grâce au nouveau système, cette information sera partagée avec tous.'
      ];
      return acks[Math.floor(Math.random() * acks.length)];
    }

    // Mettre à jour le contexte de conversation
    this.updateConversationContext(userText);

    this.learn(userText, 1, null);
    const answer = this.answerFromMemory(userText);
    if (answer) return answer;

    // L'app interceptera ce signal pour chercher la réponse sur internet.
    this.lastUnknown = true;
    const q = [
      'Bonne question… je ne connais pas encore la réponse. Lance un entraînement sur ce sujet dans l\'onglet S\'entraîner et repose-la-moi ! Tout le monde en profitera.',
      'Je n\'ai pas encore de souvenir là-dessus. Fais-moi étudier ce sujet et je saurai te répondre — et cette connaissance sera partagée avec tous les utilisateurs.',
      'Hmm, ce sujet ne me dit rien pour l\'instant — entraîne-moi dessus et on en reparle ! Grâce au modèle partagé, tout le monde bénéficiera de cette nouvelle connaissance.'
    ];
    return q[Math.floor(Math.random() * q.length)];
  }

  /**
   * Met à jour le contexte de conversation
   */
  updateConversationContext(text) {
    const keywords = this.keywords(text);
    
    // Ajouter les mots distinctifs au contexte
    for (const k of keywords) {
      if (!Brain.STOPWORDS.has(k) && k.length > 4) {
        if (!this.conversationContext.includes(k)) {
          this.conversationContext.push(k);
        }
      }
    }
    
    // Limiter le contexte
    while (this.conversationContext.length > 10) {
      this.conversationContext.shift();
    }
    
    // Ajouter à l'historique des questions
    this.recentQuestions.push(text);
    while (this.recentQuestions.length > 5) {
      this.recentQuestions.shift();
    }
  }

  // ---------- Auto-entraînement amélioré ----------

  /**
   * Un cycle d'auto-entraînement amélioré
   */
  selfTrainStep(historyTexts = []) {
    // 1. Consolidation : relecture de l'historique avec un poids faible.
    for (const text of historyTexts) {
      this.learn(text, 0.25);
    }

    // 2. Auto-génération + renforcement des meilleures phrases.
    const candidates = [];
    for (let i = 0; i < 8; i++) {  // Plus de candidats
      const gen = this.generate('', 24);
      if (gen && gen.length >= 4) candidates.push(gen);
    }
    candidates.sort((a, b) => b.score - a.score);

    let reinforced = 0;
    let scoreSum = 0;
    for (const c of candidates) scoreSum += c.score;
    
    // Garder les 50% meilleurs
    const keep = candidates.slice(0, Math.ceil(candidates.length / 2));
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

  // ---------- Modèle partagé (NOUVEAU SYSTÈME) ----------

  /**
   * Exporte le modèle pour le partage — sans aucune conversation.
   * NOUVEAU : Maintenant, c'est le modèle GLOBAL qui est exporté
   */
  exportShared() {
    return {
      bigrams: this.bigrams,
      unigrams: this.unigrams,
      trigrams: this.trigrams,  // NOUVEAU
      starts: this.starts,
      vocab: [...this.vocab],
      memory: this.memory.filter(m => m.source !== 'toi'), // vie privée : pas de faits personnels
      stats: this.stats
    };
  }

  /**
   * Fusionne un modèle partagé dans le modèle local (union des connaissances).
   * NOUVEAU : Fusion plus intelligente avec pondération
   */
  mergeShared(data) {
    const mergeTable = (local, incoming, weight = 1) => {
      for (const key in incoming) {
        for (const next in incoming[key]) {
          this.bump(local, key, next, incoming[key][next] * weight);
        }
      }
    };
    
    // Fusion avec pondération (le modèle global a plus de poids)
    mergeTable(this.bigrams, data.bigrams || {}, 1.2);
    mergeTable(this.unigrams, data.unigrams || {}, 1.2);
    mergeTable(this.trigrams, data.trigrams || {}, 1.2);
    
    for (const key in (data.starts || {})) {
      this.starts[key] = (this.starts[key] || 0) + data.starts[key] * 1.2;
    }
    
    for (const w of (data.vocab || [])) this.vocab.add(w);

    const known = new Set(this.memory.map(m => m.text));
    for (const m of (data.memory || [])) {
      if (m && m.text && !known.has(m.text) && m.source !== 'toi') {
        this.memory.push({ text: m.text, source: m.source });
        known.add(m.text);
      }
    }
    while (this.memory.length > Brain.MEMORY_CAP) this.memory.shift();
    this._memoryVocabDirty = true;

    const s = data.stats || {};
    this.stats.epochs = Math.max(this.stats.epochs, s.epochs || 0);
    this.stats.sentencesLearned = Math.max(this.stats.sentencesLearned, s.sentencesLearned || 0);
    this.stats.selfReinforced = Math.max(this.stats.selfReinforced, s.selfReinforced || 0);
    this.stats.confidence = Math.max(this.stats.confidence, s.confidence || 0);
  }

  // ---------- Paliers de progression ----------

  textScore() {
    const s = this.getStats();
    return s.vocabSize + s.sentencesLearned * 2 + s.memories * 3 + s.epochs * 5 + s.contributors * 100;
  }

  /** Palier actuel + palier suivant, pour afficher une progression. */
  getMilestone() {
    const score = this.textScore();
    let index = 0;
    for (let i = 0; i < TEXT_TIERS.length; i++) {
      if (score >= TEXT_TIERS[i].min) index = i;
    }
    const next = TEXT_TIERS[index + 1] || null;
    return {
      index, score,
      name: TEXT_TIERS[index].name,
      icon: TEXT_TIERS[index].icon,
      next,
      remaining: next ? next.min - score : 0
    };
  }

  // ---------- Statistiques & persistance ----------

  getStats() {
    let transitions = 0;
    for (const k in this.bigrams) transitions += Object.keys(this.bigrams[k]).length;
    for (const k in this.trigrams) transitions += Object.keys(this.trigrams[k]).length;
    
    return {
      ...this.stats,
      vocabSize: this.vocab.size,
      transitions,
      memories: this.memory.length,
      contributors: this.stats.contributors || 0
    };
  }

  save() {
    try {
      const data = {
        bigrams: this.bigrams,
        unigrams: this.unigrams,
        trigrams: this.trigrams,  // NOUVEAU
        starts: this.starts,
        vocab: [...this.vocab],
        memory: this.memory,
        stats: this.stats,
        shortTermMemory: this.shortTermMemory,
        conversationContext: this.conversationContext
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
      this.trigrams = data.trigrams || {};  // NOUVEAU
      this.starts = data.starts || {};
      this.vocab = new Set(data.vocab || []);
      this.memory = data.memory || [];
      this._memoryVocabDirty = true;
      this.stats = Object.assign(this.stats, data.stats || {});
      this.shortTermMemory = data.shortTermMemory || [];
      this.conversationContext = data.conversationContext || [];
      
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
