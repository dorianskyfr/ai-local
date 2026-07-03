# AI Local — v0.1

Application de bureau (Windows `.exe`) avec une interface de chat façon ChatGPT / Claude,
embarquant un **modèle d'IA 100 % local qui s'entraîne tout seul**.

![version](https://img.shields.io/badge/version-0.1.0-orange)

## ✨ Fonctionnalités

- **Interface de chat** moderne (thème sombre, bulles, barre latérale, indicateur de frappe).
- **Modèle d'IA local** : une chaîne de Markov d'ordre 2 (avec repli d'ordre 1) qui apprend
  le vocabulaire et le style de tes messages. Aucune connexion internet, aucune API externe.
- **Bouton d'auto-entraînement** : quand il est activé, le modèle tourne en boucle :
  1. il consolide ce qu'il a appris de la conversation,
  2. il génère des phrases candidates, les note, et **renforce les meilleures** (auto-renforcement),
  3. il met à jour ses statistiques en direct (cycles, vocabulaire, transitions, confiance).
- **Persistance** : le modèle est sauvegardé automatiquement et retrouvé au prochain lancement.
- **Réinitialisation** possible du modèle en un clic.

## 📦 Télécharger le `.exe`

Le `.exe` est compilé automatiquement par GitHub Actions (workflow **Build Windows .exe**) :

1. Onglet **Actions** du dépôt → dernier run vert → artefact `AI-Local-windows`.
2. Deux fichiers sont produits :
   - `AI-Local-0.1.0-portable.exe` — version portable, aucun install requis ;
   - `AI Local Setup 0.1.0.exe` — installateur classique.

Sur un tag `v0.1.0`, les `.exe` sont aussi attachés à une **Release GitHub**.

## 🛠 Lancer en développement

```bash
npm install
npm start          # lance l'app Electron
npm run dist:win   # compile les .exe (sous Windows)
```

## 🧠 Comment le modèle apprend

Le "cerveau" (`renderer/brain.js`) est un modèle de langage n-grammes :

- chaque phrase est découpée en mots ; le modèle compte les transitions
  `(mot1, mot2) → mot3` (bigrammes) et `mot → suivant` (unigrammes) ;
- pour répondre, il part d'un mot de ton message et échantillonne mot à mot ;
- en mode **auto-entraînement**, il génère ses propres phrases, calcule un score de
  cohérence (probabilité moyenne de transition) et réinjecte les meilleures dans son
  apprentissage — c'est ce qui le fait progresser tout seul, cycle après cycle.

## 📁 Structure

```
main.js                  # processus principal Electron
preload.js
renderer/
  index.html             # interface de chat
  style.css
  app.js                 # logique UI + boucle d'entraînement
  brain.js               # modèle d'IA local auto-apprenant
.github/workflows/
  build-windows.yml      # compilation du .exe sur GitHub Actions
```

## Licence

MIT
