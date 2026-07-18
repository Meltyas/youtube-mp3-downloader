@echo off
title YouTube a MP3
cd /d "%~dp0"
setlocal enableextensions
set "HERE=%~dp0"

REM ---------- Configuracion ----------
set "NODE_VERSION=v20.11.0"
set "NODE_DIR=node-%NODE_VERSION%-win-x64"
set "NODE_ZIP_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_DIR%.zip"
set "YTDLP_URL=https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

echo ================================================
echo    YouTube a MP3  -  Preparando todo...
echo    (la primera vez descarga lo necesario)
echo ================================================
echo.

REM ---------- 1) Node: sistema, portable, o descargar portable ----------
set "NEED_PORTABLE=0"
where node >nul 2>nul
if errorlevel 1 set "NEED_PORTABLE=1"

if "%NEED_PORTABLE%"=="1" (
  if not exist "bin\node\node.exe" (
    echo No se encontro Node.js. Descargando version portable ^(no instala nada^)...
    if not exist "bin" mkdir "bin"
    powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri '%NODE_ZIP_URL%' -OutFile 'bin\node.zip' } catch { exit 1 }"
    if not exist "bin\node.zip" (
      echo.
      echo [ERROR] No se pudo descargar Node. Revisa tu conexion a internet.
      echo.
      pause
      exit /b
    )
    echo Extrayendo Node...
    powershell -NoProfile -Command "Expand-Archive -Path 'bin\node.zip' -DestinationPath 'bin' -Force"
    move "bin\%NODE_DIR%" "bin\node" >nul
    del "bin\node.zip" >nul 2>nul
  )
  set "PATH=%HERE%bin\node;%PATH%"
)

REM ---------- 2) yt-dlp.exe (sin Python) ----------
if not exist "bin\yt-dlp.exe" (
  echo Descargando yt-dlp.exe...
  if not exist "bin" mkdir "bin"
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri '%YTDLP_URL%' -OutFile 'bin\yt-dlp.exe' } catch { exit 1 }"
  if not exist "bin\yt-dlp.exe" (
    echo.
    echo [ERROR] No se pudo descargar yt-dlp. Revisa tu conexion a internet.
    echo.
    pause
    exit /b
  )
)

REM ---------- 3) Dependencias de Node (express + ffmpeg) ----------
if not exist "node_modules" (
  echo Instalando dependencias ^(solo la primera vez, 1-2 minutos^)...
  echo.
  call npm install
  echo.
)

REM ---------- 4) Arrancar servidor y abrir navegador ----------
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
