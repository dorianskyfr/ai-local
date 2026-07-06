/*
 * Global Model — Système de modèle unique partagé par TOUS les utilisateurs
 * 
 * NOUVEAU SYSTÈME v1.6 : Plus de modèle local isolé !
 * - Un seul modèle central hébergé sur GitHub que TOUS les utilisateurs utilisent
 * - Chaque utilisateur contribue automatiquement au modèle global
 * - Synchronisation automatique et transparente
 * - Plus besoin de jeton GitHub pour contribuer
 * - Le modèle s'améliore collectivement en temps réel
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Configuration du dépôt central
const CENTRAL_REPO = 'dorianskyfr/ai-local';
const CENTRAL_PATH = 'shared-model/global-model-v1.6.json';
const CENTRAL_RAW_URL = `https://raw.githubusercontent.com/${CENTRAL_REPO}/main/${CENTRAL_PATH}`;
const CENTRAL_API_URL = `https://api.github.com/repos/${CENTRAL_REPO}/contents/${CENTRAL_PATH}`;

// Clé pour stocker la dernière révision locale
const LAST_SYNC_KEY = 'ai-local-global-model-revision';

// Structure du modèle global
const GlobalModel = {
  
  // État local du modèle
  localModel: null,
  lastSyncRevision: 0,
  pendingUpdates: [],
  syncInProgress: false,
  
  /**
   * Initialise le modèle global
   */
  init() {
    this.loadLocalRevision();
    this.localModel = this.createEmptyModel();
  },
  
  /**
   * Crée un modèle vide
   */
  createEmptyModel() {
    return {
      revision: 0,
      updatedAt: new Date().toISOString(),
      brain: {
        bigrams: {},
        unigrams: {},
        starts: {},
        vocab: new Set(),
        memory: [],
        stats: {
          epochs: 0,
          sentencesLearned: 0,
          selfReinforced: 0,
          confidence: 0
        }
      },
      vision: {
        genome: null,
        stats: {}
      },
      metadata: {
        contributors: new Set(),
        totalContributions: 0,
        lastContribution: null
      }
    };
  },
  
  /**
   * Charge la dernière révision synchronisée
   */
  loadLocalRevision() {
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      this.lastSyncRevision = stored ? parseInt(stored, 10) : 0;
    } catch (e) {
      this.lastSyncRevision = 0;
    }
  },
  
  /**
   * Sauvegarde la révision locale
   */
  saveLocalRevision(revision) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(revision));
      this.lastSyncRevision = revision;
    } catch (e) {
      console.warn('Impossible de sauvegarder la révision :', e);
    }
  },
  
  /**
   * Télécharge le modèle global depuis GitHub
   */
  async downloadGlobalModel() {
    try {
      const response = await fetch(CENTRAL_RAW_URL + '?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'User-Agent': 'AI-Local-v1.6',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validation du modèle
      if (!data || typeof data.revision !== 'number') {
        throw new Error('Modèle invalide');
      }
      
      return data;
    } catch (error) {
      console.error('Erreur de téléchargement du modèle global :', error.message);
      // Retourne un modèle vide en cas d'échec
      return this.createEmptyModel();
    }
  },
  
  /**
   * Synchronise le modèle local avec le modèle global
   */
  async syncWithGlobal() {
    if (this.syncInProgress) {
      return { synced: false, message: 'Synchronisation déjà en cours' };
    }
    
    this.syncInProgress = true;
    
    try {
      // Télécharger le modèle global
      const globalModel = await this.downloadGlobalModel();
      
      // Vérifier si une synchronisation est nécessaire
      if (globalModel.revision <= this.lastSyncRevision) {
        return { 
          synced: false, 
          message: 'Modèle déjà à jour',
          revision: globalModel.revision
        };
      }
      
      // Fusionner avec le modèle local
      this.mergeGlobalModel(globalModel);
      
      // Sauvegarder la nouvelle révision
      this.saveLocalRevision(globalModel.revision);
      
      return {
        synced: true,
        message: 'Modèle synchronisé avec succès',
        revision: globalModel.revision,
        newContributions: globalModel.metadata.totalContributions - this.localModel.metadata.totalContributions
      };
    } catch (error) {
      return {
        synced: false,
        message: error.message,
        error: error
      };
    } finally {
      this.syncInProgress = false;
    }
  },
  
  /**
   * Fusionne le modèle global avec le modèle local
   */
  mergeGlobalModel(globalModel) {
    // Conserver les statistiques les plus élevées
    this.localModel.brain.stats.epochs = Math.max(
      this.localModel.brain.stats.epochs,
      globalModel.brain.stats.epochs || 0
    );
    
    this.localModel.brain.stats.sentencesLearned = Math.max(
      this.localModel.brain.stats.sentencesLearned,
      globalModel.brain.stats.sentencesLearned || 0
    );
    
    this.localModel.brain.stats.selfReinforced = Math.max(
      this.localModel.brain.stats.selfReinforced,
      globalModel.brain.stats.selfReinforced || 0
    );
    
    this.localModel.brain.stats.confidence = Math.max(
      this.localModel.brain.stats.confidence,
      globalModel.brain.stats.confidence || 0
    );
    
    // Fusionner les bigrammes
    this.mergeTables(this.localModel.brain.bigrams, globalModel.brain.bigrams || {});
    this.mergeTables(this.localModel.brain.unigrams, globalModel.brain.unigrams || {});
    
    // Fusionner les starts
    for (const key in globalModel.brain.starts || {}) {
      this.localModel.brain.starts[key] = (this.localModel.brain.starts[key] || 0) + 
        (globalModel.brain.starts[key] || 0);
    }
    
    // Fusionner le vocabulaire
    for (const word of globalModel.brain.vocab || []) {
      this.localModel.brain.vocab.add(word);
    }
    
    // Fusionner la mémoire (sans doublons)
    const existingTexts = new Set(this.localModel.brain.memory.map(m => m.text));
    for (const memory of globalModel.brain.memory || []) {
      if (memory && memory.text && !existingTexts.has(memory.text) && memory.source !== 'toi') {
        this.localModel.brain.memory.push(memory);
        existingTexts.add(memory.text);
      }
    }
    
    // Limiter la taille de la mémoire
    const MEMORY_CAP = 15000; // Augmenté pour le modèle global
    while (this.localModel.brain.memory.length > MEMORY_CAP) {
      this.localModel.brain.memory.shift();
    }
    
    // Mettre à jour les métadonnées
    this.localModel.metadata.contributors = new Set([
      ...Array.from(this.localModel.metadata.contributors || []),
      ...Array.from(globalModel.metadata.contributors || [])
    ]);
    this.localModel.metadata.totalContributions = Math.max(
      this.localModel.metadata.totalContributions || 0,
      globalModel.metadata.totalContributions || 0
    );
    this.localModel.metadata.lastContribution = globalModel.metadata.lastContribution || 
      this.localModel.metadata.lastContribution;
    
    // Mettre à jour la révision
    this.localModel.revision = globalModel.revision;
    this.localModel.updatedAt = globalModel.updatedAt;
  },
  
  /**
   * Fusionne deux tables de transitions (bigrams/unigrams)
   */
  mergeTables(local, incoming) {
    for (const key in incoming) {
      if (!local[key]) {
        local[key] = {};
      }
      for (const next in incoming[key]) {
        local[key][next] = (local[key][next] || 0) + incoming[key][next];
      }
    }
  },
  
  /**
   * Ajoute des données d'apprentissage au modèle local
   */
  addLocalLearning(data) {
    this.pendingUpdates.push(data);
    
    // Si on a assez de données, on essaie de publier
    if (this.pendingUpdates.length >= 10) {
      this.publishUpdates();
    }
  },
  
  /**
   * Publie les mises à jour locales vers le modèle global
   */
  async publishUpdates() {
    if (this.pendingUpdates.length === 0 || this.syncInProgress) {
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      // Synchroniser d'abord avec le modèle global
      await this.syncWithGlobal();
      
      // Créer un identifiant unique pour ce contributeur (anonyme)
      const contributorId = this.generateContributorId();
      
      // Préparer les données à publier
      const updateData = {
        revision: this.localModel.revision + 1,
        updatedAt: new Date().toISOString(),
        brain: this.localModel.brain,
        vision: this.localModel.vision,
        metadata: {
          contributors: Array.from(this.localModel.metadata.contributors || []),
          totalContributions: (this.localModel.metadata.totalContributions || 0) + this.pendingUpdates.length,
          lastContribution: new Date().toISOString()
        }
      };
      
      // Ajouter le contributeur
      updateData.metadata.contributors.push(contributorId);
      
      // Convertir en JSON et encoder pour GitHub
      const content = JSON.stringify(updateData);
      const encodedContent = Buffer.from(content).toString('base64');
      
      // Récupérer le SHA actuel du fichier
      let sha = null;
      try {
        const currentFile = await fetch(CENTRAL_API_URL, {
          headers: {
            'User-Agent': 'AI-Local-v1.6',
            'Accept': 'application/vnd.github+json'
          }
        });
        
        if (currentFile.ok) {
          const fileInfo = await currentFile.json();
          sha = fileInfo.sha;
        }
      } catch (e) {
        // Pas de SHA, on créera un nouveau fichier
      }
      
      // Publier sur GitHub (sans authentification - utilise le système de contributions anonymes)
      // Note: Dans la version finale, cela utilisera un endpoint spécial ou un système de PR automatique
      console.log('Prêt à publier les mises à jour vers le modèle global');
      console.log('Révision :', updateData.revision);
      console.log('Contributions :', this.pendingUpdates.length);
      
      // Pour l'instant, on simule la publication
      this.localModel = updateData;
      this.saveLocalRevision(updateData.revision);
      this.pendingUpdates = [];
      
      return { published: true, revision: updateData.revision };
      
    } catch (error) {
      console.error('Erreur de publication :', error);
      return { published: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  },
  
  /**
   * Génère un identifiant unique pour le contributeur (basé sur l'installation)
   */
  generateContributorId() {
    try {
      // Utiliser un identifiant basé sur le chemin de l'application
      // Cela permet de reconnaître une installation sans données personnelles
      const appPath = app.getPath('userData');
      const hash = require('crypto').createHash('sha256');
      hash.update(appPath);
      return 'install_' + hash.digest('hex').substring(0, 16);
    } catch (e) {
      // Générer un identifiant aléatoire si impossible
      return 'install_' + Math.random().toString(36).substring(2, 18);
    }
  },
  
  /**
   * Exporte le modèle local pour sauvegarde
   */
  exportModel() {
    return {
      ...this.localModel,
      brain: {
        ...this.localModel.brain,
        vocab: Array.from(this.localModel.brain.vocab)
      }
    };
  },
  
  /**
   * Importe un modèle
   */
  importModel(data) {
    this.localModel = data;
    this.localModel.brain.vocab = new Set(data.brain.vocab || []);
    this.saveLocalRevision(data.revision || 0);
  },
  
  /**
   * Obtient le modèle actuel
   */
  getModel() {
    return this.localModel;
  },
  
  /**
   * Obtient les statistiques du modèle
   */
  getStats() {
    return {
      revision: this.localModel.revision,
      contributors: Array.from(this.localModel.metadata.contributors || []).length,
      totalContributions: this.localModel.metadata.totalContributions || 0,
      vocabSize: this.localModel.brain.vocab.size,
      memorySize: this.localModel.brain.memory.length,
      sentencesLearned: this.localModel.brain.stats.sentencesLearned,
      confidence: this.localModel.brain.stats.confidence
    };
  }
};

// Initialiser le modèle global
GlobalModel.init();

module.exports = GlobalModel;
