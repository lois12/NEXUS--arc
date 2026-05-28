/**
 * 📦 NEXUS SYSTEM | nexus-js/auth.js
 * 🔐 Модуль: Авторизация, сессия, профиль, аватар
 */

import { showToast, setButtonLoading, startClock } from "./utils.js";

const AUTH_API = "http://localhost:5000/api/auth";

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
  document.getElementById("auth-title").textContent = isRegisterMode
    ? "🔐 РЕГИСТРАЦИЯ"
    : "🔐 ВХОД";
  document.getElementById("auth-username").style.display = isRegisterMode
    ? "block"
    : "none";
  document.getElementById("auth-confirm").style.display = isRegisterMode
    ? "block"
    : "none";
  document.getElementById("auth-submit").textContent = isRegisterMode
    ? "🚀 СОЗДАТЬ"
    : "🚀 ВОЙТИ";
  document.getElementById("auth-switch-text").textContent = isRegisterMode
    ? "Уже есть аккаунт? "
    : "Нет аккаунта? ";
  document.getElementById("auth-toggle").textContent = isRegisterMode
    ? "Войти"
    : "Создать";
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
    window.nexusAuth.user = data.user; // Обновляем локальную сессию
    const u = data.user;
    const p = u.profile || {};

    // Шапка профиля
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

    // Аватар
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

    // Поля
    document.getElementById("prof-firstName").value = p.firstName || "";
    document.getElementById("prof-lastName").value = p.lastName || "";
    document.getElementById("prof-position").value = p.position || "";
    document.getElementById("prof-phone").value = p.phone || "";
    document.getElementById("prof-address").value = p.address || "";

    document.getElementById("profile-modal")?.classList.add("active");
  } catch (e) {
    console.error("[PROFILE FETCH ERR]", e);
    showToast("⚠️ Не удалось загрузить профиль", "warning");
  }
}

// ============================================================================
// 🔹 EVENT LISTENERS (Self-Contained)
// ============================================================================

// Форма входа/регистрации
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("auth-submit");
    setButtonLoading(btn, true);
    try {
      const ep = isRegisterMode ? "/register" : "/login";
      const body = isRegisterMode
        ? {
            username: document.getElementById("auth-username").value.trim(),
            email: document.getElementById("auth-email").value.trim(),
            password: document.getElementById("auth-password").value,
          }
        : {
            email: document.getElementById("auth-email").value.trim(),
            password: document.getElementById("auth-password").value,
          };

      if (
        isRegisterMode &&
        document.getElementById("auth-password").value !==
          document.getElementById("auth-confirm").value
      ) {
        throw new Error("Пароли не совпадают");
      }
      if (!body.email || !body.password) throw new Error("Заполните поля");

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

      // 🔹 Декуплинг: main.js подпишется на это событие для запуска initApp()
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

// Переключатель режима
document
  .getElementById("auth-toggle")
  ?.addEventListener("click", toggleAuthMode);

// Экспорт в глобальную область для совместимости с HTML onclick
window.logout = logout;
window.openProfileModal = openProfileModal;

// Закрытие профиля
document
  .getElementById("close-profile-modal")
  ?.addEventListener("click", () => {
    document.getElementById("profile-modal")?.classList.remove("active");
  });
document.getElementById("profile-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "profile-modal")
    document.getElementById("profile-modal").classList.remove("active");
});

// Загрузка аватара
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
      document.getElementById("avatar-preview").innerHTML =
        `<img src="${d.avatar}">`;
      window.nexusAuth.user.profile.avatar = d.avatar;
      showToast("Аватар обновлён", "success");
    } catch {
      showToast("Ошибка", "error");
    } finally {
      if (btn) setButtonLoading(btn, false);
    }
  };
}

// Сохранение профиля
document
  .getElementById("save-profile-btn")
  ?.addEventListener("click", async function () {
    setButtonLoading(this, true);
    try {
      const p = {
        firstName: document.getElementById("prof-firstName").value.trim(),
        lastName: document.getElementById("prof-lastName").value.trim(),
        position: document.getElementById("prof-position").value.trim(),
        phone: document.getElementById("prof-phone").value.trim(),
        address: document.getElementById("prof-address").value.trim(),
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
      document.getElementById("profile-modal")?.classList.remove("active");
    } catch {
      showToast("Ошибка", "error");
    } finally {
      setButtonLoading(this, false);
    }
  });
