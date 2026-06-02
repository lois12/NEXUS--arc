/**
 * 📦 NEXUS SYSTEM | nexus-js/documents.js
 * 📄 Модуль: Документы (вкладки, загрузка, скачивание, контекстное меню)
 */

import {
  showToast,
  setButtonLoading,
  showNexusProgressToast,
  showNexusErrorToast,
  showNexusModal,
  showModal,
  hideModal,
} from "./utils.js";

const API_BASE = window.location.origin;
const DOCUMENTS_API = `${API_BASE}/api/documents`;

// 🔹 State
let currentFolder = localStorage.getItem("nexus_documents_folder") || "general";
let customTabs = JSON.parse(
  localStorage.getItem("nexus_documents_tabs") || "[]",
);

const DEFAULT_TABS = [
  { key: "general", label: "📁 Общие" },
  { key: "contracts", label: "📑 Договоры" },
  { key: "reports", label: "📊 Отчёты" },
  { key: "templates", label: "📋 Шаблоны" },
];

// 🔹 Иконки по расширениям
function getDocIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const icons = {
    pdf: "📕",
    doc: "📘",
    docx: "📘",
    xls: "📗",
    xlsx: "📗",
    csv: "📗",
    ppt: "📙",
    pptx: "📙",
    txt: "📄",
    md: "📄",
    log: "📄",
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
    json: "⚙️",
    xml: "⚙️",
    yaml: "⚙️",
  };
  return icons[ext] || "📎";
}

function getDocClass(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xls";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["txt", "md", "log"].includes(ext)) return "txt";
  if (["zip", "rar", "7z"].includes(ext)) return "zip";
  return "other";
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ============================================================================
// 🔹 РЕНДЕРИНГ ВКЛАДОК
// ============================================================================
function renderTabs() {
  const dynamicTabsContainer = document.getElementById(
    "documents-tabs-dynamic",
  );
  if (!dynamicTabsContainer) return;
  dynamicTabsContainer.innerHTML = "";

  document
    .querySelectorAll(".documents-tab-btn:not(.dynamic-tab)")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.folder === currentFolder);
    });

  customTabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = `documents-tab-btn dynamic-tab ${tab.key === currentFolder ? "active" : ""} new-tab`;
    btn.dataset.folder = tab.key;
    btn.innerHTML = `📁 ${tab.label} <span class="tab-close" data-key="${tab.key}">×</span>`;
    dynamicTabsContainer.appendChild(btn);
  });
}

function switchFolder(folder) {
  currentFolder = folder;
  localStorage.setItem("nexus_documents_folder", folder);
  renderTabs();
  loadDocuments();
}

