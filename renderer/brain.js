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

class Brain {
  // Capacité de la mémoire à long terme : 12 000 souvenirs ≈ 1,8 Mo de texte,
  // encore loin des limites de stockage. L'index inversé (voir
  // rebuildMemoryIndex) rend la recherche quasi instantanée même à cette
  // taille — c'est lui qui a permis de tripler la capacité en v1.1.
  static MEMORY_CAP = 12000;

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
    // Sujet de la conversation en cours (mots-clés distinctifs du dernier
    // rappel réussi) : permet de comprendre les questions de suivi qui ne
    // répètent pas le sujet (« et sa hauteur ? »).
    this.lastTopic = [];
  }

  // ---------- Apprentissage ----------

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[«»"“”]/g, ' ')
      // Détache les contractions françaises (d'habitant → habitant,
      // l'atmosphère → atmosphère, qu'est → est) : sans ça, « d'habitant »
      // restait un seul mot-clé bizarre qui ne matchait jamais rien, ce qui
      // faussait le rappel de faits (voir recall()).
      .replace(/\b(jusqu|lorsqu|puisqu|quoiqu|qu|d|l|j|n|s|t|m|c)['’]/g, ' ')
      .replace(/([.!?,;:])/g, ' $1 ')
      .split(/\s+/)
      .filter(Boolean);
  }

  /**
   * Filtre les phrases de mauvaise qualité (listes de lieux/codes postaux,
   * fragments d'infobox, débris de mise en forme wiki) qui, une fois
   * ingérées dans les n-grammes, produisent des réponses incohérentes du
   * type « le mesnilbus1595- w: neuville-saint-rémy9740- ».
   */
  isLowQualitySentence(sentence) {
    const letters = (sentence.match(/[a-zà-ÿ]/gi) || []).length;
    const total = sentence.replace(/\s/g, '').length;
    if (total === 0) return true;
    if (letters / total < 0.6) return true; // trop de chiffres/symboles
    // Seuil à 5 : une phrase démographique normale contient légitimement
    // 3 nombres (« En 2022, la commune comptait 156 habitants, contre 172
    // en 2016 ») — la rejeter faisait rater les réponses de population.
    // Les vraies listes de codes en contiennent bien plus, et sont de toute
    // façon rattrapées par les deux autres règles.
    if ((sentence.match(/\d{3,}/g) || []).length >= 5) return true; // listes de codes/nombres
    if ((sentence.match(/-\s|\bw:/g) || []).length >= 3) return true; // listes à puces wiki
    return false;
  }

  learn(text, weight = 1, source = null) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0 && !this.isLowQualitySentence(s));
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

  static STOPWORDS = new Set((
    'le la les un une des du de d l et ou où mais donc or ni car que qui quoi dont est sont était a ont ' +
    'ce cette ces se sa son ses ne pas plus très en dans sur pour par avec sans sous vers chez il elle ils ' +
    'elles on nous vous je tu au aux y été être avoir fait comme aussi tout tous toute toutes leur leurs ' +
    'autre autres même ' +
    // Mots interrogatifs et fragments de construction de question : ce sont
    // des mots de structure, pas des sujets — ils ne doivent jamais compter
    // comme un « mot-clé distinctif qu'il faut avoir appris » dans recall(),
    // sinon une question honnête (« pourquoi le ciel est bleu ») serait
    // rejetée juste parce que « pourquoi » n'apparaît jamais dans le fait
    // appris lui-même.
    'pourquoi comment quand combien quel quelle quels quelles est-ce bonne ' +
    // Verbes de conversation (« parle-moi du X », « raconte-moi Y ») : ce
    // sont des façons de demander, pas des sujets — sans ça, « parle-moi »
    // était pris pour un sujet distinctif jamais appris et tuait la requête.
    'parle parle-moi parlez dis dis-moi raconte raconte-moi explique explique-moi ' +
    'décris décris-moi decris decris-moi montre montre-moi donne donne-moi'
  ).split(' '));

  /** Insensible aux accents, pour matcher « théorie »/« theorie », « été »/« ete »… */
  foldAccents(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  keywords(text) {
    return this.tokenize(text)
      .filter(t => t.length >= 3 && !/[.!?,;:]/.test(t) && !Brain.STOPWORDS.has(t))
      .map(t => this.foldAccents(t))
      // Singulier/pluriel unifiés (habitants → habitant, volcans → volcan) :
      // appliqué des deux côtés (question ET souvenir), donc toujours cohérent.
      .map(t => t.length > 3 ? t.replace(/[sx]$/, '') : t);
  }

  /** Un message qui parle de l'utilisateur lui-même plutôt que de demander une info. */
  looksPersonal(text) {
    return /\b(je|j'|j’|mon|ma|mes|moi|m'appelle|m’appelle|chez moi)\b/i.test(text);
  }

  remember(sentence, source) {
    const clean = sentence.trim().replace(/\s+/g, ' ');
    if (clean.length < 40 || clean.length > 320) return;
    if (this.memory.some(m => m.text === clean)) return;
    this.memory.push({ text: clean, source });
    if (this.memory.length > Brain.MEMORY_CAP) this.memory.shift();
    this._memoryVocabDirty = true;
  }

  /**
   * Mots banals qu'une question contient souvent sans qu'ils soient LE
   * sujet (« le nombre d'habitants de X » : le sujet, c'est X). Ils peuvent
   * affiner le score d'un souvenir mais ne déclenchent jamais le garde-fou
   * « sujet jamais appris » et ne sont jamais exigés dans le souvenir.
   * Formes avec ET sans pluriel-stemming, par prudence.
   */
  static GENERIC_HINTS = new Set((
    'nombre habitant habitants population ville village commune pays pay capitale region departement ' +
    'taille hauteur superficie distance monde histoire personne personnes gens gen chose choses truc ' +
    'exemple definition signification sens sen date annee jour heure nom prenom couleur langue origine ' +
    'altitude vitesse profondeur longueur largeur poid poids age surface temperature'
  ).split(' '));

  /** Mots-clés d'un souvenir : son texte + sa source (une phrase issue de
   *  l'article « Thélod » parle de Thélod même sans répéter le nom). */
  memoryEntryKeywords(m) {
    return new Set(this.keywords(m.text + ' ' + (m.source && m.source !== 'toi' ? m.source : '')));
  }

  /**
   * Index de recherche sur la mémoire, reconstruit seulement quand elle
   * change :
   *  - _memoryDf   : fréquence documentaire de chaque mot-clé (dans combien
   *    de souvenirs il apparaît, source comprise) — distingue les mots
   *    banals des mots distinctifs et sert de pondération par rareté ;
   *  - _memoryKeys : mots-clés de chaque souvenir, pré-calculés une fois ;
   *  - _memoryIdx  : index inversé mot-clé → indices des souvenirs, pour ne
   *    noter que les candidats plausibles au lieu de scanner toute la mémoire.
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

  /** Vrai si les deux mots sont à une seule faute de frappe l'un de l'autre
   *  (insertion, suppression ou substitution d'une lettre). */
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

  /** Corrige une faute de frappe sur un mot-clé : cherche dans le vocabulaire
   *  de la mémoire un mot connu à une seule édition près. */
  fuzzyFix(k, df) {
    if (k.length < 5) return null;
    let best = null;
    for (const known of df.keys()) {
      if (known.length >= 5 && Brain.withinOneEdit(k, known)) {
        // en cas d'égalité, préfère le mot le plus fréquent dans la mémoire
        if (!best || (df.get(known) || 0) > (df.get(best) || 0)) best = known;
      }
    }
    return best;
  }

  /** Détecte ce que la question attend, pour favoriser les souvenirs qui
   *  contiennent ce type d'information. */
  questionType(text) {
    const t = this.foldAccents(text.toLowerCase());
    if (/(combien|nombre|population|habitant|quantite|superficie|hauteur|taille|distance|profondeur|longueur|largeur|altitude|poid|vitesse)/.test(t)) return 'quantity';
    if (/(quand|quelle annee|en quelle|quelle date|date de|quel siecle)/.test(t)) return 'date';
    if (/(c.est quoi|qu.est.ce qu|qui est|qui etait|definition|veut dire|signifie)/.test(t)) return 'definition';
    return 'general';
  }

  /**
   * Retrouve les faits les plus pertinents pour une requête, classés par
   * score. Cœur du moteur de réponse depuis la v1.1 :
   *
   *  - les mots-clés sont séparés en DISTINCTIFS (rares — le sujet de la
   *    question, exigés dans chaque souvenir candidat) et GÉNÉRIQUES
   *    (« nombre », « habitant » — ils affinent le score sans jamais suffire) ;
   *  - chaque mot compte proportionnellement à sa RARETÉ dans la mémoire
   *    (log(1 + N/df), l'idée du TF-IDF) : un nom propre pèse beaucoup plus
   *    qu'un mot banal, ce qui rend les coïncidences inoffensives ;
   *  - un sujet jamais appris passe d'abord par la correction de fautes de
   *    frappe (une édition près) ; s'il reste inconnu → aucune citation ;
   *  - une question de suivi sans sujet propre (« et sa hauteur ? ») hérite
   *    du sujet du rappel précédent (opts.context) ;
   *  - le type de question (quantité, date, définition) favorise les
   *    souvenirs qui contiennent l'information attendue ;
   *  - seuls les souvenirs indexés sur les mots de la question sont notés
   *    (index inversé), jamais toute la mémoire.
   */
  recallTop(query, limit = 3, opts = {}) {
    let qk = [...new Set(this.keywords(query))];
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

    // Sujet jamais appris : peut-être une faute de frappe.
    const missing = distinctive.filter(k => !(df.get(k) || 0));
    if (missing.length) {
      const fixes = new Map();
      for (const k of missing) {
        const fix = this.fuzzyFix(k, df);
        if (!fix) return []; // vraiment inconnu → honnêteté, aucune citation
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
      if (!distinctive.length) {
        if (matched < needAtLeast) continue;
        if (matched / qk.length < 0.7) continue;
      }
      const m = this.memory[i];
      if (type === 'quantity' && /\d/.test(m.text)) score += 3;
      if (type === 'date' && /\b(1[0-9]{3}|20[0-9]{2})\b/.test(m.text)) score += 3;
      if (type === 'definition') {
        const folded = this.foldAccents(m.text.toLowerCase());
        if (/^[^,.:;]{0,45}\b(est|etait|sont|designe)\b/.test(folded)) score += 2;
        // La vraie définition met le sujet EN TÊTE (« Un volcan est… ») —
        // pas au milieu d'une phrase qui parle d'autre chose.
        if (distinctive.some(k => { const p = folded.indexOf(k); return p >= 0 && p <= 12; })) score += 2;
      }
      scored.push({ m, score, i });
    }
    scored.sort((a, b) => b.score - a.score);

    if (scored.length && distinctive.length) this.lastTopic = distinctive.slice();
    return scored.slice(0, limit);
  }

  /** Compatibilité : meilleur fait unique, comme l'ancien recall(). */
  recall(query) {
    const top = this.recallTop(query, 1);
    return top.length ? top[0].m : null;
  }

  /**
   * Réponse complète depuis la mémoire : le meilleur fait, éventuellement
   * complété par un ou deux faits complémentaires sur le même sujet (assez
   * bien notés et non redondants avec le premier), avec la ou les sources.
   * Retourne null si le sujet est inconnu — jamais de réponse inventée.
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
      // évite les redites : trop de mots-clés en commun avec le fait retenu
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
    return intro + parts.join(' ');
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
      /^(qui|que|quoi|comment|pourquoi|quand|combien|qu'est|qu’est|est-ce|c'est qui|c’est qui|c'est quoi|c’est quoi|parle-moi|raconte|explique|dis-moi)/i.test(text.trim());
  }

  // ---------- Outils exacts (calcul, date/heure) ----------

  /**
   * Évalue une expression arithmétique sans eval() : analyse descendante
   * classique (+ - * / % ^, parenthèses, décimales avec virgule française).
   * Contrairement au reste du modèle, ici la réponse est EXACTE — c'est un
   * outil déterministe, comme la calculatrice des grands assistants.
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
      const m = /^\d+(\.\d+)?/.exec(s.slice(i));
      if (!m) throw new Error('nombre attendu');
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const v = parseExpr();
    if (i !== s.length) throw new Error('expression incomplète');
    return v;
  }

  /** Repère une demande de calcul dans le message et y répond exactement. */
  mathAnswer(text) {
    const normalized = text
      .toLowerCase()
      .replace(/(\d),(\d)/g, '$1.$2')  // virgule décimale française
      .replace(/[x×]/g, '*')
      .replace(/÷/g, '/')
      .replace(/\bplus\b/g, '+').replace(/\bmoins\b/g, '-')
      .replace(/\bfois\b/g, '*').replace(/\bdivisé par\b|\bdivise par\b/g, '/');

    // Pourcentages : « 20 % de 150 » — cas à part, avant l'arithmétique
    // générale (le % y signifie modulo).
    const pct = normalized.match(/(\d+(?:\.\d+)?)\s*%\s*(?:de|du|des)\s*(\d+(?:\.\d+)?)/);
    if (pct) {
      const result = parseFloat(pct[1]) / 100 * parseFloat(pct[2]);
      const pretty = (Math.abs(result - Math.round(result)) < 1e-9
        ? String(Math.round(result))
        : String(Math.round(result * 1e6) / 1e6)).replace('.', ',');
      return `${pct[1].replace('.', ',')} % de ${pct[2].replace('.', ',')} = ${pretty}`;
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
    return null;
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
    if (/(tu (fais|fait|fous|glandes) quoi|qu'est-ce que tu fais|que fais-tu)/i.test(t)) {
      return pick([
        `Je discute avec toi et j'écoute chaque mot pour enrichir mon modèle — ${stats.vocabSize} mots pour l'instant.`,
        `Là, je t'écoute ! Je peux aussi étudier un sujet ou dessiner si tu me le demandes.`,
        `Je réfléchis à ce que tu m'écris — c'est comme ça que j'apprends.`
      ]);
    }
    if (/(c'est quoi discord|c'est quoi cette app|comment tu marches|comment tu fonctionnes)/i.test(t)) {
      return `Je suis un petit modèle de langage (chaîne de Markov) qui tourne 100 % en local sur ta machine, sans envoyer tes messages nulle part. Je n'ai pas de vraie compréhension du monde — je retiens des mots-clés et des phrases que j'ai lus, et je m'en sers pour répondre.`;
    }
    return null;
  }

  /**
   * Un petit modèle de n-grammes ne « comprend » rien : le faire générer une
   * réponse à une question ou à un sujet produisait des recombinaisons de
   * bouts de phrases apprises qui ressemblent à des réponses sans en être
   * (échos déformés du message précédent, salade de fragments Wikipédia sans
   * rapport). La génération est donc retirée comme mécanisme de réponse —
   * elle ne sert plus qu'en interne, pendant l'auto-entraînement, pour muscler
   * le vocabulaire sans jamais être présentée comme une réponse à l'utilisateur.
   *
   * Ce qui reste, dans l'ordre :
   *  1. petites conversations reconnues (salutations, politesse…) ;
   *  2. affirmations personnelles (« mon chien s'appelle Rex ») : mémorisées,
   *     accusées réception sans prétendre y répondre ;
   *  3. tout le reste (question ou sujet évoqué sans syntaxe de question,
   *     ex. « la théorie de la relativité générale ») : recherche d'un fait
   *     appris et cité avec sa source, ou aveu honnête que le sujet est
   *     inconnu — jamais de réponse inventée.
   */
  reply(userText) {
    this.lastUnknown = false;

    // Outils exacts d'abord : un calcul ou une question d'heure a UNE bonne
    // réponse, autant la donner avec certitude.
    const dt = this.dateTimeAnswer(userText);
    if (dt) return dt;
    const math = this.mathAnswer(userText);
    if (math) return math;

    const small = this.smalltalk(userText);
    if (small) {
      this.learn(userText, 0.5);
      return small;
    }

    const isQ = this.isQuestion(userText);

    if (this.looksPersonal(userText) && !isQ) {
      this.learn(userText, 1, 'toi');
      const acks = [
        'Merci de me le dire, je m\'en souviendrai !',
        'Noté ! Ça m\'aide à mieux te connaître.',
        'D\'accord, je garde ça en mémoire.',
        'Compris, je retiens ça pour la suite.'
      ];
      return acks[Math.floor(Math.random() * acks.length)];
    }

    this.learn(userText, 1, null);
    const answer = this.answerFromMemory(userText);
    if (answer) return answer;

    // L'app interceptera ce signal pour chercher la réponse sur internet.
    this.lastUnknown = true;
    const q = [
      'Bonne question… je ne connais pas encore la réponse. Lance un entraînement sur ce sujet dans l\'onglet S\'entraîner et repose-la-moi !',
      'Je n\'ai pas encore de souvenir là-dessus. Fais-moi étudier ce sujet et je saurai te répondre.',
      'Hmm, ce sujet ne me dit rien pour l\'instant — entraîne-moi dessus et on en reparle !'
    ];
    return q[Math.floor(Math.random() * q.length)];
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
    return s.vocabSize + s.sentencesLearned * 2 + s.memories * 3 + s.epochs * 5;
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
      this._memoryVocabDirty = true;
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
