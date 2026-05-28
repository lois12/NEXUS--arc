// ============================================================================
// NEXUS SYSTEM | server.js (v9 - STORAGE MODULE: LOGO/IMPORTANT/IMG TABS)
// ============================================================================
require("dotenv").config(); // 🔹 ПЕРВАЯ СТРОКА: загружает .env до всего остального

const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const archiver = require("archiver"); // 🔹 Без .default — для v5.3.2

// 🔹 КОНФИГ ИЗ ТВОЕГО .env (с безопасными фоллбэками)
const PORT = Number(process.env.PORT) || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "nexus_secret_key_2024";
const JWT_EXPIRE = process.env.JWT_EXPIRE || "24h";
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 10485760;
const ADMIN_CREDS = {
  user: process.env.ADMIN_USER || "admin",
  pass: process.env.ADMIN_PASS || "Glaz43239989",
};

// 🔹 ПУТИ К ДАННЫМ
const DATA_DIR = path.join(__dirname, "data");
const USERS_DIR = path.join(DATA_DIR, "users");
const MEDIA_DIR = path.join(DATA_DIR, "media-plan-img");
const LOGO_DIR = path.join(DATA_DIR, "logo");
const STORAGE_DIR = path.join(DATA_DIR, "storage"); // 🔹 НОВОЕ: универсальное хранилище

const REGISTRY_FILE = path.join(USERS_DIR, "registry.json");
const MEDIA_NOTES_FILE = path.join(MEDIA_DIR, "notes.json");
const MEDIA_LOGS_FILE = path.join(MEDIA_DIR, "logs.json");
const KNOWLEDGE_FILE = path.join(DATA_DIR, "knowledge.json");
const RESOURCES_FILE = path.join(DATA_DIR, "res.json");
const FILE_DELETE_LOGS_FILE = path.join(DATA_DIR, "file-delete-logs.json");
const ADMIN_NOTES_FILE = path.join(DATA_DIR, "admintext.json");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 🔹 РАЗДАЧА СТАТИКИ (ВСЕ ФАЙЛЫ ИЗ КОРНЯ ПРОЕКТА)
app.use(express.static(path.join(__dirname)));

app.use("/nexus-js", express.static(path.join(__dirname, "nexus-js")));
app.use("/css", express.static(path.join(__dirname, "css")));

// ============================================================================
// 🔹 УТИЛИТЫ
// ============================================================================
async function readJSON(file) {
  try {
    const d = await fs.readFile(file, "utf8");
    if (!d.trim()) return [];
    return JSON.parse(d);
  } catch {
    await fs.writeFile(file, "[]", "utf8");
    return [];
  }
}
async function writeJSON(file, d) {
  await fs.writeFile(file, JSON.stringify(d, null, 2), "utf8");
}

// 🔹 FIX: Правильная обработка UTF-8 имён (кириллица, эмодзи, любой язык)
function safeFilename(file) {
  const original =
    typeof file === "string" ? file : file?.originalname || "unnamed";

  // 🔹 1. КОНВЕРТАЦИЯ: Исправляем "Latin-1 misinterpretation of UTF-8"
  // ÑÑÑÑÐºÐ¸Ð¹ -> русский
  let name = original;
  try {
    name = Buffer.from(original, "binary").toString("utf8");
  } catch (e) {
    name = original; // Фоллбэк, если что-то пошло не так
  }

  // 🔹 2. Выделяем расширение
  const ext = path.extname(name).toLowerCase();
  let base = name.slice(0, name.length - ext.length);

  // 🔹 3. Чистим ТОЛЬКО опасные символы (чёрный список)
  base = base.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_");

  // 🔹 4. Убираем дубли подчёркиваний и мусор по краям
  base = base
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  // 🔹 5. Лимит длины + фоллбэк
  const safeBase = base.slice(0, 150) || "file";

  return safeBase + ext;
}
// 🔹 БЕЗОПАСНАЯ ОЧИСТКА ИМЕНИ ПАПКИ (защита от ../ атак)
function sanitizeFolder(name) {
  return (
    (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 50) || "default"
  );
}

function createFileFilter(types) {
  const a = {
    images: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    docs: [".pdf", ".doc", ".docx", ".txt", ".md", ".zip"],
  };
  return (r, f, cb) => {
    const e = path.extname(f.originalname).toLowerCase();
    types.some((t) => a[t]?.includes(e))
      ? cb(null, true)
      : cb(new Error("Недопустимый формат"), false);
  };
}

