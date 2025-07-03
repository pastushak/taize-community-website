/**
 * Google Sheets інтеграція для сайту Тезе
 * Файл: js/sheets.js
 */

class GoogleSheetsDB {
  constructor() {
    // ID вашої Google Sheets таблиці
    this.SHEET_ID = '1UrDYb4RrEYgXy7hqbFkHdb1YbROUlYf5qwP7_kDM2RQ';
    this.SHEET_NAME = 'Події';
    
    // Публічний URL для читання (не потребує API ключа)
    this.baseURL = `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${this.SHEET_NAME}`;
    
    this.isEnabled = true;
    this.lastSync = null;
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 хвилин
  }

  /**
   * Завантаження всіх подій з Google Sheets
   */
  async loadEvents() {
    if (!this.isEnabled) return [];

    const cacheKey = 'events';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log('📦 Використовуємо кешовані дані');
      return cached.data;
    }

    // Завантажуємо свіжі дані
    const events = await this.fetchEventsFromSheets();
    
    // Кешуємо тільки якщо дані успішно завантажилися
    if (events.length > 0) {
      this.cache.set(cacheKey, {
        data: events,
        timestamp: Date.now()
      });
    }
    
    return events;
  }

  /**
   * Окремий метод для завантаження з Sheets
   */
  async fetchEventsFromSheets() {
    try {
      console.log('🔄 Завантаження подій з Google Sheets...');
      
      const response = await fetch(this.baseURL);
      const text = await response.text();
      
      // Google Sheets повертає JSONP, потрібно витягнути JSON
      const jsonText = text.substring(47).slice(0, -2);
      const data = JSON.parse(jsonText);
      
      if (!data.table || !data.table.rows) {
        console.warn('Таблиця порожня або недоступна');
        return [];
      }
      
      const events = [];
      
      // Пропускаємо перший рядок (заголовки) та обробляємо дані
      for (let i = 0; i < data.table.rows.length; i++) {
        const row = data.table.rows[i];
        if (!row.c) continue; // Пропускаємо порожні рядки
        
        try {
          const event = this.parseRowToEvent(row.c, i + 2); // +2 бо рядок 1 = заголовки
          if (event && event.title) {
            events.push(event);
          }
        } catch (error) {
          console.warn(`Помилка обробки рядка ${i + 2}:`, error);
        }
      }
      
      this.lastSync = new Date();
      console.log(`✅ Завантажено ${events.length} подій з Google Sheets`);
      
      return events;
      
    } catch (error) {
      console.error('❌ Помилка завантаження з Google Sheets:', error);
      this.showError('Не вдалося завантажити дані з Google Sheets. Перевірте доступ до таблиці.');
      return [];
    }
  }

  /**
   * Конвертація рядка Google Sheets в об'єкт події
   */
  parseRowToEvent(row, rowNumber) {
    try {
      // Функція для безпечного отримання значення
      const getValue = (index, defaultValue = '') => {
        return row[index] && row[index].v !== null ? row[index].v : defaultValue;
      };

      const id = getValue(0) ? parseInt(getValue(0)) : Date.now() + rowNumber;
      const title = getValue(1);
      
      // Пропускаємо рядки без назви
      if (!title) return null;

      const dateValue = getValue(2);
      let formattedDate = '';
      
      if (dateValue) {
        if (dateValue instanceof Date) {
          formattedDate = dateValue.toISOString().slice(0, 16);
        } else if (typeof dateValue === 'string') {
          // Спробуємо розпарсити дату
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate)) {
            formattedDate = parsedDate.toISOString().slice(0, 16);
          } else {
            formattedDate = dateValue;
          }
        }
      }

      const event = {
        id: id,
        title: title,
        date: formattedDate,
        location: getValue(3),
        lat: parseFloat(getValue(4)) || 0,
        lng: parseFloat(getValue(5)) || 0,
        description: getValue(6),
        fullDescription: getValue(7) || getValue(6),
        programLink: getValue(8),
        photos: getValue(9) ? getValue(9).split(',').map(url => url.trim()).filter(url => url) : [],
        createdAt: getValue(10) || new Date().toISOString(),
        status: getValue(11) || 'Завершено',
        source: 'sheets'
      };

      return event;
      
    } catch (error) {
      console.error(`Помилка парсингу рядка ${rowNumber}:`, error);
      return null;
    }
  }

  /**
   * Синхронізація з Google Sheets
   */
  async syncWithSheets() {
    try {
      const sheetsEvents = await this.loadEvents();
      
      if (sheetsEvents.length > 0) {
        // Зберігаємо локальні дані як резервну копію
        const localEvents = window.app ? window.app.events : [];
        localStorage.setItem('taizeEventsBackup', JSON.stringify(localEvents));
        
        // Заміняємо дані на дані з Sheets
        if (window.app) {
          window.app.events = sheetsEvents;
          window.app.saveEvents();
          
          // ДОДАТИ: примусове оновлення сайдбара
          window.app.forceRefreshUI();
        }
        
        this.showSuccess(`Синхронізовано ${sheetsEvents.length} подій з Google Sheets`);
        return true;
      } else {
        this.showWarning('Google Sheets таблиця порожня або недоступна');
        return false;
      }
      
    } catch (error) {
      console.error('Помилка синхронізації:', error);
      this.showError('Помилка синхронізації з Google Sheets');
      return false;
    }
  }

  /**
   * Перевірка доступності Google Sheets
   */
  async testConnection() {
    try {
      const response = await fetch(this.baseURL);
      if (response.ok) {
        this.showSuccess('✅ З\'єднання з Google Sheets працює');
        return true;
      } else {
        this.showError('❌ Таблиця недоступна. Перевірте налаштування доступу.');
        return false;
      }
    } catch (error) {
      this.showError('❌ Не вдалося підключитися до Google Sheets');
      return false;
    }
  }

  /**
   * Отримання посилання на таблицю
   */
  getSheetURL() {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/edit`;
  }

  /**
   * Показ інструкцій для додавання події
   */
  showAddInstructions(event) {
    const instruction = `
📊 Додавання події в Google Sheets:

1. Відкрийте таблицю: ${this.getSheetURL()}

2. Додайте новий рядок з даними:
   • ID: ${event.id}
   • Назва: ${event.title}
   • Дата: ${event.date}
   • Локація: ${event.location}
   • Широта: ${event.lat}
   • Довгота: ${event.lng}
   • Короткий опис: ${event.description}
   • Повний опис: ${event.fullDescription}
   • Програма: ${event.programLink}
   • Фото: ${event.photos.join(', ')}
   • Створено: ${new Date().toISOString().slice(0, 16)}
   • Статус: Заплановано

3. Поверніться на сайт та натисніть "🔄 Синхронізувати"

💡 Або скопіюйте цей рядок та вставте в таблицю:
${this.formatEventForSheet(event)}
    `;
    
    if (confirm(instruction + '\n\nВідкрити таблицю зараз?')) {
      window.open(this.getSheetURL(), '_blank');
    }
  }

  /**
   * Форматування події для вставки в таблицю
   */
  formatEventForSheet(event) {
    return [
      event.id,
      event.title,
      event.date,
      event.location,
      event.lat,
      event.lng,
      event.description,
      event.fullDescription,
      event.programLink,
      event.photos.join(', '),
      new Date().toISOString().slice(0, 16),
      'Заплановано'
    ].join('\t');
  }

  /**
   * Показ сповіщень
   */
  showSuccess(message) {
    if (window.adminManager) {
      window.adminManager.showSuccess(message);
    } else {
      console.log('✅', message);
    }
  }

  showError(message) {
    if (window.adminManager) {
      window.adminManager.showError(message);
    } else {
      console.error('❌', message);
    }
  }

  showWarning(message) {
    if (window.adminManager) {
      window.adminManager.showInfo(message);
    } else {
      console.warn('⚠️', message);
    }
  }

  /**
   * Увімкнути/вимкнути Google Sheets
   */
  toggleEnabled() {
    this.isEnabled = !this.isEnabled;
    localStorage.setItem('sheetsEnabled', this.isEnabled);
    
    if (this.isEnabled) {
      this.showSuccess('Google Sheets інтеграція увімкнена');
    } else {
      this.showWarning('Google Sheets інтеграція вимкнена');
    }
  }

  /**
   * Статус останньої синхронізації
   */
  getLastSyncStatus() {
    if (!this.lastSync) {
      return 'Ще не синхронізовано';
    }
    
    const now = new Date();
    const diffMinutes = Math.floor((now - this.lastSync) / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Щойно';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} хв. тому`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours} год. тому`;
    }
  }

  /**
   * Очищення кешу
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Кеш очищено');
  }

  /**
   * Примусове оновлення (без кешу)
   */
  async forceLoadEvents() {
    this.clearCache();
    return await this.loadEvents();
  }

  /**
   * Статус кешу
   */
  getCacheStatus() {
    const cached = this.cache.get('events');
    if (!cached) return 'Кеш порожній';
    
    const age = Date.now() - cached.timestamp;
    const remaining = this.CACHE_DURATION - age;
    
    if (remaining > 0) {
      const minutes = Math.floor(remaining / (1000 * 60));
      return `Кеш дійсний ще ${minutes} хв.`;
    } else {
      return 'Кеш застарілий';
    }
  }
}

// Ініціалізація Google Sheets DB
document.addEventListener('DOMContentLoaded', () => {
  window.sheetsDB = new GoogleSheetsDB();
  
  // Завантажуємо налаштування
  const savedEnabled = localStorage.getItem('sheetsEnabled');
  if (savedEnabled !== null) {
    window.sheetsDB.isEnabled = savedEnabled === 'true';
  }
});

// Глобальні функції для використання в HTML
async function syncFromSheets() {
  if (window.sheetsDB) {
    await window.sheetsDB.syncWithSheets();
  }
}

function openSheetsTable() {
  if (window.sheetsDB) {
    window.open(window.sheetsDB.getSheetURL(), '_blank');
  }
}

function testSheetsConnection() {
  if (window.sheetsDB) {
    window.sheetsDB.testConnection();
  }
}

function toggleSheetsIntegration() {
  if (window.sheetsDB) {
    window.sheetsDB.toggleEnabled();
  }
}

// Нові глобальні функції для роботи з кешем
function clearSheetsCache() {
  if (window.sheetsDB) {
    window.sheetsDB.clearCache();
    if (window.adminManager) {
      window.adminManager.showSuccess('Кеш Google Sheets очищено');
    }
  }
}

function forceSyncFromSheets() {
  if (window.sheetsDB) {
    return window.sheetsDB.forceLoadEvents();
  }
}

function showCacheStatus() {
  if (window.sheetsDB) {
    const status = window.sheetsDB.getCacheStatus();
    if (window.adminManager) {
      window.adminManager.showInfo(`📊 Статус кешу: ${status}`);
    } else {
      alert(`📊 Статус кешу: ${status}`);
    }
  }
}