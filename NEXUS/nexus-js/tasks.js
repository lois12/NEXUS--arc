/**
 * 📦 NEXUS SYSTEM | nexus-js/tasks.js
 * 📋 Модуль: Задачи, этапы, файлы, поиск, API-взаимодействие
 */

import {
  showToast,
  renderMarkdown,
  showNexusModal,
  setButtonLoading,
} from "./utils.js";

const API_URL = "http://localhost:5000/api/tasks";

// 🔹 DOM Elements
const taskList = document.getElementById("taskList");
const archiveList = document.getElementById("archiveList");
const searchInput = document.getElementById("searchInput");

// 🔹 API Helpers
const getAuthHeaders = () => ({
  Authorization: `Bearer ${window.nexusAuth?.token}`,
});

async function apiGet(archived = false) {
  const r = await fetch(`${API_URL}?archived=${archived}`, {
    headers: getAuthHeaders(),
  });
  return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
}

async function apiPost(data) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
}

async function apiPatch(id, data) {
  const r = await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) console.error("[PATCH ERR]", r.status, id);
  return r.ok ? r.json() : Promise.reject();
}

async function apiDelete(id) {
  const r = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
}

// 🔹 Рендеринг
export function renderTask(t, isA) {
  const li = document.createElement("li");
  li.className = `task-item priority-${t.priority || "normal"} ${t.pinned ? "pinned" : ""} ${t.archived ? "archived" : ""} collapsed`;
  li.dataset.id = t.id;

  const pColor =
    { important: "var(--neon-yellow)", critical: "var(--neon-red)" }[
      t.priority
    ] || "var(--neon-green)";

  li.innerHTML = `
    <div class="task-header">
      <button class="collapse-btn" title="Свернуть/Развернуть">▼</button>
      <span class="task-name">${t.name}</span>
      <div class="controls">
        ${
          !isA
            ? `<select class="priority-select" style="color:${pColor}">
          <option value="normal" ${t.priority === "normal" ? "selected" : ""}>🟢 Ждет</option>
          <option value="important" ${t.priority === "important" ? "selected" : ""}>🟡 Важно</option>
          <option value="critical" ${t.priority === "critical" ? "selected" : ""}>🔴 Критично</option>
        </select>`
            : ""
        }
        ${
          isA
            ? `<button class="restore-btn">↩️</button>`
            : `
          <button class="pin-btn ${t.pinned ? "active" : ""}">📌</button>
          <button class="archive-btn">📦</button>
        `
        }
        <button class="edit-btn">✎</button>
        <button class="delete-btn">✕</button>
      </div>
    </div>
    <div class="task-details">
      <div class="task-meta-row">
        <div class="meta-block">
          <span class="meta-label">Дедлайн</span>
          <input type="date" class="deadline-input" value="${t.deadline || ""}">
        </div>
        <div class="progress-wrapper">
          <span class="meta-label">Прогресс</span>
          <div class="progress-track"><div class="progress-fill" style="--progress:${t.progress}%"></div></div>
          <input type="range" min="0" max="100" value="${t.progress}" class="progress-slider">
          <span class="meta-value">${t.progress}%</span>
        </div>
      </div>
      ${t.comment ? `<div style="margin-top:4px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:0.9rem;color:var(--text-main)">${renderMarkdown(t.comment)}</div>` : ""}
      <div class="stages-block">
        <button class="add-stage-btn">+ Этап</button>
        <ul class="stage-list"></ul>
      </div>
      <div class="files-block">
        <ul class="file-list"></ul>
        <input type="file" class="hidden-file-input" multiple>
        <button class="btn-upload" data-type="task" data-id="${t.id}">📎 Добавить файл</button>
      </div>
    </div>`;

  attachTaskEvents(li, t, isA);
  return li;
}

function renderStage(s = {}) {
  const li = document.createElement("li");
  li.className = "stage-item";
  li.dataset.saved = s.id ? "true" : "false";
  li.dataset.stageId = s.id || "new_" + Date.now();
  li.innerHTML = `
    <div class="stage-fields">
      <input type="text" class="stage-name-input" value="${s.name || ""}" placeholder="Название">
      <textarea class="stage-comment-input" placeholder="Комментарий">${s.comment || ""}</textarea>
      <input type="date" class="stage-date-input" value="${s.date || ""}">
    </div>
    <div class="stage-actions">
      <button class="stage-delete-btn">✕</button>
      <button class="stage-save-btn">💾</button>
      <button class="stage-edit-btn" style="display:none">✎</button>
    </div>`;
  return li;
}

