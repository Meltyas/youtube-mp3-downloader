@echo off
title YouTube a MP3
cd /d "%~dp0"

echo ================================================
echo    YouTube a MP3  -  Iniciando...
echo ================================================
echo.

REM --- Comprobar Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encuentra Node.js en tu equipo.
  echo.
  echo   Descarga la version "LTS" desde:  https://nodejs.org
  echo   Instalala y vuelve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b
)

REM --- Comprobar Python ---
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encuentra Python en tu equipo.
  echo.
  echo   Descargalo desde:  https://www.python.org/downloads/
  echo   IMPORTANTE: marca la casilla "Add Python to PATH" al instalar.
  echo   Luego vuelve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b
)

REM --- Instalar dependencias de Node la primera vez ---
if not exist "node_modules" (
  echo Instalando dependencias por primera vez. Esto puede tardar 1-2 minutos...
  echo.
  call npm install
  echo.
)

REM --- Asegurar que yt-dlp esta instalado ---
python -m yt_dlp --version >nul 2>nul
if errorlevel 1 (
  echo Instalando yt-dlp...
  python -m pip install --quiet --upgrade yt-dlp
  echo.
)

REM --- Arrancar el servidor en su propia ventana ---
echo Iniciando el servidor...
start "YouTube a MP3 (servidor)" cmd /k node server.js

REM --- Esperar y abrir el navegador ---
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
