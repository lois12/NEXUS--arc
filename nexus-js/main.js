/**
 * 📦 NEXUS CORE | nexus-js/main.js
 * 🎯 Модуль: Главный контроллер, маршрутизация, переходы, персистентность, частицы
 * 🔄 Обновлено: FIX документов, FIX перепрыгивания на F5, улучшенная логика DOM
 */

import {
  showToast,
  setTheme,
  startClock,
  showPageTransition,
  hidePageTransition,
} from "./utils.js";
import { checkAuth, logout, openProfileModal } from "./auth.js";
import { loadTasks, loadArchive } from "./tasks.js";
import {
  renderCalendar,
  renderNextPost,
  initVoiceInputs,
} from "./mediaplan.js";
import { loadKnowledge } from "./knowledge.js";
import { openResourceModal } from "./resources.js";
import { initStorage } from "./storage.js";
import { initDocuments } from "./documents.js";
import { initCLI } from "./cli.js";

// 🔹 ГЛОБАЛЬНЫЕ БИНДИНГИ
window.setTheme = setTheme;
window.navigateTo = navigateTo;
window.logout = logout;
window.openProfileModal = openProfileModal;
window.openResourceModal = openResourceModal;

// 🔹 НОВЫЕ: Экспорт хелперов для модалок
export { showModal, hideModal, initModals };

// 🔹 СОСТОЯНИЕ И КОНФИГУРАЦИЯ
// Важно: ключи здесь должны совпадать с data-page в HTML
let currentPage = localStorage.getItem("nexus_current_page") || "home";
const pages = [
  "home",
  "main",
  "archive",
  "mediaplan",
  "logo",
  "documents", // 🔥 ИСПРАВЛЕНО: было "documents-page", теперь "documents"
  "knowledge",
  "qr-generator",
];

// ============================================================================
// 🔹 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
function hasAnyToken() {
  return !!(
    window.nexusAuth?.token ||
    localStorage.getItem("nexus_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("nexus_token")
  );
}

function syncHeaderUI() {
  const nickEl = document.getElementById("header-nickname");
  const avatarEl = document.querySelector(".user-avatar-small");

  if (window.nexusAuth?.user) {
    const user = window.nexusAuth.user;
    if (nickEl) nickEl.textContent = (user.username || "USER").toUpperCase();
    if (avatarEl) {
      avatarEl.innerHTML = user.profile?.avatar
        ? `<img src="${user.profile.avatar}" alt="avatar">`
        : `<span>👤</span>`;
    }
  } else {
    if (nickEl) nickEl.textContent = "GUEST";
    if (avatarEl) avatarEl.innerHTML = `<span>👤</span>`;
  }
}

function setNavVisible(visible) {
  const nav = document.getElementById("page-nav");
  if (nav) nav.style.display = visible ? "flex" : "none";
}

// ============================================================================
// 🔹 МОДАЛКИ: SCAN-LINE ANIMATION HELPERS ✨
// ============================================================================
function showModal(modal, options = {}) {
  const modalEl =
    typeof modal === "string" ? document.getElementById(modal) : modal;

  if (!modalEl) {
    console.warn(`⚠️ Modal not found: ${modal}`);
    return;
  }

  const { duration = 600, focusSelector = null } = options;

  document.querySelectorAll(".nexus-modal.animating").forEach((m) => {
    m.classList.remove("animating");
  });

  modalEl.classList.add("active");
  void modalEl.offsetWidth;
  modalEl.classList.add("animating");

  setTimeout(() => {
    modalEl.classList.remove("animating");
    if (focusSelector) {
      const focusEl = modalEl.querySelector(focusSelector);
      if (focusEl) focusEl.focus();
    }
  }, duration);

  return modalEl;
}

function hideModal(modal) {
  const modalEl =
    typeof modal === "string" ? document.getElementById(modal) : modal;

  if (!modalEl) return;
  modalEl.classList.remove("active");
  setTimeout(() => document.body.focus(), 100);
}

function initModals() {
  document.querySelectorAll(".nexus-modal").forEach((modal) => {
    const closeBtn = modal.querySelector(".modal-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        hideModal(modal);
      });
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".nexus-modal.active").forEach(hideModal);
    }
  });
}

