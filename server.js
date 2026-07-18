import express from "express";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const DEFAULT_DOWNLOADS = path.join(__dirname, "downloads");
const PORT = process.env.PORT || 3000;
const PYTHON = process.platform === "win32" ? "python" : "python3";

// yt-dlp: usa el binario suelto de bin/ (sin Python) si existe; si no, cae a "python -m yt_dlp".
const YTDLP_EXE = path.join(__dirname, "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const HAS_YTDLP_EXE = fs.existsSync(YTDLP_EXE);
function spawnYtdlp(args) {
  return HAS_YTDLP_EXE ? spawn(YTDLP_EXE, args) : spawn(PYTHON, ["-m", "yt_dlp", ...args]);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(DEFAULT_DOWNLOADS, { recursive: true });

// ---------- Estado persistente ----------
let state = {
  nextId: 1,
  jobs: [],
  settings: { outputDir: DEFAULT_DOWNLOADS, concurrency: 3 },
};

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    state = {
      nextId: parsed.nextId || 1,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      settings: { ...state.settings, ...(parsed.settings || {}) },
    };
    // Los que quedaron a medias al cerrar vuelven a la cola
    for (const j of state.jobs) {
      if (["downloading", "converting"].includes(j.status)) {
        j.status = "queued";
        j.progress = 0;
      }
    }
  } catch {
    /* primera ejecución: no hay estado guardado */
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch {}
  }, 150);
}

load();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function findJob(id) {
  return state.jobs.find((j) => j.id === id);
}

// ---------- Metadatos / expansión ----------
function thumbFor(id) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

// Expande una URL: playlist -> N vídeos; vídeo -> 1. Devuelve [{id,title,duration}].
// Los "Mix/Radio" (list=RD...) NO se expanden (son infinitos).
function expandUrl(url) {
  return new Promise((resolve) => {
    const listMatch = url.match(/[?&]list=([\w-]+)/);
    const isMix = listMatch && /^(RD|UL|RDMM|RDCLAK)/.test(listMatch[1]);

    const args = [
      "--no-warnings",
      "--flat-playlist",
      "--print", "%(id)s\t%(title)s\t%(duration)s",
    ];
    if (isMix) args.push("--no-playlist");
    else args.push("-I", "1:300"); // límite de seguridad

    args.push(url);

    const p = spawnYtdlp(args);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => {
      const entries = out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [id = "", title = "", dur = ""] = line.split("\t");
          const d = dur.trim();
          return {
            id: id.trim(),
            title: title.trim() || id.trim(),
            duration: /^\d+(\.\d+)?$/.test(d) ? Math.round(parseFloat(d)) : null,
          };
        })
        .filter((e) => /^[\w-]{11}$/.test(e.id));
      resolve(entries);
    });
    p.on("error", () => resolve([]));
  });
}

// Metadatos para una URL suelta que no se pudo expandir (p.ej. otra web)
function fetchMeta(job) {
  const p = spawnYtdlp([
    "--no-warnings",
    "--skip-download",
    "--print", "%(title)s\t%(duration)s\t%(thumbnail)s",
    job.url,
  ]);
  let out = "";
  p.stdout.on("data", (d) => (out += d.toString()));
  p.on("close", (code) => {
    if (code !== 0 || !out.trim()) return;
    const [title = "", dur = "", thumb = ""] = out.trim().split("\n")[0].split("\t");
    if (title) job.title = title.trim();
    if (/^\d+(\.\d+)?$/.test(dur.trim())) job.duration = Math.round(parseFloat(dur));
    if (thumb.startsWith("http")) job.thumbnail = thumb.trim();
    save();
  });
}

function makeJob(videoId, url, title, duration) {
  return {
    id: state.nextId++,
    videoId: videoId || null,
    url,
    title: title || url,
    duration: duration ?? null,
    thumbnail: videoId ? thumbFor(videoId) : null,
    status: "queued",
    progress: 0,
    file: null,
    dir: state.settings.outputDir,
    error: null,
    addedAt: Date.now(),
    finishedAt: null,
  };
}

// ---------- Descarga ----------
function dirOf(job) {
  return job.dir || state.settings.outputDir;
}

function videoIdOf(job) {
  if (job.videoId) return job.videoId;
  const fromFile = (job.file || "").match(/\[([\w-]{11})\]/);
  if (fromFile) return fromFile[1];
  const m = job.url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function findFileById(job) {
  const id = videoIdOf(job);
  if (!id) return null;
  try {
    const m = fs.readdirSync(dirOf(job)).filter((f) => f.endsWith(".mp3") && f.includes(id));
    return m[0] || null;
  } catch {
    return null;
  }
}

function resolveFilePath(job) {
  const id = videoIdOf(job);
  const dir = dirOf(job);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp3"));
  } catch {
    return null;
  }
  let name = null;
  if (id) name = files.find((f) => f.includes(id));
  if (!name && job.file && files.includes(job.file)) name = job.file;
  return name ? path.join(dir, name) : null;
}

function niceName(job) {
  const base = (job.title || "audio")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return (base || "audio") + ".mp3";
}