function renderFileItem(f, type, parentId, taskId) {
  const li = document.createElement("li");
  li.className = "file-item";
  li.dataset.serverName = f.serverName;
  const sz = f.size ? (f.size / 1024).toFixed(1) + " KB" : "0 KB";
  const url =
    f.url ||
    `http://localhost:5000/api/tasks/files/${window.nexusAuth?.user?.id}/${taskId}/main/${f.serverName}`;
  li.innerHTML = `<span>📄</span><a href="${url}" target="_blank" class="file-link">${f.name}</a><span style="font-size:10px;color:var(--text-muted)">(${sz})</span><button class="file-delete">🗑️</button>`;
  return li;
}

// 🔹 События задачи
function attachTaskEvents(el, t, isA) {
  const id = el.dataset.id;
  const col = el.querySelector(".collapse-btn");
  const pin = el.querySelector(".pin-btn");
  const sel = el.querySelector(".priority-select");
  const edit = el.querySelector(".edit-btn");
  const nameEl = el.querySelector(".task-name");
  const del = el.querySelector(".delete-btn");
  const arch = el.querySelector(".archive-btn");
  const res = el.querySelector(".restore-btn");
  const slider = el.querySelector(".progress-slider");
  const dIn = el.querySelector(".deadline-input");

  if (col)
    col.onclick = (e) => {
      e.stopPropagation();
      el.classList.toggle("collapsed");
      col.textContent = el.classList.contains("collapsed") ? "▶" : "▼";
    };

  if (!isA) {
    if (pin)
      pin.onclick = async () => {
        const v = !pin.classList.contains("active");
        pin.classList.toggle("active", v);
        el.classList.toggle("pinned", v);
        try {
          await apiPatch(id, { pinned: v });
          showToast(v ? "Закреплено" : "Откреплено", "success");
        } catch {}
      };
    if (sel)
      sel.onchange = async (e) => {
        el.classList.remove(
          "priority-normal",
          "priority-important",
          "priority-critical",
        );
        el.classList.add("priority-" + e.target.value);
        sel.style.color =
          { important: "var(--neon-yellow)", critical: "var(--neon-red)" }[
            e.target.value
          ] || "var(--neon-green)";
        try {
          await apiPatch(id, { priority: e.target.value });
        } catch {}
      };
    if (edit)
      edit.onclick = () => {
        nameEl.contentEditable = true;
        nameEl.focus();
      };
    nameEl.onblur = async () => {
      nameEl.contentEditable = false;
      try {
        await apiPatch(id, { name: nameEl.textContent.trim() });
      } catch {}
    };
    if (arch)
      arch.onclick = () => {
        showNexusModal("📦 В архив?", "Задача будет скрыта.");
        document.getElementById("modal-cancel").onclick = async () => {
          try {
            await apiPatch(id, { archived: true, progress: 100 });
            el.remove();
            showToast("В архиве", "success");
            document.getElementById("nexus-modal").classList.remove("active");
          } catch {}
        };
      };
  } else {
    if (res)
      res.onclick = async () => {
        try {
          await apiPatch(id, { archived: false });
          el.remove();
          showToast("Восстановлено", "success");
        } catch {}
      };
  }

  if (del)
    del.onclick = () => {
      showNexusModal("🗑️ Удалить?", "Безвозвратно.", "var(--neon-red)");
      document.getElementById("modal-cancel").onclick = async () => {
        try {
          await apiDelete(id);
          el.remove();
          showToast("Удалено", "info");
          document.getElementById("nexus-modal").classList.remove("active");
        } catch {}
      };
    };

  if (slider)
    slider.oninput = async (e) => {
      e.stopPropagation();
      el.querySelector(".progress-fill").style.setProperty(
        "--progress",
        e.target.value + "%",
      );
      el.querySelector(".meta-value").textContent = e.target.value + "%";
      try {
        await apiPatch(id, { progress: parseInt(e.target.value) });
      } catch {}
    };

  if (dIn)
    dIn.onchange = async (e) => {
      try {
        await apiPatch(id, { deadline: e.target.value || null });
      } catch {}
    };

  // Этапы
  const stUl = el.querySelector(".stage-list");
  if (stUl && Array.isArray(t.stages)) {
    t.stages.forEach((s) => {
      const se = renderStage(s);
      stUl.appendChild(se);
      se.dataset.saved = "true";
      se.querySelectorAll("input,textarea").forEach((i) => (i.disabled = true));
      se.querySelector(".stage-save-btn").style.display = "none";
      se.querySelector(".stage-edit-btn").style.display = "inline-block";
      attachStageEvents(se, stUl, el, true);
    });
  }

  // Файлы
  const fUl = el.querySelector(".files-block .file-list");
  if (fUl && Array.isArray(t.files))
    t.files.forEach((f) =>
      fUl.appendChild(renderFileItem(f, "task", "main", t.id)),
    );

  const upBtn = el.querySelector('.btn-upload[data-type="task"]');
  const fIn = el.querySelector(".files-block .hidden-file-input");
  if (upBtn && fIn) {
    upBtn.onclick = () => fIn.click();
    fIn.onchange = async (e) => {
      if (e.target.files.length) {
        await handleTaskUpload(t.id, e.target.files, el);
        e.target.value = "";
      }
    };
  }
}

