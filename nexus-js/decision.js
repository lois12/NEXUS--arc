/**
 * 📦 NEXUS SYSTEM | nexus-js/decision.js
 * 🎲 Модуль: Генератор случайных решений, история, анимация
 */

export function initDecision() {
  // 🔹 DOM Elements
  const decisionInput = document.getElementById("decision-input");
  const generateBtn = document.getElementById("generate-btn");
  const resultDisplay = document.getElementById("result-display");
  const historyList = document.getElementById("history-list");

  let isAnimating = false;

  // Загрузка истории из localStorage
  function loadHistory() {
    if (!historyList) return;
    const history = JSON.parse(localStorage.getItem("decisionHistory") || "[]");
    historyList.innerHTML = "";
    history.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      li.classList.add("history-item");
      historyList.appendChild(li);
    });
  }

  // Сохранение в историю
  function saveToHistory(result) {
    const history = JSON.parse(localStorage.getItem("decisionHistory") || "[]");
    history.unshift(result);
    if (history.length > 5) history.pop();
    localStorage.setItem("decisionHistory", JSON.stringify(history));
    loadHistory();
  }

  // Анимация перебора вариантов
  function animateSelection(options) {
    if (!resultDisplay) return;
    isAnimating = true;
    let iterations = 0;
    const maxIterations = 20;
    const speed = 100;

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * options.length);
      resultDisplay.textContent = options[randomIndex];
      resultDisplay.classList.add("glitch-text");

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        finalizeSelection(options);
      }
    }, speed);
  }

  // Финальный выбор
  function finalizeSelection(options) {
    if (!resultDisplay) return;
    const finalIndex = Math.floor(Math.random() * options.length);
    const result = options[finalIndex];

    resultDisplay.textContent = result;
    resultDisplay.classList.remove("glitch-text");
    resultDisplay.classList.add("selected-effect");

    saveToHistory(`Выбрано: ${result}`);
    isAnimating = false;

    setTimeout(() => {
      if (resultDisplay) resultDisplay.classList.remove("selected-effect");
    }, 2000);
  }

  // Обработчик кнопки
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      if (isAnimating) return;
      if (!decisionInput || !resultDisplay) return;

      const text = decisionInput.value.trim();
      if (!text) {
        resultDisplay.textContent = "ВВЕДИТЕ ВАРИАНТЫ ЧЕРЕЗ ЗАПЯТУЮ";
        resultDisplay.classList.add("error-text");
        setTimeout(() => resultDisplay.classList.remove("error-text"), 2000);
        return;
      }

      const options = text
        .split(/[,;\n]+/)
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);

      if (options.length < 2) {
        resultDisplay.textContent = "МИНИМУМ 2 ВАРИАНТА";
        resultDisplay.classList.add("error-text");
        setTimeout(() => resultDisplay.classList.remove("error-text"), 2000);
        return;
      }

      resultDisplay.textContent = "ВЫЧИСЛЕНИЕ...";
      resultDisplay.classList.remove("error-text");
      animateSelection(options);
    });
  }

  // Инициализация
  loadHistory();
}

// 🔥 ЗАЩИТА ОТ ДВОЙНОГО ЗАПУСКА
if (!window.__nexus_decision_initialized) {
  window.__nexus_decision_initialized = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDecision);
  } else {
    initDecision();
  }
}
