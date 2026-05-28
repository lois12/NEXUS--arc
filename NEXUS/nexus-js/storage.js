/**
 * 📦 NEXUS SYSTEM | nexus-js/storage.js
 * 📂 Модуль: Хранилище (вкладки, загрузка, удаление, прогресс-сфера, 3D-стрелки)
 */

import {
  showToast,
  setButtonLoading,
  showNexusProgressToast,
  showNexusErrorToast,
  showNexusModal,
} from "./utils.js";

const STORAGE_API = "http://localhost:5000/api/storage";

// 🔹 DOM Elements
const tabsWrapper = document.querySelector(".storage-tabs");
const dynamicTabsContainer = document.getElementById("storage-tabs-dynamic");
const addTabBtn = document.getElementById("storage-add-tab-btn");
const tabModal = document.getElementById("storage-tab-modal");
const tabModalClose = document.getElementById("storage-tab-modal-close");
const tabModalCreate = document.getElementById("storage-tab-create-btn");
const tabNameInput = document.getElementById("storage-new-tab-name");
const tabLabelInput = document.getElementById("storage-tab-display-name");
const dropZone = document.getElementById("storage-drop-zone");
const fileInput = document.getElementById("storage-file-input");
const uploadBtn = document.getElementById("storage-upload-btn");
const gallery = document.getElementById("logo-gallery");
const countEl = document.getElementById("storage-count");

// 🔹 3D-Стрелки
const leftBtn = document.getElementById("gallery-scroll-left");
const rightBtn = document.getElementById("gallery-scroll-right");

// 🔹 State
let currentFolder = localStorage.getItem("nexus_storage_folder") || "logo";
let customTabs = JSON.parse(localStorage.getItem("nexus_storage_tabs") || "[]");

const DEFAULT_TABS = [
  { key: "logo", label: "🎨 Логотипы" },
  { key: "important", label: "📌 Важное" },
  { key: "img", label: "📷 Фотографии" },
];

// ============================================================================
// 🔹 РЕНДЕРИНГ ВКЛАДОК
// ============================================================================
function renderTabs() {
  if (!dynamicTabsContainer) return;
  dynamicTabsContainer.innerHTML = "";

  document.querySelectorAll(".storage-tab-btn").forEach((btn) => {
    if (!btn.classList.contains("dynamic-tab")) {
      btn.classList.toggle("active", btn.dataset.folder === currentFolder);
    }
  });

  customTabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = `storage-tab-btn dynamic-tab ${tab.key === currentFolder ? "active" : ""} new-tab`;
    btn.dataset.folder = tab.key;
    btn.innerHTML = `📁 ${tab.label} <span class="tab-close" data-key="${tab.key}">×</span>`;
    dynamicTabsContainer.appendChild(btn);
  });
}

function switchFolder(folder) {
  currentFolder = folder;
  localStorage.setItem("nexus_storage_folder", folder);
  renderTabs();
  loadStorage();
}

// 🔹 ПОИСК (статичный, из HTML)
const searchInput = document.getElementById("storage-search-input");
if (searchInput) {
  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".logo-item").forEach((item) => {
      const name =
        item.querySelector("div:last-child")?.textContent.toLowerCase() || "";
      item.style.display = name.includes(q) ? "" : "none";
    });
  };
}

// ============================================================================
// 🔹 3D-СТРЕЛКИ: ЛОГИКА (ТОЧНЫЙ РАСЧЁТ + ЗАЩИТА ОТ ПЕРЕХОДА)
// ============================================================================
function updateGalleryArrows() {
  if (!gallery || !leftBtn || !rightBtn) return;

  // Форсируем пересчёт макета после рендера
  void gallery.offsetHeight;
  const hasScroll = gallery.scrollWidth > gallery.clientWidth + 5;

  // 🔹 Используем setProperty, чтобы гарантированно перебить любые стили
  const val = hasScroll ? "flex" : "none";
  leftBtn.style.setProperty("display", val, "important");
  rightBtn.style.setProperty("display", val, "important");

  leftBtn.style.pointerEvents = hasScroll ? "auto" : "none";
  rightBtn.style.pointerEvents = hasScroll ? "auto" : "none";

  if (hasScroll) {
    const atStart = gallery.scrollLeft <= 5;
    const atEnd =
      gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 5;
    leftBtn.classList.toggle("disabled", atStart);
    rightBtn.classList.toggle("disabled", atEnd);
  }
}