function attachStageEvents(se, sl, te, ro) {
  const del = se.querySelector(".stage-delete-btn");
  const sav = se.querySelector(".stage-save-btn");
  const edt = se.querySelector(".stage-edit-btn");

  if (del)
    del.onclick = () => {
      se.remove();
      saveStages(te);
      showToast("Этап удалён", "info");
    };
  if (sav)
    sav.onclick = () => {
      se.querySelectorAll("input,textarea").forEach((i) => (i.disabled = true));
      sav.style.display = "none";
      edt.style.display = "inline-block";
      se.dataset.saved = "true";
      saveStages(te);
      showToast("Сохранено", "success");
    };
  if (edt)
    edt.onclick = () => {
      se.querySelectorAll("input,textarea").forEach(
        (i) => (i.disabled = false),
      );
      edt.style.display = "none";
      sav.style.display = "inline-block";
      se.dataset.saved = "false";
    };
}

async function saveStages(te) {
  const st = Array.from(te.querySelector(".stage-list").children)
    .filter((e) => e.dataset.saved === "true")
    .map((e) => ({
      id: e.dataset.stageId,
      name: e.querySelector(".stage-name-input").value.trim(),
      comment: e.querySelector(".stage-comment-input").value.trim(),
      date: e.querySelector(".stage-date-input").value.trim() || null,
    }));
  try {
    await apiPatch(te.dataset.id, { stages: st });
  } catch {
    showToast("Ошибка сохранения", "error");
  }
}