const ENC_KEY = Buffer.from("NEXUS_ADMIN_SEC!");
function encText(t) {
  if (!t) return "";
  const iv = crypto.randomBytes(16),
    c = crypto.createCipheriv("aes-128-cbc", ENC_KEY, iv);
  return (
    iv.toString("base64") +
    ":" +
    c.update(t, "utf8", "base64") +
    c.final("base64")
  );
}
function decText(t) {
  if (!t) return "";
  try {
    const [iv, d] = t.split(":"),
      dc = crypto.createDecipheriv(
        "aes-128-cbc",
        ENC_KEY,
        Buffer.from(iv, "base64"),
      );
    return dc.update(d, "base64", "utf8") + dc.final("utf8");
  } catch {
    return "[ERROR]";
  }
}
async function logFileAction(req, act, tgt) {
  try {
    const l = await readJSON(FILE_DELETE_LOGS_FILE);
    l.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      userId: req?.user?.id || "sys",
      username: req?.user?.username || "sys",
      action: act,
      target: tgt,
    });
    if (l.length > 500) l.length = 500;
    await writeJSON(FILE_DELETE_LOGS_FILE, l);
  } catch (e) {
    console.error("[LOG ERR]", e);
  }
}

// ============================================================================
// 🔹 MIDDLEWARE
// ============================================================================
async function getUserDir(uid) {
  const dir = path.join(USERS_DIR, uid);
  await fs.mkdir(dir, { recursive: true });
  return {
    dir,
    tasks: path.join(dir, "tasks", "tasks.json"),
    uploads: path.join(dir, "uploads"),
  };
}

const authMiddleware = async (req, res, next) => {
  const a = req.headers.authorization;
  const publicPaths = [
    "/api/logos/",
    "/api/tasks/files/",
    "/api/mediaplan/images/",
    "/api/auth/avatar/",
    "/api/storage/", // 🔹 НОВОЕ: публичный доступ к файлам хранилища
  ];
  if (
    !a?.startsWith("Bearer ") &&
    !publicPaths.some((p) => req.path.startsWith(p))
  ) {
    return res.status(401).json({ error: "Auth required" });
  }
  if (!a?.startsWith("Bearer ")) return next();
  try {
    const d = jwt.verify(a.slice(7), JWT_SECRET);
    if (d.userId === "admin" && d.role === "admin") {
      req.user = { id: "admin", username: "Admin", role: "admin" };
      return next();
    }
    const u = (await readJSON(REGISTRY_FILE)).find((u) => u.id === d.userId);
    if (!u) return res.status(404).json({ error: "User not found" });
    req.user = u;
    next();
  } catch {
    if (publicPaths.some((p) => req.path.startsWith(p))) return next();
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminMiddleware = async (req, res, next) => {
  const a = req.headers.authorization;
  if (!a?.startsWith("Bearer "))
    return res.status(401).json({ error: "Auth required" });
  try {
    const d = jwt.verify(a.slice(7), JWT_SECRET);
    if (d.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.admin = d;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const handleMulter = (e, req, res, next) => {
  if (res.headersSent) return;
  if (e instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ error: e.code === "LIMIT_FILE_SIZE" ? "Файл >10МБ" : e.message });
  }
  if (e) {
    console.error("[MULTER ERR]", e);
    return res.status(400).json({ error: e.message || "Ошибка загрузки" });
  }
  next();
};

// ============================================================================
// 🔹 MULTER CONFIG
// ============================================================================
const taskStor = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const d = await getUserDir(req.user.id);
      const p = path.join(d.uploads, req.params.taskId, "main");
      await fs.mkdir(p, { recursive: true });
      cb(null, p);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => cb(null, safeFilename(file)),
});
const taskUp = multer({
  storage: taskStor,
  fileFilter: createFileFilter(["images", "docs"]),
  limits: { fileSize: MAX_FILE_SIZE },
});

const mediaStor = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(MEDIA_DIR, { recursive: true });
      const p = path.join(MEDIA_DIR, req.params.date, req.params.eventId);
      await fs.mkdir(p, { recursive: true });
      cb(null, p);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => cb(null, safeFilename(file)),
});
const mediaUp = multer({
  storage: mediaStor,
  fileFilter: createFileFilter(["images"]),
  limits: { fileSize: MAX_FILE_SIZE },
});

const logoStor = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(LOGO_DIR, { recursive: true });
    cb(null, LOGO_DIR);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file)),
});
const logoUp = multer({
  storage: logoStor,
  fileFilter: createFileFilter(["images"]),
  limits: { fileSize: MAX_FILE_SIZE },
});

// 🔹 НОВОЕ: Storage multer config (универсальный)
const storageStor = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const folder = sanitizeFolder(req.params.folder);
      const dir = path.join(STORAGE_DIR, folder);
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  // 🔹 ВОТ ЭТА СТРОКА (примерно строка 209):
  filename: (req, file, cb) => cb(null, Date.now() + "-" + safeFilename(file)),
});
const storageUp = multer({
  storage: storageStor,
  fileFilter: createFileFilter(["images"]),
  limits: { fileSize: MAX_FILE_SIZE },
});

