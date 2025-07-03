/**
 * Модуль адміністрування для сайту спільноти Тезе
 * Тільки синхронізація з Google Sheets та управління даними
 * Версія 2.0 - без форми додавання подій
 */

class AdminManager {
  constructor() {
    this.isInitialized = false;
    this.autoSyncInterval = null;
    this.SYNC_INTERVAL = 6 * 60 * 60 * 1000;
    
    this.init();
  }

  /**
   * Ініціалізація адмін-панелі
   */
  init() {
    // Чекаємо поки основний застосунок ініціалізується
    if (window.app && window.app.isInitialized) {
      this.setupAdmin();
    } else {
      window.addEventListener('appInitialized', () => {
        this.setupAdmin();
      });
    }
  }

  /**
   * Налаштування адмін-функцій
   */
  setupAdmin() {
    try {
      this.setupAutoSync();
      this.setupImportExport();
      this.setupGoogleSheetsIntegration();
      this.setupKeyboardShortcuts();
      
      this.isInitialized = true;
      console.log('Адмін-панель ініціалізована успішно');

      // Запускаємо першу синхронізацію
      this.performInitialSync();

    } catch (error) {
      console.error('Помилка ініціалізації адмін-панелі:', error);
    }
  }

  /**
   * Налаштування автоматичної синхронізації
   */
  setupAutoSync() {
    // Перевіряємо, чи потрібно синхронізуватися при завантаженні
    const lastSync = localStorage.getItem('lastAutoSync');
    const now = Date.now();
    
    if (!lastSync || (now - parseInt(lastSync)) > this.SYNC_INTERVAL) {
      console.log('🔄 Час для автоматичної синхронізації');
      // Синхронізація відбудеться через performInitialSync
    }

    // Встановлюємо інтервал для автоматичної синхронізації
    this.autoSyncInterval = setInterval(() => {
      this.performAutoSync();
    }, this.SYNC_INTERVAL);

    console.log(`⏰ Автоматична синхронізація налаштована (кожні ${this.SYNC_INTERVAL / (1000 * 60 * 60)} годин)`);
  }

  /**
   * Виконання початкової синхронізації
   */
  async performInitialSync() {
    try {
      const lastSync = localStorage.getItem('lastAutoSync');
      const now = Date.now();
      const isFirstVisit = !localStorage.getItem('taizeEvents');
      
      const shouldSync = !lastSync || 
                        (now - parseInt(lastSync)) > this.SYNC_INTERVAL ||
                        !window.app.events.length ||
                        isFirstVisit;

      if (shouldSync) {
        console.log('🔄 Виконуємо початкову синхронізацію...');
        const success = await this.syncFromSheets(false); // false = не показувати повідомлення
        
        if (success) {
          localStorage.setItem('lastAutoSync', now.toString());
          console.log('✅ Початкова синхронізація завершена');
        }
      } else {
        console.log('⏭️ Початкова синхронізація не потрібна');
      }
    } catch (error) {
      console.error('❌ Помилка початкової синхронізації:', error);
    }
  }

  /**
   * Виконання автоматичної синхронізації
   */
  async performAutoSync() {
    try {
      console.log('🔄 Автоматична синхронізація...');
      
      const success = await this.syncFromSheets(false); // Тиха синхронізація
      
      if (success) {
        const now = Date.now();
        localStorage.setItem('lastAutoSync', now.toString());
        console.log('✅ Автоматична синхронізація завершена');
        
        // Показуємо ненав'язливе повідомлення
        this.showQuietNotification('🔄 Дані оновлено');
      } else {
        console.log('⚠️ Автоматична синхронізація не вдалася');
      }
    } catch (error) {
      console.error('❌ Помилка автоматичної синхронізації:', error);
    }
  }

  /**
   * Ручна синхронізація з Google Sheets
   */
  async syncFromSheets(showMessages = true) {
    try {
      if (!window.sheetsDB) {
        if (showMessages) this.showError('Google Sheets інтеграція недоступна');
        return false;
      }

      if (showMessages) this.showInfo('🔄 Синхронізація з Google Sheets...');
      
      const success = await window.sheetsDB.syncWithSheets();
      
      if (success && showMessages) {
        this.showSuccess('✅ Синхронізація завершена успішно!');
      }
      
      return success;
      
    } catch (error) {
      console.error('Помилка ручної синхронізації:', error);
      if (showMessages) this.showError('Помилка синхронізації з Google Sheets');
      return false;
    }
  }

  /**
   * Налаштування імпорту/експорту (спрощена версія)
   */
  setupImportExport() {
    const adminSection = document.getElementById('admin-section');
    if (!adminSection) return;

    // Видаляємо стару форму, якщо є
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
      eventForm.remove();
    }

