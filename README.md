# AI Local — v1.5

> ## 🏁 Fin du développement
> **AI Local v1.5.0 est la version finale.** Le développement actif est terminé :
> aucune nouvelle version n'est prévue. L'application reste entièrement
> fonctionnelle et téléchargeable : le chat, l'entraînement, le LLM local et la
> génération d'images continuent de marcher sans aucun serveur — tout tourne sur
> ta machine. Le modèle communautaire reste synchronisé tant que ce dépôt existe.
> Merci à tous ceux qui ont utilisé l'app et fait grandir le modèle. ❤

Application de bureau (Windows `.exe`) avec une interface de chat façon ChatGPT / Claude,
embarquant un **modèle d'IA local qui s'entraîne tout seul** — sur du texte via internet
(y compris une recherche libre sur tout le web), et sur la génération d'images et de vidéos.
Depuis la v1.2, elle peut aussi faire tourner un **vrai LLM 100 % local** (llama.cpp),
nourri par la mémoire auto-apprise (RAG).

![version](https://img.shields.io/badge/version-1.5.0-orange)

## ✨ Fonctionnalités

### 🚀 Cerveau LLM local (optionnel, v1.2)
- **Un vrai modèle de langage sur ton PC** : Qwen 2.5 (0,5 / 1,5 / 7 milliards de
  paramètres, licence Apache 2.0) exécuté via llama.cpp, entièrement en local —
  aucune donnée envoyée dans le cloud, fonctionne hors ligne une fois téléchargé.
- **Nourri par la mémoire auto-apprise (RAG)** : les faits appris pendant tes
  entraînements sont injectés dans le prompt ; le LLM s'appuie dessus en priorité
  et cite ses sources. Le modèle auto-appris devient sa base de connaissances.
- **Téléchargement intégré** (barre de progression, annulation), choix du modèle
  selon la puissance du PC, URL `.gguf` personnalisée pour les utilisateurs
  avancés, rechargement automatique au démarrage, réponse en streaming.
- **Sans LLM, rien ne change** : l'app fonctionne exactement comme avant.

### 💬 Chat (vue par défaut)
- Interface moderne : thème sombre, bulles, indicateur de frappe, **réponses en
  streaming** mot à mot.
- **Conversations multiples** dans la barre latérale, sauvegardées et restaurées
  au lancement (titres automatiques, suppression au survol).
- **Mémoire à long terme** : le modèle retient des faits de ses lectures et de tes
  messages ; pose-lui une question sur un sujet étudié et il répond en **citant sa
  source** (« D'après ce que j'ai appris sur “Volcan” : … »). Depuis la v1.1, la
  réponse peut **combiner plusieurs faits complémentaires** sur le sujet, et la
  recherche est **pondérée par la rareté des mots** (le principe du TF-IDF) sur un
  **index inversé** — précise et quasi instantanée même avec des milliers de souvenirs.
- **Questions de suivi comprises** : le modèle retient le sujet de l'échange en
  cours — « et sa hauteur ? » est rattaché au sujet précédent au lieu d'échouer.
- **Tolérance aux fautes de frappe** : une lettre erronée, manquante ou en trop
  dans le sujet est corrigée automatiquement (une seule faute maximum, pour ne
  jamais répondre à côté).
- **Multimodal** : demande-lui « dessine un coucher de soleil » ou
  « fais une vidéo de l'océan » et il compose une vraie scène (ciel, soleil,
  montagnes, vagues animées) colorée d'après de vraies photos du sujet.
- **Recherche instantanée** : s'il ne connaît pas la réponse à une question, il
  cherche immédiatement sur toutes les sources en parallèle, apprend et répond
  avec le fait trouvé et sa source.
- **Jamais de réponse inventée** : la génération n'est plus utilisée comme
  mécanisme de réponse, qu'il s'agisse d'une question formelle ou d'un sujet
  évoqué sans syntaxe de question — un fait connu cité avec sa source, ou un
  aveu honnête qu'il ne sait pas, jamais une phrase inventée.
- **Calculatrice et horloge exactes** : « combien font 127 × 43 ? », « 20 % de
  150 ? », « quelle heure il est ? », « quel jour sommes-nous ? » — réponses
  déterministes, toujours justes (opérations, parenthèses, puissances,
  pourcentages, décimales à la française).
- **Confidences personnelles reconnues** : « mon chien s'appelle Rex » reçoit
  un accusé de réception chaleureux et reste en mémoire pour plus tard.

### 🧠 Onglet « S'entraîner »
- **Texte multi-sources en parallèle** : Wikipédia, Vikidia, Wikinews, Wiktionnaire,
  Wikisource, Wikibooks, Wikiversité et les actualités (France Info, Le Monde) sont
  interrogés **en même temps** à chaque cycle. Sujet précis au choix, ou n'importe
  quel sujet si le champ est vide. Sans connexion, repli sur l'auto-entraînement local.
- **Recherche libre sur tout le web** : une source « Recherche libre » (DuckDuckGo)
  n'est pas limitée aux sources prédéfinies — le modèle trouve une page pertinente
  et en apprend le texte, comme les autres sources, en parallèle.
