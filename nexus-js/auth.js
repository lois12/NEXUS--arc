/**
 * 📦 NEXUS SYSTEM | nexus-js/auth.js
 * 🔐 Модуль: Авторизация, сессия, профиль, аватар
 */

import {
  showToast,
  setButtonLoading,
  startClock,
  showModal,
  hideModal,
} from "./utils.js";

// 🔥 ИСПРАВЛЕНО: Динамический базовый URL вместо хардкода localhost
const API_BASE = window.location.origin;
const AUTH_API = `${API_BASE}/api/auth`;

// 🔹 DOM Elements
const authOverlay = document.getElementById("auth-overlay");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");

// 🔹 State
let isRegisterMode = false;
window.nexusAuth = window.nexusAuth || { token: null, user: null };

// 🔹 Overlay Control
export function showAuthOverlay() {
  if (authOverlay) authOverlay.classList.add("active");
  document.body.classList.add("auth-required");
}

export function hideAuthOverlay() {
  if (authOverlay) authOverlay.classList.remove("active");
  document.body.classList.remove("auth-required");
}

// 🔹 Auth Check & Session Init
export async function checkAuth() {
  const t = localStorage.getItem("nexus_token");
  if (!t) {
    showAuthOverlay();
    return false;
  }

  try {
    const r = await fetch(`${AUTH_API}/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) throw new Error("Invalid");
    const d = await r.json();

    window.nexusAuth = { token: t, user: d.user };
    hideAuthOverlay();
    updateUserHeader();
    startClock();
    return true;
  } catch {
    localStorage.removeItem("nexus_token");
    showAuthOverlay();
    return false;
  }
}

// 🔹 Toggle Login/Register Mode
export function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  const titleEl = document.getElementById("auth-title");
  const usernameEl = document.getElementById("auth-username");
  const confirmEl = document.getElementById("auth-confirm");
  const submitBtn = document.getElementById("auth-submit");
  const switchText = document.getElementById("auth-switch-text");
  const toggleLink = document.getElementById("auth-toggle");

  if (titleEl)
    titleEl.textContent = isRegisterMode ? "🔐 РЕГИСТРАЦИЯ" : "🔐 ВХОД";
  if (usernameEl) usernameEl.style.display = isRegisterMode ? "block" : "none";
  if (confirmEl) confirmEl.style.display = isRegisterMode ? "block" : "none";
  if (submitBtn)
    submitBtn.textContent = isRegisterMode ? "🚀 СОЗДАТЬ" : "🚀 ВОЙТИ";
  if (switchText)
    switchText.textContent = isRegisterMode
      ? "Уже есть аккаунт? "
      : "Нет аккаунта? ";
  if (toggleLink) toggleLink.textContent = isRegisterMode ? "Войти" : "Создать";
}

// 🔹 User Header Update
function updateUserHeader() {
  const n = document.getElementById("user-name-display");
  const a = document.getElementById("user-avatar-small");
  if (n && window.nexusAuth?.user) {
    n.textContent = window.nexusAuth.user.username;
    if (a) {
      if (window.nexusAuth.user.profile?.avatar) {
        a.innerHTML = `<img src="${window.nexusAuth.user.profile.avatar}" alt="Avatar">`;
      } else {
        a.innerHTML = `<span style="font-size:16px;font-weight:700">${window.nexusAuth.user.username.charAt(0).toUpperCase()}</span>`;
      }
    }
  }
}

// 🔹 Logout
export function logout() {
  localStorage.removeItem("nexus_token");
  window.nexusAuth = { token: null, user: null };
  showToast("👋 Вы вышли", "info");
  location.reload();
}

// 🔹 Profile Modal Logic
export async function openProfileModal() {
  if (!window.nexusAuth?.token) return;
  try {
    const res = await fetch(`${AUTH_API}/me`, {
      headers: { Authorization: `Bearer ${window.nexusAuth.token}` },
    });
    if (!res.ok) throw new Error("Ошибка авторизации");

    const data = await res.json();
    window.nexusAuth.user = data.user;
    const u = data.user;
    const p = u.profile || {};

    const usernameEl = document.getElementById("prof-username");
    const roleEl = document.getElementById("prof-role");
    if (usernameEl) usernameEl.textContent = u.username;
    if (roleEl) {
      const roles = {
        admin: "👑 АДМИНИСТРАТОР",
        editor: "✏️ РЕДАКТОР",
        manager: "📊 МЕНЕДЖЕР",
        user: "👤 ПОЛЬЗОВАТЕЛЬ",
      };
      roleEl.textContent = roles[u.role] || "👤 ПОЛЬЗОВАТЕЛЬ";
    }

    const avatarImg = document.getElementById("profile-avatar-img");
    const avatarPlaceholder = document.getElementById(
      "profile-avatar-placeholder",
    );
    if (avatarImg && avatarPlaceholder) {
      if (p.avatar) {
        avatarImg.src = p.avatar;
        avatarImg.style.display = "block";
        avatarPlaceholder.style.display = "none";
      } else {
        avatarImg.style.display = "none";
        avatarPlaceholder.style.display = "flex";
      }
    }

    const firstNameEl = document.getElementById("prof-firstName");
    const lastNameEl = document.getElementById("prof-lastName");
    const positionEl = document.getElementById("prof-position");
    const phoneEl = document.getElementById("prof-phone");
    const addressEl = document.getElementById("prof-address");
    if (firstNameEl) firstNameEl.value = p.firstName || "";
    if (lastNameEl) lastNameEl.value = p.lastName || "";
    if (positionEl) positionEl.value = p.position || "";
    if (phoneEl) phoneEl.value = p.phone || "";
    if (addressEl) addressEl.value = p.address || "";

    showModal("profile-modal", { focusSelector: "#prof-firstName" });
  } catch (e) {
    console.error("[PROFILE FETCH ERR]", e);
    showToast("⚠️ Не удалось загрузить профиль", "warning");
  }
}

// ============================================================================
// 🔹 EVENT LISTENERS (Self-Contained)
// ============================================================================

if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("auth-submit");
    setButtonLoading(btn, true);
    try {
      const ep = isRegisterMode ? "/register" : "/login";
      const usernameVal =
        document.getElementById("auth-username")?.value?.trim() || "";
      const emailVal =
        document.getElementById("auth-email")?.value?.trim() || "";
      const passwordVal = document.getElementById("auth-password")?.value || "";
      const confirmVal = document.getElementById("auth-confirm")?.value || "";

      const body = isRegisterMode
        ? { username: usernameVal, email: emailVal, password: passwordVal }
        : { email: emailVal, password: passwordVal };

      if (isRegisterMode && passwordVal !== confirmVal) {
        throw new Error("Пароли не совпадают");
      }
      if (!emailVal || !passwordVal) throw new Error("Заполните поля");

      const r = await fetch(`${AUTH_API}${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Ошибка");
      const d = await r.json();

      localStorage.setItem("nexus_token", d.token);
      window.nexusAuth = { token: d.token, user: d.user };
      showToast(
        isRegisterMode ? "✅ Аккаунт создан" : "✅ Добро пожаловать",
        "success",
      );
      updateUserHeader();
      hideAuthOverlay();

      window.dispatchEvent(new CustomEvent("nexus:auth-success"));
    } catch (err) {
      if (authError) {
        authError.textContent = err.message;
        authError.classList.add("visible");
        setTimeout(() => authError.classList.remove("visible"), 4000);
      }
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

document
  .getElementById("auth-toggle")
  ?.addEventListener("click", toggleAuthMode);

window.logout = logout;
window.openProfileModal = openProfileModal;

document
  .getElementById("close-profile-modal")
  ?.addEventListener("click", () => hideModal("profile-modal"));
document.getElementById("profile-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "profile-modal") hideModal("profile-modal");
});

const avatarInput = document.getElementById("avatar-input");
if (avatarInput) {
  avatarInput.onchange = async (e) => {
    if (!e.target.files.length) return;
    const f = e.target.files[0];
    if (f.size > 10 * 1024 * 1024) return showToast(">10MB", "error");
    const btn = document.querySelector("#avatar-preview + .btn-upload");
    if (btn) setButtonLoading(btn, true);
    try {
      const fd = new FormData();
      fd.append("avatar", f);
      const r = await fetch(`${AUTH_API}/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
        body: fd,
      });
      if (!r.ok) throw new Error("Ошибка");
      const d = await r.json();
      const previewImg = document.getElementById("avatar-preview");
      if (previewImg) previewImg.innerHTML = `<img src="${d.avatar}">`;
      window.nexusAuth.user.profile.avatar = d.avatar;
      showToast("Аватар обновлён", "success");
    } catch {
      showToast("Ошибка", "error");
    } finally {
      if (btn) setButtonLoading(btn, false);
    }
  };
}

document
  .getElementById("save-profile-btn")
  ?.addEventListener("click", async function () {
    setButtonLoading(this, true);
    try {
      const p = {
        firstName:
          document.getElementById("prof-firstName")?.value?.trim() || "",
        lastName: document.getElementById("prof-lastName")?.value?.trim() || "",
        position: document.getElementById("prof-position")?.value?.trim() || "",
        phone: document.getElementById("prof-phone")?.value?.trim() || "",
        address: document.getElementById("prof-address")?.value?.trim() || "",
      };
      const r = await fetch(`${AUTH_API}/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${window.nexusAuth?.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error("Ошибка");
      const d = await r.json();
      window.nexusAuth.user.profile = d.profile;
      updateUserHeader();
      showToast("Сохранено", "success");
      hideModal("profile-modal");
    } catch {
      showToast("Ошибка", "error");
    } finally {
      setButtonLoading(this, false);
    }
  });
// 🔹 Password Visibility Toggle
function initPasswordToggle() {
  const toggleBtn = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("auth-password");

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      toggleBtn.textContent = isPassword ? "🙈" : "👁️";
      toggleBtn.classList.toggle("active", isPassword);
      toggleBtn.title = isPassword ? "Скрыть пароль" : "Показать пароль";
      passwordInput.focus();
    });
  }

  // Для подтверждения пароля (регистрация)
  const toggleConfirm = document.getElementById("toggle-confirm");
  const confirmInput = document.getElementById("auth-confirm");

  if (toggleConfirm && confirmInput) {
    // Синхронизируем видимость с полем
    const syncConfirmToggle = () => {
      const isShown = confirmInput.style.display !== "none";
      toggleConfirm.style.display = isShown ? "flex" : "none";
    };

    // Слушаем изменения режима (логин/регистрация)
    const originalToggle = window.toggleAuthMode;
    window.toggleAuthMode = function (...args) {
      if (originalToggle) originalToggle.apply(this, args);
      syncConfirmToggle();
    };

    toggleConfirm.addEventListener("click", () => {
      const isPassword = confirmInput.type === "password";
      confirmInput.type = isPassword ? "text" : "password";
      toggleConfirm.textContent = isPassword ? "🙈" : "👁️";
      toggleConfirm.classList.toggle("active", isPassword);
      toggleConfirm.title = isPassword ? "Скрыть пароль" : "Показать пароль";
      confirmInput.focus();
    });

    // Первичная синхронизация
    syncConfirmToggle();
  }
}

// Инициализация после загрузки DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPasswordToggle);
} else {
  initPasswordToggle();
}
