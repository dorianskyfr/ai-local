# \ud83c\udf05 Build AI Local v1.6.0 - Guide Complet

Ce guide explique comment builder et publier AI Local v1.6.0 avec tous les assets :
- **Windows** : `AI-Local-1.6.0-portable.exe` (portable) + `AI-Local-Setup-1.6.0.exe` (installateur)
- **Linux** : `AI-Local-1.6.0.AppImage` (portable) + `ai-local_1.6.0_amd64.deb` (paquet Debian)

---

## \ud83c\udf05 Pr\u0019requis

### Sur votre machine locale
- **Node.js** : Version 20+ recommand\u0019e
- **npm** : Version 10+
- **Git** : Pour cloner le d\u0019p\u0014t

### Pour Linux (build AppImage/DEB)
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y rpm fuse libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 \
    libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0

# Fedora/RHEL
sudo dnf install -y rpm fuse libX11 libXcomposite libXcursor libXdamage \
    libXi libXtst nss cups libXScrnSaver libXrandr alsa-lib atk at-spi2-atk \
    at-spi2-core gtk3
```

---

## \u26a1\ufe0f M\u0019thodes de Build

### Option 1 : Build Local (Recommand\u0019 pour les tests)

#### Sur Linux (AppImage + DEB)
```bash
# Cloner le d\u0019p\u0014t
git clone https://github.com/dorianskyfr/ai-local.git
cd ai-local

# Installer les d\u0019pendances
npm install

# Builder Linux (AppImage + DEB)
npm run dist:linux

# Les fichiers seront dans dist/
ls -la dist/
```

#### Sur Windows (Portable EXE + Installateur)
```cmd
REM Cloner le d\u0019p\u0014t
git clone https://github.com/dorianskyfr/ai-local.git
cd ai-local

REM Installer les d\u0019pendances
npm install

REM Builder Windows (portable + NSIS)
npm run dist:win

REM Les fichiers seront dans dist/
dir dist\*.exe
```

#### Builder TOUT en une commande
```bash
# Linux
npm run dist:all

# Ou utiliser le script
chmod +x build-all.sh
./build-all.sh
```

---

### Option 2 : Build via GitHub Actions (Recommand\u0019 pour la release)

Le workflow **`build-v1.6.0-complete.yml`** permet de builder et publier automatiquement tous les assets.

#### Comment l'utiliser :

1. Allez sur : [https://github.com/dorianskyfr/ai-local/actions](https://github.com/dorianskyfr/ai-local/actions)

2. S\u0019lectionnez le workflow : **"Build v1.6.0 Complete - All Platforms"**

3. Cliquez sur **"Run workflow"**

4. Optionnel : Modifiez la version (par d\u0019faut : 1.6.0)

5. Choisissez si vous voulez cr\u0019er une release GitHub (recommand\u0019 : **true**)

6. Lancez le workflow

#### Ce que fait le workflow :
- \u2705 Build Linux (AppImage + DEB) sur Ubuntu
- \u2705 Build Windows (Portable EXE + NSIS Installer) sur Windows
- \u2705 T\u0019l\u0019charge tous les artifacts
- \u2705 Cr\u0019e une release GitHub avec tous les assets
- \u2705 Upload les fichiers :
  - `AI-Local-1.6.0-portable.exe`
  - `AI-Local-Setup-1.6.0.exe`
  - `AI-Local-1.6.0.AppImage`
  - `ai-local_1.6.0_amd64.deb`

---

## \ud83d\udce6 Fichiers G\u0019n\u0019r\u0019s

Apr\u00e8s un build r\u0019ussi, vous trouverez dans le dossier `dist/` :

### Windows
| Fichier | Type | Taille | Description |
|---|---|---|---|
| `AI-Local-1.6.0-portable.exe` | Portable | ~100-150 Mo | Version portable, aucune installation requise |
| `AI-Local-Setup-1.6.0.exe` | Installateur | ~80-120 Mo | Installateur NSIS standard |

### Linux
| Fichier | Type | Taille | Description |
|---|---|---|---|
| `AI-Local-1.6.0.AppImage` | AppImage | ~100-150 Mo | Portable toutes distributions |
| `ai-local_1.6.0_amd64.deb` | DEB | ~80-120 Mo | Paquet pour Ubuntu/Debian |

---

## \ud83d\ude80 Publication Manuelle

Si vous pr\u0019f\u0019rez publier manuellement :

### 1. Builder tous les assets
```bash
# Sur Linux
npm run dist:linux

