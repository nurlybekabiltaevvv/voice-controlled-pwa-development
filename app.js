/**
 * VoiceFlow — Главный модуль приложения
 * 
 * Архитектура:
 * - Event Emitter (наблюдатель) для событийной модели
 * - Proxy-based State Manager для реактивного управления состоянием
 * - Простой SPA-роутер на основе hash-навигации
 * - Интеграция с VoiceManager для голосового управления
 * - Персистентность данных через localStorage
 */
;(function() {
  'use strict';

  // ==================== Константы ====================
  const STORAGE_KEY = 'voiceflow-state';
  const PAGES = ['home', 'tasks', 'settings'];
  
  /** Категории задач с метаданными */
  const CATEGORIES = {
    general:  { label: 'Общее',   color: '#64748b', emoji: '📋' },
    work:     { label: 'Работа',  color: '#3b82f6', emoji: '💼' },
    personal: { label: 'Личное',  color: '#22c55e', emoji: '👤' },
    urgent:   { label: 'Срочное', color: '#ef4444', emoji: '⚡' }
  };

  // ==================== Event Emitter ====================
  /**
   * Простой паттерн Наблюдатель (Observer / Event Emitter)
   * Позволяет подписываться на события и реагировать на них
   */
  const Emitter = {
    _events: {},

    /** Подписаться на событие */
    on(event, fn) {
      (this._events[event] = this._events[event] || []).push(fn);
      return this;
    },

    /** Отписаться от события */
    off(event, fn) {
      if (this._events[event]) {
        this._events[event] = this._events[event].filter(f => f !== fn);
      }
      return this;
    },

    /** Отправить событие всем подписчикам */
    emit(event, ...args) {
      (this._events[event] || []).forEach(fn => {
        try { fn(...args); } catch (e) { console.error(`[Emitter] Error in "${event}" handler:`, e); }
      });
      return this;
    }
  };

  // ==================== State Manager ====================
  /**
   * Состояние приложения по умолчанию
   * Все изменения состояния проходят через Proxy, что позволяет:
   * 1. Автоматически сохранять состояние в localStorage
   * 2. Уведомлять подписчиков об изменениях (реактивность)
   */
  const defaultState = {
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    currentPage: 'home',
    tasks: [],
    voiceEnabled: true,
    voiceRate: 1.0,
    filter: 'all', // all | active | completed
    isListening: false // Транзиентное состояние (не сохраняется)
  };

  /** Загрузить состояние из localStorage */
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Мёржим с дефолтным состоянием для обратной совместимости
        return { ...defaultState, ...parsed, isListening: false };
      }
    } catch (e) {
      console.error('[Store] Failed to load state:', e);
    }
    return { ...defaultState };
  }

  /** Сохранить состояние в localStorage */
  function saveState(data) {
    try {
      // Не сохраняем транзиентное состояние (isListening)
      const toSave = { ...data, isListening: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('[Store] Failed to save state:', e);
    }
  }

  /**
   * Реактивный стейт-менеджер на основе Proxy
   * При любом изменении свойства:
   * 1. Сохраняется в localStorage
   * 2. Отправляется событие 'state:change' со всеми изменениями
   * 3. Отправляется специфичное событие 'state:propName'
   */
  const state = new Proxy(loadState(), {
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;
      saveState(target);
      Emitter.emit('state:change', { prop, value, oldValue });
      Emitter.emit(`state:${prop}`, { prop, value, oldValue });
      return true;
    },

    get(target, prop) {
      return target[prop];
    }
  });

  // ==================== Router ====================
  /**
   * Простой SPA-роутер на основе location.hash
   * Навигация: #home, #tasks, #settings
   */
  function navigate(page) {
    if (!PAGES.includes(page)) return;
    if (state.currentPage === page) return; // Уже на этой странице
    state.currentPage = page;
  }

  function setupRouter() {
    // Клик по навигационным кнопкам
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        navigate(btn.dataset.nav);
      });
    });

    // Обработка кнопок "Назад" / "Вперёд" в браузере
    window.addEventListener('popstate', () => {
      const hash = location.hash.replace('#', '') || 'home';
      if (PAGES.includes(hash)) {
        state.currentPage = hash;
      }
    });

    // Устанавливаем начальный маршрут
    const hash = location.hash.replace('#', '') || state.currentPage;
    if (PAGES.includes(hash)) {
      state.currentPage = hash;
    }
  }

  // ==================== UI Rendering ====================
  
  /** Главная точка входа для рендеринга текущей страницы */
  function renderPage() {
    const current = state.currentPage;

    // Переключаем видимость страниц с анимацией
    document.querySelectorAll('[data-page]').forEach(page => {
      const isTarget = page.dataset.page === current;
      const wasActive = page.classList.contains('active');

      if (isTarget) {
        // Целевая страница: показываем с анимацией входа
        page.classList.remove('leaving');
        page.classList.add('active');
      } else if (wasActive) {
        // Предыдущая активная страница: анимация выхода
        page.classList.remove('active');
        page.classList.add('leaving');
        setTimeout(() => page.classList.remove('leaving'), 300);
      }
    });

    // Обновляем навигацию
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === current);
    });

    // Обновляем hash без перезагрузки
    history.replaceState(null, '', `#${current}`);

    // Рендерим содержимое текущей страницы
    switch (current) {
      case 'home': renderHome(); break;
      case 'tasks': renderTasks(); break;
      case 'settings': renderSettings(); break;
    }
  }

  /** Рендеринг главной страницы */
  function renderHome() {
    // Приветствие
    const greetingEl = document.getElementById('greeting-text');
    const greetingSubEl = document.getElementById('greeting-sub');
    if (greetingEl) greetingEl.textContent = getGreeting();
    if (greetingSubEl) {
      const date = new Date();
      const options = { weekday: 'long', day: 'numeric', month: 'long' };
      greetingSubEl.textContent = date.toLocaleDateString('ru-RU', options);
    }

    // Статистика
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const active = total - completed;

    const statTotal = document.getElementById('stat-total');
    const statActive = document.getElementById('stat-active');
    const statCompleted = document.getElementById('stat-completed');

    if (statTotal) statTotal.textContent = total;
    if (statActive) statActive.textContent = active;
    if (statCompleted) statCompleted.textContent = completed;

    // Последние задачи (5 невыполненных)
    const recentEl = document.getElementById('recent-tasks');
    if (recentEl) {
      const recentTasks = state.tasks
        .filter(t => !t.completed)
        .slice(-5)
        .reverse();

      if (recentTasks.length === 0) {
        recentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <p class="empty-state-text">Задач пока нет. Добавьте первую задачу или скажите голосом!</p>
          </div>`;
      } else {
        recentEl.innerHTML = recentTasks.map(task => renderTaskCard(task)).join('');
        bindTaskEvents(recentEl);
      }
    }
  }

  /** Рендеринг страницы задач */
  function renderTasks() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    // Фильтрация задач
    let filtered = state.tasks;
    if (state.filter === 'active') filtered = state.tasks.filter(t => !t.completed);
    if (state.filter === 'completed') filtered = state.tasks.filter(t => t.completed);

    // Обновляем вкладки фильтра
    document.querySelectorAll('[data-filter]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === state.filter);
    });

    // Счётчик в заголовке
    const taskCountEl = document.getElementById('tasks-count');
    if (taskCountEl) {
      const active = state.tasks.filter(t => !t.completed).length;
      taskCountEl.textContent = active > 0 ? `(${active})` : '';
    }

    // Пустое состояние
    if (filtered.length === 0) {
      const messages = {
        all: 'Задач пока нет. Добавьте первую!',
        active: 'Все задачи выполнены! 🎉',
        completed: 'Нет выполненных задач'
      };
      const icons = { all: '📝', active: '✅', completed: '🎯' };
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icons[state.filter]}</div>
          <p class="empty-state-text">${messages[state.filter]}</p>
        </div>`;
      return;
    }

    // Рендерим список задач
    listEl.innerHTML = filtered.map(task => renderTaskCard(task)).join('');
    bindTaskEvents(listEl);
  }

  /** Рендеринг карточки задачи */
  function renderTaskCard(task) {
    const cat = CATEGORIES[task.category] || CATEGORIES.general;
    const completedClass = task.completed ? 'completed' : '';
    const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    return `
      <article class="task-card ${completedClass}" data-task-id="${task.id}">
        <button class="task-checkbox ${task.completed ? 'checked' : ''}" 
                data-task-toggle="${task.id}" 
                type="button"
                aria-label="Отметить задачу как ${task.completed ? 'невыполненную' : 'выполненную'}">
          ${task.completed ? checkSvg : ''}
        </button>
        <div class="task-content">
          <span class="task-text">${escapeHtml(task.text)}</span>
          <span class="task-badge" style="--badge-color: ${cat.color}">${cat.emoji} ${cat.label}</span>
        </div>
        <button class="task-delete" data-task-delete="${task.id}" type="button" aria-label="Удалить задачу">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </article>`;
  }

  /** Привязать события к элементам задач */
  function bindTaskEvents(container) {
    container.querySelectorAll('[data-task-toggle]').forEach(btn => {
      btn.addEventListener('click', () => toggleTask(Number(btn.dataset.taskToggle)));
    });
    container.querySelectorAll('[data-task-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteTask(Number(btn.dataset.taskDelete)));
    });
  }

  /** Рендеринг страницы настроек */
  function renderSettings() {
    // Тема
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.classList.toggle('active', state.theme === 'dark');
      themeToggle.setAttribute('aria-checked', state.theme === 'dark');
    }

    // Голосовые подсказки
    const voiceToggle = document.getElementById('voice-toggle');
    if (voiceToggle) {
      voiceToggle.classList.toggle('active', state.voiceEnabled);
      voiceToggle.setAttribute('aria-checked', state.voiceEnabled);
    }

    // Обновляем индикатор голоса в сайдбаре
    const voiceDot = document.querySelector('.sidebar-footer .voice-dot');
    const voiceText = document.querySelector('.sidebar-footer span:last-child');
    const supported = window.VoiceManager && VoiceManager.isSupported;
    if (voiceDot) voiceDot.classList.toggle('inactive', !supported);
    if (voiceText) voiceText.textContent = supported ? 'Голос: доступен' : 'Голос: недоступен';

    // Скорость голоса
    const voiceRate = document.getElementById('voice-rate');
    const voiceRateValue = document.getElementById('voice-rate-value');
    if (voiceRate) voiceRate.value = state.voiceRate;
    if (voiceRateValue) voiceRateValue.textContent = state.voiceRate.toFixed(1) + 'x';

    // Количество задач
    const taskCountEl = document.getElementById('settings-task-count');
    if (taskCountEl) taskCountEl.textContent = state.tasks.length;

    // Доступность голоса
    const voiceStatus = document.getElementById('voice-status');
    if (voiceStatus) {
      const supported = window.VoiceManager && VoiceManager.isSupported;
      voiceStatus.textContent = supported ? 'Доступно ✓' : 'Не поддерживается браузером';
      voiceStatus.style.color = supported ? 'var(--color-success)' : 'var(--color-danger)';
    }

    // Кнопка установки
    const installSettingsBtn = document.getElementById('install-settings-btn');
    if (installSettingsBtn) {
      installSettingsBtn.style.display = deferredPrompt ? '' : 'none';
    }
  }

  // ==================== Task CRUD ====================

  /** Добавить задачу */
  function addTask(text, category = 'general') {
    if (!text || !text.trim()) return false;
    const task = {
      id: Date.now() + Math.random(), // Уникальный ID
      text: text.trim(),
      completed: false,
      category: category,
      createdAt: new Date().toISOString()
    };
    state.tasks = [...state.tasks, task];
    showToast('Задача добавлена', 'success');
    return true;
  }

  /** Переключить статус задачи */
  function toggleTask(id) {
    state.tasks = state.tasks.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    const task = state.tasks.find(t => t.id === id);
    if (task && task.completed) {
      showToast('Задача выполнена! 🎉', 'success');
    }
  }

  /** Удалить задачу */
  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    speak('Задача удалена');
    showToast('Задача удалена', 'info');
  }

  /** Удалить все задачи */
  function clearAllTasks() {
    state.tasks = [];
    showToast('Все задачи удалены', 'info');
  }

  // ==================== Theme ====================

  /** Применить тему к DOM */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    // Обновляем метаданные для браузера
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = state.theme === 'dark' ? '#0f172a' : '#f1f5f9';
    }
  }

  /** Переключить тему */
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
  }

  // ==================== Voice Command Processing ====================
  
  /**
   * Обработка распознанной голосовой команды
   * Поддерживаемые команды:
   * - Навигация: "Открыть главную", "Открыть задачи", "Открыть настройки"
   * - Задачи: "Добавить задачу [текст]", "Новая задача [текст]"
   * - Тема: "Поменять тему", "Сменить тему"
   * - Очистка: "Удалить все задачи", "Очистить задачи"
   */
  function processVoiceCommand(transcript) {
    const cmd = transcript.toLowerCase().trim();
    console.log('[VoiceCommand] Processing:', cmd);

    // ---- Навигация ----
    if (cmd.includes('главн') || cmd.includes('домой') || cmd.includes('home')) {
      navigate('home');
      speak('Открываю главную');
      showToast('Переход: Главная', 'info');
      return;
    }

    if (cmd.includes('задач') || cmd.includes('дела') || cmd.includes('tasks')) {
      navigate('tasks');
      speak('Открываю задачи');
      showToast('Переход: Задачи', 'info');
      return;
    }

    if (cmd.includes('настройк') || cmd.includes('параметр') || cmd.includes('settings')) {
      navigate('settings');
      speak('Открываю настройки');
      showToast('Переход: Настройки', 'info');
      return;
    }

    // ---- Добавление задачи ----
    const addMatch = cmd.match(/(?:добавь|добавить|новая|создай|создать)\s+(?:задач[ауе]|дело)\s*(.*)/i);
    if (addMatch) {
      let taskText = addMatch[1].trim();
      let category = 'general';

      // Определяем категорию по ключевым словам
      if (cmd.includes('срочн')) {
        category = 'urgent';
        taskText = taskText.replace(/срочн[оыеая]*\s*/i, '').trim();
      } else if (cmd.includes('работ') || cmd.includes('рабоч')) {
        category = 'work';
        taskText = taskText.replace(/рабо?[тч][аиеу]*\s*/i, '').trim();
      } else if (cmd.includes('личн')) {
        category = 'personal';
        taskText = taskText.replace(/личн[аыеоу]*\s*/i, '').trim();
      }

      if (taskText) {
        addTask(taskText, category);
        speak(`Задача "${taskText}" добавлена`);
      } else {
        speak('Скажите текст задачи после команды. Например: добавь задачу купить молоко');
        showToast('Скажите: "Добавь задачу [текст]"', 'warning');
      }
      return;
    }

    // ---- Переключение темы ----
    if (cmd.match(/(?:поменяй|смени|переключи|измени)\s*(?:тему|оформление)/) || 
        cmd.includes('сменить тему') || cmd.includes('поменять тему') || 
        cmd.includes('тёмная тема') || cmd.includes('светлая тема') ||
        cmd === 'тема') {
      toggleTheme();
      speak(`Тема изменена на ${state.theme === 'dark' ? 'тёмную' : 'светлую'}`);
      return;
    }

    // ---- Удаление всех задач ----
    if (cmd.match(/(?:удали|очисти|убери)\s*(?:все|все|всё)\s*(?:задачи|дела)/) ||
        cmd.includes('очистить задачи') || cmd.includes('удалить все')) {
      clearAllTasks();
      speak('Все задачи удалены');
      return;
    }

    // ---- Команда не распознана ----
    speak('Команда не распознана. Скажите "помощь" для списка команд');
    showToast('Команда не распознана', 'warning');
  }

  /** Озвучить текст (если голос включён) */
  function speak(text) {
    if (state.voiceEnabled && window.VoiceManager) {
      VoiceManager.speak(text, state.voiceRate);
    }
  }

  // ==================== Toast System ====================
  
  /**
   * Показать toast-уведомление
   * @param {string} message — Текст уведомления
   * @param {'success'|'error'|'info'|'warning'} type — Тип
   * @param {number} duration — Длительность (мс)
   */
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    container.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    // Автоматическое скрытие
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ==================== Install Prompt ====================
  
  /** Отложенный prompt для установки PWA */
  let deferredPrompt = null;

  function setupInstallPrompt() {
    // Перехватываем стандартный баннер установки браузера
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Показываем кастомный баннер
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.remove('hidden');
      
      console.log('[PWA] Install prompt captured');
    });

    // Кнопка "Установить" в баннере
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          showToast('Приложение установлено!', 'success');
          speak('Приложение установлено');
        }
        
        deferredPrompt = null;
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.add('hidden');
      });
    }

    // Кнопка "Закрыть" в баннере
    const dismissBtn = document.getElementById('install-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.add('hidden');
      });
    }

    // Кнопка установки в настройках
    const installSettingsBtn = document.getElementById('install-settings-btn');
    if (installSettingsBtn) {
      installSettingsBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
          showToast('Приложение уже установлено или не поддерживается', 'info');
          return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Приложение установлено!', 'success');
          speak('Приложение установлено');
        }
        deferredPrompt = null;
      });
    }

    // Событие установки
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      deferredPrompt = null;
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.add('hidden');
    });
  }

  // ==================== Voice Integration ====================
  
  /** Настроить интеграцию с VoiceManager */
  function setupVoice() {
    const vm = window.VoiceManager;
    if (!vm) {
      console.warn('[App] VoiceManager not available');
      return;
    }

    // Если SpeechRecognition не поддерживается — скрываем кнопку микрофона
    if (!vm.isSupported) {
      const fab = document.getElementById('voice-fab');
      if (fab) fab.style.display = 'none';
      
      // Показываем предупреждение на главной
      const voiceStatus = document.getElementById('voice-status');
      if (voiceStatus) {
        voiceStatus.textContent = 'Не поддерживается браузером';
        voiceStatus.style.color = 'var(--color-danger)';
      }
      return;
    }

    // Инициализируем SpeechRecognition
    vm.init();

    // Обновляем скорость озвучки из состояния
    vm.setRate(state.voiceRate);

    // ---- Кнопка микрофона (FAB) ----
    const fab = document.getElementById('voice-fab');
    if (fab) {
      fab.addEventListener('click', () => {
        if (vm.isListening) {
          vm.stopListening();
        } else {
          vm.startListening();
        }
      });
    }

    // ---- Кнопка микрофона в форме добавления задачи ----
    const voiceAddBtn = document.getElementById('voice-add-task');
    if (voiceAddBtn) {
      voiceAddBtn.addEventListener('click', () => {
        if (vm.isListening) {
          vm.stopListening();
        } else {
          vm.startListening();
        }
      });
    }

    // ---- Изменение состояния прослушивания ----
    vm.onStateChange((isListening) => {
      state.isListening = isListening;
      
      const fabEl = document.getElementById('voice-fab');
      const overlay = document.getElementById('voice-overlay');
      const voiceAddBtn = document.getElementById('voice-add-task');

      if (fabEl) fabEl.classList.toggle('listening', isListening);
      if (overlay) overlay.classList.toggle('active', isListening);
      if (voiceAddBtn) voiceAddBtn.classList.toggle('active', isListening);

      if (isListening) {
        const transcriptEl = document.getElementById('voice-transcript');
        if (transcriptEl) transcriptEl.textContent = 'Слушаю...';
      }
    });

    // ---- Результат распознавания ----
    vm.onResult(({ transcript, isFinal }) => {
      const transcriptEl = document.getElementById('voice-transcript');
      if (transcriptEl) transcriptEl.textContent = transcript || 'Слушаю...';

      if (isFinal && transcript) {
        // Небольшая задержка для визуальной обратной связи
        setTimeout(() => {
          processVoiceCommand(transcript);
          
          // Скрываем оверлей
          const overlay = document.getElementById('voice-overlay');
          if (overlay) overlay.classList.remove('active');
        }, 600);
      }
    });

    // ---- Ошибка распознавания ----
    vm.onError((error) => {
      const messages = {
        'not-allowed': 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.',
        'no-speech': 'Речь не обнаружена. Попробуйте снова.',
        'audio-capture': 'Микрофон не найден. Подключите микрофон.',
        'network': 'Ошибка сети. Для распознавания голоса требуется интернет.',
        'service-not-allowed': 'Сервис распознавания речи недоступен.'
      };
      const msg = messages[error] || `Ошибка: ${error}`;
      showToast(msg, 'error', 5000);
      speak('Произошла ошибка');
    });
  }

  // ==================== Event Handlers ====================
  
  /** Настроить все обработчики событий UI */
  function setupEventHandlers() {
    // ---- Переключатель темы (в настройках) ----
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        toggleTheme();
      });
    }

    // ---- Кнопки темы в шапке (на каждой странице) ----
    ['header-theme-toggle', 'header-theme-toggle-tasks', 'header-theme-toggle-settings'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', toggleTheme);
    });

    // ---- Переключатель голосовых подсказок ----
    const voiceToggle = document.getElementById('voice-toggle');
    if (voiceToggle) {
      voiceToggle.addEventListener('click', () => {
        state.voiceEnabled = !state.voiceEnabled;
        showToast(
          state.voiceEnabled ? 'Голосовые подсказки включены' : 'Голосовые подсказки выключены',
          'info'
        );
      });
    }

    // ---- Слайдер скорости голоса ----
    const voiceRate = document.getElementById('voice-rate');
    if (voiceRate) {
      voiceRate.addEventListener('input', () => {
        state.voiceRate = parseFloat(voiceRate.value);
        if (window.VoiceManager) VoiceManager.setRate(state.voiceRate);
      });
    }

    // ---- Форма добавления задачи ----
    const addTaskForm = document.getElementById('add-task-form');
    const addTaskInput = document.getElementById('add-task-input');
    const addTaskCategory = document.getElementById('add-task-category');

    if (addTaskForm && addTaskInput) {
      addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = addTaskInput.value.trim();
        if (!text) return;
        const category = addTaskCategory ? addTaskCategory.value : 'general';
        addTask(text, category);
        addTaskInput.value = '';
        addTaskInput.focus();
        speak('Задача добавлена');
      });
    }

    // ---- Вкладки фильтра задач ----
    document.querySelectorAll('[data-filter]').forEach(tab => {
      tab.addEventListener('click', () => {
        state.filter = tab.dataset.filter;
      });
    });

    // ---- Кнопка "Очистить все задачи" ----
    const clearAllBtn = document.getElementById('clear-all-tasks');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (state.tasks.length === 0) {
          showToast('Список задач уже пуст', 'info');
          return;
        }
        if (confirm('Удалить все задачи? Это действие нельзя отменить.')) {
          clearAllTasks();
          speak('Все задачи удалены');
        }
      });
    }

    // ---- Кнопка "Экспорт данных" ----
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const data = JSON.stringify({ tasks: state.tasks, theme: state.theme }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voiceflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Данные экспортированы', 'success');
      });
    }
  }

  // ==================== State Change Listeners ====================
  
  /** Подписаться на изменения состояния */
  function setupStateListeners() {
    // Смена страницы
    Emitter.on('state:currentPage', () => {
      renderPage();
    });

    // Изменение задач
    Emitter.on('state:tasks', () => {
      renderHome();
      renderTasks();
      renderSettings();
    });

    // Смена темы
    Emitter.on('state:theme', ({ value }) => {
      applyTheme();
      renderSettings();
      showToast(value === 'dark' ? 'Тёмная тема 🌙' : 'Светлая тема ☀️', 'info');
    });

    // Смена фильтра
    Emitter.on('state:filter', () => {
      renderTasks();
    });

    // Смена скорости голоса
    Emitter.on('state:voiceRate', () => {
      renderSettings();
    });

    // Смена настройки голоса
    Emitter.on('state:voiceEnabled', () => {
      renderSettings();
    });
  }

  // ==================== Utility Functions ====================
  
  /** Получить приветствие в зависимости от времени суток */
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return 'Доброй ночи! 🌙';
    if (hour < 12) return 'Доброе утро! ☀️';
    if (hour < 18) return 'Добрый день! 👋';
    return 'Добрый вечер! 🌆';
  }

  /** Экранирование HTML */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== Initialize ====================
  
  function init() {
    console.log('[App] Initializing VoiceFlow...');

    // Применяем тему
    applyTheme();

    // Настраиваем роутер
    setupRouter();

    // Подписываемся на изменения состояния
    setupStateListeners();

    // Настраиваем обработчики событий
    setupEventHandlers();

    // Настраиваем установку PWA
    setupInstallPrompt();

    // Первый рендеринг
    renderPage();

    // Инициализируем голосовой модуль (с задержкой для загрузки DOM)
    setTimeout(() => setupVoice(), 200);

    // Регистрируем Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
          console.log('[SW] Registered:', reg.scope);
          
          // Проверяем обновления
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                showToast('Приложение обновлено! Перезагрузите страницу.', 'info', 5000);
              }
            });
          });
        })
        .catch(err => {
          console.error('[SW] Registration failed:', err);
        });
    }

    console.log('[App] VoiceFlow initialized');
  }

  // Запуск приложения
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
