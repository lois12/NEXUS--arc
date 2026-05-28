/**
 * 📦 NEXUS CORE | nexus-js/main.js
 * 🎯 Модуль: Главный контроллер, маршрутизация, переходы, персистентность, частицы
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
import { initCLI } from "./cli.js";

// 🔹 ГЛОБАЛЬНЫЕ БИНДИНГИ
window.setTheme = setTheme;
window.navigateTo = navigateTo;
window.logout = logout;
window.openProfileModal = openProfileModal;
window.openResourceModal = openResourceModal;

// 🔹 СОСТОЯНИЕ
let currentPage = localStorage.getItem("nexus_current_page") || "home";
const pages = ["home", "main", "archive", "mediaplan", "logo", "knowledge", "qr-generator"];

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
// 🔹 НАВИГАЦИЯ (SPA ROUTER)
// ============================================================================
export function navigateTo(page) {
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
  setNavVisible(page !== "home" && hasAnyToken());

  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));

  // Скрываем лендинг если не главная
  const landing = document.getElementById("landing-page");
  if (landing) landing.style.display = page === "home" ? "flex" : "none";
  
  // Скрываем ВСЕ страницы кроме активной
  const allPages = ["home", "main", "archive", "mediaplan", "logo", "knowledge", "decision", "qr-generator"];
  allPages.forEach((p) => {
    const el = document.getElementById(`${p}-page`);
    if (el) {
      if (p === "home") {
        el.style.display = p === page ? "flex" : "none";
      } else {
        // Важно: скрываем через display:none, а не только класс hidden
        if (p === page) {
          el.classList.remove("hidden");
          el.style.display = "block";
        } else {
          el.classList.add("hidden");
          el.style.display = "none";
        }
      }
    }
  });

  loadPageData(page);
}

function loadPageData(page) {
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
    case "knowledge":
      loadKnowledge();
      break;
    case "decision":
      // Decision page doesn't need data loading
      break;
    case "qr-generator":
      // QR Generator page doesn't need data loading
      break;
  }
}

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

  const saved = localStorage.getItem("nexus_current_page");
  const target = saved && pages.includes(saved) ? saved : "main";
  applyPageState(target);
}

function isPageReload() {
  if (window.performance?.navigation?.type === 1) return true;
  const nav = window.performance?.getEntriesByType?.("navigation")?.[0];
  return nav?.type === "reload";
}

document.addEventListener("DOMContentLoaded", () => {
  const isReload = isPageReload();
  showPageTransition(isReload ? "refresh" : "navigate").then(() => {
    checkAuth().then((isAuth) => {
      if (isAuth) startAppSequence();
      else {
        localStorage.removeItem("nexus_token");
        localStorage.removeItem("token");
        sessionStorage.removeItem("nexus_token");
        window.nexusAuth = null;
        applyPageState("home");
        syncHeaderUI();
        setNavVisible(false);
      }
      hidePageTransition();
    });
  });
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
      await fetch("http://localhost:5000/api/tasks", {
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