// Привязка кликов
if (leftBtn)
  leftBtn.onclick = () => gallery.scrollBy({ left: -600, behavior: "smooth" });
if (rightBtn)
  rightBtn.onclick = () => gallery.scrollBy({ left: 600, behavior: "smooth" });

// Слушатели
gallery?.addEventListener("scroll", updateGalleryArrows);
window.addEventListener("resize", updateGalleryArrows);

// Хак: ждём отрисовку картинок перед расчётом (двойная проверка)
const checkArrowsAfterRender = () => {
  setTimeout(updateGalleryArrows, 100);
  setTimeout(updateGalleryArrows, 300);
};

// ============================================================================
// 🔹 ЗАГРУЗКА ФАЙЛОВ
// ============================================================================
async function loadStorage() {
  if (!gallery) return;

  gallery.innerHTML =
    '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted)">Загрузка...</div>';
  if (countEl) countEl.textContent = "...";

  try {
    const r = await fetch(`${STORAGE_API}/${currentFolder}`, {
      headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
    });
    if (!r.ok) throw new Error("Ошибка загрузки");
    const files = await r.json();

    gallery.innerHTML = "";
    if (countEl) countEl.textContent = files.length;

    if (!files.length) {
      gallery.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px">Папка пуста</div>';
      document
        .getElementById("storage-download-wrapper")
        ?.classList.add("hidden");
      updateGalleryArrows();
      return;
    }

    files.forEach((f) => {
      const div = document.createElement("div");
      div.className = "logo-item";
      const ext = f.name.split(".").pop().toLowerCase();
      const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
        ext,
      );

      div.innerHTML = `
        <button class="file-download-btn" title="Скачать">⬇️</button>
        ${isImage ? `<img src="${f.url}" onclick="window.openZoomModal?.('${f.url}')">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:rgba(0,0,0,0.3)">📄</div>`}
        <button class="file-delete" data-server="${f.serverName}" title="Удалить">🗑️</button>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:4px;background:rgba(0,0,0,0.7);font-size:10px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
      `;
      gallery.appendChild(div);
    });

    // Кнопка архива
    const dlWrapper = document.getElementById("storage-download-wrapper");
    const dlBtn = document.getElementById("storage-download-all-btn");
    if (dlWrapper && dlBtn) {
      dlWrapper.classList.remove("hidden");
      dlBtn.textContent = `📦 Скачать всё архивом (${files.length})`;
      dlBtn.disabled = false;
      dlBtn.onclick = async () => {
        dlBtn.disabled = true;
        dlBtn.textContent = "⏳ Формирую архив...";
        try {
          const a = document.createElement("a");
          a.href = `${STORAGE_API}/${currentFolder}/download`;
          a.download = `nexus-${currentFolder}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => {
            dlBtn.disabled = false;
            dlBtn.textContent = `📦 Скачать всё архивом (${files.length})`;
          }, 3000);
        } catch {
          dlBtn.disabled = false;
          dlBtn.textContent = `📦 Скачать всё архивом (${files.length})`;
          showNexusErrorToast("Не удалось скачать архив");
        }
      };
    }
  } catch (e) {
    console.error("[STORAGE LOAD ERR]", e);
    gallery.innerHTML =
      '<div style="grid-column:1/-1;color:var(--neon-red);text-align:center">⚠️ Ошибка загрузки</div>';
    document
      .getElementById("storage-download-wrapper")
      ?.classList.add("hidden");
  } finally {
    // Обновляем стрелки только после того, как файлы и картинки отрисовались
    checkArrowsAfterRender();
  }
}