    // Видаляємо заголовок форми
    const formTitle = adminSection.querySelector('h2');
    if (formTitle && formTitle.textContent.includes('Додати нову подію')) {
      formTitle.remove();
    }

    // Видаляємо список подій (буде замінений на статистику)
    const existingEventsTitle = adminSection.querySelector('h3');
    if (existingEventsTitle && existingEventsTitle.textContent.includes('Існуючі події')) {
      existingEventsTitle.remove();
    }

    const existingEventsList = document.getElementById('admin-events-list');
    if (existingEventsList) {
      existingEventsList.remove();
    }

    // Створюємо новий інтерфейс
    adminSection.innerHTML = `
      <div class="admin-header">
        <h2>🔧 Панель адміністрування</h2>
        <p class="subtitle">Управління даними та синхронізація з Google Sheets</p>
      </div>
      
      <div class="sync-status-section">
        <h3>📊 Статус синхронізації</h3>
        <div class="sync-info-grid">
          <div class="sync-info-item">
            <span class="sync-label">Остання синхронізація:</span>
            <span class="sync-value" id="last-sync-display">Завантаження...</span>
          </div>
          <div class="sync-info-item">
            <span class="sync-label">Наступна автоматична:</span>
            <span class="sync-value" id="next-sync-display">Завантаження...</span>
          </div>
          <div class="sync-info-item">
            <span class="sync-label">Кількість подій:</span>
            <span class="sync-value" id="events-count">0</span>
          </div>
          <div class="sync-info-item">
            <span class="sync-label">Статус Google Sheets:</span>
            <span class="sync-value" id="sheets-status">Перевірка...</span>
          </div>
        </div>
      </div>

      <div class="admin-actions">
        <h3>🚀 Дії</h3>
        <div class="action-buttons">
          <button onclick="adminManager.syncFromSheets(true)" class="btn btn-primary">
            🔄 Синхронізувати зараз
          </button>
          <button onclick="adminManager.testConnection()" class="btn btn-secondary">
            🔌 Перевірити з'єднання
          </button>
          <button onclick="adminManager.openGoogleSheets()" class="btn btn-secondary">
            📊 Відкрити Google Sheets
          </button>
        </div>
      </div>
      
      <div class="data-management">
        <h3>💾 Управління даними</h3>
        <div class="management-buttons">
          <button onclick="adminManager.exportData()" class="btn btn-secondary">
            📥 Експортувати дані
          </button>
          <button onclick="adminManager.importData()" class="btn btn-secondary">
            📤 Імпортувати дані
          </button>
          <button onclick="adminManager.showEventsList()" class="btn btn-secondary">
            📋 Переглянути події
          </button>
          <button onclick="adminManager.clearAllData()" class="btn btn-danger">
            🗑️ Очистити дані
          </button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display: none;">
      </div>

      <div class="events-preview" id="events-preview" style="display: none;">
        <h3>📋 Список подій</h3>
        <div id="events-list-container"></div>
      </div>
    `;

    // Додаємо CSS стилі
    this.addAdminStyles();

