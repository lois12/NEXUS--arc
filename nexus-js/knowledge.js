/**
 * 📦 NEXUS SYSTEM | nexus-js/knowledge.js
 * 📚 Модуль: База знаний, поиск, фильтры, статистика, редактор
 */

import {
  showToast,
  setButtonLoading,
  execFormat,
  insertLink,
  showModal,
  hideModal,
} from "./utils.js";

// 🔥 ИСПРАВЛЕНО: Динамический базовый URL вместо хардкода localhost
const API_BASE = window.location.origin;
const KNOWLEDGE_API = `${API_BASE}/api/knowledge`;

// 🔹 DOM Elements
const knowledgeList = document.getElementById("knowledge-list");
const knowledgeStats = document.getElementById("knowledge-stats");
const knowledgeModal = document.getElementById("knowledge-modal");
const modalTitle = document.getElementById("knowledge-modal-title");
const docTitle = document.getElementById("doc-title");
const docCategory = document.getElementById("doc-category");
const docEditor = document.getElementById("doc-editor");
const deleteBtn = document.getElementById("delete-doc-btn");
const saveBtn = document.getElementById("save-doc-btn");
const addBtn = document.getElementById("add-knowledge-btn");
const closeBtn = document.getElementById("close-knowledge-modal");
const searchInput = document.getElementById("knowledge-search");
const catFilter = document.getElementById("knowledge-cat-filter");

// 🔹 State
let currentDoc = null;
let knowledgeCache = [];
let currentSearch = "";
let currentCat = "all";

// ============================================================================
// 🔹 РЕНДЕРИНГ & ФИЛЬТРАЦИЯ
// ============================================================================
function renderKnowledgeList() {
  if (!knowledgeList) return;
  knowledgeList.innerHTML = "";

  const filtered = knowledgeCache.filter((doc) => {
    const matchesSearch =
      !currentSearch ||
      doc.title.toLowerCase().includes(currentSearch) ||
      doc.content.toLowerCase().includes(currentSearch);
    const matchesCat = currentCat === "all" || doc.category === currentCat;
    return matchesSearch && matchesCat;
  });

  if (!filtered.length) {
    knowledgeList.innerHTML =
      '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:20px">Ничего не найдено</div>';
    return;
  }

  filtered.forEach((doc) => {
    const item = document.createElement("div");
    item.className = "knowledge-item";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = doc.content;
    const prev =
      tempDiv.textContent.slice(0, 100) +
      (tempDiv.textContent.length > 100 ? "..." : "");

    item.innerHTML = `
      <div class="ki-header">
        <span class="ki-author"><img src="${doc.authorAvatar || ""}" onerror="this.style.display='none'"> ${doc.author}</span>
        <span>${new Date(doc.updatedAt || doc.createdAt).toLocaleDateString()}</span>
      </div>
      <h4 class="ki-title">${doc.title || "Без названия"}</h4>
      <div class="ki-preview">${prev}</div>
      <div class="ki-tags">
        <span class="ki-tag">${doc.category}</span>
        ${(doc.tags || [])
          .slice(0, 3)
          .map((t) => `<span class="ki-tag">#${t}</span>`)
          .join("")}
      </div>`;
    item.addEventListener("click", () => openKnowledgeModal(doc));
    knowledgeList.appendChild(item);
  });
}

function updateStats() {
  if (!knowledgeStats) return;
  const cats = {};
  knowledgeCache.forEach(
    (d) => (cats[d.category] = (cats[d.category] || 0) + 1),
  );
  knowledgeStats.innerHTML =
    `📊 ВСЕГО: <b style="color:var(--neon-cyan)">${knowledgeCache.length}</b> | ` +
    Object.entries(cats)
      .map(
        ([k, v]) =>
          `<span style="margin:0 6px;color:var(--text-muted)">${k}: <b style="color:#fff">${v}</b></span>`,
      )
      .join("");
}

export async function loadKnowledge() {
  try {
    const r = await fetch(KNOWLEDGE_API, {
      headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    knowledgeCache = await r.json();
    updateStats();
    renderKnowledgeList();
  } catch (e) {
    console.error("[LOAD KNOWLEDGE ERR]", e);
    if (knowledgeList)
      knowledgeList.innerHTML =
        '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:20px">⚠ Ошибка загрузки</div>';
  }
}

// ============================================================================
// 🔹 ПОИСК & ФИЛЬТРЫ
// ============================================================================
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderKnowledgeList();
  });
}
if (catFilter) {
  catFilter.addEventListener("change", (e) => {
    currentCat = e.target.value;
    renderKnowledgeList();
  });
}

// ============================================================================
// 🔹 МОДАЛКА РЕДАКТОРА
// ============================================================================
export function openKnowledgeModal(doc = null) {
  if (!knowledgeModal) return;
  currentDoc = doc;

  if (doc) {
    modalTitle.textContent = "✏️ Редактирование";
    docTitle.value = doc.title || "";
    docCategory.value = doc.category || "Общее";
    docEditor.innerHTML = doc.content || "";
    deleteBtn.style.display = "inline-block";
  } else {
    modalTitle.textContent = "📝 Новая статья";
    docTitle.value = "";
    docCategory.value = "Общее";
    docEditor.innerHTML = "";
    deleteBtn.style.display = "none";
  }
  showModal("knowledge-modal", { focusSelector: "#doc-title" });
}

// 🔹 Сохранение (POST/PATCH)
saveBtn?.addEventListener("click", async function () {
  setButtonLoading(this, true);
  try {
    const title = docTitle.value.trim();
    const category = docCategory.value.trim();
    const content = docEditor.innerHTML;
    if (!title) throw new Error("Введите название");

    const data = { title, category, content, tags: [] };
    const method = currentDoc ? "PATCH" : "POST";
    const url = currentDoc
      ? `${KNOWLEDGE_API}/${currentDoc.id}`
      : KNOWLEDGE_API;

    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${window.nexusAuth?.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("Ошибка сохранения");

    showToast("Сохранено", "success");
    hideModal("knowledge-modal");
    currentDoc = null;
    loadKnowledge();
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    setButtonLoading(this, false);
  }
});

// 🔹 Удаление
deleteBtn?.addEventListener("click", async function () {
  if (!currentDoc || !confirm("Удалить эту статью безвозвратно?")) return;
  try {
    const r = await fetch(`${KNOWLEDGE_API}/${currentDoc.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
    });
    if (!r.ok) throw new Error("Ошибка удаления");
    showToast("Удалено", "success");
    hideModal("knowledge-modal");
    currentDoc = null;
    loadKnowledge();
  } catch (e) {
    showToast(e.message, "error");
  }
});

// 🔹 WYSIWYG ТУЛБАР
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".fmt-btn[data-cmd]");
  if (btn && e.target.closest("#knowledge-modal")) {
    if (btn.dataset.cmd === "createLink") insertLink();
    else execFormat(btn.dataset.cmd);
  }
});

// 🔹 Закрытие модалки
closeBtn?.addEventListener("click", () => {
  hideModal("knowledge-modal");
  currentDoc = null;
});
knowledgeModal?.addEventListener("click", (e) => {
  if (e.target === knowledgeModal) {
    hideModal("knowledge-modal");
    currentDoc = null;
  }
});

addBtn?.addEventListener("click", () => openKnowledgeModal(null));