// ============================================================================
// 🔹 1. АВТОРИЗАЦИЯ
// ============================================================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Заполните поля" });
    const u = await readJSON(REGISTRY_FILE);
    if (u.find((u) => u.email === email))
      return res.status(400).json({ error: "Email занят" });
    const np = await bcrypt.hash(password, 10);
    const n = {
      id: Date.now().toString(),
      username,
      email,
      password: np,
      role: "user",
      createdAt: new Date().toISOString(),
      profile: {},
    };
    u.push(n);
    await writeJSON(REGISTRY_FILE, u);
    const t = jwt.sign(
      { userId: n.id, username: n.username, role: n.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE },
    );
    const { password: _, ...safe } = n;
    res.status(201).json({ token: t, user: safe });
  } catch (e) {
    console.error("[REG ERR]", e);
    res.status(500).json({ error: "Ошибка" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = (await readJSON(REGISTRY_FILE)).find((u) => u.email === email);
    if (!u || !(await bcrypt.compare(password, u.password)))
      return res.status(401).json({ error: "Неверные данные" });
    const t = jwt.sign(
      { userId: u.id, username: u.username, role: u.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE },
    );
    const { password: _, ...safe } = u;
    res.json({ token: t, user: safe });
  } catch {
    res.status(500).json({ error: "Ошибка" });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const { password: _, ...s } = req.user;
  res.json({ user: s });
});

app.patch("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const u = await readJSON(REGISTRY_FILE);
    const i = u.findIndex((u) => u.id === req.user.id);
    if (i === -1) return res.status(404).json({ error: "Не найден" });
    u[i].profile = { ...u[i].profile, ...req.body };
    await writeJSON(REGISTRY_FILE, u);
    const { password: _, ...s } = u[i];
    res.json({ profile: s.profile });
  } catch {
    res.status(500).json({ error: "Ошибка" });
  }
});

// ============================================================================
// 🔹 2. ЗАДАЧИ & ФАЙЛЫ
// ============================================================================
app.post(
  "/api/tasks/:taskId/stages/main/upload",
  authMiddleware,
  taskUp.array("files", 10),
  handleMulter,
  async (req, res) => {
    if (res.headersSent) return;
    if (!req.files?.length)
      return res.status(400).json({ error: "Нет файлов" });
    try {
      const d = await getUserDir(req.user.id);
      const t = await readJSON(d.tasks);
      const task = t.find(
        (t) => t.id === req.params.taskId && t.userId === req.user.id,
      );
      if (!task) return res.status(404).json({ error: "Задача не найдена" });
      const fds = req.files.map((f) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: f.originalname,
        serverName: f.filename,
        url: `/api/tasks/files/${req.user.id}/${req.params.taskId}/main/${f.filename}`,
        size: f.size,
      }));
      if (!task.files) task.files = [];
      task.files.push(...fds);
      await writeJSON(d.tasks, t);
      res.json(fds);
    } catch (e) {
      console.error("[UPLOAD ERR]", e);
      res.status(500).json({ error: "Ошибка загрузки: " + e.message });
    }
  },
);

app.delete(
  "/api/tasks/:taskId/stages/main/files/:filename",
  authMiddleware,
  async (req, res) => {
    if (res.headersSent) return;
    try {
      const d = await getUserDir(req.user.id);
      const p = path.join(
        d.uploads,
        req.params.taskId,
        "main",
        req.params.filename,
      );
      await fs.unlink(p);
      const t = await readJSON(d.tasks);
      const task = t.find((t) => t.id === req.params.taskId);
      if (task?.files) {
        task.files = task.files.filter(
          (f) => f.serverName !== req.params.filename,
        );
        await writeJSON(d.tasks, t);
      }
      await logFileAction(req, "УДАЛЕНИЕ ФАЙЛА", p);
      res.json({ success: true });
    } catch (e) {
      console.error("[DELETE FILE ERR]", e);
      res.status(500).json({ error: "Ошибка" });
    }
  },
);

app.get(
  "/api/tasks/files/:userId/:taskId/:stage/:filename",
  async (req, res) => {
    if (res.headersSent) return;
    try {
      const d = await getUserDir(req.params.userId);
      res.sendFile(
        path.join(
          d.uploads,
          req.params.taskId,
          req.params.stage,
          req.params.filename,
        ),
      );
    } catch {
      if (!res.headersSent) res.status(404).json({ error: "Не найден" });
    }
  },
);

