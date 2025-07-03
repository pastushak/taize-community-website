/**
 * Головний файл для сайту спільноти Тезе
 * Відповідає за основну логіку застосунку, управління подіями та інтерфейсом
 */

class TaizeCommunityApp {
  constructor() {
    this.events = [];
    this.currentSection = 'map';
    this.isInitialized = false;
    this.VERSION = '1.0.0';

    // Прив'язка методів до контексту
    this.showEventDetails = this.showEventDetails.bind(this);
    this.deleteEvent = this.deleteEvent.bind(this);
    this.openImageModal = this.openImageModal.bind(this);

    this.init();
  }

  /**
   * Ініціалізація застосунку
   */
  async init() {
    try {
      console.log('Ініціалізація Taize Community App v' + this.VERSION);

      // Показуємо індикатор завантаження для нових користувачів
      const isFirstVisit = !localStorage.getItem('taizeEvents');
      if (isFirstVisit) {
        this.showLoadingIndicator();
      }

      await this.loadEvents();
      
      // Приховуємо індикатор
      this.hideLoadingIndicator();

      await this.loadEvents();
      this.setupEventListeners();
      this.setupModals();
      this.showSection('map');

      // Ініціалізація сайдбара
      this.updateSidebar();

      this.isInitialized = true;
      console.log('Застосунок успішно ініціалізований');

      // Повідомлення про готовність для інших компонентів
      window.dispatchEvent(new CustomEvent('appInitialized', { detail: this }));

    } catch (error) {
      console.error('Помилка ініціалізації:', error);
      this.showError('Помилка при завантаженні застосунку');
    }
  }

    /**
   * Завантаження подій з localStorage або ініціалізація прикладами
   */
  async loadEvents() {
    try {
      const savedEvents = localStorage.getItem('taizeEvents');

      if (savedEvents) {
        this.events = JSON.parse(savedEvents);
        console.log(`Завантажено ${this.events.length} подій з localStorage`);
      } else {
        // Спочатку завантажуємо з Google Sheets
        console.log('🔄 Перше завантаження - синхронізація з Google Sheets...');
        await this.loadFromSheetsFirst();
        
        // Якщо не вдалося - використовуємо приклади
        if (this.events.length === 0) {
          this.events = this.getDefaultEvents();
          console.log('Ініціалізовано з прикладами подій');
        }
        
        await this.saveEvents();
      }

      // Валідація та очищення даних
      this.validateEvents();

    } catch (error) {
      console.error('Помилка завантаження подій:', error);
      this.events = this.getDefaultEvents();
      this.showError('Помилка завантаження даних. Використовуються приклади.');
    }
  }

  /**
   * Отримання стандартних подій для демонстрації
   */
  getDefaultEvents() {
    return [
      {
        id: Date.now(),
        title: "Молитовна зустріч у Івано-Франківську",
        date: "2025-01-15T19:00",
        location: "Церква Святого Миколая",
        lat: 48.9226,
        lng: 24.7111,
        description: "Спільна молитва в дусі Тезе з піснями та медитацією",
        fullDescription: "Запрошуємо всіх бажаючих на молитовну зустріч у дусі спільноти Тезе. Вечір почнеться о 19:00 спільними піснями, після чого буде час тихої медитації та читання Священного Писання. Завершимо зустріч спільною молитвою. Принесіть із собою відкрите серце та готовність до зустрічі з Богом у тиші та спільноті.",
        photos: [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop"
        ],
        programLink: "https://taize.fr/uk"
      },
      {
        id: Date.now() + 1,
        title: "Зустріч у Львові",
        date: "2025-01-22T18:30",
        location: "Костел Святого Антонія",
        lat: 49.8397,
        lng: 24.0297,
        description: "Вечірня молитва з читанням та піснями",
        fullDescription: "Вечірня молитва у Львові проходитиме у костелі Святого Антонія. Програма включає спільні пісні в дусі Тезе, читання уривків з Євангелія та час для особистої молитви в тиші. Після молитви буде можливість поспілкуватися з іншими учасниками за чашкою чаю.",
        photos: [
          "https://images.unsplash.com/photo-1519491050282-cf00c82424b4?w=400&h=300&fit=crop"
        ],
        programLink: ""
      },
      {
        id: Date.now() + 2,
        title: "Молодіжна зустріч у Тернополі",
        date: "2025-02-05T17:00",
        location: "Парафіяльний дім",
        lat: 49.5535,
        lng: 25.5948,
        description: "Спеціальна зустріч для молоді з піснями та обговоренням",
        fullDescription: "Молодіжна зустріч спільноти Тезе в Тернополі. Разом ми будемо співати пісні, ділитися думками про віру та сучасне життя, а також проводити час у молитві. Зустріч орієнтована на молодь віком від 16 до 35 років, але всі бажаючі запрошуються.",
        photos: [
          "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=300&fit=crop"
        ],
        programLink: ""
      }
    ];
  }