# Sur Windows
npm run dist:win
```

### 2. Cr\u0019er une release GitHub

```bash
# Cr\u0019er une nouvelle release
gh release create v1.6.0 --title "AI Local v1.6.0" --notes-file RELEASE-v1.6.0.md

# Uploader les assets
gh release upload v1.6.0 dist/AI-Local-1.6.0-portable.exe \
    dist/AI-Local-Setup-1.6.0.exe \
    dist/AI-Local-1.6.0.AppImage \
    dist/ai-local_1.6.0_amd64.deb
```

Ou via l'interface web GitHub :
1. Allez dans **Releases** > **Draft a new release**
2. Tag : `v1.6.0`
3. Title : `AI Local v1.6.0`
4. Copiez le contenu de `RELEASE-v1.6.0.md`
5. Glissez-d\u0019posez les 4 fichiers depuis `dist/`
6. Publiez la release

---

## \u274c R\u0019solution des Probl\u00e8mes

### Erreur : "fuse: device not found"
```bash
# Sur Ubuntu/Debian
sudo modprobe fuse
sudo usermod -aG fuse $USER
# Red\u0019marrez votre session
```

### Erreur : "Cannot find module 'electron-builder'"
```bash
npm install -g electron-builder
# ou
npm install
```

### Erreur : "GTK not found" sur Linux
```bash
# Ubuntu/Debian
sudo apt-get install -y libgtk-3-0

# Fedora
sudo dnf install -y gtk3
```

### Build Windows \u0019choue sur Linux
Utilisez GitHub Actions ou une machine Windows. electron-builder ne peut pas cross-compiler Windows depuis Linux sans configuration avanc\u0019e.

---

## \ud83d\udc68 V\u0019rification

Apr\u00e8s le build, v\u0019rifiez que tous les fichiers existent :

```bash
# Linux
ls -lh dist/AI-Local-1.6.0.AppImage dist/ai-local_1.6.0_amd64.deb

# Windows
ls -lh dist/AI-Local-1.6.0-portable.exe dist/AI-Local-Setup-1.6.0.exe
```

---

## \ud83c\udf89 Notes

- Les builds peuvent prendre **10-30 minutes** selon votre machine
- GitHub Actions est **gratuit** pour les d\u0019p\u0014ts publics
- Les artifacts sont conserv\u0019s **7 jours** dans GitHub Actions
- Pour une release officielle, utilisez le workflow avec `create-release: true`

---

## \ud83d\udd17 Configuration electron-builder

La configuration est dans `package.json` > `build` :

```json
{
  "win": {
    "target": ["portable", "nsis"]
  },
  "linux": {
    "target": ["AppImage", "deb"]
  }
}
```

Pour modifier les noms des fichiers, \u0019ditez les champs `artifactName` dans la section `build`.

---

## \u2728 Changelog des Assets

| Version | Windows Portable | Windows Setup | Linux AppImage | Linux DEB |
|---|---|---|---|---|
| v1.6.0 | ✅ | ✅ | ✅ | ✅ |

---

## \ud83d\udcda Liens Utiles

- [GitHub Actions](https://github.com/dorianskyfr/ai-local/actions)
- [Releases GitHub](https://github.com/dorianskyfr/ai-local/releases)
- [electron-builder Docs](https://www.electron.build/)
- [Node.js Download](https://nodejs.org/)