// ============================================================================
// 🔹 НАВИГАЦИЯ (SPA ROUTER)
// ============================================================================
export function navigateTo(page) {
  console.log(`🔄 NEXUS: Navigation to ${page}`);

  // Разрешаем переход на главную без токена
  if (!hasAnyToken() && page !== "home") {
    showToast("⚠️ Требуется авторизация", "warning");
    return;
  }
  if (page === currentPage) return;

  localStorage.setItem("nexus_current_page", page);

  showPageTransition("navigate").then(() => {
    applyPageState(page);
    hidePageTransition();
  });
}

function applyPageState(page) {
  currentPage = page;
  console.log(`📄 Setting active page: ${page}`);

  // Навигация видна везде, кроме "home" (если авторизован)
  setNavVisible(page !== "home" && hasAnyToken());

  // Подсветка кнопок меню
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));

  // 🔹 СПЕЦИАЛЬНОЕ ОБРАБОТЫВАНИЕ ЛЕНДИНГА
  const landing = document.getElementById("landing-page");
  if (landing) {
    landing.style.display = page === "home" ? "flex" : "none";
  }

  // 🔹 СПИСОК ВСЕХ ВВОДНЫХ БЛОКОВ (ВАЖНО: ДОБАВЛЕН "documents")
  const allPages = [
    "home",
    "main",
    "archive",
    "mediaplan",
    "logo",
    "documents", // 🔥 ДОБАВЛЕНО: теперь блок виден
    "knowledge",
    "decision",
    "qr-generator",
  ];

  // Переключение видимости блоков
  allPages.forEach((p) => {
    // Пропускаем home здесь, т.к. лендинг обработан отдельно
    if (p === "home") return;

    const el = document.getElementById(`${p}-page`);

    if (el) {
      if (p === page) {
        el.classList.remove("hidden");
        el.style.display = "block"; // 🔥 Принудительное отображение
        console.log(`✅ Showing block: ${p}-page`);
      } else {
        el.classList.add("hidden");
        el.style.display = "none";
      }
    } else {
      console.warn(`⚠️ Element not found in DOM: ${p}-page`);
    }
  });

  loadPageData(page);
}

function loadPageData(page) {
  console.log(`📥 Loading data for: ${page}`);
  switch (page) {
    case "main":
      loadTasks();
      break;
    case "archive":
      loadArchive();
      break;
    case "mediaplan":
      renderCalendar();
      renderNextPost();
      break;
    case "logo":
      initStorage();
      break;
    case "documents": // 🔥 Кейс для документов
      initDocuments();
      break;
    case "knowledge":
      loadKnowledge();
      break;
    case "decision":
      // Decision logic handled in decision.js
      break;
    case "qr-generator":
      // QR Generator logic handled in iframe
      break;
  }
}

// 🔹 Привязка кликов к кнопкам
document
  .querySelectorAll(".nav-btn")
  .forEach((btn) => (btn.onclick = () => navigateTo(btn.dataset.page)));
document
  .querySelectorAll(".module-card")
  .forEach((card) => (card.onclick = () => navigateTo(card.dataset.page)));

// ============================================================================
// 🔹 ИНИЦИАЛИЗАЦИЯ
// ============================================================================
function startAppSequence() {
  startClock();
  initVoiceInputs();
  initCanvasParticles();
  initCLI();
  syncHeaderUI();

  // 🔹 ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ (FIX F5)
  const saved = localStorage.getItem("nexus_current_page");

  // Проверяем, есть ли сохраненная страница в допустимом списке
  const target = saved && pages.includes(saved) ? saved : "home";

  console.log(`🚀 Start sequence: Target page -> ${target}`);
  applyPageState(target);
}

function isPageReload() {
  if (window.performance?.navigation?.type === 1) return true;
  const nav = window.performance?.getEntriesByType?.("navigation")?.[0];
  return nav?.type === "reload";
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔹 NEXUS DOM Loaded");
  const isReload = isPageReload();

  showPageTransition(isReload ? "refresh" : "navigate").then(() => {
    checkAuth().then((isAuth) => {
      if (isAuth) {
        startAppSequence();
      } else {
        // Если не авторизован — сбрасываем всё на "home"
        localStorage.removeItem("nexus_token");
        localStorage.removeItem("token");
        sessionStorage.removeItem("nexus_token");
        window.nexusAuth = null;
        applyPageState("home");
        syncHeaderUI();
        setNavVisible(false);
      }

      // Инициализация модалок
      initModals();

      hidePageTransition();
    });
  });
  // ... (в твоём main.js после всех инициализаций)

  function checkFooterVisibility() {
    const footer = document.getElementById("nexus-footer");
    if (!footer) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Проверяем, достиг ли скролл самого низа
    if (scrollY + windowHeight >= docHeight - 1) {
      // -1 чтобы учесть погрешности
      footer.style.bottom = "0";
    } else {
      footer.style.bottom = "-60px"; // Скрыть
    }
  }

  // При загрузке страницы
  window.addEventListener("load", checkFooterVisibility);

  // При скролле
  window.addEventListener("scroll", checkFooterVisibility);

  // При изменении размера окна
  window.addEventListener("resize", checkFooterVisibility);
});