    /**
   * Завантаження з Google Sheets при першому відвідуванні
   */
  async loadFromSheetsFirst() {
    try {
      if (window.sheetsDB) {
        const sheetsEvents = await window.sheetsDB.loadEvents();
        if (sheetsEvents && sheetsEvents.length > 0) {
          this.events = sheetsEvents;
          console.log(`✅ Завантажено ${sheetsEvents.length} подій з Google Sheets`);
          
          // Показуємо повідомлення користувачу
          this.showWelcomeMessage();
          return;
        }
      }
    } catch (error) {
      console.error('Помилка завантаження з Sheets:', error);
    }
    
    console.log('⚠️ Не вдалося завантажити з Google Sheets');
  }

  /**
   * Вітальне повідомлення для нових користувачів
   */
  showWelcomeMessage() {
    setTimeout(() => {
      const message = `
  🕊️ Вітаємо у спільноті Тезе!

  Дані успішно завантажено з Google Sheets.
  На карті відображені наші молитовні зустрічі.

  Приєднуйтесь до нас! 🙏
      `;
      
      if (confirm(message.trim())) {
        // Можна додати перехід до майбутніх подій
        this.showSection('future');
      }
    }, 1000);
  }

  /**
   * Валідація подій
   */
  validateEvents() {
    const validEvents = this.events.filter(event => {
      return event.id && event.title && event.date &&
        event.location && event.lat && event.lng;
    });

    if (validEvents.length !== this.events.length) {
      console.warn(`Видалено ${this.events.length - validEvents.length} некоректних подій`);
      this.events = validEvents;
    }
  }