async function handleTaskUpload(id, files, el) {
  const btn = el.querySelector('.btn-upload[data-type="task"]');
  if (!btn) return;
  setButtonLoading(btn, true);
  try {
    showToast("Загрузка...", "info");
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const r = await fetch(`${API_URL}/${id}/stages/main/upload`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: fd,
    });
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({ error: "Ошибка" }))).error ||
          `HTTP ${r.status}`,
      );
    const up = await r.json();
    const ul = el.querySelector(".files-block .file-list");
    if (ul)
      up.forEach((f) => {
        const li = renderFileItem(f, "task", "main", id);
        ul.appendChild(li);
        li.querySelector(".file-delete").onclick = async () => {
          try {
            await fetch(`${API_URL}/${id}/stages/main/files/${f.serverName}`, {
              method: "DELETE",
              headers: getAuthHeaders(),
            });
            li.remove();
            showToast("Удалено", "success");
          } catch {}
        };
      });
    showToast(`✅ Загружено: ${up.length}`, "success");
  } catch (e) {
    console.error("[UPLOAD ERR]", e);
    showToast("Ошибка: " + e.message, "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

// 🔹 Загрузка списков
export async function loadTasks() {
  try {
    const tasks = await apiGet(false);
    window.tasksCache = tasks; // Для CLI-команд
    if (!taskList) return;
    taskList.innerHTML = "";
    if (!tasks.length) {
      taskList.innerHTML =
        '<div style="text-align:center;color:var(--text-muted);padding:20px">Нет задач</div>';
    } else {
      tasks.forEach((t) => taskList.appendChild(renderTask(t, false)));
    }
    updateTaskStats(tasks); // Обновляем счетчики
  } catch (e) {
    console.error("[LOAD TASKS ERR]", e);
    if (taskList)
      taskList.innerHTML =
        '<div style="color:var(--text-muted);padding:20px">⚠ Ошибка загрузки</div>';
  }
}

export async function loadArchive() {
  try {
    const tasks = await apiGet(true);
    window.tasksCache = tasks;
    if (!archiveList) return;
    archiveList.innerHTML = "";
    if (!tasks.length) {
      archiveList.innerHTML =
        '<div style="text-align:center;color:var(--text-muted);padding:20px">Архив пуст</div>';
    } else {
      tasks.forEach((t) => archiveList.appendChild(renderTask(t, true)));
    }
    updateArchiveStats(tasks); // Обновляем счетчики архива
  } catch (e) {
    console.error("[LOAD ARCHIVE ERR]", e);
  }
}

// 🔹 Обновление статистики задач
function updateTaskStats(tasks) {
  const activeCount = document.getElementById("dash-count");
  const dashProgress = document.getElementById("dash-progress");
  const dashCritical = document.getElementById("dash-critical");
  
  if (!activeCount || !dashProgress || !dashCritical) return;
  
  const total = tasks.length;
  const critical = tasks.filter(t => t.priority === "critical").length;
  const avgProgress = total > 0 
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / total)
    : 0;
  
  activeCount.textContent = total;
  dashProgress.textContent = avgProgress + "%";
  dashCritical.textContent = critical;
  
  // Анимация чисел
  animateValue(activeCount, parseInt(activeCount.textContent) || 0, total, 500);
  animateValue(dashCritical, parseInt(dashCritical.textContent) || 0, critical, 500);
}

function updateArchiveStats(tasks) {
  const archiveCount = document.querySelector(".archive-count");
  const archiveTotal = document.getElementById("archive-total");
  
  if (!archiveCount || !archiveTotal) return;
  
  const completed = tasks.filter(t => t.progress === 100).length;
  
  archiveCount.textContent = tasks.length;
  archiveTotal.textContent = completed;
}

function animateValue(el, start, end, duration) {
  if (start === end) return;
  const range = end - start;
  let current = start;
  const increment = end > start ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range)) || 50;
  
  const timer = setInterval(() => {
    current += increment;
    el.textContent = current;
    if (current === end) clearInterval(timer);
  }, stepTime);
}

// 🔹 Инициализация событий
document.getElementById("addTaskBtn")?.addEventListener("click", async () => {
  const n = document.getElementById("newTaskInput")?.value.trim();
  const d = document.getElementById("newTaskDeadline")?.value.trim();
  if (!n) return showToast("Введите название", "warning");
  try {
    await apiPost({ name: n, deadline: d || null, progress: 0, stages: [] });
    document.getElementById("newTaskInput").value = "";
    document.getElementById("newTaskDeadline").value = "";
    showToast("Создано", "success");
    loadTasks();
  } catch {
    showToast("Ошибка", "error");
  }
});

document.addEventListener("click", (e) => {
  const b = e.target.closest(".add-stage-btn");
  if (b) {
    e.preventDefault();
    e.stopPropagation();
    const ti = b.closest(".task-item");
    const sl = ti?.querySelector(".stage-list");
    if (!ti || !sl) return;
    const ns = renderStage({ id: "new_" + Date.now() });
    sl.appendChild(ns);
    attachStageEvents(ns, sl, ti, false);
    ns.querySelector(".stage-save-btn").style.display = "inline-block";
    ns.querySelector(".stage-edit-btn").style.display = "none";
    ns.dataset.saved = "false";
    ns.querySelector(".stage-name-input").focus();
    showToast("Этап добавлен", "success");
  }
});

if (searchInput) {
  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".task-item").forEach((t) => {
      const n = t.querySelector(".task-name")?.textContent.toLowerCase();
      t.style.display = n?.includes(q) ? "" : "none";
    });
  };
}
