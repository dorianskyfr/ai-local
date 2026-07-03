# AI Local — v0.4

Application de bureau (Windows `.exe`) avec une interface de chat façon ChatGPT / Claude,
embarquant un **modèle d'IA local qui s'entraîne tout seul** — sur du texte via internet,
et sur la génération d'images et de vidéos.

![version](https://img.shields.io/badge/version-0.4.0-orange)

## ✨ Fonctionnalités

### 💬 Chat (vue par défaut)
- Interface moderne : thème sombre, bulles, indicateur de frappe, **réponses en
  streaming** mot à mot.
- **Conversations multiples** dans la barre latérale, sauvegardées et restaurées
  au lancement (titres automatiques, suppression au survol).
- **Mémoire à long terme** : le modèle retient des faits de ses lectures et de tes
  messages ; pose-lui une question sur un sujet étudié et il répond en **citant sa
  source** (« D'après ce que j'ai appris sur “Volcan” : … »).
- **Multimodal** : demande-lui « dessine un coucher de soleil » ou
  « fais une vidéo de l'océan » et il génère l'image ou la vidéo dans le chat.

### 🧠 Onglet « S'entraîner »
- **Texte multi-sources en parallèle** : Wikipédia, Vikidia, Wikinews, Wiktionnaire,
  Wikisource et les actualités (France Info, Le Monde) sont interrogés **en même temps**
  à chaque cycle. Sujet précis au choix, ou n'importe quel sujet si le champ est vide.
  Sans connexion, repli sur l'auto-entraînement local.
- **YouTube** : colle un lien de vidéo comme sujet et le modèle apprend ses sous-titres.
- **Génération d'images** : entraînement évolutionnaire — le module génère des images
  candidates, les note (harmonie, contraste, composition), garde les meilleures et fait
  muter ses paramètres, avec aperçu en direct.
- **Génération de vidéos** : même principe, avec un aperçu animé ; les vidéos sont
  encodées en WebM directement dans l'app.
- Journal d'entraînement en direct et statistiques (cycles, vocabulaire, souvenirs,
  générations, confiance).

### 🖼 Onglet « Galerie »
- Toutes les images générées (chat et entraînement) sont conservées automatiquement,
  avec leur sujet en légende.

### 🔒 Modèle persistant et communautaire
- Le modèle est sauvegardé automatiquement et retrouvé au prochain lancement.
- **Il ne peut pas être réinitialisé** : tout ce qu'il apprend est conservé.
- **Modèle communautaire** : au démarrage, l'app télécharge le modèle partagé publié
  dans ce dépôt (`shared-model/model.json`) et le fusionne au sien ; aux grandes
  avancées d'entraînement, il est republié (jeton GitHub requis). **Les conversations
  ne sont jamais partagées.**

### 🔄 Mises à jour automatiques
- À chaque démarrage, l'app vérifie les releases GitHub et propose d'installer la
  nouvelle version en un clic.

## 📦 Télécharger le `.exe`

Les `.exe` sont compilés automatiquement par GitHub Actions (workflow **Build Windows .exe**) :

- **Releases** : https://github.com/dorianskyfr/ai-local/releases —
  `AI-Local-x.y.z-portable.exe` (aucune installation) et `AI Local Setup x.y.z.exe` (installateur).
- Ou onglet **Actions** → dernier run vert → artefact `AI-Local-windows`.

## 📝 Notes de version

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

- **Texte** (`renderer/brain.js`) : chaîne de Markov d'ordre 2 (repli d'ordre 1).
  Il compte les transitions `(mot1, mot2) → mot3`, génère mot à mot, note ses propres
  phrases (probabilité moyenne de transition) et **renforce les meilleures** — c'est
  l'auto-entraînement. L'onglet S'entraîner y ajoute la lecture d'articles Wikipédia.
- **Mémoire** : les phrases apprises avec une source deviennent des « souvenirs » ;
  une question déclenche une recherche par mots-clés et le meilleur fait est cité
  avec sa source.
- **Images / vidéos** (`renderer/vision.js`) : un « génome » de génération (palette,
  formes, symétrie, grain, dynamique) évolue par mutation ; à chaque cycle les
  candidats sont notés par des heuristiques esthétiques et le meilleur survit.
- **Internet** (`renderer/trainer.js`) : encyclopédies MediaWiki (Wikipédia, Vikidia,
  Wikinews, Wiktionnaire, Wikisource), flux RSS d'actualités et sous-titres YouTube,
  interrogés en parallèle.
- **Communauté** (`renderer/shared.js`) : téléchargement/fusion du modèle partagé du
  dépôt et publication des grandes avancées via l'API GitHub.

## 📁 Structure

```
main.js                  # processus principal Electron
preload.js
renderer/
  index.html             # interface : onglets Chat / S'entraîner
  style.css
  app.js                 # logique UI, chat multimodal, centre d'entraînement
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
