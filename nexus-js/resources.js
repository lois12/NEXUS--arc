/**
 * 📦 NEXUS SYSTEM | nexus-js/resources.js
 * 🔗 Модуль: Ресурсы, ссылки, модалка, CRUD, мгновенное обновление
 */

import { showToast, setButtonLoading, showModal, hideModal } from "./utils.js";

// 🔥 ИСПРАВЛЕНО: Динамический базовый URL вместо хардкода localhost
const API_BASE = window.location.origin;
const RES_API = `${API_BASE}/api/resources`;

// 🔹 DOM Elements
const resModal = document.getElementById("resource-modal");
const resListEl = document.getElementById("resource-list");
const resNameIn = document.getElementById("res-name");
const resUrlIn = document.getElementById("res-url");
const resAddBtn = document.getElementById("res-add-btn");
const nexusLinksBtn = document.getElementById("nexus-links-btn");

// 🔹 State
let resourcesCache = [];
let editingResourceId = null;

// ============================================================================
// 🔹 API & КЭШ
// ============================================================================
export async function loadResources() {
  try {
    const r = await fetch(RES_API, {
      headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    resourcesCache = await r.json();
    if (resModal?.classList.contains("active")) renderResourceModal();
  } catch (e) {
    console.error("[RES LOAD ERR]", e);
  }
}

// ============================================================================
// 🔹 UI ЛОГИКА
// ============================================================================
export function openResourceModal() {
  if (!window.nexusAuth?.token) {
    showToast("⚠️ Требуется авторизация", "warning");
    return;
  }
  editingResourceId = null;
  if (resNameIn) resNameIn.value = "";
  if (resUrlIn) resUrlIn.value = "";
  if (resAddBtn) resAddBtn.textContent = "+ Добавить";
  showModal("resource-modal", { focusSelector: "#res-name" });
  renderResourceModal();
}

function renderResourceModal() {
  if (!resListEl) return;
  resListEl.innerHTML =
    '<div style="text-align:center;color:var(--text-muted);padding:15px">Загрузка...</div>';

  if (resourcesCache.length > 0) {
    drawResourceList(resourcesCache);
  } else {
    loadResources()
      .then(() => {
        if (resourcesCache.length) drawResourceList(resourcesCache);
        else
          resListEl.innerHTML =
            '<div style="text-align:center;color:var(--text-muted);padding:15px">Пока пусто</div>';
      })
      .catch(() => {
        resListEl.innerHTML =
          '<div style="text-align:center;color:var(--neon-red);padding:15px">Ошибка загрузки</div>';
      });
  }
}

function drawResourceList(list) {
  if (!resListEl) return;
  resListEl.innerHTML = "";
  if (!list.length) {
    resListEl.innerHTML =
      '<div style="text-align:center;color:var(--text-muted);padding:15px">Пока пусто</div>';
    return;
  }

  list.forEach((r) => {
    const div = document.createElement("div");
    div.className = "res-item";
    div.innerHTML = `
      <a href="${r.url}" target="_blank" class="res-link" title="${r.url}">${r.name}</a>
      <div class="res-actions">
        <button class="res-edit" data-id="${r.id}" title="Редактировать">✎</button>
        <button class="res-del" data-id="${r.id}" title="Удалить">✕</button>
      </div>`;
    resListEl.appendChild(div);
  });

  resListEl.querySelectorAll(".res-link").forEach((link) => {
    link.onclick = (e) => e.stopPropagation();
  });
  resListEl.querySelectorAll(".res-edit").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = resourcesCache.find((x) => x.id === id);
      if (item) {
        editingResourceId = id;
        if (resNameIn) resNameIn.value = item.name;
        if (resUrlIn) resUrlIn.value = item.url;
        if (resAddBtn) resAddBtn.textContent = "💾 Сохранить";
        resNameIn?.focus();
        showToast("Редактирование: " + item.name, "info");
      }
    };
  });
  resListEl.querySelectorAll(".res-del").forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        await fetch(`${RES_API}/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
        });
        resourcesCache = resourcesCache.filter((x) => x.id !== id);
        drawResourceList(resourcesCache);
        showToast("Удалено", "success");
      } catch {
        showToast("Ошибка удаления", "error");
      }
    };
  });
}

// ============================================================================
// 🔹 ОБРАБОТЧИКИ ФОРМЫ
// ============================================================================
async function handleResourceSubmit() {
  if (!resNameIn || !resUrlIn || !resAddBtn) return;
  const name = resNameIn.value.trim();
  const url = resUrlIn.value.trim();
  if (!name || !url) return showToast("Заполни оба поля", "warning");

  setButtonLoading(resAddBtn, true);
  try {
    const payload = { name, url, page: "all" };
    if (editingResourceId) {
      await fetch(`${RES_API}/${editingResourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.nexusAuth?.token}`,
        },
        body: JSON.stringify(payload),
      });
      const idx = resourcesCache.findIndex((x) => x.id === editingResourceId);
      if (idx !== -1)
        resourcesCache[idx] = { ...resourcesCache[idx], ...payload };
      showToast("Сохранено", "success");
    } else {
      const r = await fetch(RES_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.nexusAuth?.token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Ошибка сервера");
      const newItem = await r.json();
      resourcesCache.push(newItem);
      showToast("Ссылка добавлена", "success");
    }
    drawResourceList(resourcesCache);
    resNameIn.value = "";
    resUrlIn.value = "";
    editingResourceId = null;
    resAddBtn.textContent = "+ Добавить";
  } catch (e) {
    showToast("Ошибка: " + e.message, "error");
  } finally {
    setButtonLoading(resAddBtn, false);
  }
}

// ============================================================================
// 🔹 ИНИЦИАЛИЗАЦИЯ & СЛУШАТЕЛИ
// ============================================================================
function setupEventListeners() {
  document
    .getElementById("nexus-links-btn-footer")
    ?.addEventListener("click", openResourceModal);
  resAddBtn?.addEventListener("click", handleResourceSubmit);
  resModal?.addEventListener("click", (e) => {
    if (e.target === resModal) hideModal("resource-modal");
  });
}

export function initResources() {
  setupEventListeners();
  console.log("🔗 Resources module initialized");
}

// 🔥 ЗАЩИТА ОТ ДВОЙНОГО ЗАПУСКА
if (!window.__nexus_resources_initialized) {
  window.__nexus_resources_initialized = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initResources);
  } else if (document.documentElement) {
    initResources();
  }
}