window.addEventListener("nexus:auth-success", () => {
  hidePageTransition();
  syncHeaderUI();
  setNavVisible(true);
  startAppSequence();
});

// ============================================================================
// 🔹 ФОНОВАЯ АНИМАЦИЯ (CANVAS PARTICLES)
// ============================================================================
function initCanvasParticles() {
  const cv = document.getElementById("bg-canvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  let w,
    h,
    pts = [];
  let ms = { x: -1000, y: -1000, r: 150 };
  const cfg = { pc: 60, cd: 140, ps: 2, mr: 150, bs: 0.3, lo: 0.3, po: 0.7 };

  function rsz() {
    w = cv.width = window.innerWidth;
    h = cv.height = window.innerHeight;
  }
  class P {
    constructor() {
      this.ox = Math.random() * w;
      this.oy = Math.random() * h;
      this.x = this.ox;
      this.y = this.oy;
      this.vx = (Math.random() - 0.5) * cfg.bs;
      this.vy = (Math.random() - 0.5) * cfg.bs;
      this.s = Math.random() * cfg.ps + 1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      const dx = ms.x - this.x,
        dy = ms.y - this.y,
        d = Math.sqrt(dx * dx + dy * dy);
      if (d < ms.r) {
        this.x -= dx * 0.02;
        this.y -= dy * 0.02;
      }
      if (Math.abs(this.vx) < 0.01 && Math.abs(this.vy) < 0.01) {
        this.vx = (Math.random() - 0.5) * cfg.bs;
        this.vy = (Math.random() - 0.5) * cfg.bs;
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2);
      ctx.fillStyle =
        getComputedStyle(document.body).getPropertyValue("--neon-cyan") ||
        "#00f0ff";
      ctx.globalAlpha = cfg.po;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function initP() {
    pts = [];
    for (let i = 0; i < Math.min(cfg.pc, Math.floor((w * h) / 15000)); i++)
      pts.push(new P());
  }
  function drawC() {
    const tc =
      getComputedStyle(document.body).getPropertyValue("--neon-cyan") ||
      "#00f0ff";
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x,
          dy = pts[i].y - pts[j].y,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d < cfg.cd) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = tc;
          ctx.globalAlpha = (1 - d / cfg.cd) * cfg.lo;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      const dx = ms.x - pts[i].x,
        dy = ms.y - pts[i].y,
        d = Math.sqrt(dx * dx + dy * dy);
      if (d < ms.r * 1.5) {
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(ms.x, ms.y);
        ctx.strokeStyle = tc;
        ctx.globalAlpha = (1 - d / (ms.r * 1.5)) * 0.4;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
  function anim() {
    ctx.clearRect(0, 0, w, h);
    pts.forEach((p) => {
      p.update();
      p.draw();
    });
    drawC();
    requestAnimationFrame(anim);
  }
  window.addEventListener("resize", () => {
    rsz();
    initP();
  });
  window.addEventListener("mousemove", (e) => {
    ms.x = e.clientX;
    ms.y = e.clientY;
  });
  window.addEventListener("mouseleave", () => {
    ms.x = -1000;
    ms.y = -1000;
  });
  rsz();
  initP();
  anim();
}

// ============================================================================
// 🔹 ДИАГНОСТИКА
// ============================================================================
document
  .getElementById("check-connection-btn")
  ?.addEventListener("click", async function () {
    if (!hasAnyToken()) return showToast("Требуется авторизация", "warning");
    const btn = this;
    btn.disabled = true;
    btn.textContent = "🔍 Проверка...";
    try {
      const start = Date.now();
      await fetch(`${window.location.origin}/api/tasks`, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
        cache: "no-store",
      });
      showToast(
        `✅ Связь установлена | Пинг: ${Date.now() - start}ms`,
        "success",
        4000,
      );
    } catch {
      showToast("❌ Сервер не отвечает", "error", 4000);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔍 + ИНИЦИАЛИЗИРОВАТЬ";
    }
  });

console.log("🚀 NEXUS CORE: App Initialized Successfully");
