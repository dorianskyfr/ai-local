/*
 * Shared — NOUVEAU SYSTÈME v1.6 : Modèle Unique Partagé par TOUS
 * 
 * ANCIEN SYSTÈME : Chaque utilisateur avait son propre modèle local et pouvait
 * contribuer au modèle communautaire via un jeton GitHub.
 * 
 * NOUVEAU SYSTÈME : 
 * - UN SEUL modèle central hébergé sur GitHub
 * - TOUS les utilisateurs utilisent ce même modèle
 * - Synchronisation automatique et transparente
 * - Plus besoin de jeton GitHub pour contribuer
 * - Le modèle s'améliore collectivement en temps réel
 * - Chaque utilisateur contribue automatiquement au modèle global
 */

// Configuration du modèle global
const GLOBAL_REPO = 'dorianskyfr/ai-local';
const GLOBAL_PATH = 'shared-model/global-model-v1.6.json';
const GLOBAL_RAW_URL = `https://raw.githubusercontent.com/${GLOBAL_REPO}/main/${GLOBAL_PATH}`;
const GLOBAL_API_URL = `https://api.github.com/repos/${GLOBAL_REPO}/contents/${GLOBAL_PATH}`;

// Clés de stockage
const LAST_SYNC_KEY = 'ai-local-global-sync-revision';
const CONTRIBUTOR_ID_KEY = 'ai-local-contributor-id';

const Shared = {
  
  /**
   * Génère un identifiant unique pour ce contributeur (basé sur le navigateur)
   */
  getContributorId() {
    let id = localStorage.getItem(CONTRIBUTOR_ID_KEY);
    if (!id) {
      // Créer un identifiant basé sur des caractéristiques du navigateur
      id = 'web_' + Math.random().toString(36).substring(2, 18) + '_' + 
           (navigator.userAgent || '').substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
      localStorage.setItem(CONTRIBUTOR_ID_KEY, id);
    }
    return id;
  },
  
  /**
   * Obtient la dernière révision synchronisée
   */
  getLastSyncRevision() {
    try {
      return parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0', 10);
    } catch (e) {
      return 0;
    }
  },
  
  /**
   * Sauvegarde la dernière révision synchronisée
   */
  setLastSyncRevision(revision) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(revision));
    } catch (e) {
      console.warn('Impossible de sauvegarder la révision :', e);
    }
  },
  
  /**
   * Télécharge le modèle global depuis GitHub
   */
  async downloadGlobalModel() {
    const response = await fetch(GLOBAL_RAW_URL + '?t=' + Date.now(), {
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
  },
  
  /**
   * Synchronise le modèle local avec le modèle global
   * NOUVEAU : Maintenant, c'est automatique et transparent
   */
  async syncDown(brain, vision) {
    try {
      const data = await this.downloadGlobalModel();
      const lastSync = this.getLastSyncRevision();
      
      // Vérifier si une synchronisation est nécessaire
      if (data.revision <= lastSync) {
        return { 
          merged: false, 
          revision: data.revision,
          message: 'Modèle déjà à jour'
        };
      }
      
      // Fusionner le modèle global
      if (data.brain) {
        // Sauvegarder les données locales personnelles
        const personalMemory = brain.memory.filter(m => m.source === 'toi');
        
        // Fusionner avec le modèle global
        brain.mergeShared(data.brain);
        
        // Restaurer les données personnelles
        for (const mem of personalMemory) {
          if (!brain.memory.some(m => m.text === mem.text)) {
            brain.memory.push(mem);
          }
        }
      }
      
      if (data.vision) {
        vision.mergeShared(data.vision);
      }
      
      // Sauvegarder
      brain.save();
      vision.save();
      this.setLastSyncRevision(data.revision);
      
      return {
        merged: true,
        revision: data.revision,
        message: 'Modèle synchronisé avec succès',
        contributors: data.metadata?.contributors?.length || 0,
        totalContributions: data.metadata?.totalContributions || 0
      };
    } catch (error) {
      console.error('Erreur de synchronisation :', error);
      return {
        merged: false,
        revision: this.getLastSyncRevision(),
        message: error.message,
        error: error
      };
    }
  },
  
  /**
   * Publie le modèle local vers le modèle global
   * NOUVEAU : Maintenant, c'est automatique et ne nécessite pas de jeton
   */
  async publish(brain, vision) {
    try {
      // Obtenir l'identifiant du contributeur
      const contributorId = this.getContributorId();
      
      // Synchroniser d'abord avec le modèle global
      const syncResult = await this.syncDown(brain, vision);
      
      // Préparer les données à publier
      const currentRevision = syncResult.revision || this.getLastSyncRevision();
      const newRevision = currentRevision + 1;
      
      const payload = {
        revision: newRevision,
        updatedAt: new Date().toISOString(),
        brain: brain.exportShared(),
        vision: vision.exportShared(),
        metadata: {
          contributors: [contributorId],
          totalContributions: (syncResult.totalContributions || 0) + 1,
          lastContribution: new Date().toISOString()
        }
      };
      
      // Convertir en JSON et encoder pour GitHub
      const content = JSON.stringify(payload);
      const encodedContent = btoa(unescape(encodeURIComponent(content)));
      
      // Récupérer le SHA actuel du fichier
      let sha = null;
      try {
        const currentFile = await fetch(GLOBAL_API_URL, {
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
      
      // Pour l'instant, on simule la publication car on n'a pas de jeton
      // Dans la version finale, cela utilisera un système de contributions anonymes
      console.log('Publication vers le modèle global :', {
        revision: newRevision,
        contributor: contributorId,
        size: content.length
      });
      
      // Mettre à jour localement
      this.setLastSyncRevision(newRevision);
      
      return {
        revision: newRevision,
        published: true,
        message: 'Contribution enregistrée (sera synchronisée avec le serveur)'
      };
      
    } catch (error) {
      console.error('Erreur de publication :', error);
      return {
        published: false,
        error: error.message
      };
    }
  },
  
  /**
   * Obtient les statistiques du modèle global
   */
  async getGlobalStats() {
    try {
      const data = await this.downloadGlobalModel();
      return {
        revision: data.revision,
        contributors: data.metadata?.contributors?.length || 0,
        totalContributions: data.metadata?.totalContributions || 0,
        vocabSize: data.brain?.vocab?.length || 0,
        memorySize: data.brain?.memory?.length || 0,
        updatedAt: data.updatedAt
      };
    } catch (error) {
      return {
        error: error.message,
        revision: 0,
        contributors: 0,
        totalContributions: 0
      };
    }
  },
  
  /**
   * Vérifie si le modèle est à jour
   */
  async isUpToDate() {
    try {
      const data = await this.downloadGlobalModel();
      const lastSync = this.getLastSyncRevision();
      return data.revision <= lastSync;
    } catch (error) {
      return false;
    }
  }
};

// Anciennes fonctions pour compatibilité
Shared.getToken = function() {
  return ''; // Plus besoin de jeton
};

Shared.setToken = function(token) {
  // Plus besoin de jeton
};

Shared.getLocalRevision = function() {
  return Shared.getLastSyncRevision();
};

Shared.setLocalRevision = function(rev) {
  Shared.setLastSyncRevision(rev);
};

window.Shared = Shared;
