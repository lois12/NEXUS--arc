/**
 * 📦 NEXUS SYSTEM | nexus-js/mediaplan.js
 * 📅 Модуль: Календарь, события, заметки, медиа, логи, зум, голосовой ввод
 */

import {
  showToast,
  renderMarkdown,
  setButtonLoading,
  execFormat,
  insertLink,
} from "./utils.js";

const NOTES_API = "http://localhost:5000/api/media-plan/notes";
const MEDIA_API = "http://localhost:5000/api/mediaplan";
const LOGS_API = "http://localhost:5000/api/media-plan-logs";

// 🔹 State
let notesCache = [];
let currentEventDate = null;
let editingEventId = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let currentZoomLevel = 1;

// 🔹 DOM Elements
const calendarGrid = document.getElementById("calendar-grid");
const calMonthYear = document.getElementById("cal-month-year");
const dayEventsList = document.getElementById("day-events-list");
const eventModal = document.getElementById("event-modal");
const logsModal = document.getElementById("logs-modal");
const logsTableBody = document.getElementById("logs-table-body");
const zoomModal = document.getElementById("zoom-modal");
const zoomImg = document.getElementById("zoom-img");

// ============================================================================
// 🔹 API HELPERS
// ============================================================================
async function apiGetNotes() {
  const r = await fetch(NOTES_API, {
    headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  notesCache = data;
  return data;
}

async function apiCreateNote(data) {
  const r = await fetch(NOTES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${window.nexusAuth?.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Ошибка создания");
  const n = await r.json();
  notesCache.push(n);
  return n;
}

async function apiUpdateNote(id, data) {
  const r = await fetch(`${NOTES_API}/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${window.nexusAuth?.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Ошибка обновления");
  const u = await r.json();
  const idx = notesCache.findIndex((n) => n.id === id);
  if (idx !== -1) notesCache[idx] = u;
  return u;
}

async function apiDeleteNote(id) {
  const r = await fetch(`${NOTES_API}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
  });
  if (!r.ok) throw new Error("Ошибка удаления");
  notesCache = notesCache.filter((n) => n.id !== id);
  return true;
}

async function apiLogMedia(action, ev, det = "") {
  return fetch(LOGS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${window.nexusAuth?.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      eventName: ev.name,
      date: ev.date,
      details: det,
    }),
  });
}

async function apiGetEventMedia(date, evId) {
  const r = await fetch(`${MEDIA_API}/images/${date}/${evId}`, {
    headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
  });
  return r.ok ? r.json() : [];
}

async function apiUploadMedia(date, evId, files) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("images", f));
  const r = await fetch(`${MEDIA_API}/upload/${date}/${evId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
    body: fd,
  });
  if (!r.ok) throw new Error("Ошибка загрузки медиа");
  return r.json();
}

// ============================================================================
// 🔹 RENDERING
// ============================================================================
function renderEventList(ds) {
  if (!dayEventsList) return;
  dayEventsList.innerHTML = "";
  const evs = notesCache.filter((n) => n.date === ds);

  if (!evs.length) {
    dayEventsList.innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:15px">Нет событий</p>';
    return;
  }

  evs.forEach((ev) => {
    const num = ev.eventNum || 1;
    const isEd = editingEventId === ev.id;
    const card = document.createElement("div");
    card.className = "event-card-full";

    if (isEd) {
      const sid = ev.id;
      card.innerHTML = `
        <div class="event-edit-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4 style="margin:0;color:var(--neon-yellow)">✏️ Ред. #${num}</h4>
          <button class="event-action-btn cancel-edit-btn" title="Отмена">❌</button>
        </div>
        <input type="text" class="edit-name-input" value="${ev.name.replace(/"/g, '"')}" style="width:100%;margin-bottom:10px">
        <div class="wysiwyg-toolbar" style="margin-bottom:8px">
          <button class="fmt-btn" data-cmd="bold">Ж</button>
          <button class="fmt-btn" data-cmd="italic">К</button>
          <button class="fmt-btn" data-cmd="underline">Ч</button>
          <button class="fmt-btn" data-cmd="createLink">🔗</button>
          <button class="fmt-btn" data-cmd="removeFormat">↺</button>
          <button class="fmt-btn voice-toolbar-btn" id="voice-event-edit-btn">🎙️</button>
        </div>
        <div class="edit-comment-input wysiwyg-editor" contenteditable="true" style="min-height:80px;margin-bottom:10px">${ev.comment || ""}</div>
        <div class="channels-row" style="margin-bottom:12px">
          <label class="neon-checkbox"><input type="checkbox" id="ec-s-${sid}" ${ev.channels?.site ? "checked" : ""}><span>🌐 Сайт</span></label>
          <label class="neon-checkbox"><input type="checkbox" id="ec-t-${sid}" ${ev.channels?.telegram ? "checked" : ""}><span>📱 ТГ</span></label>
          <label class="neon-checkbox"><input type="checkbox" id="ec-v-${sid}" ${ev.channels?.vk ? "checked" : ""}><span>🟦 ВК</span></label>
          <label class="neon-checkbox"><input type="checkbox" id="ec-m-${sid}" ${ev.channels?.max ? "checked" : ""}><span>👤 Макс</span></label>
        </div>
        <button class="btn-confirm save-edit-btn" style="width:100%">💾 Сохранить</button>`;

      card.querySelector(".save-edit-btn").onclick = async (e) => {
        e.stopPropagation();
        setButtonLoading(e.target, true);
        try {
          await apiUpdateNote(ev.id, {
            name: card.querySelector(".edit-name-input").value,
            comment: card.querySelector(".edit-comment-input").innerHTML,
            channels: {
              site: document.getElementById(`ec-s-${sid}`).checked,
              telegram: document.getElementById(`ec-t-${sid}`).checked,
              vk: document.getElementById(`ec-v-${sid}`).checked,
              max: document.getElementById(`ec-m-${sid}`).checked,
            },
          });
          await apiLogMedia("UPDATE", ev);
          editingEventId = null;
          renderEventList(currentEventDate);
          renderCalendar();
          showToast("✅ Сохранено", "success");
        } catch (err) {
          showToast("❌ " + err.message, "error");
        } finally {
          setButtonLoading(e.target, false);
        }
      };

      card.querySelector(".cancel-edit-btn").onclick = () => {
        editingEventId = null;
        renderEventList(ds);
      };

      // WYSIWYG toolbar bindings
      card.querySelectorAll(".fmt-btn").forEach((btn) => {
        if (btn.dataset.cmd === "createLink") btn.onclick = insertLink;
        else btn.onclick = () => execFormat(btn.dataset.cmd);
      });
    } else {
      let tags = "";
      if (ev.channels?.site) tags += '<span class="channel-badge">🌐</span>';
      if (ev.channels?.telegram)
        tags += '<span class="channel-badge tg">📱</span>';
      if (ev.channels?.vk) tags += '<span class="channel-badge vk">🟦</span>';
      if (ev.channels?.max) tags += '<span class="channel-badge max">👤</span>';

      card.innerHTML = `
        <div class="event-view-header">
          <h4>#${num} ${ev.name}</h4>
          <div class="event-actions">
            <button class="event-action-btn edit-btn" title="Редактировать">✎</button>
            <button class="event-action-btn delete-btn" title="Удалить">🗑️</button>
          </div>
        </div>
        <div class="event-comment-body">${renderMarkdown(ev.comment || "")}</div>
        <div class="channels-row" style="margin:8px 0;padding:0">${tags || "Нет каналов"}</div>
        <div id="mg-${ev.id}" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
        <div style="margin-top:6px">
          <input type="file" id="mi-${ev.id}" class="hidden-file-input" multiple>
          <button class="btn-upload photo-btn">📷 Фото</button>
          <button class="fmt-btn voice-toolbar-btn" id="voice-event-btn">🎙️</button>
        </div>`;

      card.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        editingEventId = ev.id;
        renderEventList(ds);
      });
      card.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Удалить это событие?")) {
          apiDeleteNote(ev.id).then(() => {
            apiLogMedia("DELETE", ev);
            renderEventList(ds);
            renderCalendar();
            showToast("Удалено", "success");
          });
        }
      });
      card.querySelector(".photo-btn").onclick = () =>
        document.getElementById(`mi-${ev.id}`).click();
      loadEventMedia(ds, ev);
    }
    dayEventsList.appendChild(card);
  });
}

function loadEventMedia(ds, ev) {
  apiGetEventMedia(ds, ev.eventNum || 1).then((m) => {
    const g = document.getElementById(`mg-${ev.id}`);
    if (!g) return;
    g.innerHTML = "";
    if (!m.length) {
      g.innerHTML =
        '<div style="color:var(--text-muted);font-size:11px">Нет фото</div>';
      return;
    }
    m.forEach((i) => {
      const wrap = document.createElement("div");
      wrap.className = "photo-thumb-wrapper";
      wrap.innerHTML = `<img src="${i.url}" onclick="openZoomModal('${i.url}')"><button class="photo-delete-btn" data-date="${ev.date}" data-ev="${ev.eventNum || 1}" data-file="${i.serverName || i.name}">✕</button>`;
      g.appendChild(wrap);
    });
  });
}

export function renderCalendar() {
  apiGetNotes().then(() => {
    if (!calendarGrid) return;
    calendarGrid.classList.add("fading");
    setTimeout(() => {
      calendarGrid.innerHTML = "";
      if (calMonthYear) {
        calMonthYear.textContent = new Date(calYear, calMonth)
          .toLocaleString("ru-RU", { month: "long", year: "numeric" })
          .replace(/^\w/, (c) => c.toUpperCase());
      }
      const fd = new Date(calYear, calMonth, 1).getDay();
      const dim = new Date(calYear, calMonth + 1, 0).getDate();
      const off = fd === 0 ? 6 : fd - 1;

      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((d) => {
        const el = document.createElement("div");
        el.className = "calendar-day-header";
        el.textContent = d;
        calendarGrid.appendChild(el);
      });
      for (let i = 0; i < off; i++)
        calendarGrid.appendChild(document.createElement("div"));

      const t = new Date();
      const isCurrentMonth =
        t.getFullYear() === calYear && t.getMonth() === calMonth;

      for (let d = 1; d <= dim; d++) {
        const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const el = document.createElement("div");
        el.className = "calendar-day";
        el.textContent = d;
        el.dataset.date = ds;
        el.style.animationDelay = `${d * 0.012}s`;
        if (isCurrentMonth && d === t.getDate()) el.classList.add("today");
        const dow = new Date(calYear, calMonth, d).getDay();
        if (dow === 0 || dow === 6) el.classList.add("is-weekend");
        if (notesCache.some((n) => n.date === ds))
          el.classList.add("has-event");
        el.onclick = () => openEventModal(ds);
        calendarGrid.appendChild(el);
      }
      setTimeout(() => calendarGrid.classList.remove("fading"), 50);
      renderNextPost();
    }, 150);
  });
}

export function renderNextPost() {
  const c = document.getElementById("next-post-content");
  if (!c) return;
  const td = new Date().toISOString().split("T")[0];
  const fut = notesCache
    .filter((e) => e.date >= td)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!fut.length) {
    c.innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:15px">Нет будущих постов</p>';
    return;
  }
  const d = fut[0].date;
  const evs = fut.filter((e) => e.date === d);
  let h = `<div><div style="color:var(--neon-yellow);font-family:monospace;font-weight:bold;margin-bottom:8px">📅 ${d.split("-").reverse().join(".")}</div>`;
  evs.forEach((ev) => {
    let ch = "";
    if (ev.channels?.site) ch += '<span class="channel-badge">🌐</span>';
    if (ev.channels?.telegram) ch += '<span class="channel-badge tg">📱</span>';
    if (ev.channels?.vk) ch += '<span class="channel-badge vk">🟦</span>';
    if (ev.channels?.max) ch += '<span class="channel-badge max">👤</span>';
    h += `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(136,146,176,0.2)"><div style="font-weight:600;color:#fff">#${ev.eventNum || 1} ${ev.name}</div>${ev.comment ? `<div style="color:var(--text-muted);font-size:11px;margin:4px 0">${renderMarkdown(ev.comment)}</div>` : ""}<div style="display:flex;gap:4px;flex-wrap:wrap;margin:5px 0">${ch || "Нет каналов"}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px" id="wg-${ev.id}"></div></div>`;
  });
  c.innerHTML = h + "</div>";
  evs.forEach((ev) => {
    apiGetEventMedia(ev.date, ev.eventNum || 1).then((m) => {
      const g = document.getElementById(`wg-${ev.id}`);
      if (!g) return;
      g.innerHTML = "";
      if (!m.length) {
        g.innerHTML =
          '<div style="color:var(--text-muted);font-size:11px">Нет фото</div>';
        return;
      }
      m.forEach((i) => {
        const wrap = document.createElement("div");
        wrap.className = "photo-thumb-wrapper";
        wrap.innerHTML = `<img src="${i.url}" onclick="openZoomModal('${i.url}')">`;
        g.appendChild(wrap);
      });
    });
  });
}