app.get("/api/tasks", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const d = await getUserDir(req.user.id);
    const t = await readJSON(d.tasks);
    res.json(
      t.filter(
        (t) =>
          t.userId === req.user.id &&
          (req.query.archived === "true" ? t.archived : !t.archived),
      ),
    );
  } catch (e) {
    console.error("[GET TASKS ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

app.post("/api/tasks", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const d = await getUserDir(req.user.id);
    const t = await readJSON(d.tasks);
    const n = {
      id: Date.now().toString(),
      userId: req.user.id,
      name: req.body.name || "Новая задача",
      progress: 0,
      deadline: req.body.deadline || null,
      stages: req.body.stages || [],
      priority: req.body.priority || "normal",
      pinned: false,
      archived: false,
      files: [],
      comment: "",
      createdAt: new Date().toISOString(),
    };
    t.push(n);
    await writeJSON(d.tasks, t);
    res.status(201).json(n);
  } catch (e) {
    console.error("[POST TASK ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

app.patch("/api/tasks/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const d = await getUserDir(req.user.id);
    const t = await readJSON(d.tasks);
    const i = t.findIndex(
      (t) => t.id === req.params.id && t.userId === req.user.id,
    );
    if (i === -1) return res.status(404).json({ error: "Задача не найдена" });
    t[i] = { ...t[i], ...req.body };
    await writeJSON(d.tasks, t);
    res.json(t[i]);
  } catch (e) {
    console.error("[PATCH TASK ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

app.delete("/api/tasks/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const d = await getUserDir(req.user.id);
    let t = await readJSON(d.tasks);
    t = t.filter((t) => t.id !== req.params.id);
    await writeJSON(d.tasks, t);
    try {
      await fs.rm(path.join(d.uploads, req.params.id), {
        recursive: true,
        force: true,
      });
    } catch {}
    await logFileAction(req, "УДАЛЕНИЕ ЗАДАЧИ", `tasks/${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    console.error("[DELETE TASK ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

// ============================================================================
// 🔹 3. МЕДИАПЛАН & КАЛЕНДАРЬ
// ============================================================================
app.get("/api/media-plan/notes", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json(await readJSON(MEDIA_NOTES_FILE));
  } catch (e) {
    console.error("[GET NOTES ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.post("/api/media-plan/notes", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const n = await readJSON(MEDIA_NOTES_FILE);
    const ne = {
      id: Date.now().toString(),
      date: req.body.date,
      name: req.body.name,
      comment: req.body.comment,
      channels: req.body.channels,
      eventNum: req.body.eventNum,
      createdAt: new Date().toISOString(),
      userId: req.user.id,
      username: req.user.username,
    };
    n.push(ne);
    await writeJSON(MEDIA_NOTES_FILE, n);
    res.status(201).json(ne);
  } catch (e) {
    console.error("[POST NOTE ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.patch("/api/media-plan/notes/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const n = await readJSON(MEDIA_NOTES_FILE);
    const i = n.findIndex((n) => n.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Не найдено" });
    n[i] = { ...n[i], ...req.body, updatedAt: new Date().toISOString() };
    await writeJSON(MEDIA_NOTES_FILE, n);
    res.json(n[i]);
  } catch (e) {
    console.error("[PATCH NOTE ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.delete("/api/media-plan/notes/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    let n = await readJSON(MEDIA_NOTES_FILE);
    const ev = n.find((n) => n.id === req.params.id);
    if (!ev) return res.status(404).json({ error: "Не найдено" });
    n = n.filter((n) => n.id !== req.params.id);
    await writeJSON(MEDIA_NOTES_FILE, n);
    try {
      await fs.rm(path.join(MEDIA_DIR, ev.date, ev.eventNum), {
        recursive: true,
        force: true,
      });
    } catch {}
    await logFileAction(
      req,
      "УДАЛЕНИЕ СОБЫТИЯ",
      `media/${ev.date}/${ev.eventNum}`,
    );
    res.json({ success: true });
  } catch (e) {
    console.error("[DELETE NOTE ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

app.post(
  "/api/mediaplan/upload/:date/:eventId",
  authMiddleware,
  mediaUp.array("images", 20),
  handleMulter,
  async (req, res) => {
    if (res.headersSent) return;
    if (!req.files?.length)
      return res.status(400).json({ error: "Нет файлов" });
    try {
      res.json(
        req.files.map((f) => ({
          name: f.originalname,
          serverName: f.filename,
          url: `/api/mediaplan/images/${req.params.date}/${req.params.eventId}/${f.filename}`,
          size: f.size,
        })),
      );
    } catch (e) {
      console.error("[UPLOAD MEDIA ERR]", e);
      if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
    }
  },
);
app.get(
  "/api/mediaplan/images/:date/:eventId",
  authMiddleware,
  async (req, res) => {
    if (res.headersSent) return;
    try {
      const p = path.join(MEDIA_DIR, req.params.date, req.params.eventId);
      const f = await fs.readdir(p).catch(() => []);
      res.json(
        f.map((f) => ({
          name: f,
          serverName: f,
          url: `/api/mediaplan/images/${req.params.date}/${req.params.eventId}/${f}`,
        })),
      );
    } catch (e) {
      console.error("[GET MEDIA ERR]", e);
      if (!res.headersSent) res.json([]);
    }
  },
);
app.delete(
  "/api/mediaplan/event/:date/:eventId/:filename",
  authMiddleware,
  async (req, res) => {
    if (res.headersSent) return;
    try {
      const p = path.join(
        MEDIA_DIR,
        req.params.date,
        req.params.eventId,
        req.params.filename,
      );
      await fs.unlink(p);
      await logFileAction(req, "УДАЛЕНИЕ ФОТО", p);
      res.json({ success: true });
    } catch (e) {
      console.error("[DELETE MEDIA ERR]", e);
      if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
    }
  },
);

app.get("/api/media-plan-logs", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json(await readJSON(MEDIA_LOGS_FILE));
  } catch (e) {
    console.error("[GET LOGS ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.post("/api/media-plan-logs", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const l = await readJSON(MEDIA_LOGS_FILE);
    l.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      username: req.user.username,
      action: req.body.action || "CREATE",
      eventName: req.body.eventName || "",
      date: req.body.date || "",
      details: req.body.details || "",
    });
    await writeJSON(MEDIA_LOGS_FILE, l);
    res.json({ success: true });
  } catch (e) {
    console.error("[POST LOG ERR]", e);
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

// ============================================================================
// 🔹 4. ЗНАНИЯ, РЕСУРСЫ, ЛОГОТИПЫ (СТАРОЕ — для совместимости)
// ============================================================================
app.get("/api/knowledge", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json(await readJSON(KNOWLEDGE_FILE));
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.post("/api/knowledge", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const d = await readJSON(KNOWLEDGE_FILE);
    const n = {
      id: Date.now().toString(),
      title: req.body.title,
      category: req.body.category,
      content: req.body.content,
      tags: req.body.tags || [],
      author: req.user.username,
      authorAvatar: req.user.profile?.avatar,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    d.push(n);
    await writeJSON(KNOWLEDGE_FILE, d);
    res.status(201).json(n);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.patch("/api/knowledge/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const d = await readJSON(KNOWLEDGE_FILE);
    const i = d.findIndex((d) => d.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Не найдена" });
    d[i] = { ...d[i], ...req.body, updatedAt: new Date().toISOString() };
    await writeJSON(KNOWLEDGE_FILE, d);
    res.json(d[i]);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.delete("/api/knowledge/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    let d = await readJSON(KNOWLEDGE_FILE);
    d = d.filter((d) => d.id !== req.params.id);
    await writeJSON(KNOWLEDGE_FILE, d);
    res.json({ success: true });
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

app.get("/api/resources", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json(await readJSON(RESOURCES_FILE));
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.post("/api/resources", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const l = await readJSON(RESOURCES_FILE);
    const n = {
      id: Date.now().toString(),
      name: req.body.name || "Новый",
      url: req.body.url || "https://",
      page: req.body.page || "main",
      createdAt: new Date().toISOString(),
    };
    l.push(n);
    await writeJSON(RESOURCES_FILE, l);
    res.status(201).json(n);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.patch("/api/resources/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const l = await readJSON(RESOURCES_FILE);
    const i = l.findIndex((l) => l.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Не найден" });
    Object.assign(l[i], req.body);
    await writeJSON(RESOURCES_FILE, l);
    res.json(l[i]);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.delete("/api/resources/:id", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    let l = await readJSON(RESOURCES_FILE);
    l = l.filter((l) => l.id !== req.params.id);
    await writeJSON(RESOURCES_FILE, l);
    res.json({ success: true });
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

// 🔹 ЛОГОТИПЫ (СТАРОЕ — перенаправляет в storage/logo для совместимости)
app.get("/api/logos", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const f = await fs.readdir(LOGO_DIR).catch(() => []);
    res.json(
      f.map((f) => ({
        name: f,
        url: `http://localhost:${PORT}/api/logos/${f}`,
      })),
    );
  } catch {
    if (!res.headersSent) res.json([]);
  }
});
app.post(
  "/api/logos/upload",
  authMiddleware,
  logoUp.array("files", 50),
  handleMulter,
  async (req, res) => {
    if (res.headersSent) return;
    if (!req.files?.length)
      return res.status(400).json({ error: "Нет файлов" });
    try {
      res.json(
        req.files.map((f) => ({
          name: f.originalname,
          serverName: f.filename,
          url: `http://localhost:${PORT}/api/logos/${f.filename}`,
        })),
      );
    } catch {
      if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
    }
  },
);
app.delete("/api/logos/:filename", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    await fs.unlink(path.join(LOGO_DIR, req.params.filename));
    await logFileAction(req, "УДАЛЕНИЕ ЛОГО", req.params.filename);
    res.json({ success: true });
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

// ============================================================================
// 🔹 5. НОВОЕ: УНИВЕРСАЛЬНОЕ ХРАНИЛИЩЕ (DATA/STORAGE)
// ============================================================================

// 5.1 Получение списка файлов из папки
app.get("/api/storage/:folder", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const folder = sanitizeFolder(req.params.folder);
    const dir = path.join(STORAGE_DIR, folder);
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    res.json(
      files.map((f) => ({
        name: f.replace(/^\d+-/, ""),
        serverName: f,
        url: `/api/storage/${folder}/${f}`,
      })),
    );
  } catch (e) {
    console.error("[STORAGE GET ERR]", e);
    if (!res.headersSent) res.json([]);
  }
});