- **N'importe quelle page, un PDF, YouTube, Vimeo, Dailymotion** : colle n'importe
  quel lien dans le champ Sujet. Pages web et PDF sont lus en entier ; YouTube donne
  les sous-titres ; Vimeo/Dailymotion donnent titre et description (un modèle de
  texte local ne peut pas réellement « regarder » une vidéo — c'est honnête et limité).
- **Vitesse réglable** : scan du PC (cœurs, mémoire) et vitesse recommandée ;
  choix entre Éco, Normal, Rapide, Turbo, Ultimate, Éclair, ou **Personnalisée**
  (curseurs cœurs/RAM qui calculent une cadence sur mesure). Le cycle d'affichage
  peut tourner très vite, mais les vraies requêtes réseau restent plafonnées à une
  toutes les 4 secondes pour ne jamais faire bloquer les services gratuits utilisés.
- **Génération d'images** : entraînement évolutionnaire — le module génère des images
  candidates, les note (harmonie, contraste, composition), garde les meilleures et fait
  muter ses paramètres, avec aperçu en direct. Compose une scène différente selon le
  sujet (volcan, océan, forêt, espace, ou paysage par défaut).
- **Génération de vidéos** : même principe, avec un aperçu animé et un léger mouvement
  de caméra (zoom, travelling) pour un vrai rendu vidéo ; encodées en WebM dans l'app.
- Journal d'entraînement en direct et statistiques (cycles, vocabulaire, souvenirs,
  générations, confiance).

### 🖼 Onglet « Galerie »
- Toutes les images générées (chat et entraînement) sont conservées automatiquement,
  avec leur sujet en légende.

### 🏆 Paliers de progression
- Deux badges dans la barre latérale (Texte, Images) qui montent de niveau à mesure
  que le modèle apprend, avec une notification à chaque palier franchi. Ce sont des
  repères **internes et ludiques**, pas une comparaison avec de vrais modèles d'IA —
  ce serait malhonnête pour un modèle de quelques Mo.

### 🔒 Modèle persistant et communautaire
- Le modèle est sauvegardé automatiquement et retrouvé au prochain lancement.
- **Il ne peut pas être réinitialisé** : tout ce qu'il apprend est conservé.
- **Modèle communautaire** : au démarrage, l'app télécharge le modèle partagé publié
  dans ce dépôt (`shared-model/model.json`) et le fusionne au sien — **automatique
  pour tout le monde, sans exception, sans réglage**. Publier ses propres avancées
  demande un jeton GitHub personnel (verrouillé une fois enregistré) : il n'y a pas
  de jeton unique intégré à l'app, un secret d'écriture dans un exécutable public
  serait extractible par n'importe qui et révoqué par la détection de fuite de
  GitHub. **Les conversations ne sont jamais partagées.**

### 🔄 Mises à jour automatiques
- À chaque démarrage, l'app vérifie les releases GitHub et propose d'installer la
  nouvelle version en un clic.

### 🎮 Discord
- Rich Presence en option : « S'entraîne : les volcans » sur ton profil Discord.

## 📦 Télécharger le `.exe`

Les `.exe` sont compilés automatiquement par GitHub Actions (workflow **Build Windows .exe**) :

- **Releases** : https://github.com/dorianskyfr/ai-local/releases —
  `AI-Local-x.y.z-portable.exe` (aucune installation) et `AI Local Setup x.y.z.exe` (installateur).
- Ou onglet **Actions** → dernier run vert → artefact `AI-Local-windows`.

## 📝 Notes de version

- [v1.5.0](docs/releases/v1.5.0.md) — version finale : audit complet du code,
  corrections de tous les bugs trouvés (réentrance, fuites de contexte entre
  conversations, versions figées, téléchargement du grand modèle), 57
  vérifications automatisées au vert.
- [v1.2.0](docs/releases/v1.2.0.md) — vrai LLM 100 % local en option (llama.cpp,
  Qwen 2.5), nourri par la mémoire auto-apprise (RAG), téléchargement intégré,
  streaming, repli complet sur le moteur de faits.
- [v1.1.0](docs/releases/v1.1.0.md) — moteur de rappel repensé (pondération par
  rareté, index inversé, réponses multi-faits), questions de suivi, tolérance
  aux fautes de frappe, mémoire ×3, pourcentages dans la calculatrice.
- [v1.0.0](docs/releases/v1.0.0.md) — recherche à la demande en texte intégral
  (les faits chiffrés sont enfin trouvés), mode personnalisé recalibré,
  calculatrice et horloge exactes, mémoire ×5, paliers étendus avec échelle
  honnête, modèle partagé documenté dans l'app.
- [v0.9.0](docs/releases/v0.9.0.md) — rappel de faits enfin fiable avec une grosse
  mémoire (garde-fou sur les mots jamais appris), contractions françaises séparées,
  mode personnalisé assaini (anti-rebond, garde-fous numériques).
- [v0.8.0](docs/releases/v0.8.0.md) — génération retirée comme mécanisme de
  réponse (plus jamais de charabia, question ou pas), rappel de faits par
  proportion de mots-clés, vitesse personnalisée, paliers de progression.