// ============================================================================
// 🔹 MODALS & UI
// ============================================================================
export function openEventModal(ds) {
  currentEventDate = ds;
  editingEventId = null;
  apiGetNotes().then(() => {
    const t = document.getElementById("event-modal-title");
    if (t) t.textContent = "📅 " + ds.split("-").reverse().join(".");
    const n = document.getElementById("evt-name");
    if (n) n.value = "";
    const c = document.getElementById("evt-comment");
    if (c) c.innerHTML = "";
    ["ch-site", "ch-tg", "ch-vk", "ch-max"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    const s = document.getElementById("save-event-btn");
    if (s) s.textContent = "💾 Создать новое";
    renderEventList(ds);
    eventModal?.classList.add("active");
  });
}

export function loadLogs() {
  const btn = document.getElementById("show-logs-btn");
  if (btn) setButtonLoading(btn, true);
  fetch(LOGS_API, {
    headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
  })
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then((l) => {
      if (!logsTableBody) return;
      logsTableBody.innerHTML = "";
      if (!l.length) {
        logsTableBody.innerHTML =
          '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Нет записей</td></tr>';
        return;
      }
      l.forEach((x) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="log-time">${new Date(x.timestamp).toLocaleString("ru-RU")}</td><td class="log-user">${x.username || "-"}</td><td class="log-action">${x.action}</td><td>${x.eventName}/${x.date}</td><td class="log-details">${x.details}</td>`;
        logsTableBody.appendChild(tr);
      });
      logsModal?.classList.add("active");
    })
    .catch(() => showToast("Ошибка загрузки логов", "error"))
    .finally(() => {
      if (btn) setButtonLoading(btn, false);
    });
}

// ============================================================================
// 🔹 EVENT LISTENERS (SELF-CONTAINED)
// ============================================================================
// Calendar Nav
document.getElementById("cal-prev")?.addEventListener("click", () => {
  calMonth--;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
});
document.getElementById("cal-next")?.addEventListener("click", () => {
  calMonth++;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
});

// Save Event
document
  .getElementById("save-event-btn")
  ?.addEventListener("click", async function () {
    setButtonLoading(this, true);
    try {
      const n = document.getElementById("evt-name")?.value.trim();
      const c = document.getElementById("evt-comment")?.innerHTML || "";
      if (!n) throw new Error("Введите название");
      const ch = {
        site: document.getElementById("ch-site").checked,
        telegram: document.getElementById("ch-tg").checked,
        vk: document.getElementById("ch-vk").checked,
        max: document.getElementById("ch-max").checked,
      };
      await apiCreateNote({
        date: currentEventDate,
        name: n,
        comment: c,
        channels: ch,
        eventNum:
          notesCache.filter((e) => e.date === currentEventDate).length + 1,
      });
      await apiLogMedia("CREATE", { name: n, date: currentEventDate });
      showToast("Создано", "success");
      renderEventList(currentEventDate);
      renderCalendar();
      renderNextPost();
      if (document.getElementById("evt-name"))
        document.getElementById("evt-name").value = "";
      if (document.getElementById("evt-comment"))
        document.getElementById("evt-comment").innerHTML = "";
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setButtonLoading(this, false);
    }
  });

// File Upload for Events
document.addEventListener("change", async (e) => {
  if (e.target.id?.startsWith("mi-") && e.target.files.length > 0) {
    const evId = e.target.id.replace("mi-", "");
    const ev = notesCache.find((n) => n.id === evId);
    if (!ev) return;
    const btn = document.querySelector(`#mi-${evId}+ .btn-upload`);
    if (btn) setButtonLoading(btn, true);
    try {
      showToast("Загрузка...", "info");
      await apiUploadMedia(ev.date, ev.eventNum || 1, e.target.files);
      await apiLogMedia("UPLOAD_MEDIA", ev);
      showToast("Загружено", "success");
      e.target.value = "";
      loadEventMedia(ev.date, ev);
      renderNextPost();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      if (btn) setButtonLoading(btn, false);
    }
  }
});

// Photo Delete (Delegation)
dayEventsList?.addEventListener("click", async (e) => {
  const delBtn = e.target.closest(".photo-delete-btn");
  if (delBtn) {
    const { date, ev, file } = delBtn.dataset;
    if (!confirm("Удалить это фото?")) return;
    try {
      await fetch(`/api/mediaplan/event/${date}/${ev}/${file}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
      });
      showToast("Фото удалено", "success");
      renderCalendar();
      renderNextPost();
    } catch (err) {
      showToast("Ошибка: " + err.message, "error");
    }
  }
});

// WYSIWYG Toolbar (Global delegation)
document.addEventListener("click", (e) => {
  if (e.target.matches(".fmt-btn[data-cmd]")) {
    if (e.target.dataset.cmd === "createLink") insertLink();
    else execFormat(e.target.dataset.cmd);
  }
});

// Zoom Modal
window.openZoomModal = (src) => {
  currentZoomLevel = 1;
  if (zoomImg) {
    zoomImg.src = src;
    zoomImg.style.transform = "scale(1)";
  }
  zoomModal?.classList.add("active");
};
window.closeZoomModal = () => zoomModal?.classList.remove("active");
document
  .getElementById("zoom-close")
  ?.addEventListener("click", window.closeZoomModal);
document.getElementById("zoom-in")?.addEventListener("click", () => {
  currentZoomLevel = Math.min(currentZoomLevel + 0.5, 4);
  if (zoomImg) zoomImg.style.transform = `scale(${currentZoomLevel})`;
});
document.getElementById("zoom-out")?.addEventListener("click", () => {
  currentZoomLevel = Math.max(currentZoomLevel - 0.5, 0.5);
  if (zoomImg) zoomImg.style.transform = `scale(${currentZoomLevel})`;
});
document.getElementById("zoom-reset")?.addEventListener("click", () => {
  currentZoomLevel = 1;
  if (zoomImg) zoomImg.style.transform = "scale(1)";
});
zoomModal?.addEventListener("click", (e) => {
  if (e.target === zoomModal) window.closeZoomModal();
});

// Logs Modal
document
  .getElementById("open-logs-btn")
  ?.addEventListener("click", () =>
    document.getElementById("show-logs-btn")?.click(),
  );
document.getElementById("show-logs-btn")?.addEventListener("click", loadLogs);
document
  .getElementById("close-logs-modal")
  ?.addEventListener("click", () => logsModal?.classList.remove("active"));
logsModal?.addEventListener("click", (e) => {
  if (e.target === logsModal) logsModal.classList.remove("active");
});

// Event Modal Close
document.getElementById("close-event-modal")?.addEventListener("click", () => {
  eventModal?.classList.remove("active");
  editingEventId = null;
});
document.getElementById("cancel-event-btn")?.addEventListener("click", () => {
  eventModal?.classList.remove("active");
  editingEventId = null;
});

// Voice Input
export function initVoiceInputs() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    document
      .querySelectorAll(".voice-toolbar-btn")
      .forEach((b) => (b.style.display = "none"));
    return;
  }
  let activeRec = null;
  function start(btn, tid) {
    if (activeRec && activeRec._target === tid) {
      activeRec.stop();
      activeRec = null;
      btn.classList.remove("listening");
      return;
    }
    if (activeRec) activeRec.stop();
    const ed = document.getElementById(tid);
    if (!ed) return;
    activeRec = new SR();
    activeRec.lang = "ru-RU";
    activeRec.continuous = true;
    activeRec.interimResults = true;
    activeRec._target = tid;
    activeRec._btn = btn;
    activeRec._processedIdx = 0;
    btn.classList.add("listening");
    ed.focus();
    activeRec.onresult = (e) => {
      let f = "";
      for (let i = activeRec._processedIdx; i < e.results.length; i++) {
        if (!e.results[i] || !e.results[i][0]) continue;
        if (e.results[i].isFinal) {
          f += e.results[i][0].transcript + " ";
          activeRec._processedIdx = i + 1;
        }
      }
      if (f) {
        ed.focus();
        document.execCommand("insertText", false, f.trim());
      }
    };
    activeRec.onend = () => {
      if (activeRec?._btn) activeRec._btn.classList.remove("listening");
      activeRec = null;
    };
    activeRec.onerror = (err) => {
      if (activeRec?._btn) activeRec._btn.classList.remove("listening");
      activeRec = null;
      if (err.error !== "aborted" && err.error !== "no-speech")
        showToast("⚠️ Микрофон недоступен", "warning");
    };
    try {
      activeRec.start();
    } catch {
      btn.classList.remove("listening");
      showToast("⚠️ Ошибка запуска", "error");
    }
  }
  const stopAll = () => {
    if (activeRec) {
      activeRec.stop();
      activeRec = null;
    }
  };
  document
    .getElementById("voice-event-btn")
    ?.addEventListener("click", function () {
      start(this, "evt-comment");
    });
  document
    .getElementById("voice-knowledge-btn")
    ?.addEventListener("click", function () {
      start(this, "doc-editor");
    });
  ["event-modal", "knowledge-modal"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", (e) => {
      if (e.target.id === id) stopAll();
    });
  });
  ["close-event-modal", "cancel-event-btn", "close-knowledge-modal"].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener("click", stopAll);
    },
  );
}