    // Обробник файлу імпорту
    const importFile = document.getElementById('import-file');
    if (importFile) {
      importFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          this.handleImportFile(e.target.files[0]);
        }
      });
    }

    // Оновлюємо статус кожні 30 секунд
    this.updateSyncStatus();
    setInterval(() => this.updateSyncStatus(), 30000);
  }

  /**
   * Додавання стилів для адмін-панелі
   */
  addAdminStyles() {
    const style = document.createElement('style');
    style.id = 'admin-styles';
    style.textContent = `
      .admin-header {
        text-align: center;
        margin-bottom: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        color: white;
      }
      
      .admin-header h2 {
        margin: 0 0 10px 0;
        color: white;
      }
      
      .sync-status-section {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        border: 1px solid #e9ecef;
      }
      
      .sync-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }
      
      .sync-info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: white;
        border-radius: 6px;
        border: 1px solid #dee2e6;
      }
      
      .sync-label {
        font-weight: 500;
        color: #6c757d;
        font-size: 0.9em;
      }
      
      .sync-value {
        font-weight: 600;
        color: #495057;
      }
      
      .admin-actions, .data-management {
        margin-bottom: 30px;
      }
      
      .action-buttons, .management-buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 15px;
      }
      
      .events-preview {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #e9ecef;
        margin-top: 20px;
      }
      
      .event-preview-item {
        background: white;
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 6px;
        border: 1px solid #dee2e6;
      }
      
      .event-preview-item h4 {
        margin: 0 0 8px 0;
        color: #495057;
      }
      
      .event-preview-item p {
        margin: 0;
        color: #6c757d;
        font-size: 0.9em;
      }
      
      @media (max-width: 768px) {
        .sync-info-grid {
          grid-template-columns: 1fr;
        }
        
        .action-buttons, .management-buttons {
          flex-direction: column;
        }
        
        .action-buttons .btn, .management-buttons .btn {
          width: 100%;
        }
      }
    `;
    
    // Видаляємо старі стилі, якщо є
    const existingStyles = document.getElementById('admin-styles');
    if (existingStyles) {
      existingStyles.remove();
    }
    
    document.head.appendChild(style);
  }

  /**
   * Оновлення статусу синхронізації
   */
  updateSyncStatus() {
    // Остання синхронізація
    const lastSyncElement = document.getElementById('last-sync-display');
    if (lastSyncElement) {
      const lastSync = localStorage.getItem('lastAutoSync');
      if (lastSync) {
        const lastSyncDate = new Date(parseInt(lastSync));
        lastSyncElement.textContent = this.formatTimeAgo(lastSyncDate);
      } else {
        lastSyncElement.textContent = 'Ще не синхронізовано';
      }
    }

    // Наступна синхронізація
    const nextSyncElement = document.getElementById('next-sync-display');
    if (nextSyncElement) {
      const lastSync = localStorage.getItem('lastAutoSync');
      if (lastSync) {
        const nextSyncDate = new Date(parseInt(lastSync) + this.SYNC_INTERVAL);
        nextSyncElement.textContent = this.formatTimeUntil(nextSyncDate);
      } else {
        nextSyncElement.textContent = 'Після першої синхронізації';
      }
    }

    // Кількість подій
    const eventsCountElement = document.getElementById('events-count');
    if (eventsCountElement && window.app) {
      eventsCountElement.textContent = window.app.events.length;
    }

    // Статус Google Sheets
    const sheetsStatusElement = document.getElementById('sheets-status');
    if (sheetsStatusElement && window.sheetsDB) {
      sheetsStatusElement.textContent = window.sheetsDB.isEnabled ? '✅ Активний' : '❌ Неактивний';
    }
  }

  /**
   * Перевірка з'єднання з Google Sheets
   */
  async testConnection() {
    if (window.sheetsDB) {
      await window.sheetsDB.testConnection();
      this.updateSyncStatus();
    } else {
      this.showError('Google Sheets інтеграція недоступна');
    }
  }

  /**
   * Відкриття Google Sheets
   */
  openGoogleSheets() {
    if (window.sheetsDB) {
      window.open(window.sheetsDB.getSheetURL(), '_blank');
    } else {
      this.showError('Google Sheets інтеграція недоступна');
    }
  }

  /**
   * Показ списку подій
   */
  showEventsList() {
    const eventsPreview = document.getElementById('events-preview');
    const eventsContainer = document.getElementById('events-list-container');
    
    if (!eventsPreview || !eventsContainer) return;

    if (eventsPreview.style.display === 'none') {
      eventsPreview.style.display = 'block';
      
      if (!window.app.events.length) {
        eventsContainer.innerHTML = '<p style="text-align: center; color: #6c757d;">Поки що немає подій</p>';
        return;
      }

      const sortedEvents = [...window.app.events].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      eventsContainer.innerHTML = sortedEvents.map(event => `
        <div class="event-preview-item">
          <h4>${this.escapeHtml(event.title)}</h4>
          <p><strong>📅</strong> ${this.formatDate(event.date)}</p>
          <p><strong>📍</strong> ${this.escapeHtml(event.location)}</p>
          <p><strong>📝</strong> ${this.escapeHtml(event.description.substring(0, 100))}${event.description.length > 100 ? '...' : ''}</p>
        </div>
      `).join('');
    } else {
      eventsPreview.style.display = 'none';
    }
  }

  /**
   * Налаштування Google Sheets інтеграції
   */
  setupGoogleSheetsIntegration() {
    // Основна інтеграція тепер в головному інтерфейсі
    console.log('📊 Google Sheets інтеграція налаштована');
  }

  /**
   * Налаштування гарячих клавіш
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+R для синхронізації
      if (e.ctrlKey && e.key === 'r' && e.target.closest('#admin-section')) {
        e.preventDefault();
        this.syncFromSheets(true);
      }

      // Ctrl+T для тестування з'єднання
      if (e.ctrlKey && e.key === 't' && e.target.closest('#admin-section')) {
        e.preventDefault();
        this.testConnection();
      }
    });
  }

  /**
   * Експорт даних
   */
  exportData() {
    try {
      const data = {
        events: window.app ? window.app.events : [],
        metadata: {
          exportDate: new Date().toISOString(),
          version: window.app ? window.app.VERSION : '2.0.0',
          totalEvents: window.app ? window.app.events.length : 0,
          lastSync: localStorage.getItem('lastAutoSync')
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `taize-events-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess('Дані успішно експортовано');

    } catch (error) {
      console.error('Помилка експорту:', error);
      this.showError('Не вдалося експортувати дані');
    }
  }

  /**
   * Імпорт даних
   */
  importData() {
    const input = document.getElementById('import-file');
    if (input) {
      input.click();
    }
  }

  /**
   * Обробка файлу імпорту
   */
  handleImportFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.events || !Array.isArray(data.events)) {
          throw new Error('Неправильний формат файлу');
        }

        const confirmMessage = `Імпортувати ${data.events.length} подій?\n\nЦе замінить всі існуючі дані!`;

        if (confirm(confirmMessage)) {
          if (window.app) {
            window.app.events = data.events;
            window.app.saveEvents();
            window.app.refreshUI();
          }

          this.showSuccess(`${data.events.length} подій успішно імпортовано!`);
          this.updateSyncStatus();
        }

      } catch (error) {
        console.error('Помилка імпорту:', error);
        this.showError('Помилка імпорту: ' + error.message);
      } finally {
        const input = document.getElementById('import-file');
        if (input) input.value = '';
      }
    };

    reader.onerror = () => {
      this.showError('Помилка читання файлу');
    };

    reader.readAsText(file);
  }

  /**
   * Очищення всіх даних
   */
  clearAllData() {
    const confirmMessage = `УВАГА! Ця дія незворотна!\n\nЦе видалить всі локальні дані.\nВи впевнені?`;

    if (confirm(confirmMessage)) {
      const doubleConfirm = prompt('Введіть "ВИДАЛИТИ" для підтвердження:');

      if (doubleConfirm === 'ВИДАЛИТИ') {
        try {
          localStorage.removeItem('taizeEvents');
          localStorage.removeItem('taizeMetadata');
          localStorage.removeItem('lastAutoSync');

          if (window.app) {
            window.app.events = [];
            window.app.refreshUI();
          }

          this.showSuccess('Всі дані очищено');
          this.updateSyncStatus();

        } catch (error) {
          console.error('Помилка очищення даних:', error);
          this.showError('Не вдалося очистити всі дані');
        }
      }
    }
  }

  /**
   * Форматування часу "тому"
   */
  formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Щойно';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} хв. тому`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} год. тому`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} дн. тому`;
    }
  }

  /**
   * Форматування часу "через"
   */
  formatTimeUntil(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((date - now) / 1000);
    
    if (diffInSeconds < 0) {
      return 'Зараз';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Через ${minutes} хв.`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `Через ${hours} год.`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `Через ${days} дн.`;
    }
  }

  /**
   * Форматування дати
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('uk-UA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Екранування HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Тихе повідомлення (менш нав'язливе)
   */
  showQuietNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1000;
      opacity: 0.9;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Показ повідомлень
   */
  showError(message) {
    console.error(message);
    this.showNotification('❌ ' + message, 'error');
  }

  showSuccess(message) {
    console.log(message);
    this.showNotification('✅ ' + message, 'success');
  }

  showInfo(message) {
    console.info(message);
    this.showNotification('ℹ️ ' + message, 'info');
  }

  showNotification(message, type = 'info') {
    // Створення контейнера для сповіщень, якщо його немає
    let container = document.getElementById('notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notifications-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }

    const colors = {
      error: { bg: '#fee', border: '#e74c3c', text: '#c0392b' },
      success: { bg: '#efe', border: '#27ae60', text: '#1e8449' },
      info: { bg: '#e3f2fd', border: '#2196f3', text: '#1976d2' }
    };

    const color = colors[type] || colors.info;

    const notification = document.createElement('div');
    notification.style.cssText = `
      background: ${color.bg};
      border: 2px solid ${color.border};
      color: ${color.text};
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      font-weight: 500;
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      ${message}
      <span style="position: absolute; top: 5px; right: 10px; font-size: 18px; opacity: 0.6;">×</span>
    `;

    container.appendChild(notification);

    const autoRemove = setTimeout(() => {
      this.removeNotification(notification);
    }, 5000);

    notification.addEventListener('click', () => {
      clearTimeout(autoRemove);
      this.removeNotification(notification);
    });
  }

  removeNotification(notification) {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Очищення при закритті
   */
  destroy() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
  }
}

// Глобальна ініціалізація
let adminManager;

document.addEventListener('DOMContentLoaded', () => {
  adminManager = new AdminManager();
});

// Очищення при закритті сторінки
window.addEventListener('beforeunload', () => {
  if (adminManager) {
    adminManager.destroy();
  }
});

// Експорт для можливого використання як модуль
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminManager;
}