// 5.2 Загрузка файлов в папку
app.post(
  "/api/storage/:folder/upload",
  authMiddleware,
  storageUp.array("files", 50),
  handleMulter,
  async (req, res) => {
    if (res.headersSent) return;
    if (!req.files?.length)
      return res.status(400).json({ error: "Нет файлов" });
    try {
      const folder = sanitizeFolder(req.params.folder);
      res.json(
        req.files.map((f) => ({
          name: f.originalname,
          serverName: f.filename,
          url: `/api/storage/${folder}/${f.filename}`,
          size: f.size,
        })),
      );
    } catch (e) {
      console.error("[STORAGE UPLOAD ERR]", e);
      if (!res.headersSent) res.status(500).json({ error: "Ошибка загрузки" });
    }
  },
);

// 🔹 5.3 УДАЛЕНИЕ ПАПКИ (ОБЯЗАТЕЛЬНО ВЫШЕ УДАЛЕНИЯ ФАЙЛА!)
app.delete("/api/storage/folder/:name", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const folder = sanitizeFolder(req.params.name);
    const dir = path.join(STORAGE_DIR, folder);
    await fs.access(dir);
    await fs.rm(dir, { recursive: true, force: true });
    await logFileAction(req, "УДАЛЕНИЕ ПАПКИ ХРАНИЛИЩА", `storage/${folder}`);
    res.json({ success: true });
  } catch (e) {
    console.error("[STORAGE DELETE FOLDER ERR]", e);
    if (!res.headersSent)
      res.status(500).json({ error: "Ошибка удаления папки" });
  }
});