  /**
   * Збереження подій в localStorage
   */
  async saveEvents() {
    try {
      const dataToSave = {
        events: this.events,
        version: this.VERSION,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem('taizeEvents', JSON.stringify(this.events));
      localStorage.setItem('taizeMetadata', JSON.stringify(dataToSave));

      console.log('Події збережено успішно');

    } catch (error) {
      console.error('Помилка збереження:', error);
      this.showError('Не вдалося зберегти дані');
    }
  }

  /**
   * Налаштування обробників подій
   */
  setupEventListeners() {
    // Обробка форми додавання події
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
      eventForm.addEventListener('submit', this.handleEventSubmit.bind(this));
    }

    // Глобальні обробники клавіатури
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Обробка зміни розміру вікна
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Налаштування модальних вікон
   */
  setupModals() {
    const eventModal = document.getElementById('event-modal');
    const imageModal = document.getElementById('image-modal');

    if (eventModal) {
      const closeBtn = eventModal.querySelector('.close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeModal('event-modal'));
      }
    }

    if (imageModal) {
      const closeBtn = imageModal.querySelector('.close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeModal('image-modal'));
      }
    }

    // Закриття модалів при кліку поза ними
    window.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) {
        this.closeModal(event.target.id);
      }
    });
  }

  /**
   * Обробка подачі форми
   */
  async handleEventSubmit(event) {
    event.preventDefault();

    try {
      const formData = this.getFormData();

      if (!this.validateFormData(formData)) {
        return;
      }

      const newEvent = this.createEventFromForm(formData);

      this.events.push(newEvent);
      await this.saveEvents();

      // Оновлення інтерфейсу
      this.refreshUI();

      // Очищення форми
      this.clearForm();

      this.showSuccess('Подію успішно додано!');

    } catch (error) {
      console.error('Помилка додавання події:', error);
      this.showError('Не вдалося додати подію');
    }
  }

  /**
   * Отримання даних з форми
   */
  getFormData() {
    return {
      title: this.getElementValue('event-title'),
      date: this.getElementValue('event-date'),
      location: this.getElementValue('event-location'),
      lat: this.getElementValue('event-lat'),
      lng: this.getElementValue('event-lng'),
      description: this.getElementValue('event-description'),
      fullDescription: this.getElementValue('event-full-description'),
      programLink: this.getElementValue('event-program-link'),
      photos: this.getElementValue('event-photos')
    };
  }

  /**
   * Допоміжна функція для отримання значення елемента
   */
  getElementValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : '';
  }

  /**
   * Валідація даних форми
   */
  validateFormData(data) {
    const errors = [];

    if (!data.title) errors.push('Назва події обов\'язкова');
    if (!data.date) errors.push('Дата та час обов\'язкові');
    if (!data.location) errors.push('Місце проведення обов\'язкове');
    if (!data.lat || isNaN(parseFloat(data.lat))) errors.push('Некоректна широта');
    if (!data.lng || isNaN(parseFloat(data.lng))) errors.push('Некоректна довгота');
    if (!data.description) errors.push('Опис події обов\'язковий');

    // Перевірка координат для України
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);

    if (lat < 44 || lat > 52) errors.push('Широта має бути між 44 та 52 (територія України)');
    if (lng < 22 || lng > 40) errors.push('Довгота має бути між 22 та 40 (територія України)');

    if (errors.length > 0) {
      this.showError('Помилки валідації:\n' + errors.join('\n'));
      return false;
    }

    return true;
  }

  /**
   * Створення об'єкта події з даних форми
   */
  createEventFromForm(data) {
    return {
      id: Date.now(),
      title: data.title,
      date: data.date,
      location: data.location,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      description: data.description,
      fullDescription: data.fullDescription || data.description,
      programLink: data.programLink,
      photos: this.parsePhotos(data.photos),
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Парсинг фотографій з текстового поля
   */
  parsePhotos(photosString) {
    if (!photosString) return [];

    return photosString
      .split(',')
      .map(url => url.trim())
      .filter(url => url && this.isValidUrl(url));
  }

  /**
   * Перевірка валідності URL
   */
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Перемикання секцій
   */
  showSection(section) {
    try {
      // Приховати всі секції
      const sections = ['map-container', 'admin-panel', 'future-events', 'media-mentions'];
      sections.forEach(sectionClass => {
        const elements = document.querySelectorAll(`.${sectionClass}`);
        elements.forEach(el => {
          el.style.display = 'none';
          el.classList.remove('active');
        });
      });

      // Видалити активний клас з кнопок навігації (тільки з тих, що існують)
      document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('active');
      });

      // Показати обрану секцію
      this.currentSection = section;

      switch (section) {
        case 'map':
          this.showMapSection();
          break;
        case 'admin':
          this.showAdminSection();
          break;
        case 'future':
          this.showFutureSection();
          break;
        case 'media':
          this.showMediaSection();
          break;
        default:
          console.warn('Невідома секція:', section);
      }

    } catch (error) {
      console.error('Помилка перемикання секції:', error);
    }
  }

  /**
   * Показ секції карти
   */
  showMapSection() {
    const mapSection = document.getElementById('map-section');
    const mapBtn = document.getElementById('map-btn');

    if (mapSection) mapSection.style.display = 'block';
    if (mapBtn) mapBtn.classList.add('active');

    // Оновлення карти після показу
    setTimeout(() => {
      if (window.mapInstance) {
        window.mapInstance.invalidateSize();
        window.mapInstance.displayEventsOnMap();
      }
    }, 100);
  }

  /**
   * Показ адмін секції
   */
  showAdminSection() {
    const adminSection = document.getElementById('admin-section');

    if (adminSection) {
      adminSection.style.display = 'block';
      adminSection.classList.add('active');
    }

    // Не оновлюємо кнопку навігації, оскільки її немає
    this.updateAdminEventsList();
  }

  /**
   * Показ секції майбутніх подій
   */
  showFutureSection() {
    const futureSection = document.getElementById('future-section');
    const futureBtn = document.getElementById('future-btn');

    if (futureSection) futureSection.classList.add('active');
    if (futureBtn) futureBtn.classList.add('active');

    this.updateFutureEventsList();
  }

  /**
   * Показ секції ЗМІ
   */
  showMediaSection() {
    const mediaSection = document.getElementById('media-section');
    const mediaBtn = document.getElementById('media-btn');

    if (mediaSection) mediaSection.classList.add('active');
    if (mediaBtn) mediaBtn.classList.add('active');

    this.updateMediaList();
  }

  /**
   * Показ деталей події
   */
  showEventDetails(eventId, customEvent = null) {
    const event = customEvent || this.events.find(e => e.id === eventId);
    if (!event) {
      console.warn('Подію не знайдено:', eventId);
      return;
    }

    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    modalContent.innerHTML = this.generateEventDetailsHTML(event);

    const modal = document.getElementById('event-modal');
    if (modal) {
      modal.style.display = 'block';
    }
  }

    /**
   * Показ індикатора завантаження
   */
  showLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
      indicator.style.display = 'block';
    }
  }

  /**
   * Приховування індикатора завантаження
   */
  hideLoadingIndicator() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Генерація HTML для деталей події
   */
  generateEventDetailsHTML(event) {
    return `
            <h2>${this.escapeHtml(event.title)}</h2>
            <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <p><strong>📅 Дата:</strong> ${this.formatDate(event.date)}</p>
                <p><strong>📍 Місце:</strong> ${this.escapeHtml(event.location)}</p>
                <p><strong>📋 Опис:</strong></p>
                <p style="line-height: 1.6; margin-top: 10px;">${this.escapeHtml(event.fullDescription || event.description)}</p>
            </div>
            ${this.generatePhotosHTML(event.photos)}
            ${this.generateProgramLinkHTML(event.programLink)}
        `;
  }

  /**
   * Генерація HTML для фотографій
   */
  generatePhotosHTML(photos) {
    if (!photos || photos.length === 0) return '';

    return `
            <div class="photo-gallery">
                ${photos.map(photo =>
      `<img src="${this.escapeHtml(photo)}" 
                          alt="Фото події" 
                          onclick="app.openImageModal('${this.escapeHtml(photo)}')" 
                          onerror="this.style.display='none'" 
                          loading="lazy">`
    ).join('')}
            </div>
        `;
  }

  /**
   * Генерація HTML для посилання на програму
   */
  generateProgramLinkHTML(programLink) {
    if (!programLink) return '';

    return `
            <p style="margin-top: 20px;">
                <a href="${this.escapeHtml(programLink)}" target="_blank" class="btn btn-primary">
                    📖 Переглянути програму молитви
                </a>
            </p>
        `;
  }

  /**
   * Видалення події
   */
  async deleteEvent(eventId) {
    if (!confirm('Ви впевнені, що хочете видалити цю подію?')) {
      return;
    }

    try {
      this.events = this.events.filter(event => event.id !== eventId);
      await this.saveEvents();
      this.refreshUI();
      this.showSuccess('Подію видалено');

    } catch (error) {
      console.error('Помилка видалення події:', error);
      this.showError('Не вдалося видалити подію');
    }
  }

  /**
   * Відкриття модального вікна зображення
   */
  openImageModal(imageSrc) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');

    if (modal && modalImage) {
      modalImage.src = imageSrc;
      modal.style.display = 'block';
    }
  }

  /**
   * Закриття модального вікна
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Форматування дати
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      };
      return date.toLocaleString('uk-UA', options);
    } catch (error) {
      console.error('Помилка форматування дати:', error);
      return dateString;
    }
  }

  /**
   * Оновлення списку подій в адмін-панелі
   */
  updateAdminEventsList() {
    const list = document.getElementById('admin-events-list');
    if (!list) return;

    if (this.events.length === 0) {
      list.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">Поки що немає доданих подій.</p>';
      return;
    }

    const sortedEvents = [...this.events].sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = sortedEvents.map(event => this.generateEventItemHTML(event)).join('');
  }

  /**
   * Генерація HTML для елемента події в списку
   */
  generateEventItemHTML(event) {
    return `
            <div class="event-item">
                <h4>${this.escapeHtml(event.title)}</h4>
                <p><strong>📅 Дата:</strong> ${this.formatDate(event.date)}</p>
                <p><strong>📍 Місце:</strong> ${this.escapeHtml(event.location)}</p>
                <p><strong>📋 Опис:</strong> ${this.escapeHtml(event.description)}</p>
                ${event.photos && event.photos.length > 0 ?
        `<p><strong>📷 Фотографій:</strong> ${event.photos.length}</p>` : ''
      }
                <div style="margin-top: 15px;">
                    <button onclick="app.showEventDetails(${event.id})" class="btn btn-primary">
                        👁️ Переглянути
                    </button>
                    <button onclick="app.deleteEvent(${event.id})" class="btn btn-danger">
                        🗑️ Видалити
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Оновлення списку майбутніх подій
   */
  updateFutureEventsList() {
    const list = document.getElementById('future-events-list');
    if (!list) return;

    const now = new Date();
    const futureEvents = this.events.filter(event => new Date(event.date) > now);

    if (futureEvents.length === 0) {
      list.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">Наразі немає запланованих майбутніх подій.</p>';
      return;
    }

    const sortedEvents = futureEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    list.innerHTML = sortedEvents.map(event => `
            <div class="event-item">
                <h4>${this.escapeHtml(event.title)}</h4>
                <p><strong>📅 Дата:</strong> ${this.formatDate(event.date)}</p>
                <p><strong>📍 Місце:</strong> ${this.escapeHtml(event.location)}</p>
                <p>${this.escapeHtml(event.description)}</p>
                <button onclick="app.showEventDetails(${event.id})" class="btn btn-primary">
                    Детальніше
                </button>
            </div>
        `).join('');
  }

  /**
   * Оновлення списку згадок в ЗМІ
   */
  updateMediaList() {
    const list = document.getElementById('media-list');
    if (!list) return;

    list.innerHTML = `
            <div class="event-item">
                <h4>📺 Інтерв'ю на місцевому телебаченні</h4>
                <p><strong>📅 Дата:</strong> 15 листопада 2024</p>
                <p><strong>📺 Канал:</strong> Галичина ТВ</p>
                <p>Розповідь про діяльність спільноти Тезе в Івано-Франківську та значення молитовних зустрічей для місцевої громади.</p>
            </div>
            <div class="event-item">
                <h4>📰 Стаття в газеті "Галичина"</h4>
                <p><strong>📅 Дата:</strong> 3 листопада 2024</p>
                <p>Публікація про екуменічний характер молитовних зустрічей та їх вплив на міжконфесійний діалог.</p>
            </div>
        `;
  }

  /**
   * Очищення форми
   */
  clearForm() {
    const form = document.getElementById('event-form');
    if (form) {
      form.reset();
    }

    // Видалення тимчасових маркерів з карти
    if (window.mapInstance && window.mapInstance.removeTempMarker) {
      window.mapInstance.removeTempMarker();
    }
  }

  /**
   * Оновлення всього інтерфейсу
   */
  refreshUI() {
    if (window.mapInstance && window.mapInstance.displayEventsOnMap) {
      window.mapInstance.displayEventsOnMap();
    }

    // Оновлення сайдбара
    this.updateSidebar();

    if (this.currentSection === 'admin') {
      this.updateAdminEventsList();
    } else if (this.currentSection === 'future') {
      this.updateFutureEventsList();
    }
  }

  /**
   * Оновлення сайдбара з недавніми подіями
   */
  updateSidebar() {
    this.updateRecentEvents();
    this.updateStatistics();
  }

  /**
   * Оновлення недавніх подій в сайдбарі
   */
  updateRecentEvents() {
    const container = document.getElementById('recent-events-list');
    if (!container) return;

    const now = new Date();
    const recentEvents = this.events
      .filter(event => new Date(event.date) < now) // Тільки минулі події
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Сортування за датою (новіші спочатку)
      .slice(0, 6); // Беремо останні 6 подій

    if (recentEvents.length === 0) {
      container.innerHTML = `
                <div class="recent-event-item">
                    <div class="recent-event-title">Поки що немає подій</div>
                    <div class="recent-event-location">Додайте першу подію через адмін-панель</div>
                </div>
            `;
      return;
    }

    container.innerHTML = recentEvents.map(event => `
            <div class="recent-event-item" onclick="app.showEventDetails(${event.id})">
                <div class="recent-event-date">${this.formatDateShort(event.date)}</div>
                <div class="recent-event-title">${this.escapeHtml(event.title)}</div>
                <div class="recent-event-location">${this.escapeHtml(event.location)}</div>
            </div>
        `).join('');
  }

  /**
   * Оновлення статистики в сайдбарі
   */
  updateStatistics() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const stats = this.getStatistics();

    container.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Всього подій</span>
                <span class="stat-value">${stats.total}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Проведено</span>
                <span class="stat-value">${stats.past}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Заплановано</span>
                <span class="stat-value">${stats.future}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">З фотографіями</span>
                <span class="stat-value">${stats.withPhotos}</span>
            </div>
            ${stats.withPrograms > 0 ? `
            <div class="stat-item">
                <span class="stat-label">З програмами</span>
                <span class="stat-value">${stats.withPrograms}</span>
            </div>
            ` : ''}
        `;
  }

  /**
   * Форматування дати для сайдбара (коротка версія)
   */
  formatDateShort(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

      if (diffInDays === 0) {
        return 'Сьогодні';
      } else if (diffInDays === 1) {
        return 'Вчора';
      } else if (diffInDays < 7) {
        return `${diffInDays} дн. тому`;
      } else if (diffInDays < 30) {
        const weeks = Math.floor(diffInDays / 7);
        return `${weeks} тиж. тому`;
      } else {
        return date.toLocaleDateString('uk-UA', {
          day: 'numeric',
          month: 'short'
        });
      }
    } catch (error) {
      console.error('Помилка форматування дати:', error);
      return dateString;
    }
  }

  /**
   * Обробка натискання клавіш
   */
  handleKeyDown(event) {
    // ESC для закриття модалів
    if (event.key === 'Escape') {
      this.closeModal('event-modal');
      this.closeModal('image-modal');
    }
  }

  /**
   * Обробка зміни розміру вікна
   */
  handleResize() {
    if (window.mapInstance && this.currentSection === 'map') {
      setTimeout(() => {
        window.mapInstance.invalidateSize();
      }, 100);
    }
  }

  /**
   * Показ повідомлення про помилку
   */
  showError(message) {
    console.error(message);
    alert('❌ ' + message);
  }

  /**
   * Показ повідомлення про успіх
   */
  showSuccess(message) {
    console.log(message);
    alert('✅ ' + message);
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
   * Отримання статистики
   */
  getStatistics() {
    const now = new Date();
    const pastEvents = this.events.filter(event => new Date(event.date) < now);
    const futureEvents = this.events.filter(event => new Date(event.date) >= now);

    return {
      total: this.events.length,
      past: pastEvents.length,
      future: futureEvents.length,
      withPhotos: this.events.filter(event => event.photos && event.photos.length > 0).length
    };
  }
}

// Глобальні функції для доступу з HTML
function showSection(section) {
  if (window.app) {
    window.app.showSection(section);
  }
}

function clearForm() {
  if (window.app) {
    window.app.clearForm();
  }
}

function exportAllEvents() {
  if (window.adminManager && window.adminManager.exportData) {
    window.adminManager.exportData();
  } else {
    alert('Функція експорту недоступна');
  }
}

function showUpcomingEvents() {
  if (window.app) {
    window.app.showSection('future');
  }
}

// Ініціалізація після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TaizeCommunityApp();
});

// Експорт для можливого використання як модуль
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaizeCommunityApp;
}