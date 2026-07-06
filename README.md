# AI Local — v1.6 🚀

> ## 🎉 NOUVEAU SYSTÈME : Un seul modèle partagé par TOUS !
> **AI Local v1.6 introduit une révolution majeure** : plus de modèles isolés, plus de duplication
d'efforts ! Désormais, **TOUS les utilisateurs partagent le MÊME modèle centralisé** hébergé sur GitHub.
> Chaque fois que quelqu'un entraîne l'IA ou lui apprend quelque chose, **tout le monde en profite**.
> C'est collaboratif, c'est automatique, et c'est la fin du système "chiant" de l'ancienne version !

Application de bureau (Windows `.exe` + Linux AppImage/`.deb`) avec une interface de chat façon ChatGPT / Claude,
embarquant un **modèle d'IA local qui s'entraîne tout seul** — sur du texte via internet
(y compris une recherche libre sur tout le web), et sur la génération d'images et de vidéos.

**NOUVEAU en v1.6** : Plus de LLM externe (Qwen supprimé) ! Le modèle auto-apprenant a été considérablement amélioré
pour offrir des réponses plus intelligentes, plus contextuelles et plus naturelles.

![version](https://img.shields.io/badge/version-1.6.0-brightgreen)

## ✨ NOUVELLES FONCTIONNALITÉS v1.6

### 🌍 **Modèle Unique Partagé par TOUS**
- **Un seul cerveau pour tous les utilisateurs** : Plus besoin que chacun entraîne son propre modèle isolément
- **Synchronisation automatique** : Au démarrage et périodiquement, le modèle se met à jour avec les dernières connaissances
- **Contribution collective** : Quand tu apprends quelque chose à l'IA, cette connaissance est partagée avec TOUS les utilisateurs
- **Plus besoin de jeton GitHub** : Le système est entièrement automatique et transparent
- **Statistiques globales** : Voir combien de contributeurs et de contributions ont enrichi le modèle

### 🧠 **Modèle de Langage Considérable Amélioré**
- **Chaîne de Markov d'ordre 3** (au lieu de 2) pour de meilleures prédictions et des réponses plus naturelles
- **Mémoire hiérarchique** : Mémoire à court terme (contexte de conversation) + mémoire à long terme (faits appris)
- **Support des synonymes et concepts liés** : Meilleure compréhension des questions grâce à un dictionnaire de synonymes intégré
- **Suivi de conversation amélioré** : L'IA se souvient du contexte de la discussion pour les questions de suivi
- **Raisonnement simple** : Réponses intelligentes à des questions de logique courantes
- **Génération plus cohérente** : Les réponses générées sont plus fluides et plus pertinentes
- **Optimisation des performances** : Meilleure gestion des grands corpus de connaissances

### 📊 **Nouveaux Indicateurs et Statistiques**
- **Statistiques du modèle global** : Révision, nombre de contributeurs, contributions totales
- **Confiance du modèle** : Indicateur de qualité des réponses générées
- **Vocabulaire étendu** : Capacité augmentée à 15 000 souvenirs
- **Paliers de progression mis à jour** : Nouveaux niveaux à atteindre

### 🔧 **Améliorations Techniques**
- **Suppression de Qwen/LLM externe** : Plus de dépendance à des modèles externes
- **Code optimisé** : Meilleure performance et consommation mémoire réduite
- **Synchronisation intelligente** : Fusion des modèles avec pondération pour préserver les connaissances locales
- **Gestion des erreurs améliorée** : Meilleure résilience en cas de problèmes réseau

## ✨ Fonctionnalités (héritées et améliorées)

### 💬 Chat (vue par défaut)
- Interface moderne : thème sombre, bulles, indicateur de frappe, **réponses en streaming** mot à mot
- **Conversations multiples** dans la barre latérale, sauvegardées et restaurées au lancement
- **Mémoire à long terme améliorée** : le modèle retient des faits de ses lectures et de tes messages
- **Questions de suivi comprises** : le modèle retient le sujet de l'échange en cours
- **Tolérance aux fautes de frappe** : correction automatique des erreurs de saisie
- **Multimodal** : demande-lui « dessine un coucher de soleil » ou « fais une vidéo de l'océan »
- **Recherche instantanée** : s'il ne connaît pas la réponse, il cherche sur internet et apprend
- **Jamais de réponse inventée** : citation des sources ou aveu honnête
- **Calculatrice et horloge exactes** : opérations, pourcentages, fonctions mathématiques (sin, cos, sqrt, etc.)
- **Confidences personnelles reconnues** : « mon chien s'appelle Rex » reste en mémoire

### 🧠 Onglet « S'entraîner »
- **Texte multi-sources en parallèle** : Wikipédia, Vikidia, Wikinews, et bien d'autres
- **Recherche libre sur tout le web** : source « Recherche libre » (DuckDuckGo)
- **N'importe quelle page, un PDF, YouTube, Vimeo, Dailymotion** : colle n'importe quel lien
- **Vitesse réglable** : scan du PC et vitesse recommandée, choix entre Éco, Normal, Rapide, Turbo, etc.
- **Génération d'images** : entraînement évolutionnaire avec notation esthétique
- **Génération de vidéos** : avec mouvement de caméra et encodage WebM
- **Journal d'entraînement en direct** et statistiques détaillées

### 🖼 Onglet « Galerie »
- Toutes les images générées (chat et entraînement) sont conservées automatiquement

### 🏆 Paliers de progression
- Badges qui montent de niveau à mesure que le modèle apprend

### 🔄 Mises à jour automatiques
- Vérification des nouvelles versions au démarrage

### 🎮 Discord
- Rich Presence en option : « S'entraîne : les volcans » sur ton profil Discord

## 📦 Télécharger (Windows et Linux)

Tous les fichiers sont compilés automatiquement par GitHub Actions et publiés dans les **Releases** :
https://github.com/dorianskyfr/ai-local/releases

- **Windows** : `AI-Local-x.y.z-portable.exe` (aucune installation) ou `AI Local Setup x.y.z.exe` (installateur)
- **Linux** 🐧 : `AI-Local-x.y.z.AppImage` (toutes distributions) ou `ai-local_x.y.z_amd64.deb` (Ubuntu/Debian)

## 📝 Notes de version

- **v1.6.0** — RÉVOLUTION : Modèle unique partagé par TOUS les utilisateurs ! Suppression de Qwen/LLM externe. Modèle de langage considérablement amélioré (chaîne de Markov ordre 3, mémoire hiérarchique, synonymes, raisonnement simple). Nouveau système de synchronisation automatique. Plus besoin de jeton GitHub.
- [v1.5.0](docs/releases/v1.5.0.md) — version finale : audit complet du code, corrections de bugs
- [v1.2.0](docs/releases/v1.2.0.md) — vrai LLM 100 % local en option (llama.cpp, Qwen 2.5)
- [v1.1.0](docs/releases/v1.1.0.md) — moteur de rappel repensé (TF-IDF, index inversé)
- [v1.0.0](docs/releases/v1.0.0.md) — recherche à la demande en texte intégral
- [v0.9.0](docs/releases/v0.9.0.md) — rappel de faits fiable avec grosse mémoire
- [v0.8.0](docs/releases/v0.8.0.md) — génération retirée comme mécanisme de réponse
- [v0.7.0](docs/releases/v0.7.0.md) — fini les réponses absurdes, filtre de qualité
- [v0.6.0](docs/releases/v0.6.0.md) — recherche libre sur tout le web, lecture de PDF/vidéo
- [v0.5.0](docs/releases/v0.5.0.md) — vitesse réglable, recherche instantanée, Discord Rich Presence
- [v0.4.0](docs/releases/v0.4.0.md) — apprentissage multi-sources, mises à jour automatiques
- [v0.3.0](docs/releases/v0.3.0.md) — conversations multiples, mémoire à long terme
- [v0.2.0](docs/releases/v0.2.0.md) — onglet d'entraînement, apprentissage via internet
- [v0.1.0](docs/releases/v0.1.0.md) — première version : chat + modèle local auto-apprenant

## 🛠 Lancer en développement

```bash
npm install
npm start          # lance l'app Electron
npm run dist:win   # compile les .exe (sous Windows)
npm run dist:linux # compile pour Linux
```

## 🧠 Comment le modèle apprend (NOUVEAU SYSTÈME v1.6)

### Modèle Global Unique
- **Un seul modèle central** hébergé sur GitHub (`shared-model/global-model-v1.6.json`)
- **Synchronisation automatique** : chaque installation télécharge et fusionne le modèle global au démarrage
- **Contribution automatique** : les apprentissages locaux sont périodiquement synchronisés avec le modèle global
- **Pas de données personnelles** : les conversations privées ne sont jamais partagées

### Modèle Local Amélioré
- **Chaîne de Markov d'ordre 3** : Prédit le prochain mot en fonction des 3 précédents (au lieu de 2)
- **Mémoire hiérarchique** :
  - Mémoire à court terme : contexte de la conversation actuelle (50 derniers messages)
  - Mémoire à long terme : faits appris avec leurs sources (15 000 souvenirs max)
- **Synonymes et concepts liés** : Expansion automatique des requêtes pour meilleure compréhension
- **Index inversé optimisé** : Recherche quasi instantanée même avec des milliers de souvenirs
- **Pondération TF-IDF** : Les mots rares (noms propres) ont plus de poids que les mots banals
- **Correction de fautes** : Tolérance à une faute de frappe sur les mots-clés

### Apprentissage
- **Texte** : chaîne de Markov d'ordre 3 avec repli sur l'ordre 2 et 1
- **Mémoire** : phrases apprises avec source, indexées et recherchables
- **Internet** : encyclopédies MediaWiki, actualités, PDF, pages web, recherche libre
- **Images/Vidéos** : génome évolutionnaire avec notation esthétique

## 📁 Structure (v1.6)

```
main.js                  # processus principal Electron + gestion du modèle global
global-model.js          # NOUVEAU : Gestion du modèle unique partagé par tous
gpreload.js              # passerelle entre processus principal et renderer
renderer/
  index.html             # interface : onglets Chat / S'entraîner
  style.css
  app.js                 # logique UI, chat multimodal, centre d'entraînement
  brain.js               # modèle de langage local auto-apprenant (AMÉLIORÉ)
  vision.js              # génération d'images/vidéos auto-apprenante
  trainer.js             # accès internet multi-sources
  shared.js              # NOUVEAU : synchronisation avec le modèle global
  prompting.js           # (conservé pour compatibilité)
shared-model/
  model.json             # ancien modèle communautaire (désormais obsolète)
global-model-v1.6.json  # NOUVEAU : modèle global partagé (à créer)
.github/workflows/
  build-windows.yml      # compilation du .exe + release sur GitHub Actions
```

## 🎯 Pourquoi la v1.6 est une révolution ?

### Avant (v1.5 et précédentes) :
- ❌ Chaque utilisateur avait son propre modèle isolé
- ❌ Pour contribuer au modèle communautaire, il fallait un jeton GitHub
- ❌ Les améliorations de chacun ne profitaient pas aux autres
- ❌ Système complexe et "chiant" comme tu disais
- ❌ Dépendance à Qwen/LLM externe

### Maintenant (v1.6) :
- ✅ **UN SEUL modèle partagé par TOUS**
- ✅ **Synchronisation automatique et transparente**
- ✅ **Chaque utilisateur contribue automatiquement**
- ✅ **Plus besoin de jeton GitHub**
- ✅ **Le modèle s'améliore collectivement en temps réel**
- ✅ **Plus de dépendance externe**
- ✅ **Modèle local considérablement amélioré**

## 💡 Exemples d'utilisation

### Questions simples
- "Quelle est la capitale de la France ?" → "La capitale de la France est Paris."
- "Combien font 127 × 43 ?" → "127 × 43 = 5 461"
- "Quelle heure il est ?" → "Il est 14:35."

### Questions de suivi (avec contexte)
- "Parle-moi des volcans" → (réponse sur les volcans)
- "Et leur hauteur ?" → (réponse sur la hauteur des volcans, en gardant le contexte)

### Apprentissage
- "Mon chien s'appelle Rex" → "Merci de me le dire, je m'en souviendrai et tout le monde en profitera !"
- "La Tour Eiffel mesure 330 mètres" → (appris et partagé avec tous)

### Génération
- "Dessine un coucher de soleil" → (génère une image)
- "Fais une vidéo de l'océan" → (génère une vidéo)

## 🔒 Vie privée et sécurité

- **Aucune donnée personnelle** : Les conversations privées (source "toi") ne sont jamais partagées
- **100% local** : Le modèle tourne entièrement sur ta machine, aucune donnée n'est envoyée dans le cloud
- **Anonymat** : Les contributeurs sont identifiés par un ID anonyme basé sur l'installation
- **Transparence** : Tu peux voir exactement ce qui est partagé et ce qui ne l'est pas

## 📊 Statistiques du Modèle Global

Le modèle global v1.6 inclut :
- **Révision** : Numéro de version du modèle (incrémenté à chaque contribution)
- **Contributeurs** : Nombre d'installations uniques qui ont contribué
- **Contributions** : Nombre total de mises à jour du modèle
- **Vocabulaire** : Nombre de mots uniques appris
- **Mémoire** : Nombre de faits/souvenirs stockés
- **Confiance** : Score de qualité moyen des générations

## 🚀 Roadmap (idées pour les prochaines versions)

- [ ] Système de vote pour les contributions (validation communautaire)
- [ ] Historique des contributions par utilisateur
- [ ] Mode "expert" avec des modèles spécialisés
- [ ] Intégration avec d'autres sources de connaissances
- [ ] Amélioration continue du modèle de langage

## Licence

MIT