// 🔹 5.4 СКАЧАТЬ ВСЁ АРХИВОМ (ZIP)
app.get("/api/storage/:folder/download", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    console.log(
      "[ARCHIVER DEBUG] typeof:",
      typeof archiver,
      "value:",
      archiver,
    );
    const folder = sanitizeFolder(req.params.folder);
    const dir = path.join(STORAGE_DIR, folder);
    await fs.access(dir);

    const files = await fs.readdir(dir);
    if (!files.length) return res.status(404).json({ error: "Папка пуста" });

    const archiveName = `nexus-${folder}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(archiveName)}"`,
    );

    // 🔹 Используем глобальный `archiver` (импортирован в начале файла с .default)
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("[ARCHIVE STREAM ERR]", err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);
    archive.directory(dir, "");
    await archive.finalize();

    await logFileAction(req, "СКАЧИВАНИЕ АРХИВА", archiveName);
  } catch (e) {
    console.error("[ARCHIVE ERR]", e);
    if (!res.headersSent)
      res.status(500).json({ error: "Ошибка архива: " + e.message });
  }
});

// 🔹 5.5 ПЕРЕИМЕНОВАНИЕ ФАЙЛА
app.post("/api/storage/rename", authMiddleware, async (req, res) => {
  if (res.headersSent) return;
  const { folder, oldName, newName } = req.body;
  if (!folder || !oldName || !newName)
    return res.status(400).json({ error: "Отсутствуют параметры" });
  try {
    const safeFolder = sanitizeFolder(folder);
    const oldPath = path.join(STORAGE_DIR, safeFolder, oldName);
    const oldExt = path.extname(oldName);
    const newExt = path.extname(newName);
    const finalExt = newExt || oldExt;
    const nameWithoutExt = newName.replace(/\.[^/.]+$/, "");
    const safeBase = nameWithoutExt
      .replace(/[\/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 100);
    const finalName = `${Date.now()}-${safeBase}${finalExt}`;
    const newPath = path.join(STORAGE_DIR, safeFolder, finalName);
    await fs.rename(oldPath, newPath);
    await logFileAction(
      req,
      "ПЕРЕИМЕНОВАНИЕ ФАЙЛА",
      `${folder}/${oldName} -> ${finalName}`,
    );
    res.json({
      success: true,
      newName: finalName,
      displayName: safeBase + finalExt,
    });
  } catch (e) {
    console.error("[RENAME ERR]", e);
    if (!res.headersSent)
      res.status(500).json({ error: "Ошибка переименования: " + e.message });
  }
});

// 5.6 Удаление файла из папки (ОБЩИЙ МАРШРУТ)
app.delete(
  "/api/storage/:folder/:filename",
  authMiddleware,
  async (req, res) => {
    if (res.headersSent) return;
    try {
      const folder = sanitizeFolder(req.params.folder);
      const filePath = path.join(STORAGE_DIR, folder, req.params.filename);
      await fs.unlink(filePath);
      await logFileAction(
        req,
        "УДАЛЕНИЕ ИЗ ХРАНИЛИЩА",
        `${folder}/${req.params.filename}`,
      );
      res.json({ success: true });
    } catch (e) {
      console.error("[STORAGE DELETE FILE ERR]", e);
      if (!res.headersSent) res.status(500).json({ error: "Ошибка удаления" });
    }
  },
);

// 5.7 Публичный доступ к файлам хранилища (ОБЩИЙ МАРШРУТ)
app.get("/api/storage/:folder/:filename", async (req, res) => {
  if (res.headersSent) return;
  try {
    const folder = sanitizeFolder(req.params.folder);
    const filePath = path.join(STORAGE_DIR, folder, req.params.filename);
    res.sendFile(filePath);
  } catch {
    if (!res.headersSent) res.status(404).json({ error: "Файл не найден" });
  }
});
// ============================================================================
// 🔹 6. АДМИНКА
// ============================================================================
app.post("/api/admin/login", async (req, res) => {
  if (res.headersSent) return;
  const { username, password } = req.body;
  if (username === ADMIN_CREDS.user && password === ADMIN_CREDS.pass) {
    const t = jwt.sign(
      { userId: "admin", role: "admin", username: "Admin" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE },
    );
    return res.json({
      token: t,
      user: { id: "admin", username: "Admin", role: "admin" },
    });
  }
  res.status(401).json({ error: "Неверные данные" });
});
app.get("/api/admin/users", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json(
      (await readJSON(REGISTRY_FILE)).map((u) => {
        const { password: _, ...s } = u;
        return { ...s, role: s.role || "user" };
      }),
    );
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.patch("/api/admin/users/:id", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const u = await readJSON(REGISTRY_FILE);
    const i = u.findIndex((u) => u.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Не найден" });
    if (
      req.body.role &&
      ["user", "editor", "moderator", "manager"].includes(req.body.role)
    )
      u[i].role = req.body.role;
    await writeJSON(REGISTRY_FILE, u);
    const { password: _, ...s } = u[i];
    res.json(s);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.get("/api/admin/stats", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const users = await readJSON(REGISTRY_FILE);
    async function count(d) {
      let c = 0;
      try {
        const e = await fs.readdir(d, { withFileTypes: true });
        for (const x of e) {
          const p = path.join(d, x.name);
          if (x.isDirectory()) c += await count(p);
          else c++;
        }
      } catch {}
      return c;
    }
    let tf = 0;
    const ud = await fs.readdir(USERS_DIR).catch(() => []);
    for (const x of ud) {
      const p = path.join(USERS_DIR, x);
      const s = await fs.stat(p).catch(() => null);
      if (s?.isDirectory())
        tf += await count(path.join(p, "uploads")).catch(() => 0);
    }
    tf +=
      (await count(MEDIA_DIR).catch(() => 0)) +
      (await count(LOGO_DIR).catch(() => 0)) +
      (await count(STORAGE_DIR).catch(() => 0));
    let tt = 0;
    for (const x of ud) {
      try {
        tt += (await readJSON(path.join(USERS_DIR, x, "tasks", "tasks.json")))
          .length;
      } catch {}
    }
    res.json({
      users: users.length,
      tasks: tt,
      files: tf,
      uptime: Math.floor(process.uptime()),
    });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});
app.get("/api/admin/file-logs", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json((await readJSON(FILE_DELETE_LOGS_FILE)).slice(0, 100));
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.get("/api/admin/notes", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    res.json(
      (await readJSON(ADMIN_NOTES_FILE)).map((n) => ({
        ...n,
        content: decText(n.content),
      })),
    );
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.post("/api/admin/notes", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const n = await readJSON(ADMIN_NOTES_FILE);
    const ne = {
      id: Date.now().toString(),
      title: req.body.title || "Без названия",
      content: encText(req.body.content || ""),
      status: req.body.status || "Запланировано",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    n.unshift(ne);
    await writeJSON(ADMIN_NOTES_FILE, n);
    res.status(201).json({ ...ne, content: req.body.content || "" });
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.patch("/api/admin/notes/:id", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    const n = await readJSON(ADMIN_NOTES_FILE);
    const i = n.findIndex((n) => n.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Не найдена" });
    if (req.body.content !== undefined)
      n[i].content = encText(req.body.content);
    if (req.body.title) n[i].title = req.body.title;
    if (req.body.status) n[i].status = req.body.status;
    n[i].updatedAt = new Date().toISOString();
    await writeJSON(ADMIN_NOTES_FILE, n);
    res.json({ ...n[i], content: req.body.content || decText(n[i].content) });
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});
app.delete("/api/admin/notes/:id", adminMiddleware, async (req, res) => {
  if (res.headersSent) return;
  try {
    let n = await readJSON(ADMIN_NOTES_FILE);
    n = n.filter((n) => n.id !== req.params.id);
    await writeJSON(ADMIN_NOTES_FILE, n);
    res.json({ success: true });
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Ошибка" });
  }
});

// ============================================================================
// 🔹 7. ДИАГНОСТИКА
// ============================================================================
app.get("/api/diagnostics/speed-test", adminMiddleware, (req, res) => {
  if (res.headersSent) return;
  res.set("Cache-Control", "no-store");
  res.send("x".repeat(1024 * 1024));
});

// ============================================================================
// 🔹 8. СТАТИКА & ПУБЛИЧНЫЕ МАРШРУТЫ
// ============================================================================
app.get("/", (req, res) => {
  if (!res.headersSent) res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/index.html", (req, res) => {
  if (!res.headersSent) res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/admin.html", (req, res) => {
  if (!res.headersSent) res.sendFile(path.join(__dirname, "admin.html"));
});
app.get("/script.js", (req, res) => {
  if (!res.headersSent) res.sendFile(path.join(__dirname, "script.js"));
});
app.get("/sw.js", (req, res) => {
  if (!res.headersSent) res.sendFile(path.join(__dirname, "sw.js"));
});
app.get("/favicon.ico", (req, res) => {
  if (res.headersSent) return;
  res.set("Content-Type", "image/x-icon");
  res.send(
    Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64",
    ),
  );
});

// 🔹 ПУБЛИЧНЫЕ КАРТИНКИ (БЕЗ AUTH)
app.get("/api/logos/:filename", async (req, res) => {
  if (res.headersSent) return;
  try {
    res.sendFile(path.join(LOGO_DIR, req.params.filename));
  } catch {
    if (!res.headersSent) res.status(404).json({ error: "Не найден" });
  }
});
app.get(
  "/api/tasks/files/:userId/:taskId/:stage/:filename",
  async (req, res) => {
    if (res.headersSent) return;
    try {
      const d = await getUserDir(req.params.userId);
      res.sendFile(
        path.join(
          d.uploads,
          req.params.taskId,
          req.params.stage,
          req.params.filename,
        ),
      );
    } catch {
      if (!res.headersSent) res.status(404).json({ error: "Не найден" });
    }
  },
);
app.get("/api/mediaplan/images/:date/:eventId/:filename", async (req, res) => {
  if (res.headersSent) return;
  try {
    res.sendFile(
      path.join(
        MEDIA_DIR,
        req.params.date,
        req.params.eventId,
        req.params.filename,
      ),
    );
  } catch {
    if (!res.headersSent) res.status(404).json({ error: "Не найден" });
  }
});
app.get("/api/auth/avatar/:userId/:filename", async (req, res) => {
  if (res.headersSent) return;
  try {
    const userDir = path.join(USERS_DIR, req.params.userId);
    const avatarDir = path.join(userDir, "avatar");
    const filePath = path.join(avatarDir, req.params.filename);
    const realPath = await fs.realpath(filePath).catch(() => null);
    const realDir = await fs.realpath(avatarDir);
    if (!realPath || !realPath.startsWith(realDir + path.sep))
      throw new Error();
    res.sendFile(realPath);
  } catch {
    if (!res.headersSent) res.status(404).json({ error: "Аватар не найден" });
  }
});

// 🔹 ФИНАЛЬНЫЙ 404
app.use((req, res) => {
  if (res.headersSent) return;
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Эндпоинт не найден" });
  res.status(404).json({ error: "Файл не найден" });
});

// ============================================================================
// 🔹 ЗАПУСК
// ============================================================================
(async function init() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(USERS_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.mkdir(LOGO_DIR, { recursive: true });
  await fs.mkdir(STORAGE_DIR, { recursive: true }); // 🔹 Создаём папку storage
  const files = [
    REGISTRY_FILE,
    MEDIA_NOTES_FILE,
    MEDIA_LOGS_FILE,
    KNOWLEDGE_FILE,
    RESOURCES_FILE,
    FILE_DELETE_LOGS_FILE,
    ADMIN_NOTES_FILE,
  ];
  for (const f of files) {
    try {
      await fs.access(f);
    } catch {
      await fs.writeFile(f, "[]", "utf8");
    }
  }
  app.listen(PORT, () => {
    console.log(`🚀 NEXUS: http://localhost:${PORT}`);
    console.log(
      `🔐 Admin: /admin.html | ${ADMIN_CREDS.user} / ${ADMIN_CREDS.pass}`,
    );
  });
})();