// ============================================================================
// 🔹 ЗАГРУЗКА ФАЙЛОВ НА СЕРВЕР
// ============================================================================
async function handleUpload(files) {
  if (!files?.length) return;
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) throw new Error("Файл >10МБ");
  }
  if (uploadBtn) setButtonLoading(uploadBtn, true);
  try {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));

    const fetchPromise = fetch(`${STORAGE_API}/${currentFolder}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
      body: fd,
    });

    await showNexusProgressToast("upload", 1200);

    const r = await fetchPromise;
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({ error: "Ошибка" }))).error,
      );

    showToast("✅ Файлы добавлены", "success");
    loadStorage();
  } catch (e) {
    showNexusErrorToast(e.message || "Что-то пошло не так");
  } finally {
    if (uploadBtn) setButtonLoading(uploadBtn, false);
  }
}

// ============================================================================
// 🔹 EVENT LISTENERS
// ============================================================================
tabsWrapper?.addEventListener("click", async (e) => {
  const closeBtn = e.target.closest(".tab-close");
  const tabBtn = e.target.closest(".storage-tab-btn");

  if (closeBtn) {
    e.stopPropagation();
    const key = closeBtn.dataset.key;
    showNexusModal(
      "⚠️ Удаление вкладки",
      `Удалить папку "${key}" и все файлы?`,
      "var(--neon-red)",
    );
    const okBtn = document.getElementById("modal-cancel");
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.onclick = async () => {
      document.getElementById("nexus-modal").classList.remove("active");
      try {
        await showNexusProgressToast("delete", 1500);
        const r = await fetch(`${STORAGE_API}/folder/${key}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
        });
        if (!r.ok) throw new Error("Ошибка сервера");
        customTabs = customTabs.filter((t) => t.key !== key);
        localStorage.setItem("nexus_storage_tabs", JSON.stringify(customTabs));
        if (currentFolder === key) switchFolder("logo");
        else renderTabs();
        showToast("✅ Папка удалена", "success");
      } catch {
        showNexusErrorToast("Ошибка удаления");
      }
    };
    return;
  }

  if (tabBtn && tabBtn.dataset.folder) switchFolder(tabBtn.dataset.folder);
});

if (uploadBtn && fileInput) {
  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    handleUpload(e.target.files);
    e.target.value = "";
  };
}

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

