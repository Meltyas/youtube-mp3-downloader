# YouTube → MP3

App web sencilla con **cola de descargas** para convertir vídeos y playlists de YouTube a MP3.
Pega una o varias URLs y las va descargando (varias a la vez), con auto-descarga al terminar.

![estado](https://img.shields.io/badge/estado-funcional-brightgreen)

## ✨ Características

- 🎵 Convierte vídeos de YouTube a **MP3** (máxima calidad).
- 📋 **Playlists**: pega una URL de playlist y la expande en un MP3 por vídeo.
- ⚡ **Descargas simultáneas** (3 a la vez por defecto, configurable).
- ⬇️ **Auto-descarga**: cada MP3 se descarga solo a tu equipo al terminar.
- 🖼️ Muestra **título, duración y miniatura** de cada vídeo.
- 🗂️ **Historial persistente**: no desaparece al cerrar. Se borra solo con el botón "Borrar todo" o quitando entradas.
- 📁 **Carpeta de destino configurable** (por defecto `downloads/`).

## 🚀 Uso rápido (Windows)

Solo tienes que hacer **doble clic en `Iniciar.bat`**. Es el único archivo que debes abrir.

La primera vez, el lanzador se encarga de todo automáticamente:
- Instala **Node.js** y **Python** si no los tienes (usando `winget`).
- Instala **yt-dlp** y las dependencias (express, ffmpeg).
- Abre la app en tu navegador.

Pega URLs de YouTube (vídeos o playlists) y listo.
Para cerrar la app, cierra la ventana del servidor.

> Si es la primera vez y se instala Node/Python, puede que tengas que cerrar la
> ventana y volver a hacer doble clic en `Iniciar.bat` una vez (Windows necesita
> refrescar el PATH). El lanzador te lo indicará.

## 🛠️ Uso manual (cualquier sistema)

Requisitos: Node.js, Python y `yt-dlp` (`pip install yt-dlp`).
ffmpeg viene incluido vía el paquete `ffmpeg-static`.

```bash
npm install      # solo la primera vez
npm start
```

Luego abre **http://localhost:3000**

## ⚙️ Ajustes

Desde la sección **⚙️ Ajustes** de la web puedes cambiar:
- **Carpeta de destino** donde se guardan los MP3.
- **Descargas simultáneas** (1–10).

## 📝 Notas

- Los MP3 se guardan también en la carpeta de destino (por defecto `downloads/`).
- Las listas **Mix/Radio** de YouTube (`list=RD...`) no se expanden (son infinitas): se baja solo ese vídeo.
- Límite de seguridad de 300 vídeos por playlist.
- Si alguna descarga falla, actualiza yt-dlp: `pip install -U yt-dlp`.

## 🧱 Tecnología

- **Backend**: Node.js + Express
- **Descarga**: [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **Conversión**: ffmpeg (vía `ffmpeg-static`)
- **Frontend**: HTML + CSS + JS (sin frameworks)