// ============================================================================
// 🔹 ЗАГРУЗКА СПИСКА ДОКУМЕНТОВ
// ============================================================================
async function loadDocuments() {
  const gallery = document.getElementById("documents-gallery");
  const countEl = document.getElementById("documents-count");
  if (!gallery) return;

  gallery.innerHTML = '<div class="empty-state-box">⏳ Загрузка...</div>';
  if (countEl) countEl.textContent = "...";

  try {
    const r = await fetch(`${DOCUMENTS_API}/${currentFolder}`, {
      headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
    });
    if (!r.ok) throw new Error("Ошибка загрузки");
    const files = await r.json();

    gallery.innerHTML = "";
    if (countEl) countEl.textContent = files.length;

    if (!files.length) {
      gallery.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1/-1;">
          <div class="icon">📭</div>
          <h4>Папка пуста</h4>
          <p style="font-size:12px;color:var(--text-muted)">Перетащите файлы сюда или нажмите "Загрузить"</p>
        </div>
      `;
      return;
    }

    files.forEach((f) => {
      const div = document.createElement("div");
      div.className = "doc-item";
      div.dataset.server = f.name;
      div.innerHTML = `
        <div class="doc-icon ${getDocClass(f.name)}">${getDocIcon(f.name)}</div>
        <div class="doc-name" title="${f.name}">${f.name}</div>
        <div class="doc-meta">${formatBytes(f.size)} • ${new Date(f.modified).toLocaleDateString("ru-RU")}</div>
        <div class="doc-actions">
          <button class="doc-btn download" title="Скачать">⬇️</button>
          <button class="doc-btn delete" title="Удалить">🗑️</button>
        </div>
      `;
      gallery.appendChild(div);
    });
  } catch (e) {
    console.error("[DOCUMENTS LOAD ERR]", e);
    gallery.innerHTML = `
      <div class="empty-state-box" style="grid-column: 1/-1;">
        <div class="icon">⚠️</div>
        <h4>Ошибка загрузки</h4>
        <p style="font-size:12px;color:var(--neon-red)">${e.message}</p>
      </div>
    `;
  }
}

// ============================================================================
// 🔹 ЗАГРУЗКА ФАЙЛОВ
// ============================================================================
async function handleUpload(files) {
  if (!files?.length) return;
  for (const f of files) {
    if (f.size > 25 * 1024 * 1024)
      return showToast(`❌ Файл "${f.name}" превышает 25МБ`, "error");
  }

  const uploadBtn = document.getElementById("documents-upload-btn");
  if (uploadBtn) setButtonLoading(uploadBtn, true);
  if (typeof showNexusProgressToast === "function")
    showNexusProgressToast("upload", 0);

  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("files", f));

  try {
    const r = await fetch(`${DOCUMENTS_API}/${currentFolder}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${window.nexusAuth?.token || localStorage.getItem("nexus_token")}`,
      },
      body: fd,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

    showToast(`✅ Загружено: ${files.length} файл(ов)`, "success", 3000);
    loadDocuments();
  } catch (e) {
    console.error("[DOCS UPLOAD ERR]", e);
    showToast(`❌ ${e.message}`, "error", 5000);
  } finally {
    if (uploadBtn) setButtonLoading(uploadBtn, false);
  }
}

// ============================================================================
// 🔹 ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ (Только один раз!)
// ============================================================================
export function initDocuments() {
  renderTabs();
  loadDocuments();

  const tabsWrapper = document.querySelector(".documents-tabs");
  const addTabBtn = document.getElementById("documents-add-tab-btn");
  const tabModal = document.getElementById("documents-tab-modal");
  const tabModalClose = document.getElementById("documents-tab-modal-close");
  const tabModalCreate = document.getElementById("documents-tab-create-btn");
  const tabNameInput = document.getElementById("documents-new-tab-name");
  const tabLabelInput = document.getElementById("documents-tab-display-name");
  const dropZone = document.getElementById("documents-drop-zone");
  const fileInput = document.getElementById("documents-file-input");
  const uploadBtn = document.getElementById("documents-upload-btn");
  const gallery = document.getElementById("documents-gallery");
  const ctxMenu = document.getElementById("documents-context-menu");
  let currentCtxItem = null;

  // 🔹 Вкладки
  tabsWrapper?.addEventListener("click", async (e) => {
    const closeBtn = e.target.closest(".tab-close");
    const tabBtn = e.target.closest(".documents-tab-btn");

    if (closeBtn) {
      e.stopPropagation();
      const key = closeBtn.dataset.key;
      if (typeof showNexusModal === "function")
        showNexusModal(
          "⚠️ Удаление вкладки",
          `Удалить папку "${key}" и все документы?`,
          "var(--neon-red)",
        );
      const okBtn = document.getElementById("modal-cancel");
      if (okBtn) {
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.onclick = async () => {
          if (typeof hideModal === "function") hideModal("nexus-modal");
          try {
            if (typeof showNexusProgressToast === "function")
              await showNexusProgressToast("delete", 1500);
            const r = await fetch(`${DOCUMENTS_API}/folder/${key}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
            });
            if (!r.ok) throw new Error("Ошибка сервера");
            customTabs = customTabs.filter((t) => t.key !== key);
            localStorage.setItem(
              "nexus_documents_tabs",
              JSON.stringify(customTabs),
            );
            if (currentFolder === key) switchFolder("general");
            else renderTabs();
            showToast("✅ Папка удалена", "success");
          } catch {
            if (typeof showNexusErrorToast === "function")
              showNexusErrorToast("Ошибка удаления");
          }
        };
      }
      return;
    }
    if (tabBtn && tabBtn.dataset.folder) switchFolder(tabBtn.dataset.folder);
  });

  // 🔹 Загрузка
  if (uploadBtn && fileInput) {
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      handleUpload(e.target.files);
      e.target.value = "";
    };
  }

  // 🔹 Drag & Drop
  if (dropZone) {
    ["dragenter", "dragover"].forEach((ev) =>
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      }),
    );
    ["dragleave", "drop"].forEach((ev) =>
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
      }),
    );
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      handleUpload(e.dataTransfer.files);
    });
  }

  // 🔹 Галерея
  gallery?.addEventListener("click", async (e) => {
    const item = e.target.closest(".doc-item");
    if (!item) return;
    if (e.target.closest(".download")) {
      e.stopPropagation();
      const a = document.createElement("a");
      a.href = `/api/documents/${currentFolder}/${item.dataset.server}`;
      a.download = item.querySelector(".doc-name")?.textContent.trim();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("📥 Скачивание...", "info", 2000);
      return;
    }
    if (e.target.closest(".delete")) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof showNexusModal === "function")
        showNexusModal(
          "⚠️ Подтверждение",
          "Удалить этот документ?",
          "var(--neon-red)",
        );
      const okBtn = document.getElementById("modal-cancel");
      if (okBtn) {
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.onclick = async () => {
          if (typeof hideModal === "function") hideModal("nexus-modal");
          try {
            const fetchPromise = fetch(
              `${DOCUMENTS_API}/${currentFolder}/${item.dataset.server}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
              },
            );
            if (typeof showNexusProgressToast === "function")
              await showNexusProgressToast("delete", 1200);
            const r = await fetchPromise;
            if (!r.ok) throw new Error("Ошибка удаления");
            showToast("✅ Удалено", "success");
            loadDocuments();
          } catch {
            if (typeof showNexusErrorToast === "function")
              showNexusErrorToast("Ошибка удаления");
          }
        };
      }
    }
  });

  // 🔹 Модалка вкладки
  if (addTabBtn && tabModal) {
    addTabBtn.onclick = () => {
      if (typeof showModal === "function")
        showModal("documents-tab-modal", {
          focusSelector: "#documents-new-tab-name",
        });
      tabNameInput.value = "";
      tabLabelInput.value = "";
      tabNameInput?.focus();
    };
    // 🔥 ИСПРАВЛЕНО: добавлены фигурные скобки для корректного синтаксиса
    tabModalClose?.addEventListener("click", () => {
      if (typeof hideModal === "function") hideModal("documents-tab-modal");
    });
    tabModal?.addEventListener("click", (e) => {
      if (e.target === tabModal && typeof hideModal === "function")
        hideModal("documents-tab-modal");
    });
    tabModalCreate?.addEventListener("click", () => {
      const rawName = tabNameInput.value.trim().toLowerCase();
      const label =
        tabLabelInput?.value.trim() ||
        rawName.charAt(0).toUpperCase() + rawName.slice(1);
      if (!rawName) return showToast("Введите имя папки", "warning");
      if (!/^[a-z0-9_-]+$/.test(rawName))
        return showToast("Только латиница, цифры, _ и -", "error");
      if (
        DEFAULT_TABS.some((t) => t.key === rawName) ||
        customTabs.some((t) => t.key === rawName)
      )
        return showToast("Такая вкладка уже есть", "warning");
      customTabs.push({ key: rawName, label });
      localStorage.setItem("nexus_documents_tabs", JSON.stringify(customTabs));
      renderTabs();
      switchFolder(rawName);
      if (typeof hideModal === "function") hideModal("documents-tab-modal");
      showToast(`✅ Вкладка "${label}" создана`, "success");
    });
  }

  // 🔹 Контекстное меню
  gallery?.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".doc-item");
    if (!item) return;
    e.preventDefault();
    currentCtxItem = item;
    if (ctxMenu) {
      ctxMenu.style.left = `${e.clientX}px`;
      ctxMenu.style.top = `${e.clientY}px`;
      ctxMenu.classList.add("active");
      setTimeout(() => {
        if (!ctxMenu) return;
        const rect = ctxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth)
          ctxMenu.style.left = `${e.clientX - rect.width}px`;
        if (rect.bottom > window.innerHeight)
          ctxMenu.style.top = `${e.clientY - rect.height}px`;
      }, 0);
    }
  });

  document.addEventListener("click", (e) => {
    if (ctxMenu && !e.target.closest(".documents-context-menu"))
      ctxMenu.classList.remove("active");
  });

  ctxMenu?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ctx-item");
    if (!btn || !currentCtxItem || !ctxMenu) return;
    const action = btn.dataset.action;
    ctxMenu.classList.remove("active");

    if (action === "download") {
      const a = document.createElement("a");
      a.href = `/api/documents/${currentFolder}/${currentCtxItem.dataset.server}`;
      a.download = currentCtxItem
        .querySelector(".doc-name")
        ?.textContent.trim();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("📥 Скачивание...", "info", 2000);
    } else if (action === "delete") {
      if (typeof showNexusModal === "function")
        showNexusModal(
          "⚠️ Подтверждение",
          "Удалить этот документ?",
          "var(--neon-red)",
        );
      const okBtn = document.getElementById("modal-cancel");
      if (okBtn) {
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.onclick = async () => {
          if (typeof hideModal === "function") hideModal("nexus-modal");
          try {
            const fetchPromise = fetch(
              `${DOCUMENTS_API}/${currentFolder}/${currentCtxItem.dataset.server}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
              },
            );
            if (typeof showNexusProgressToast === "function")
              await showNexusProgressToast("delete", 1200);
            const r = await fetchPromise;
            if (!r.ok) throw new Error("Ошибка удаления");
            showToast("✅ Удалено", "success");
            loadDocuments();
          } catch {
            if (typeof showNexusErrorToast === "function")
              showNexusErrorToast("Ошибка удаления");
          }
        };
      }
    }
  });

  console.log("📄 Documents module initialized");
}

// 🔥 ЗАЩИТА ОТ ДВОЙНОГО ЗАПУСКА
if (!window.__nexus_documents_initialized) {
  window.__nexus_documents_initialized = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDocuments);
  } else if (document.documentElement) {
    initDocuments();
  }
}