function runJob(job) {
  return new Promise((resolve) => {
    job.status = "downloading";
    job.progress = 0;
    save();

    const dir = dirOf(job);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}

    const outTemplate = path.join(dir, "%(title)s [%(id)s].%(ext)s");
    const args = [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--ffmpeg-location", ffmpegPath,
      "--no-playlist",
      "--restrict-filenames",
      "--newline",
      "-o", outTemplate,
      job.url,
    ];

    const p = spawnYtdlp(args);
    let stderr = "";

    const handleLine = (line) => {
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m) {
        job.progress = parseFloat(m[1]);
        if (job.progress >= 100 && job.status === "downloading") job.status = "converting";
      }
      const ex = line.match(/\[ExtractAudio\] Destination: (.+\.mp3)\s*$/);
      if (ex) job.file = path.basename(ex[1].trim());
      const already = line.match(/\[download\] (.+\.mp3) has already been downloaded/);
      if (already) job.file = path.basename(already[1].trim());
    };

    p.stdout.on("data", (d) =>
      d.toString().split(/\r?\n/).forEach((l) => l && handleLine(l))
    );
    p.stderr.on("data", (d) => {
      stderr += d.toString();
      d.toString().split(/\r?\n/).forEach((l) => l && handleLine(l));
    });

    p.on("close", (code) => {
      if (code === 0) {
        job.status = "done";
        job.progress = 100;
        if (!job.file) job.file = findFileById(job);
      } else {
        job.status = "error";
        job.error = (stderr.split("\n").filter(Boolean).pop() || "Error desconocido").slice(0, 300);
      }
      job.finishedAt = Date.now();
      save();
      resolve();
    });
    p.on("error", (e) => {
      job.status = "error";
      job.error = String(e.message || e);
      job.finishedAt = Date.now();
      save();
      resolve();
    });
  });
}

// ---------- Cola concurrente ----------
let active = 0;
function pump() {
  while (active < (state.settings.concurrency || 1)) {
    const job = state.jobs.find((j) => j.status === "queued");
    if (!job) break;
    active++;
    runJob(job).finally(() => {
      active--;
      pump();
    });
  }
}

// ---------- API ----------
app.post("/api/jobs", async (req, res) => {
  const raw = String(req.body.urls || "");
  const urls = raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));

  if (urls.length === 0) {
    return res.status(400).json({ error: "No se ha encontrado ninguna URL válida." });
  }

  let count = 0;
  for (const url of urls) {
    const entries = await expandUrl(url);
    if (entries.length === 0) {
      const job = makeJob(null, url, url, null);
      state.jobs.push(job);
      fetchMeta(job);
      count++;
    } else {
      for (const e of entries) {
        state.jobs.push(makeJob(e.id, `https://www.youtube.com/watch?v=${e.id}`, e.title, e.duration));
        count++;
      }
    }
  }

  save();
  pump();
  res.json({ added: count });
});

app.get("/api/jobs", (req, res) => {
  res.json(state.jobs.slice().sort((a, b) => b.id - a.id)); // más recientes arriba
});

// Borrar TODO el historial (deja los que se están procesando)
app.delete("/api/jobs", (req, res) => {
  state.jobs = state.jobs.filter((j) => ["downloading", "converting"].includes(j.status));
  save();
  res.json({ ok: true });
});

// Borrar una entrada concreta
app.delete("/api/jobs/:id", (req, res) => {
  const job = findJob(Number(req.params.id));
  if (!job) return res.status(404).json({ error: "No existe" });
  if (["downloading", "converting"].includes(job.status)) {
    return res.status(400).json({ error: "No se puede quitar mientras se procesa." });
  }
  state.jobs.splice(state.jobs.indexOf(job), 1);
  save();
  res.json({ ok: true });
});

// Descarga del MP3 (busca por id, a prueba de nombres raros)
app.get("/download/:id", (req, res) => {
  const job = findJob(Number(req.params.id));
  if (!job || job.status !== "done") return res.status(404).send("No disponible todavía.");
  const filePath = resolveFilePath(job);
  if (!filePath) return res.status(404).send("No se encuentra el fichero en disco.");
  res.download(filePath, niceName(job));
});

// Ajustes (carpeta de destino y descargas simultáneas)
app.get("/api/settings", (req, res) => {
  res.json(state.settings);
});

app.post("/api/settings", (req, res) => {
  const s = req.body || {};
  if (typeof s.outputDir === "string" && s.outputDir.trim()) {
    const dir = s.outputDir.trim();
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      state.settings.outputDir = dir;
    } catch {
      return res.status(400).json({ error: "No se puede usar esa carpeta (¿existe? ¿permisos?)." });
    }
  }
  if (Number.isInteger(s.concurrency) && s.concurrency >= 1 && s.concurrency <= 10) {
    state.settings.concurrency = s.concurrency;
  }
  save();
  pump();
  res.json(state.settings);
});

app.listen(PORT, () => {
  console.log(`\n  ✅ App lista en:  http://localhost:${PORT}\n`);
  pump(); // reanuda lo que quedara en cola
});
