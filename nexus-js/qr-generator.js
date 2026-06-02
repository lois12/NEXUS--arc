/**
 * 📦 NEXUS SYSTEM | qr-generator.html (Inline JS)
 * ⟁ Модуль: QR-генератор, анимация, скачивание, iframe-коммуникация
 */
document.addEventListener("DOMContentLoaded", function () {
  // 🔹 DOM Elements (Safe queries)
  const qrText = document.getElementById("qr-text");
  const qrColor = document.getElementById("qr-color");
  const qrBgColor = document.getElementById("qr-bg-color");
  const qrSize = document.getElementById("qr-size");
  const generateBtn = document.getElementById("generate-btn");
  const downloadBtn = document.getElementById("download-png");
  const qrContainer = document.getElementById("qr-container");
  const qrOutput = document.getElementById("qr-output");
  const qrPlaceholder = document.getElementById("qr-placeholder");
  const qrLoader = document.getElementById("qr-loader");
  const backBtn = document.getElementById("back-to-home");
  const percentEl = document.getElementById("loader-percent");

  let qrcodeObj = null;
  let isGenerating = false;

  // 🔹 Изолированный тост для iframe (нет доступа к utils.js родителя)
  function showToast(message, type = "info", duration = 3000) {
    const toast = document.createElement("div");
    toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; padding: 12px 20px;
            background: rgba(15,20,30,0.95); border: 2px solid ${type === "success" ? "#00ff9d" : type === "error" ? "#ff2a6d" : "#00f3ff"};
            border-radius: 10px; color: #e0e0ff; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem;
            display: flex; align-items: center; gap: 10px; z-index: 10000;
            box-shadow: 0 0 20px rgba(0,243,255,0.4); animation: slideIn 0.3s ease-out;
            backdrop-filter: blur(10px);
        `;
    toast.innerHTML = `<span>${type === "success" ? "✅" : type === "error" ? "❌" : "⚡"}</span><span>${message}</span>`;

    if (!document.getElementById("nexus-toast-anim")) {
      const style = document.createElement("style");
      style.id = "nexus-toast-anim";
      style.textContent = `@keyframes slideIn{from{transform:translateX(150px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(150px);opacity:0}}`;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease-in forwards";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // 🔹 Анимация генерации (1.3s)
  function showGenerationLoader() {
    return new Promise((resolve) => {
      if (qrOutput) qrOutput.innerHTML = "";
      if (qrPlaceholder) qrPlaceholder.style.display = "none";
      if (qrLoader) qrLoader.classList.add("active");

      let progress = 0;
      const interval = setInterval(() => {
        progress += 100 / (1300 / 30);
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        if (percentEl) percentEl.textContent = `${Math.round(progress)}%`;
      }, 30);

      setTimeout(() => {
        if (qrLoader) qrLoader.classList.remove("active");
        resolve();
      }, 1300);
    });
  }

  // 🔹 Генерация QR
  async function generateQR() {
    if (isGenerating) {
      showToast("⏳ Уже генерирую...", "info", 1500);
      return;
    }

    const text = qrText?.value?.trim();
    if (!text) {
      showToast("⚠️ Введите текст или ссылку!", "warning");
      return;
    }
    if (typeof QRCode === "undefined") {
      showToast(
        "❌ Библиотека QRCode не загружена. Проверь подключён ли qrcode.js",
        "error",
        5000,
      );
      return;
    }

    isGenerating = true;
    if (generateBtn) generateBtn.disabled = true;

    try {
      await showGenerationLoader();
      if (qrOutput) qrOutput.innerHTML = "";

      qrcodeObj = new QRCode(qrOutput, {
        text: text,
        width: parseInt(qrSize?.value) || 300,
        height: parseInt(qrSize?.value) || 300,
        colorDark: qrColor?.value || "#000000",
        colorLight: qrBgColor?.value || "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });

      if (qrContainer) {
        qrContainer.style.boxShadow =
          "0 0 0 3px #00f3ff, 0 0 40px rgba(0,243,255,0.6)";
        setTimeout(() => {
          if (qrContainer) qrContainer.style.boxShadow = "";
        }, 300);
      }

      if (downloadBtn)
        setTimeout(() => {
          downloadBtn.disabled = false;
        }, 100);
      showToast("✅ QR-код сгенерирован", "success");
    } catch (err) {
      console.error("QR Error:", err);
      showToast("❌ Ошибка генерации", "error", 4000);
      if (qrPlaceholder) {
        qrPlaceholder.textContent = "⚠️ ОШИБКА";
        qrPlaceholder.style.color = "#ff2a6d";
        qrPlaceholder.style.display = "flex";
      }
    } finally {
      isGenerating = false;
      if (generateBtn) generateBtn.disabled = false;
    }
  }

  // 🔹 Обработчики событий
  if (generateBtn) generateBtn.addEventListener("click", generateQR);

  if (qrText) {
    qrText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        generateQR();
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      const canvas =
        qrOutput?.querySelector("canvas") ||
        qrContainer?.querySelector("canvas");
      if (canvas) {
        const link = document.createElement("a");
        link.download = "nexus-qr-" + Date.now() + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast("📥 Загрузка начата", "info", 2000);
      } else {
        showToast("⚠️ Сначала сгенерируйте QR-код!", "warning");
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: "navigate", page: "home" }, "*");
        if (typeof window.parent.applyPageState === "function") {
          window.parent.applyPageState("home");
        }
      } else {
        window.location.href = "/";
      }
    });
  }

  if (downloadBtn) downloadBtn.disabled = true;

  // 🔹 Горячие клавиши
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      generateQR();
    }
    if (e.key === "Escape" && backBtn) {
      backBtn.click();
    }
  });

  console.log("⚡ QR Generator (NEXUS Enhanced) ready");
});
