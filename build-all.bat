@echo off
REM Script de build complet pour AI Local v1.6.0 sur Windows
REM Génère : portable.exe et setup.exe

setlocal enabledelayedexpansion

echo ==========================================
echo AI Local v1.6.0 - Build Windows
echo ==========================================

REM Vérifier Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js est requis mais non trouvé
    echo Installez Node.js 20+ : https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ npm est requis mais non trouvé
    pause
    exit /b 1
)

REM Vérifier la version
for /f "delims=" %%i in ('node -p "require('./package.json').version"') do set VERSION=%%i
echo 📦 Version : v%VERSION%

REM Créer le dossier de sortie
if not exist dist mkdir dist

REM Installer les dépendances
echo ⏳ Installation des dépendances...
npm install

REM Builder Windows (portable + NSIS)
echo ⏳ Build Windows (portable.exe + setup.exe)...
npx electron-builder --win --x64 --publish never

echo ⏳ Build terminé !
echo.
echo Fichiers générés dans dist/ :
dir dist\*.exe 2>nul || echo Aucun fichier .exe trouvé

echo.
echo ==========================================
echo Pour builder Linux (AppImage + DEB), utilisez :
echo   npm run dist:linux
echo ou lancez le workflow GitHub Actions
echo ==========================================

pause
