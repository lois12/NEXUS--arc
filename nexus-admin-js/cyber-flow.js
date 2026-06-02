document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = {
    apiBase: "http://192.168.31.5:5000/api",
    endpoints: [
      { method: "POST", path: "/admin/login", label: "Admin Auth" },
      { method: "GET", path: "/admin/stats", label: "System Stats" },
      { method: "GET", path: "/admin/users", label: "Users List" },
      { method: "GET", path: "/admin/notes", label: "Admin Notes" },
      { method: "GET", path: "/admin/file-logs", label: "File Logs" },
      { method: "GET", path: "/diagnostics/speed-test", label: "Speed Test" },
    ],
    nodes: [
      { id: "storage", label: "Database / Storage", critical: true },
      { id: "tasks", label: "Task Queue / Workers", critical: true },
      { id: "knowledge", label: "Knowledge Base", critical: false },
      { id: "generator", label: "Code Generator", critical: false },
    ],
  };

  let logEntries = [];
  let monitorActive = false;
  let resourceInterval;

  window.toggleSystemMonitor = () => {
    const overlay = document.getElementById("system-monitor-overlay");
    if (!overlay) return;
    monitorActive = !monitorActive;
    overlay.classList.toggle("active", monitorActive);

    if (monitorActive) {
      renderDependencyGraph();
      renderApiList();
      addLog("System Monitor opened", "info");
      resourceInterval = setInterval(updateSystemResources, 5000);
      updateSystemResources();
    } else {
      clearInterval(resourceInterval);
    }
  };

  document
    .getElementById("close-monitor")
    ?.addEventListener("click", toggleSystemMonitor);

  function renderDependencyGraph() {
    const container = document.getElementById("dependency-graph");
    if (!container) return;
    container.innerHTML = `
      <div class="dependency-row">
        <span class="node-core">[CORE]</span>
        <span class="node-connector">───┬───</span>
        <div style="display:flex;flex-direction:column;gap:5px;flex:1">
          ${CONFIG.nodes
            .map(
              (node) => `
            <div class="node-item" data-node="${node.id}">
              <span class="node-name">${node.label}</span>
              <span class="node-status off" id="status-${node.id}">CHECKING...</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
    CONFIG.nodes.forEach((node) => checkNodeStatus(node.id));
  }

  async function checkNodeStatus(nodeId) {
    const statusEl = document.getElementById(`status-${nodeId}`);
    if (!statusEl) return;
    const testUrl = `${CONFIG.apiBase}/admin/stats`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("nexus_admin_token") || ""}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        statusEl.className = "node-status ok";
        statusEl.textContent = "ONLINE";
        addLog(`Node [${nodeId}] heartbeat → OK`, "ok");
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      statusEl.className = "node-status err";
      statusEl.textContent = "OFFLINE";
      const msg = error.name === "AbortError" ? "Timeout (3s)" : error.message;
      addLog(`Node [${nodeId}] check failed: ${msg}`, "err");
    }
  }

  async function updateSystemResources() {
    try {
      const token = localStorage.getItem("nexus_admin_token");
      const response = await fetch(`${CONFIG.apiBase}/admin/system-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch system stats");
      const data = await response.json();

      const cpuProgress = document.getElementById("cpu-progress");
      const ramProgress = document.getElementById("ram-progress");
      const diskProgress = document.getElementById("disk-progress");

      cpuProgress.style.width = `${data.cpu}%`;
      cpuProgress.textContent = `${data.cpu}%`;
      cpuProgress.style.background =
        data.cpu > 80
          ? "linear-gradient(90deg, #ff2a6d, #ffcc00)"
          : "linear-gradient(90deg, var(--neon-green), var(--neon-cyan))";

      ramProgress.style.width = `${data.ram}%`;
      ramProgress.textContent = `${data.ram}%`;
      ramProgress.style.background =
        data.ram > 85
          ? "linear-gradient(90deg, #ff2a6d, #ffcc00)"
          : "linear-gradient(90deg, var(--neon-green), var(--neon-cyan))";

      diskProgress.style.width = `${data.disk}%`;
      diskProgress.textContent = `${data.disk}%`;
      diskProgress.style.background =
        data.disk > 90
          ? "linear-gradient(90deg, #ff2a6d, #ffcc00)"
          : "linear-gradient(90deg, var(--neon-green), var(--neon-cyan))";
    } catch (error) {
      console.error("Error updating system resources:", error);
    }
  }

  function renderApiList() {
    const container = document.getElementById("api-list");
    if (!container) return;
    container.innerHTML = CONFIG.endpoints
      .map(
        (ep, i) => `
      <div class="api-item" id="api-${i}" data-index="${i}">
        <span class="api-method ${ep.method.toLowerCase()}">${ep.method}</span>
        <span class="api-endpoint" title="${CONFIG.apiBase}${ep.path}">${ep.path}</span>
        <span class="api-result">
          <span class="api-time" id="time-${i}">—</span>
          <button class="api-test-btn" onclick="testSingleEndpoint(${i})">Test</button>
        </span>
      </div>
    `,
      )
      .join("");
  }

  window.testSingleEndpoint = async (index) => {
    const ep = CONFIG.endpoints[index];
    const item = document.getElementById(`api-${index}`);
    const timeEl = document.getElementById(`time-${index}`);
    if (!item || !timeEl) return;

    item.style.opacity = "0.6";
    timeEl.textContent = "testing...";
    addLog(`→ Testing ${ep.method} ${ep.path}`, "info");

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${CONFIG.apiBase}${ep.path}`, {
        method: ep.method === "GET" ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("nexus_admin_token") || ""}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const duration = Math.round(performance.now() - start);
      timeEl.textContent = `${duration}ms`;

      if (response.ok) {
        item.className = `api-item ok`;
        addLog(
          `✓ ${ep.method} ${ep.path} → ${response.status} OK (${duration}ms)`,
          "ok",
        );
      } else if (response.status >= 400 && response.status < 500) {
        item.className = `api-item warn`;
        addLog(
          `⚠ ${ep.method} ${ep.path} → ${response.status} Client Error`,
          "warn",
        );
      } else {
        item.className = `api-item err`;
        addLog(
          `✗ ${ep.method} ${ep.path} → ${response.status} Server Error`,
          "err",
        );
      }
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      timeEl.textContent = `ERR`;
      item.className = `api-item err`;
      const errorMsg =
        error.name === "AbortError" ? "Timeout (5s)" : error.message;
      addLog(`✗ ${ep.method} ${ep.path} → ${errorMsg}`, "err");
      console.error(`[API ERROR] ${ep.method} ${ep.path}:`, error);
    } finally {
      item.style.opacity = "1";
    }
  };

  document
    .getElementById("test-all-api")
    ?.addEventListener("click", async () => {
      const statusEl = document.getElementById("api-test-status");
      if (!statusEl) return;
      statusEl.textContent = "Running...";
      addLog("▶ Starting bulk API health check...", "info");
      for (let i = 0; i < CONFIG.endpoints.length; i++) {
        await testSingleEndpoint(i);
        await new Promise((r) => setTimeout(r, 300));
      }
      statusEl.textContent = "✓ Complete";
      setTimeout(() => {
        statusEl.textContent = "";
      }, 2000);
      addLog("✓ Bulk check finished", "ok");
    });

  function addLog(message, type = "info") {
    const viewer = document.getElementById("log-viewer");
    if (!viewer) return;
    const empty = viewer.querySelector(".log-empty");
    if (empty) empty.remove();

    const time = new Date().toLocaleTimeString("ru-RU");
    const icon =
      type === "ok" ? "✓" : type === "warn" ? "⚠" : type === "err" ? "✗" : "•";

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-status ${type}">${icon}</span><span class="log-endpoint">${message}</span>`;

    viewer.insertBefore(entry, viewer.firstChild);
    const entries = viewer.querySelectorAll(".log-entry");
    if (entries.length > 50) entries[entries.length - 1].remove();
    viewer.scrollTop = 0;
    logEntries.unshift({ time, type, message });
    if (logEntries.length > 100) logEntries.pop();
  }

  document.getElementById("clear-log")?.addEventListener("click", () => {
    const viewer = document.getElementById("log-viewer");
    if (!viewer) return;
    viewer.innerHTML =
      '<div class="log-empty">Log cleared. Click "Test All" to start.</div>';
    logEntries = [];
    addLog("Log cleared by admin", "info");
  });
});
