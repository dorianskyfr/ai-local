#!/bin/bash

# Script de build complet pour AI Local v1.6.0
# Génère tous les assets : portable.exe, setup.exe, AppImage, .deb

set -e

echo "=========================================="
echo "AI Local v1.6.0 - Build All Platforms"
echo "=========================================="

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js est requis mais non trouvé"
    echo "Installez Node.js 20+ : https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm est requis mais non trouvé"
    exit 1
fi

# Vérifier electron-builder
if ! npm list -g electron-builder &> /dev/null; then
    echo "⚠️  electron-builder non trouvé globalement, installation..."
    npm install -g electron-builder
fi

# Installer les dépendances
 echo "⏳ Installation des dépendances..."
npm install

# Vérifier la version
VERSION=$(node -p "require('./package.json').version")
echo "📦 Version : v$VERSION"

# Créer le dossier de sortie
mkdir -p dist

# Détecter le système d'exploitation
OS="$(uname -s)"
echo "🖥️  Système : $OS"

if [ "$OS" = "Linux" ]; then
    echo ""
    echo "=========================================="
    echo "Build Linux (AppImage + DEB)"
    echo "=========================================="
    
    # Installer les dépendances pour electron-builder sur Linux
    echo "⏳ Installation des dépendances Linux..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y rpm fuse libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y rpm fuse libX11 libXcomposite libXcursor libXdamage libXi libXtst nss cups libXScrnSaver libXrandr alsa-lib atk at-spi2-atk at-spi2-core gtk3
    elif command -v yum &> /dev/null; then
        sudo yum install -y rpm fuse libX11 libXcomposite libXcursor libXdamage libXi libXtst nss cups libXScrnSaver libXrandr alsa-lib atk at-spi2-atk at-spi2-core gtk3
    else
        echo "⚠️  Impossible d'installer les dépendances automatiquement"
        echo "Installez manuellement : rpm, fuse, et les bibliothèques GTK/X11"
    fi
    
    echo "⏳ Build AppImage et DEB..."
    npx electron-builder --linux --x64 --publish never
    
    echo ""
    echo "✅ Build Linux terminé !"
    echo "Fichiers générés :"
    ls -lh dist/ 2>/dev/null || echo "Aucun fichier dans dist/"
    
elif [ "$OS" = "Darwin" ]; then
    echo "⚠️  macOS n'est pas officiellement supporté pour le build"
    echo "Utilisez les workflows GitHub Actions pour builder"
    exit 1
else
    echo "⚠️  Système non reconnu : $OS"
    echo "Ce script fonctionne sur Linux et Windows (via WSL ou GitHub Actions)"
    exit 1
fi

echo ""
echo "=========================================="
echo "Build terminé !"
echo "=========================================="
echo ""
echo "Pour builder sur Windows, utilisez :"
echo "  npm run dist:win"
echo ""
echo "Pour builder sur Linux, utilisez :"
echo "  npm run dist:linux"
echo ""
echo "Pour builder tout via GitHub Actions :"
echo "  Lancez le workflow 'Build v1.6.0 Complete - All Platforms'"
