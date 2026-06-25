/**
 * VoiceFlow — Модуль голосового управления
 * 
 * Использует Web Speech API:
 * - SpeechRecognition для распознавания голосовых команд
 * - SpeechSynthesis для озвучки действий приложения
 * 
 * Поддерживаемые браузеры: Chrome, Edge, Safari (частично)
 * Firefox не поддерживает SpeechRecognition на данный момент.
 */
;(function() {
  'use strict';

  // ==================== Проверка поддержки API ====================
  // SpeechRecognition доступен как window.SpeechRecognition или window.webkitSpeechRecognition
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synthesis = window.speechSynthesis;

  // ==================== Состояние модуля ====================
  let recognition = null;       // Экземпляр SpeechRecognition
  let listening = false;        // Текущее состояние прослушивания
  let resultCallback = null;    // Колбэк для результатов распознавания
  let errorCallback = null;     // Колбэк для ошибок
  let stateChangeCallback = null; // Колбэк для изменения состояния
  let voiceRate = 1.0;          // Скорость озвучки

  // ==================== VoiceManager API ====================
  const VoiceManager = {
    /** Поддерживается ли SpeechRecognition в текущем браузере */
    isSupported: !!SpeechRecognitionAPI,

    /**
     * Инициализация SpeechRecognition
     * Настраивает язык, режим работы и обработчики событий
     * @returns {boolean} Успешна ли инициализация
     */
    init() {
      if (!SpeechRecognitionAPI) {
        console.warn('[VoiceManager] SpeechRecognition is not supported in this browser');
        return false;
      }

      recognition = new SpeechRecognitionAPI();
      
      // Язык распознавания — русский
      recognition.lang = 'ru-RU';
      
      // continuous: false — распознавание остановится после первой фразы
      // Это предотвращает бесконечное прослушивание и экономит ресурсы
      recognition.continuous = false;
      
      // interimResults: true — показываем промежуточные результаты,
      // пока пользователь ещё говорит (для визуальной обратной связи)
      recognition.interimResults = true;
      
      // maxAlternatives: 1 — нам нужен только лучший вариант распознавания
      recognition.maxAlternatives = 1;

      // ==================== Обработчик результатов ====================
      // Вызывается при получении распознанной речи
      // event.results содержит массив вариантов распознавания
      // Каждый вариант имеет свойство isFinal — завершено ли распознавание
      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;
        const confidence = result[0].confidence;

        if (resultCallback) {
          resultCallback({ transcript, isFinal, confidence });
        }
      };

      // ==================== Обработчик ошибок ====================
      // Возможные ошибки:
      // - not-allowed: пользователь запретил доступ к микрофону
      // - no-speech: речь не обнаружена
      // - audio-capture: микрофон не найден
      // - network: ошибка сети (для распознавания нужен интернет)
      // - aborted: распознавание прервано
      // - service-not-allowed: сервис распознавания недоступен
      recognition.onerror = (event) => {
        console.error('[VoiceManager] SpeechRecognition error:', event.error);
        
        // 'aborted' — нормальное завершение, не сообщаем об ошибке
        if (event.error === 'aborted') return;
        
        if (errorCallback) errorCallback(event.error);
        setListening(false);
      };

      // ==================== Обработчик завершения ====================
      // Вызывается, когда распознавание останавливается (автоматически или вручную)
      recognition.onend = () => {
        setListening(false);
      };

      // ==================== Обработчик начала ====================
      recognition.onstart = () => {
        setListening(true);
      };

      console.log('[VoiceManager] Initialized successfully');
      return true;
    },

    /**
     * Начать прослушивание микрофона
     * Запускает SpeechRecognition. Если уже слушаем — игнорируем.
     */
    startListening() {
      if (!recognition) {
        console.warn('[VoiceManager] Recognition not initialized');
        return;
      }

      if (listening) return; // Уже слушаем

      try {
        recognition.start();
        // onstart вызовет setListening(true)
      } catch (e) {
        console.error('[VoiceManager] Failed to start recognition:', e);
        // Иногда recognition уже запущен (race condition) — перезапускаем
        try {
          recognition.stop();
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e2) {
              console.error('[VoiceManager] Failed to restart recognition:', e2);
            }
          }, 150);
        } catch (e2) {
          // Игнорируем
        }
      }
    },

    /**
     * Остановить прослушивание микрофона
     */
    stopListening() {
      if (!recognition) return;
      try {
        recognition.stop();
      } catch (e) {
        // Может быть уже остановлен — игнорируем
      }
      setListening(false);
    },

    /**
     * Озвучить текст через SpeechSynthesis
     * @param {string} text — Текст для озвучки
     * @param {number} [rate] — Скорость озвучки (0.1 — 10, по умолчанию 1.0)
     */
    speak(text, rate) {
      if (!synthesis) {
        console.warn('[VoiceManager] SpeechSynthesis is not supported');
        return;
      }

      // Отменяем текущую озвучку, если есть
      synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = rate || voiceRate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Пытаемся найти русский голос для лучшего качества
      const voices = synthesis.getVoices();
      const russianVoice = voices.find(v => v.lang.startsWith('ru'));
      if (russianVoice) {
        utterance.voice = russianVoice;
      }

      synthesis.speak(utterance);
    },

    /**
     * Установить скорость озвучки
     * @param {number} rate — Скорость (0.1 — 10)
     */
    setRate(rate) {
      voiceRate = Math.max(0.1, Math.min(10, rate));
    },

    /** Регистрация колбэков */
    onResult(callback) { resultCallback = callback; },
    onError(callback) { errorCallback = callback; },
    onStateChange(callback) { stateChangeCallback = callback; },

    /** Текущее состояние */
    get isListening() { return listening; }
  };

  // ==================== Внутренние функции ====================
  
  /**
   * Установить состояние прослушивания и уведомить подписчиков
   * @param {boolean} value — Слушаем ли микрофон
   */
  function setListening(value) {
    const changed = listening !== value;
    listening = value;
    if (changed && stateChangeCallback) {
      stateChangeCallback(value);
    }
  }

  // ==================== Экспорт в глобальную область ====================
  window.VoiceManager = VoiceManager;

  // Предзагрузка голосов для SpeechSynthesis
  // В некоторых браузерах голоса загружаются асинхронно
  if (synthesis) {
    synthesis.getVoices(); // Триггерит загрузку
    synthesis.onvoiceschanged = () => {
      synthesis.getVoices(); // Обновляем список голосов
    };
  }

  console.log('[VoiceManager] Module loaded. Supported:', VoiceManager.isSupported);
})();
