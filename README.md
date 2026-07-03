# AI Local — v0.2

Application de bureau (Windows `.exe`) avec une interface de chat façon ChatGPT / Claude,
embarquant un **modèle d'IA local qui s'entraîne tout seul** — sur du texte via internet,
et sur la génération d'images et de vidéos.

![version](https://img.shields.io/badge/version-0.2.0-orange)

## ✨ Fonctionnalités

### 💬 Chat (vue par défaut)
- Interface moderne : thème sombre, bulles, barre latérale, indicateur de frappe.
- Le modèle apprend de chaque message que tu lui envoies.
- **Multimodal** : demande-lui « dessine un coucher de soleil » ou
  « fais une vidéo de l'océan » et il génère l'image ou la vidéo dans le chat.

### 🧠 Onglet « S'entraîner »
- **Texte via internet** : le modèle étudie des articles Wikipédia — un
  **sujet précis** que tu choisis, ou **n'importe quel sujet** (articles aléatoires)
  si tu laisses le champ vide. Sans connexion, il se replie sur l'auto-entraînement local.
- **Génération d'images** : entraînement évolutionnaire — le module génère des images
  candidates, les note (harmonie, contraste, composition), garde les meilleures et fait
  muter ses paramètres, avec aperçu en direct.
- **Génération de vidéos** : même principe, avec un aperçu animé ; les vidéos sont
  encodées en WebM directement dans l'app.
- Journal d'entraînement en direct et statistiques (cycles, vocabulaire, transitions,
  générations, confiance).

### 🔒 Modèle persistant
- Le modèle est sauvegardé automatiquement et retrouvé au prochain lancement.
- **Il ne peut pas être réinitialisé** : tout ce qu'il apprend est conservé.

## 📦 Télécharger le `.exe`

Les `.exe` sont compilés automatiquement par GitHub Actions (workflow **Build Windows .exe**) :

- **Releases** : https://github.com/dorianskyfr/ai-local/releases —
  `AI-Local-x.y.z-portable.exe` (aucune installation) et `AI Local Setup x.y.z.exe` (installateur).
- Ou onglet **Actions** → dernier run vert → artefact `AI-Local-windows`.

## 📝 Notes de version

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
- **Images / vidéos** (`renderer/vision.js`) : un « génome » de génération (palette,
  formes, symétrie, grain, dynamique) évolue par mutation ; à chaque cycle les
  candidats sont notés par des heuristiques esthétiques et le meilleur survit.
- **Internet** (`renderer/trainer.js`) : API Wikipédia (fr) — article au hasard ou
  recherche sur le sujet demandé.

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
  trainer.js             # accès internet (Wikipédia)
.github/workflows/
  build-windows.yml      # compilation du .exe + release sur GitHub Actions
```

## Licence

MIT
