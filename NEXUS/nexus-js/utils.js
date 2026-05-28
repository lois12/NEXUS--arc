/**
 * 📦 NEXUS SYSTEM | nexus-js/utils.js
 * 🛠 Модуль: UI-утилиты, темы, уведомления, модалки, часы, анимации переходов
 */

export function getThemeColor() {
  if (document.body.classList.contains("theme-vaporwave")) return "#bd00ff";
  if (document.body.classList.contains("theme-matrix")) return "#00ff9d";
  return "#00f0ff";
}

export function showToast(msg, type = "info", duration = 3000) {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    c.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
    document.body.appendChild(c);
  }
  const el = document.createElement("div");
  const colors = {
    success: "#00ff9d",
    error: "#ff2a6d",
    warning: "#ffcc00",
    info: "#00f0ff",
  };
  const icons = { success: "✅", error: "⚠️", warning: "🟡", info: "ℹ️" };
  const col = colors[type] || getThemeColor();

  el.style.cssText = `pointer-events:auto;min-width:250px;padding:10px 14px;border-radius:6px;background:rgba(11,16,26,0.95);border-left:4px solid ${col};color:#fff;font-family:var(--font-mono);font-size:13px;animation:slideIn 0.3s forwards;`;
  el.innerHTML = `<span>${icons[type] || "ℹ️"}</span> ${msg}`;
  c.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function renderMarkdown(t) {
  if (!t || typeof window.marked === "undefined") return t || "";
  try {
    return window.marked.parse(t);
  } catch {
    return t;
  }
}

