/*
 * Shared — modèle communautaire hébergé sur GitHub.
 *
 * Principe : le modèle (cerveau texte + génome d'images, JAMAIS les
 * conversations) vit aussi dans le dépôt GitHub, dans shared-model/model.json.
 *  - Au démarrage, chaque installation télécharge ce modèle partagé et le
 *    fusionne avec son modèle local : une nouvelle installation ne repart
 *    donc pas de zéro, et une désinstallation ne fait rien perdre.
 *  - À chaque grande avancée d'entraînement, l'app publie le modèle fusionné
 *    sur GitHub (nécessite un jeton GitHub, à configurer dans la barre
 *    latérale — typiquement celui du propriétaire du dépôt). Tout le monde
 *    profite alors de l'entraînement de chacun : c'est collaboratif.
 */

const SHARED_REPO = 'dorianskyfr/ai-local';
const SHARED_PATH = 'shared-model/model.json';
const SHARED_RAW_URL = `https://raw.githubusercontent.com/${SHARED_REPO}/main/${SHARED_PATH}`;
const SHARED_API_URL = `https://api.github.com/repos/${SHARED_REPO}/contents/${SHARED_PATH}`;
const TOKEN_KEY = 'ai-local-github-token';
const REVISION_KEY = 'ai-local-shared-revision';

const Shared = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  },

  setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  },

  getLocalRevision() {
    return parseInt(localStorage.getItem(REVISION_KEY) || '0', 10);
  },

  setLocalRevision(rev) {
    localStorage.setItem(REVISION_KEY, String(rev));
  },

  /** Télécharge le modèle partagé publié sur GitHub. */
  async download() {
    const res = await fetch(SHARED_RAW_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  /**
   * Synchronisation au démarrage : fusionne le modèle partagé dans le modèle
   * local s'il contient une révision plus récente que la dernière vue.
   */
  async syncDown(brain, vision) {
    const data = await this.download();
    if (!data || typeof data.revision !== 'number') return { merged: false };
    if (data.revision <= this.getLocalRevision()) {
      return { merged: false, revision: data.revision };
    }
    if (data.brain) brain.mergeShared(data.brain);
    if (data.vision) vision.mergeShared(data.vision);
    brain.save();
    vision.save();
    this.setLocalRevision(data.revision);
    return { merged: true, revision: data.revision };
  },

  /**
   * Publie le modèle local (fusionné) sur GitHub. Exclut les conversations
   * par construction : seuls le cerveau et le génome sont exportés.
   */
  async publish(brain, vision) {
    const token = this.getToken();
    if (!token) throw new Error('Aucun jeton GitHub configuré');

    const headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    // Récupère le SHA et la révision du fichier actuel.
    let sha;
    let remoteRevision = 0;
    const current = await fetch(SHARED_API_URL, { headers });
    if (current.ok) {
      const info = await current.json();
      sha = info.sha;
      try {
        const existing = JSON.parse(decodeURIComponent(escape(atob(info.content.replace(/\n/g, '')))));
        remoteRevision = existing.revision || 0;
      } catch (e) { /* contenu illisible : on écrase */ }
    }

    const revision = Math.max(remoteRevision, this.getLocalRevision()) + 1;
    const payload = {
      revision,
      updatedAt: new Date().toISOString(),
      brain: brain.exportShared(),
      vision: vision.exportShared()
    };
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

    const res = await fetch(SHARED_API_URL, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Modèle partagé : révision ${revision} (publiée depuis l'app)`,
        content,
        branch: 'main',
        ...(sha ? { sha } : {})
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || ('HTTP ' + res.status));
    }
    this.setLocalRevision(revision);
    return { revision };
  }
};

window.Shared = Shared;