gallery?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".file-delete");
  if (!btn) return;
  e.preventDefault();
  showNexusModal(
    "⚠️ Подтверждение",
    "Вы действительно хотите удалить этот файл?",
    "var(--neon-red)",
  );
  const okBtn = document.getElementById("modal-cancel");
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  newOkBtn.onclick = async () => {
    document.getElementById("nexus-modal").classList.remove("active");
    try {
      const fetchPromise = fetch(
        `${STORAGE_API}/${currentFolder}/${btn.dataset.server}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
        },
      );
      await showNexusProgressToast("delete", 1200);
      const r = await fetchPromise;
      if (!r.ok) throw new Error("Ошибка удаления");
      showToast("✅ Удалено", "success");
      loadStorage();
    } catch {
      showNexusErrorToast("Ошибка удаления");
    }
  };
});

if (addTabBtn && tabModal) {
  addTabBtn.onclick = () => {
    tabModal.classList.add("active");
    tabNameInput.value = "";
    tabLabelInput.value = "";
    tabNameInput?.focus();
  };
  tabModalClose?.addEventListener("click", () =>
    tabModal.classList.remove("active"),
  );
  tabModal?.addEventListener("click", (e) => {
    if (e.target === tabModal) tabModal.classList.remove("active");
  });

  tabModalCreate?.addEventListener("click", () => {
    const rawName = tabNameInput.value.trim().toLowerCase();
    const label =
      tabLabelInput?.value.trim() ||
      rawName.charAt(0).toUpperCase() + rawName.slice(1);
    if (!rawName) return showToast("Введите имя папки", "warning");
    if (!/^[a-z0-9_-]+$/.test(rawName))
      return showToast("Только латиница, цифры, _ и -", "error");
    const exists =
      DEFAULT_TABS.some((t) => t.key === rawName) ||
      customTabs.some((t) => t.key === rawName);
    if (exists) return showToast("Такая вкладка уже есть", "warning");

    customTabs.push({ key: rawName, label });
    localStorage.setItem("nexus_storage_tabs", JSON.stringify(customTabs));
    renderTabs();
    switchFolder(rawName);
    tabModal.classList.remove("active");
    showToast(`✅ Вкладка "${label}" создана`, "success");
  });
}

// ============================================================================
// 🔹 КОНТЕКСТНОЕ МЕНЮ
// ============================================================================
const ctxMenu = document.getElementById("storage-context-menu");
let currentCtxItem = null;

gallery?.addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".logo-item");
  if (!item) return;
  e.preventDefault();
  currentCtxItem = item;
  ctxMenu.style.left = `${e.clientX}px`;
  ctxMenu.style.top = `${e.clientY}px`;
  ctxMenu.classList.add("active");
  setTimeout(() => {
    const rect = ctxMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      ctxMenu.style.left = `${e.clientX - rect.width}px`;
    if (rect.bottom > window.innerHeight)
      ctxMenu.style.top = `${e.clientY - rect.height}px`;
  }, 0);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".storage-context-menu"))
    ctxMenu.classList.remove("active");
});
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".logo-item")) ctxMenu.classList.remove("active");
});

ctxMenu?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ctx-item");
  if (!btn || !currentCtxItem) return;

  const action = btn.dataset.action;
  const serverName =
    currentCtxItem.querySelector(".file-delete")?.dataset.server;
  const displayName = currentCtxItem
    .querySelector("div:last-child")
    ?.textContent.trim();
  ctxMenu.classList.remove("active");

  if (action === "download") {
    const a = document.createElement("a");
    a.href = `/api/storage/${currentFolder}/${serverName}`;
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else if (action === "rename") {
    const renameModal = document.getElementById("rename-modal");
    const renameInput = document.getElementById("rename-input");
    if (renameModal && renameInput) {
      renameModal.classList.add("active");
      renameInput.value = displayName.replace(/^\d+-/, "");
      renameInput.focus();
      renameInput.select();
      const confirmBtn = document.getElementById("rename-confirm");
      if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.onclick = async () => {
          let newName = renameInput.value.trim();
          renameModal.classList.remove("active");
          if (!newName || newName === displayName.replace(/^\d+-/, "")) return;
          try {
            await showNexusProgressToast("upload", 800);
            const r = await fetch(`${STORAGE_API}/rename`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${window.nexusAuth?.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                folder: currentFolder,
                oldName: serverName,
                newName,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Ошибка сервера");
            const item = currentCtxItem;
            if (item) {
              const delBtn = item.querySelector(".file-delete");
              if (delBtn) delBtn.dataset.server = data.newName;
              const nameEl = item.querySelector("div:last-child");
              if (nameEl) nameEl.textContent = data.displayName;
              const img = item.querySelector("img");
              if (img)
                img.src = `/api/storage/${currentFolder}/${data.newName}?t=${Date.now()}`;
            }
            showToast("✅ Переименовано", "success");
          } catch (err) {
            showNexusErrorToast(err.message || "Ошибка");
            loadStorage();
          }
        };
      }
      const closeRename = () => renameModal.classList.remove("active");
      const setupBtn = (id, handler) => {
        const b = document.getElementById(id);
        if (b) {
          const nb = b.cloneNode(true);
          b.parentNode.replaceChild(nb, b);
          document.getElementById(id).onclick = handler;
        }
      };
      setupBtn("rename-modal-close", closeRename);
      setupBtn("rename-cancel", closeRename);
      renameModal.onclick = (e) => {
        if (e.target === renameModal) closeRename();
      };
    }
  } else if (action === "delete") {
    showNexusModal("⚠️ Подтверждение", "Удалить этот файл?", "var(--neon-red)");
    const okBtn = document.getElementById("modal-cancel");
    if (okBtn) {
      const newOkBtn = okBtn.cloneNode(true);
      okBtn.parentNode.replaceChild(newOkBtn, okBtn);
      newOkBtn.onclick = async () => {
        document.getElementById("nexus-modal").classList.remove("active");
        try {
          const fetchPromise = fetch(
            `${STORAGE_API}/${currentFolder}/${serverName}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
            },
          );
          await showNexusProgressToast("delete", 1200);
          const r = await fetchPromise;
          if (!r.ok) throw new Error("Ошибка удаления");
          showToast("✅ Удалено", "success");
          loadStorage();
        } catch {
          showNexusErrorToast("Ошибка удаления");
        }
      };
    }
  }
});

gallery?.addEventListener("click", (e) => {
  const dlBtn = e.target.closest(".file-download-btn");
  if (dlBtn) {
    e.stopPropagation();
    const item = dlBtn.closest(".logo-item");
    const serverName = item.querySelector(".file-delete")?.dataset.server;
    const displayName = item
      .querySelector("div:last-child")
      ?.textContent.trim();
    const a = document.createElement("a");
    a.href = `/api/storage/${currentFolder}/${serverName}`;
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

// ============================================================================
// 🔹 ЭКСПОРТ
// ============================================================================
export function initStorage() {
  renderTabs();
  loadStorage();
}