// Применяет тему без уведомлений (для инициализации)
export function applyTheme(th) {
  const themes = ["cyberpunk", "vaporwave", "matrix", "solar", "red-protocol"];
  if (!themes.includes(th)) th = "cyberpunk";
  document.body.classList.remove(...themes.map((t) => `theme-${t}`));
  if (th !== "cyberpunk") document.body.classList.add(`theme-${th}`);
  document
    .querySelectorAll(".theme-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.theme === th));
}

// Переключает тему с уведомлением и пульсацией
export function setTheme(th) {
  applyTheme(th);
  localStorage.setItem("nexus_theme", th);
  document.body.classList.add("theme-pulse");
  setTimeout(() => document.body.classList.remove("theme-pulse"), 700);
  //howToast(`🎨 Тема: ${th}`, "success");
}

// Инициализация темы при загрузке
export function initTheme() {
  const saved = localStorage.getItem("nexus_theme") || "cyberpunk";
  applyTheme(saved);
}

// Унифицированная модалка подтверждения
export function showNexusModal(title, text, col = "var(--neon-cyan)") {
  let m = document.getElementById("nexus-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "nexus-modal";
    m.className = "nexus-modal";
    m.innerHTML = `
      <div class="modal-content">
        <div class="modal-title" id="modal-title"></div>
        <div class="modal-text" id="modal-text"></div>
        <div style="text-align:center;margin-top:15px;">
          <button id="modal-cancel" style="background:var(--neon-cyan);color:#000;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">OK</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-title").style.color = col;
  document.getElementById("modal-text").textContent = text;
  m.classList.add("active");

  const btn = document.getElementById("modal-cancel");
  const close = () => m.classList.remove("active");

  btn.onclick = close;
  m.addEventListener("click", (e) => {
    if (e.target === m) close();
  });

  return {
    onConfirm: (cb) => (btn.onclick = cb),
    close: close,
  };
}

// WYSIWYG хелперы
export function execFormat(cmd, val = null) {
  document.execCommand(cmd, false, val);
  const e = document.activeElement;
  if (e?.classList.contains("wysiwyg-editor")) e.focus();
}

export function insertLink() {
  const u = prompt("URL:", "https://");
  if (u) execFormat("createLink", u);
}

// Часы в хедере/дашборде
export function startClock() {
  if (window._clockInterval) clearInterval(window._clockInterval);
  const update = () => {
    const now = new Date().toLocaleTimeString("ru-RU", { hour12: false });
    ["dash-time", "archive-time", "landing-time"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) el.textContent = now;
    });
  };
  update();
  window._clockInterval = setInterval(update, 1000);
}

// Состояние загрузки кнопок
export function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.classList.add("btn-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }
}

// Анимация перехода между страницами
export function playTransition(cb) {
  const o = document.getElementById("page-transition");
  if (o) {
    o.classList.add("active");
    setTimeout(() => {
      cb();
      setTimeout(() => o.classList.remove("active"), 500);
    }, 700);
  } else cb();
}
// 🔹 ПРОГРЕСС-ТОСТ С 3D-СФЕРОЙ
export function showNexusProgressToast(type = "upload", duration = 1200) {
  let toast = document.getElementById("nexus-progress-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "nexus-progress-toast";
    toast.innerHTML = `
      <div class="nexus-sphere-loader"><span></span><span></span><span></span></div>
      <div class="nexus-progress-text" id="nexus-progress-val">0%</div>
    `;
    document.body.appendChild(toast);
  }
  const valEl = toast.querySelector("#nexus-progress-val");
  const sphere = toast.querySelector(".nexus-sphere-loader");

  toast.classList.add("active");
  sphere.style.animationDuration = "1.5s";
  valEl.className = "nexus-progress-text";
  valEl.textContent = "0%";
  sphere.style.display = "block";

  return new Promise((resolve) => {
    let start = Date.now();
    const step = () => {
      let elapsed = Date.now() - start;
      let progress = Math.min(Math.floor((elapsed / duration) * 100), 100);
      valEl.textContent = progress + "%";
      if (progress < 100) {
        requestAnimationFrame(step);
      } else {
        setTimeout(() => {
          const successMsg =
            type === "upload"
              ? "✅ Успешно"
              : type === "delete"
                ? "✅ Удалено"
                : "✅ Готово";
          valEl.textContent = successMsg;
          valEl.classList.add("success");
          sphere.style.animationDuration = "4s"; // Замедляем после завершения
          setTimeout(() => {
            toast.classList.remove("active");
            resolve(true);
          }, 1200);
        }, 150);
      }
    };
    requestAnimationFrame(step);
  });
}

export function showNexusErrorToast(msg = "Что-то пошло не так") {
  const toast = document.getElementById("nexus-progress-toast");
  if (!toast || !toast.classList.contains("active")) return;
  const valEl = toast.querySelector("#nexus-progress-val");
  const sphere = toast.querySelector(".nexus-sphere-loader");
  valEl.textContent = "❌ " + msg;
  valEl.className = "nexus-progress-text error";
  sphere.style.display = "none";
  setTimeout(() => {
    toast.classList.remove("active");
    sphere.style.display = "block";
  }, 2000);
}
// 🔹 НОВАЯ ЛОГИКА ПЕРЕХОДОВ (F5 / НАВИГАЦИЯ)
export function showPageTransition(type = "navigate") {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return Promise.resolve();

  overlay.classList.add("active");
  const scan = overlay.querySelector(".scan-line");
  const text = overlay.querySelector(".transition-text");
  const sphere = document.getElementById("transition-sphere");
  const prog = document.getElementById("transition-progress");

  if (type === "refresh") {
    scan.style.display = "block";
    text.style.display = "block";
    text.textContent = "ОБНОВЛЕНИЕ...";
    if (sphere) sphere.style.display = "none";
    if (prog) prog.style.display = "none";
    // 🔹 ЗАДЕРЖКА 1.5 СЕКУНДЫ (чтобы успеть прочитать надпись)
    return new Promise((resolve) => setTimeout(resolve, 1500));
  } else {
    scan.style.display = "none";
    text.style.display = "block";
    text.textContent = "ИНИЦИАЛИЗАЦИЯ";
    if (sphere) sphere.style.display = "block";
    if (prog) {
      prog.style.display = "block";
      prog.textContent = "0%";
    }

    return new Promise((resolve) => {
      let start = Date.now();
      const run = () => {
        let p = Math.min(Math.floor(((Date.now() - start) / 500) * 100), 100);
        if (prog) prog.textContent = p + "%";
        if (p < 100) requestAnimationFrame(run);
        else setTimeout(resolve, 150);
      };
      requestAnimationFrame(run);
    });
  }
}

export function hidePageTransition() {
  const overlay = document.getElementById("page-transition");
  if (overlay) setTimeout(() => overlay.classList.remove("active"), 100);
}
