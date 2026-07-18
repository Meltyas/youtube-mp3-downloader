@echo off
title YouTube a MP3
cd /d "%~dp0"
setlocal enableextensions enabledelayedexpansion

echo ================================================
echo    YouTube a MP3  -  Preparando todo...
echo    (la primera vez puede instalar Node y Python)
echo ================================================
echo.

REM ---------- Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado. Instalandolo automaticamente...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo.
    echo [ERROR] No se puede instalar solo ^(falta "winget" en este Windows^).
    echo Instala Node.js desde  https://nodejs.org  y vuelve a abrir este archivo.
    echo.
    pause
    exit /b
  )
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
  set "PATH=%ProgramFiles%\nodejs;!PATH!"
)

REM ---------- Python ----------
where python >nul 2>nul
if errorlevel 1 (
  echo Python no esta instalado. Instalandolo automaticamente...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo.
    echo [ERROR] No se puede instalar solo ^(falta "winget" en este Windows^).
    echo Instala Python desde  https://www.python.org/downloads/  ^(marca "Add to PATH"^).
    echo.
    pause
    exit /b
  )
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent
  for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do set "PYHOME=%%D"
  if defined PYHOME set "PATH=!PYHOME!;!PYHOME!\Scripts;!PATH!"
)

REM ---------- Revalidar (a veces Windows necesita reabrir para ver el PATH nuevo) ----------
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js ya esta instalado, pero Windows necesita que reabras la app.
  echo   =^> Cierra esta ventana y vuelve a hacer doble clic en Iniciar.bat
  echo.
  pause
  exit /b
)
where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python ya esta instalado, pero Windows necesita que reabras la app.
  echo   =^> Cierra esta ventana y vuelve a hacer doble clic en Iniciar.bat
  echo.
  pause
  exit /b
)

REM ---------- yt-dlp (dentro de Python, no es un .exe suelto) ----------
python -m yt_dlp --version >nul 2>nul
if errorlevel 1 (
  echo Instalando yt-dlp...
  python -m pip install --quiet --upgrade yt-dlp
)

REM ---------- Dependencias de Node (express + ffmpeg) ----------
if not exist "node_modules" (
  echo Instalando dependencias ^(solo la primera vez, 1-2 minutos^)...
  echo.
  call npm install
  echo.
)

REM ---------- Arrancar servidor y abrir navegador ----------
echo Iniciando el servidor...
start "YouTube a MP3 (servidor)" cmd /k node server.js
echo Esperando a que arranque...
timeout /t 3 >nul
start "" http://localhost:3000

echo.
echo ================================================
echo  Listo! La app se ha abierto en tu navegador.
echo.
echo  - Pega URLs de YouTube (videos o playlists).
echo  - Los MP3 se descargan solos al terminar.
echo.
echo  El servidor corre en la OTRA ventana.
echo  Para CERRAR la app, cierra esa otra ventana.
echo ================================================
echo.
timeout /t 8 >nul
exit /b
