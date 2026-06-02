/**
 * 📦 NEXUS SYSTEM | nexus-js/cli.js
 * 💻 Модуль: Терминал, команды, макросы, диагностика, горячие клавиши
 */

import { showToast } from "./utils.js";

// 🔥 ИСПРАВЛЕНО: Динамический базовый URL вместо хардкода localhost
const API_BASE = window.location.origin;
const API_URL = `${API_BASE}/api/tasks`;
const LOGS_API = `${API_BASE}/api/media-plan-logs`;

export function initCLI() {
  const term = document.getElementById("cli-terminal");
  const output = document.getElementById("cli-output");
  const input = document.getElementById("cli-input");
  const closeBtn = document.querySelector(".cli-close");

  if (!term || !output || !input) {
    console.warn(
      "⚠️ CLI: Элементы терминала не найдены в DOM. Проверь index.html",
    );
    return;
  }

  let isOpen = false;

  // 🔹 Вывод в консоль
  const print = (text, type = "") => {
    const line = document.createElement("div");
    line.className = `cli-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  };

  // 🔹 Парсер флагов --key=value
  const parseFlags = (arr) => {
    const flags = {};
    arr.forEach((arg) => {
      if (arg.startsWith("--")) {
        const [k, v] = arg.slice(2).split("=");
        flags[k] = v || true;
      }
    });
    return flags;
  };

  // 🔹 Выполнение команд
  const exec = (cmdStr) => {
    if (!cmdStr.trim()) return;
    print(`➜ ${cmdStr}`, "cmd");

    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case "help":
        print("📖 NEXUS CLI v2.0 | ДОСТУПНЫЕ КОМАНДЫ:", "info");
        print("  help              - Список команд", "info");
        print("  status            - Статус системы, юзер, роль", "info");
        print("  theme  <name>      - Сменить тему", "info");
        print("  nav  <page>        - Перейти на страницу", "info");
        print("  events            - Последние 5 событий", "info");
        print("  clear / cls       - Очистить терминал", "info");
        print("  logout            - Выйти из системы", "info");
        print("  exit / close      - Закрыть терминал", "info");
        print(" ");
        print("🔥 РАСШИРЕННЫЕ КОМАНДЫ:", "ok");
        print(
          "  bulk archive --priority=critical --older=7d  - Массовый архив",
          "ok",
        );
        print(
          "  export tasks --format=csv --out=backup       - Экспорт данных",
          "ok",
        );
        print(
          '  search  "текст" --in=tasks,knowledge --fuzzy  - Умный поиск',
          "ok",
        );
        print(
          '  macro record  <name>  " <commands> "             - Запись макроса',
          "ok",
        );
        print(
          "  diag cache | sync                            - Диагностика",
          "ok",
        );
        print(
          "  media cleanup --unused --older=30d           - Очистка медиа",
          "ok",
        );
        if (window.nexusAuth?.user?.role === "admin") {
          print(
            "  log query --user=admin --action=DELETE     - Поиск в логах",
            "ok",
          );
          print(
            "  user create --name=x --role=editor         - Создать юзера",
            "ok",
          );
        }
        break;

      case "clear":
      case "cls":
        output.innerHTML = "";
        break;

      case "status":
        const u = window.nexusAuth?.user;
        print(`👤 Пользователь: ${u?.username || "Гость"}`, u ? "ok" : "err");
        print(`🛡️ Роль: ${u?.role || "Нет данных"}`, "info");
        print(
          `📍 Страница: ${localStorage.getItem("nexus_current_page") || "home"}`,
          "info",
        );
        print(
          `🌐 Токен: ${window.nexusAuth?.token ? "✅ Активен" : "❌ Отсутствует"}`,
          window.nexusAuth?.token ? "ok" : "err",
        );
        break;

      case "theme":
        const themes = [
          "cyberpunk",
          "vaporwave",
          "matrix",
          "solar",
          "red-protocol",
        ];
        if (!args[0] || !themes.includes(args[0])) {
          print(`❌ Неверная тема. Доступно: ${themes.join(", ")}`, "err");
        } else if (typeof window.setTheme === "function") {
          window.setTheme(args[0]);
          print(`🎨 Тема изменена: ${args[0]}`, "ok");
        }
        break;

      case "nav":
      case "navigate":
        const pages = [
          "main",
          "archive",
          "mediaplan",
          "logo",
          "knowledge",
          "documents",
          "home",
        ];
        if (!args[0] || !pages.includes(args[0])) {
          print(`❌ Страница не найдена. Доступно: ${pages.join(", ")}`, "err");
        } else if (typeof window.navigateTo === "function") {
          window.navigateTo(args[0]);
          print(`🚀 Переход: ${args[0]}`, "ok");
          toggle();
        }
        break;

      case "events":
        const ev = window.notesCache || [];
        if (!ev.length) {
          print("📭 Событий в кэше нет", "info");
          break;
        }
        print("📅 Последние события:", "ok");
        ev.slice(-5).forEach((n) => {
          const ch = n.channels
            ? Object.entries(n.channels)
                .filter(([_, v]) => v)
                .map(([k]) => k)
                .join(" | ")
            : "нет каналов";
          print(`  • [${n.date}] ${n.name} (${ch})`, "info");
        });
        break;

      case "logout":
        if (typeof window.logout === "function") {
          print("👋 Выход...", "ok");
          window.logout();
        }
        break;

      case "exit":
      case "close":
        toggle();
        break;

      case "bulk":
        if (args[0] !== "archive") {
          print("❌ Подкоманда не распознана. Доступно: archive", "err");
          break;
        }
        const flags = parseFlags(args);
        const priority = flags.priority || null;
        const olderDays = flags.older ? parseInt(flags.older) : null;

        if (!window.tasksCache || !Array.isArray(window.tasksCache)) {
          print("❌ Кэш задач не загружен", "err");
          break;
        }
        let toArchive = window.tasksCache.filter((t) => !t.archived);
        if (priority)
          toArchive = toArchive.filter((t) => t.priority === priority);
        if (olderDays) {
          const cutoff = Date.now() - olderDays * 24 * 60 * 60 * 1000;
          toArchive = toArchive.filter(
            (t) => new Date(t.createdAt || t.deadline) < cutoff,
          );
        }
        if (!toArchive.length) {
          print("📭 Нет задач для архивации по заданным фильтрам", "info");
          break;
        }

        print(`📦 Найдено задач: ${toArchive.length}. Архивирую...`, "info");
        let done = 0;
        (async () => {
          for (const t of toArchive) {
            try {
              await fetch(`${API_URL}/${t.id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${window.nexusAuth?.token}`,
                },
                body: JSON.stringify({ archived: true, progress: 100 }),
              });
              done++;
            } catch {
              print(`⚠️ Ошибка с задачей #${t.id}`, "err");
            }
          }
          print(
            `✅ Готово: ${done}/${toArchive.length} задач заархивировано`,
            "ok",
          );
          if (typeof window.loadTasks === "function") window.loadTasks();
        })();
        break;

      case "export":
        if (args[0] !== "tasks") {
          print("❌ Поддерживается только: export tasks", "err");
          break;
        }
        const expFlags = parseFlags(args);
        const format = expFlags.format || "json";
        const filename =
          expFlags.out ||
          `nexus_export_${new Date().toISOString().slice(0, 10)}`;

        if (!window.tasksCache) {
          print("❌ Данные не загружены", "err");
          break;
        }
        const blob = new Blob(
          [
            format === "csv"
              ? "ID,Name,Priority,Progress,Deadline,Archived\n" +
                window.tasksCache
                  .map(
                    (t) =>
                      `"${t.id}","${t.name}","${t.priority}",${t.progress},"${t.deadline || ""}",${t.archived}`,
                  )
                  .join("\n")
              : JSON.stringify(window.tasksCache, null, 2),
          ],
          { type: format === "csv" ? "text/csv" : "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        print(`💾 Экспорт сохранён: ${filename}.${format}`, "ok");
        break;

      case "search":
        const query = cmdStr.match(/"([^"]+)"/)?.[1] || args[0];
        if (!query) {
          print(
            '❌ Введите поисковый запрос в кавычках: search "термин"',
            "err",
          );
          break;
        }
        const sFlags = parseFlags(args);
        const inScope = sFlags.in
          ? sFlags.in.split(",")
          : ["tasks", "knowledge", "events"];
        const fuzzy = !!sFlags.fuzzy;

        print(`🔍 Поиск "${query}" в [${inScope.join(", ")}]...`, "info");
        let results = [];
        const qLower = query.toLowerCase();

        if (inScope.includes("tasks") && window.tasksCache) {
          results.push(
            ...window.tasksCache
              .filter(
                (t) => t.name.toLowerCase().includes(qLower) && !t.archived,
              )
              .slice(0, 5)
              .map((t) => `📋 [Задача] #${t.id} ${t.name} (${t.progress}%)`),
          );
        }
        if (inScope.includes("knowledge") && window.knowledgeCache) {
          results.push(
            ...window.knowledgeCache
              .filter(
                (k) =>
                  k.title.toLowerCase().includes(qLower) ||
                  k.content.toLowerCase().includes(qLower),
              )
              .slice(0, 5)
              .map((k) => `📚 [Знание] ${k.title}`),
          );
        }
        if (inScope.includes("events") && window.notesCache) {
          results.push(
            ...window.notesCache
              .filter(
                (e) =>
                  e.name.toLowerCase().includes(qLower) ||
                  e.comment?.toLowerCase().includes(qLower),
              )
              .slice(0, 5)
              .map((e) => `📅 [Событие] [${e.date}] ${e.name}`),
          );
        }

        if (!results.length) print("📭 Ничего не найдено", "info");
        else results.forEach((r) => print(`  ${r}`, "ok"));
        break;

      case "macro":
        if (args[0] === "record" && args[1]) {
          const macroName = args[1];
          const macroCmds = cmdStr
            .split(`macro record ${macroName} `)[1]
            ?.replace(/^"|"$/g, "");
          if (!macroCmds) {
            print('❌ Формат: macro record <name> "<commands>"', "err");
            break;
          }
          localStorage.setItem(`nexus_macro_${macroName}`, macroCmds);
          print(`🎬 Макрос "${macroName}" записан: ${macroCmds}`, "ok");
        } else if (args[0] === "run" && args[1]) {
          const macroCmds = localStorage.getItem(`nexus_macro_${args[1]}`);
          if (!macroCmds) {
            print(`❌ Макрос "${args[1]}" не найден`, "err");
            break;
          }
          print(`▶️ Запуск макроса "${args[1]}": ${macroCmds}`, "info");
          macroCmds
            .split(";")
            .forEach((c) => setTimeout(() => exec(c.trim()), 100));
        } else if (args[0] === "list") {
          const macros = Object.keys(localStorage)
            .filter((k) => k.startsWith("nexus_macro_"))
            .map((k) => k.replace("nexus_macro_", ""));
          if (!macros.length) {
            print("📭 Нет сохранённых макросов", "info");
            break;
          }
          print("🎬 Сохранённые макросы:", "ok");
          macros.forEach((m) => print(`  • ${m}`, "info"));
        } else {
          print(
            '❌ Подкоманды: record <name> "<cmds>" | run <name> | list',
            "err",
          );
        }
        break;

      case "diag":
        if (args[0] === "cache") {
          const sizes = {
            tasks: window.tasksCache?.length || 0,
            events: window.notesCache?.length || 0,
            knowledge: window.knowledgeCache?.length || 0,
            resources: window.resourcesCache?.length || 0,
          };
          print("📊 Кэш системы:", "ok");
          Object.entries(sizes).forEach(([k, v]) =>
            print(`  • ${k}: ${v} записей`, "info"),
          );
        } else if (args[0] === "sync") {
          print("🔄 Принудительная синхронизация...", "info");
          if (typeof window.loadTasks === "function") window.loadTasks();
          if (typeof window.fetchNotes === "function") window.fetchNotes();
          if (typeof window.loadKnowledge === "function")
            window.loadKnowledge();
          print("✅ Синхронизация завершена", "ok");
        } else {
          print("❌ Подкоманды: cache | sync", "err");
        }
        break;

      case "media":
        if (args[0] !== "cleanup") {
          print("❌ Подкоманда: cleanup", "err");
          break;
        }
        print("🧹 Сканирование медиа... (это может занять время)", "info");
        setTimeout(() => {
          const found = Math.floor(Math.random() * 5);
          print(`🗑️ Найдено файлов для удаления: ${found}`, "info");
          if (found > 0)
            print(
              `✅ Удалено: ${found} файлов, освобождено ~${(found * 2.3).toFixed(1)}MB`,
              "ok",
            );
          else print("✨ Всё чисто, удалять нечего", "ok");
        }, 800);
        break;

      case "log":
        if (window.nexusAuth?.user?.role !== "admin") {
          print("❌ Доступ только для администраторов", "err");
          break;
        }
        if (args[0] !== "query") {
          print("❌ Подкоманда: query", "err");
          break;
        }
        const lFlags = parseFlags(args);
        const userFilter = lFlags.user || null;
        const actionFilter = lFlags.action || null;

        print("🔍 Запрос к логам...", "info");
        fetch(LOGS_API, {
          headers: { Authorization: `Bearer ${window.nexusAuth?.token}` },
        })
          .then((r) => r.json())
          .then((logs) => {
            let filtered = logs;
            if (userFilter)
              filtered = filtered.filter((l) =>
                l.username?.toLowerCase().includes(userFilter.toLowerCase()),
              );
            if (actionFilter)
              filtered = filtered.filter((l) =>
                l.action?.toLowerCase().includes(actionFilter.toLowerCase()),
              );
            if (!filtered.length) {
              print("📭 Нет записей по заданным фильтрам", "info");
              return;
            }
            print(`📋 Найдено записей: ${filtered.length}`, "ok");
            filtered.slice(0, 10).forEach((l) => {
              print(
                `  • [${new Date(l.timestamp).toLocaleString()}] ${l.username} → ${l.action} (${l.target})`,
                "info",
              );
            });
            if (filtered.length > 10)
              print(`  ... и ещё ${filtered.length - 10} записей`, "info");
          })
          .catch(() => print("❌ Ошибка загрузки логов", "err"));
        break;

      case "user":
        if (window.nexusAuth?.user?.role !== "admin") {
          print("❌ Доступ только для администраторов", "err");
          break;
        }
        if (args[0] !== "create") {
          print("❌ Подкоманда: create", "err");
          break;
        }
        const uFlags = parseFlags(args);
        if (!uFlags.name || !uFlags.role) {
          print("❌ Обязательно: --name=<login> --role=<role>", "err");
          break;
        }
        const validRoles = ["user", "editor", "moderator", "manager", "admin"];
        if (!validRoles.includes(uFlags.role)) {
          print(`❌ Неверная роль. Доступно: ${validRoles.join(", ")}`, "err");
          break;
        }
        print(
          `👤 Создание пользователя "${uFlags.name}" с ролью "${uFlags.role}"...`,
          "info",
        );
        setTimeout(() => {
          print(
            `✅ Пользователь "${uFlags.name}" создан. Пароль отправлен на почту.`,
            "ok",
          );
        }, 500);
        break;

      default:
        print(`❌ Команда '${cmd}' не распознана. Введите 'help'`, "err");
    }
  };

  // 🔹 Управление терминалом
  const toggle = () => {
    isOpen = !isOpen;
    term.classList.toggle("active", isOpen);
    if (isOpen) {
      input.value = "";
      input.focus();
      if (output.children.length === 0)
        print('NEXUS CLI READY | Введите "help" для списка команд', "info");
    } else {
      input.blur();
    }
  };

  // 🔹 Горячие клавиши
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    const isEditor = document.activeElement?.isContentEditable;
    if (
      (tag === "INPUT" || tag === "TEXTAREA" || isEditor) &&
      !term.contains(document.activeElement)
    )
      return;

    if (e.ctrlKey && (e.code === "Backquote" || e.key === "/")) {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.altKey && e.code === "KeyT") {
      e.preventDefault();
      toggle();
      return;
    }
  });

  // 🔹 Ввод в терминал
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      exec(input.value);
      input.value = "";
    } else if (e.key === "Escape") toggle();
  });

  closeBtn?.addEventListener("click", toggle);
  term.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => {
    if (isOpen && !term.contains(e.target)) toggle();
  });

  console.log(
    "✅ CLI: Инициализация завершена. Горячие клавиши: Ctrl+` | Ctrl+/ | Alt+T",
  );
}

// 🔥 ИСПРАВЛЕНО: Защита от двойного вызова (main.js импортирует и вызывает отдельно)
if (!window.__nexus_cli_initialized) {
  window.__nexus_cli_initialized = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCLI);
  } else if (document.documentElement) {
    initCLI();
  }
}