- [v0.7.0](docs/releases/v0.7.0.md) — fini les réponses absurdes aux questions sans
  réponse connue, filtre de qualité à l'apprentissage, recherche web fiabilisée,
  vitesse Éclair, vidéos avec mouvement de caméra.
- [v0.6.0](docs/releases/v0.6.0.md) — recherche libre sur tout le web, lecture de
  n'importe quelle page/PDF/vidéo, vitesse Ultimate, scènes générées repensées par
  archétype de sujet.
- [v0.5.0](docs/releases/v0.5.0.md) — vitesse réglable avec scan du PC, recherche
  instantanée quand il ne sait pas, PDF, palettes de vraies images, scènes générées,
  Discord Rich Presence, jeton verrouillé.
- [v0.4.0](docs/releases/v0.4.0.md) — apprentissage multi-sources en parallèle
  (+ YouTube), mises à jour automatiques, modèle communautaire sur GitHub,
  chatbot plus malin.
- [v0.3.0](docs/releases/v0.3.0.md) — conversations multiples, mémoire à long terme
  avec citation des sources, réponses en streaming, galerie.
- [v0.2.0](docs/releases/v0.2.0.md) — onglet d'entraînement, apprentissage via internet,
  génération d'images et de vidéos, modèle non réinitialisable.
- [v0.1.0](docs/releases/v0.1.0.md) — première version : chat + modèle local auto-apprenant.

## 🛠 Lancer en développement

```bash
npm install
npm start          # lance l'app Electron
npm run dist:win   # compile les .exe (sous Windows)
```

## 🧠 Comment le modèle apprend

- **LLM local** (`llm-main.js`) : un modèle de langage ouvert au format GGUF,
  exécuté par llama.cpp (node-llama-cpp) dans le processus principal, CPU
  uniquement. Les faits pertinents retrouvés dans la mémoire auto-apprise sont
  injectés dans chaque prompt (`renderer/prompting.js`) — le principe du RAG.
  Optionnel : sans modèle téléchargé, tout ce qui suit répond seul, comme avant.
- **Texte** (`renderer/brain.js`) : chaîne de Markov d'ordre 2 (repli d'ordre 1).
  Il compte les transitions `(mot1, mot2) → mot3` et génère mot à mot en interne
  pendant l'auto-entraînement (calibrage du vocabulaire), mais **la génération n'est
  jamais utilisée pour répondre** : toute réponse vient soit d'une petite conversation
  reconnue, soit d'un fait appris cité avec sa source (rappel par proportion de
  mots-clés partagés, insensible aux accents), soit d'un aveu honnête. Un filtre
  écarte les phrases de mauvaise qualité (listes de codes/lieux) à l'apprentissage.
- **Mémoire** : les phrases apprises avec une source deviennent des « souvenirs »,
  indexés dans un index inversé (mot-clé → souvenirs). Une question déclenche une
  recherche pondérée par la rareté de chaque mot (TF-IDF) ; les meilleurs faits
  complémentaires sont combinés et cités avec leurs sources. Le type de question
  (quantité, date, définition) favorise les souvenirs qui contiennent l'information
  attendue ; une question de suivi hérite du sujet précédent ; une faute de frappe
  d'une lettre est corrigée depuis le vocabulaire appris. Garde-fou
  anti-coïncidence : si la question contient un mot distinctif jamais appris nulle
  part (même après correction), aucune citation n'est proposée, même si d'autres
  mots génériques coïncident par hasard avec un souvenir.
- **Images / vidéos** (`renderer/vision.js`) : un « génome » de génération (palette,
  formes, symétrie, grain, dynamique) évolue par mutation ; à chaque cycle les
  candidats sont notés par des heuristiques esthétiques et le meilleur survit.
- **Internet** (`renderer/trainer.js`) : encyclopédies MediaWiki, flux RSS d'actualités,
  sous-titres YouTube, métadonnées Vimeo/Dailymotion, PDF, n'importe quelle page web et
  recherche libre (DuckDuckGo), interrogés en parallèle.
- **Communauté** (`renderer/shared.js`) : téléchargement/fusion du modèle partagé du
  dépôt et publication des grandes avancées via l'API GitHub.

## 📁 Structure

```
main.js                  # processus principal Electron
llm-main.js              # LLM local (llama.cpp) : téléchargement, chargement, génération
preload.js
renderer/
  index.html             # interface : onglets Chat / S'entraîner
  style.css
  app.js                 # logique UI, chat multimodal, centre d'entraînement
  prompting.js           # assemblage des prompts LLM (faits appris → RAG)
  brain.js               # modèle de langage local auto-apprenant
  vision.js              # génération d'images/vidéos auto-apprenante
  trainer.js             # accès internet multi-sources
  shared.js              # modèle communautaire (GitHub)
shared-model/
  model.json             # le modèle partagé par toutes les installations
.github/workflows/
  build-windows.yml      # compilation du .exe + release sur GitHub Actions
```

## Licence

MIT
