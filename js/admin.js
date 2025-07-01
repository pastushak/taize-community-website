/**
 * Модуль адміністрування для сайту спільноти Тезе
 * Відповідає за управління подіями, валідацію, геолокацію та імпорт/експорт
 */

class AdminManager {
  constructor() {
    this.isInitialized = false;
    this.autoSaveTimer = null;
    this.validationRules = this.setupValidationRules();

    // Налаштування дебаунсингу для автозбереження
    this.debouncedSave = this.debounce(this.saveFormData.bind(this), 1000);

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
      this.setupLocationHelpers();
      this.setupFormValidation();
      this.setupAutoSave();
      this.setupPreview();
      this.setupImportExport();
      this.setupAdvancedFeatures();

      this.isInitialized = true;
      console.log('Адмін-панель ініціалізована успішно');

    } catch (error) {
      console.error('Помилка ініціалізації адмін-панелі:', error);
    }
  }

  /**
   * Налаштування правил валідації
   */
  setupValidationRules() {
    return {
      'event-title': {
        required: true,
        minLength: 3,
        maxLength: 100,
        pattern: /^[а-яА-ЯіІїЇєЄ\w\s\-.,!?()]+$/u
      },
      'event-date': {
        required: true,
        custom: this.validateEventDate.bind(this)
      },
      'event-location': {
        required: true,
        minLength: 3,
        maxLength: 200
      },
      'event-lat': {
        required: true,
        type: 'number',
        min: 44,
        max: 52
      },
      'event-lng': {
        required: true,
        type: 'number',
        min: 22,
        max: 40
      },
      'event-description': {
        required: true,
        minLength: 10,
        maxLength: 500
      },
      'event-full-description': {
        maxLength: 2000
      },
      'event-program-link': {
        type: 'url'
      }
    };
  }

  /**
   * Налаштування помічників для локації
   */
  setupLocationHelpers() {
    const latInput = document.getElementById('event-lat');
    const lngInput = document.getElementById('event-lng');
    const locationInput = document.getElementById('event-location');

    if (!latInput || !lngInput || !locationInput) return;

    // Створення контейнера для кнопок допомоги
    const helperContainer = this.createLocationHelperButtons();

    // Додавання після поля довготи
    const lngGroup = lngInput.closest('.form-group');
    if (lngGroup) {
      lngGroup.appendChild(helperContainer);
    }

    // Автоматичне заповнення координат при введенні адреси
    locationInput.addEventListener('blur', () => {
      if (locationInput.value.trim() && !latInput.value && !lngInput.value) {
        this.autoFillCoordinates(locationInput.value.trim());
      }
    });

    // Валідація координат в реальному часі
    [latInput, lngInput].forEach(input => {
      input.addEventListener('input', () => {
        this.validateCoordinatesRealtime();
      });
    });
  }

  /**
   * Створення кнопок допомоги для локації
   */
  createLocationHelperButtons() {
    const container = document.createElement('div');
    container.className = 'location-helpers';
    container.style.cssText = `
            margin-top: 10px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        `;

    const buttons = [
      {
        text: '🗺️ Вибрати на карті',
        action: this.pickLocationOnMap.bind(this),
        tooltip: 'Клікніть на карті для вибору координат'
      },
      {
        text: '🔍 Знайти за адресою',
        action: this.searchLocationDialog.bind(this),
        tooltip: 'Пошук координат за назвою місця'
      },
      {
        text: '📍 Моє місце',
        action: this.getCurrentLocation.bind(this),
        tooltip: 'Використати поточне місцезнаходження'
      },
      {
        text: '🎯 Центр міста',
        action: this.setCityCenter.bind(this),
        tooltip: 'Встановити центр найближчого міста'
      }
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary btn-sm';
      button.textContent = btn.text;
      button.title = btn.tooltip;
      button.addEventListener('click', btn.action);

      button.style.cssText = `
                font-size: 12px;
                padding: 6px 12px;
                margin-bottom: 5px;
            `;

      container.appendChild(button);
    });

    return container;
  }

  /**
   * Вибір локації на карті
   */
  async pickLocationOnMap() {
    if (!window.mapInstance) {
      this.showError('Карта ще не завантажена. Спробуйте пізніше.');
      return;
    }

    try {
      // Перемикання на секцію карти
      if (window.app) {
        window.app.showSection('map');
      }

      this.showInfo('Клікніть на карті для вибору місця події');

      // Активація режиму вибору локації
      window.mapInstance.enableLocationPicking((lat, lng) => {
        this.setCoordinates(lat, lng);

        // Повернення до адмін-панелі через короткий час
        setTimeout(() => {
          if (window.app) {
            window.app.showSection('admin');
          }
          this.showSuccess('Координати встановлено з карти');
        }, 1000);
      });

    } catch (error) {
      console.error('Помилка вибору на карті:', error);
      this.showError('Не вдалося активувати вибір на карті');
    }
  }

  /**
   * Діалог пошуку локації
   */
  async searchLocationDialog() {
    const address = prompt('Введіть назву місця або адресу для пошуку:');
    if (!address) return;

    await this.searchLocation(address);
  }

  /**
   * Пошук локації за адресою
   */
  async searchLocation(address) {
    if (!window.mapInstance) {
      this.showError('Карта ще не завантажена. Спробуйте пізніше.');
      return;
    }

    try {
      this.showInfo('Пошук локації...');

      const result = await window.mapInstance.searchLocation(address);

      if (result) {
        this.setCoordinates(result.lat, result.lng);

        // Оновлення поля локації, якщо воно порожнє
        const locationField = document.getElementById('event-location');
        if (locationField && !locationField.value.trim()) {
          const simplifiedLocation = result.display_name
            .split(',')
            .slice(0, 2)
            .join(', ')
            .trim();
          locationField.value = simplifiedLocation;
        }

        this.showSuccess('Локацію знайдено та встановлено!');
      }

    } catch (error) {
      console.error('Помилка пошуку:', error);
      this.showError('Не вдалося знайти зазначене місце. Спробуйте інший запит.');
    }
  }

  /**
   * Отримання поточного місцезнаходження
   */
  getCurrentLocation() {
    if (!navigator.geolocation) {
      this.showError('Ваш браузер не підтримує геолокацію.');
      return;
    }

    this.showInfo('Визначення вашого місцезнаходження...');

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.setCoordinates(lat, lng);

        if (window.mapInstance && window.mapInstance.addTemporaryMarker) {
          window.mapInstance.addTemporaryMarker(lat, lng);
        }

        this.showSuccess('Ваше місцезнаходження встановлено!');
      },
      (error) => {
        let errorMessage = 'Не вдалося отримати ваше місцезнаходження';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Доступ до геолокації заборонений';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Інформація про місцезнаходження недоступна';
            break;
          case error.TIMEOUT:
            errorMessage = 'Час очікування геолокації вичерпано';
            break;
        }

        this.showError(errorMessage);
      },
      options
    );
  }

  /**
   * Встановлення центру найближчого міста
   */
  async setCityCenter() {
    const cities = {
      'Івано-Франківськ': { lat: 48.9226, lng: 24.7111 },
      'Львів': { lat: 49.8397, lng: 24.0297 },
      'Тернопіль': { lat: 49.5535, lng: 25.5948 },
      'Чернівці': { lat: 48.2920, lng: 25.9358 },
      'Калуш': { lat: 49.0213, lng: 24.3734 },
      'Коломия': { lat: 48.5219, lng: 25.0406 }
    };

    const cityNames = Object.keys(cities);
    const selectedCity = prompt(
      'Виберіть місто:\n' +
      cityNames.map((city, index) => `${index + 1}. ${city}`).join('\n') +
      '\n\nВведіть номер або назву:'
    );

    if (!selectedCity) return;

    let city = null;

    // Пошук за номером
    const cityIndex = parseInt(selectedCity) - 1;
    if (cityIndex >= 0 && cityIndex < cityNames.length) {
      city = cityNames[cityIndex];
    } else {
      // Пошук за назвою
      city = cityNames.find(name =>
        name.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    if (city && cities[city]) {
      this.setCoordinates(cities[city].lat, cities[city].lng);
      this.showSuccess(`Встановлено координати центру міста ${city}`);
    } else {
      this.showError('Місто не знайдено');
    }
  }

  /**
   * Встановлення координат в поля форми
   */
  setCoordinates(lat, lng) {
    const latInput = document.getElementById('event-lat');
    const lngInput = document.getElementById('event-lng');

    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lng.value = lng.toFixed(6);

    this.validateCoordinatesRealtime();
  }

  /**
   * Автоматичне заповнення координат за адресою
   */
  async autoFillCoordinates(address) {
    if (!window.mapInstance) return;

    try {
      const result = await window.mapInstance.searchLocation(address);
      if (result && !document.getElementById('event-lat').value) {
        this.setCoordinates(result.lat, result.lng);
      }
    } catch (error) {
      // Тихо ігноруємо помилки автозаповнення
      console.log('Автозаповнення координат не вдалося:', error);
    }
  }

  /**
   * Налаштування валідації форми
   */
  setupFormValidation() {
    const form = document.getElementById('event-form');
    if (!form) return;

    // Валідація в реальному часі
    Object.keys(this.validationRules).forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('blur', () => this.validateField(field));
        field.addEventListener('input', () => {
          this.clearFieldError(field);
          this.debouncedValidate(field);
        });
      }
    });

    // Валідація перед відправкою
    form.addEventListener('submit', (e) => {
      if (!this.validateForm()) {
        e.preventDefault();
      }
    });
  }

  /**
   * Дебаунсинг валідації
   */
  debouncedValidate = this.debounce((field) => {
    this.validateField(field);
  }, 500);

  /**
   * Валідація окремого поля
   */
  validateField(field) {
    if (!field || !field.id) return true;

    const rules = this.validationRules[field.id];
    if (!rules) return true;

    const value = field.value.trim();
    const errors = [];

    // Перевірка обов'язковості
    if (rules.required && !value) {
      errors.push('Це поле обов\'язкове для заповнення');
    }

    if (value) {
      // Перевірка мінімальної довжини
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Мінімальна довжина: ${rules.minLength} символів`);
      }

      // Перевірка максимальної довжини
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Максимальна довжина: ${rules.maxLength} символів`);
      }

      // Перевірка шаблону
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push('Недопустимі символи в полі');
      }

      // Перевірка типу
      if (rules.type === 'number') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          errors.push('Введіть коректне число');
        } else {
          if (rules.min !== undefined && num < rules.min) {
            errors.push(`Значення має бути не менше ${rules.min}`);
          }
          if (rules.max !== undefined && num > rules.max) {
            errors.push(`Значення має бути не більше ${rules.max}`);
          }
        }
      }

      if (rules.type === 'url' && !this.isValidUrl(value)) {
        errors.push('Введіть коректний URL');
      }

      // Кастомна валідація
      if (rules.custom) {
        const customError = rules.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    if (errors.length > 0) {
      this.showFieldError(field, errors[0]);
      return false;
    } else {
      this.clearFieldError(field);
      this.showFieldSuccess(field);
      return true;
    }
  }

  /**
   * Валідація дати події
   */
  validateEventDate(dateString) {
    if (!dateString) return null;

    const selectedDate = new Date(dateString);
    const now = new Date();

    // Перевірка на коректність дати
    if (isNaN(selectedDate.getTime())) {
      return 'Некоректна дата';
    }

    // Перевірка, чи дата не занадто давня (більше року тому)
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    if (selectedDate < oneYearAgo) {
      return 'Дата не може бути більше року тому';
    }

    // Попередження для дуже далеких дат (більше року вперед)
    const oneYearForward = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    if (selectedDate > oneYearForward) {
      return 'Дата здається занадто далекою в майбутньому';
    }

    return null;
  }

  /**
   * Валідація координат в реальному часі
   */
  validateCoordinatesRealtime() {
    const latInput = document.getElementById('event-lat');
    const lngInput = document.getElementById('event-lng');

    if (!latInput || !lngInput) return;

    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Показати попередній перегляд на карті
      if (window.mapInstance && window.mapInstance.addTemporaryMarker) {
        window.mapInstance.addTemporaryMarker(lat, lng);
      }
    }
  }

  /**
   * Валідація всієї форми
   */
  validateForm() {
    let isValid = true;

    Object.keys(this.validationRules).forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        const fieldValid = this.validateField(field);
        if (!fieldValid) {
          isValid = false;
        }
      }
    });

    return isValid;
  }

  /**
   * Показ помилки поля
   */
  showFieldError(field, message) {
    this.clearFieldError(field);

    field.style.borderColor = '#e74c3c';
    field.style.boxShadow = '0 0 5px rgba(231, 76, 60, 0.3)';

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = `
            color: #e74c3c;
            font-size: 12px;
            margin-top: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
    errorDiv.innerHTML = `<span>⚠️</span> ${message}`;

    field.parentNode.appendChild(errorDiv);
  }

  /**
   * Показ успіху поля
   */
  showFieldSuccess(field) {
    field.style.borderColor = '#27ae60';
    field.style.boxShadow = '0 0 5px rgba(39, 174, 96, 0.3)';

    // Видалення індикатора успіху через 2 секунди
    setTimeout(() => {
      if (field.style.borderColor === 'rgb(39, 174, 96)') {
        field.style.borderColor = '#e0e0e0';
        field.style.boxShadow = '';
      }
    }, 2000);
  }

  /**
   * Очищення помилки поля
   */
  clearFieldError(field) {
    field.style.borderColor = '#e0e0e0';
    field.style.boxShadow = '';

    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
  }

  /**
   * Налаштування автозбереження
   */
  setupAutoSave() {
    const form = document.getElementById('event-form');
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.debouncedSave();
      });
    });

    // Завантаження збережених даних при ініціалізації
    this.loadFormData();

    // Очищення автозбереження при успішній відправці форми
    form.addEventListener('submit', () => {
      this.clearFormData();
    });
  }

  /**
   * Збереження даних форми
   */
  saveFormData() {
    try {
      const form = document.getElementById('event-form');
      if (!form) return;

      const data = {};
      const inputs = form.querySelectorAll('input, textarea, select');

      inputs.forEach(input => {
        if (input.id && input.value.trim()) {
          data[input.id] = input.value.trim();
        }
      });

      data.timestamp = new Date().toISOString();
      localStorage.setItem('taizeFormDraft', JSON.stringify(data));

      console.log('Чернетка форми збережена');

    } catch (error) {
      console.error('Помилка збереження чернетки:', error);
    }
  }

  /**
   * Завантаження даних форми
   */
  loadFormData() {
    try {
      const savedData = localStorage.getItem('taizeFormDraft');
      if (!savedData) return;

      const data = JSON.parse(savedData);

      // Перевірка, чи дані не застарілі (більше 24 годин)
      if (data.timestamp) {
        const saveTime = new Date(data.timestamp);
        const now = new Date();
        const hoursDiff = (now - saveTime) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
          this.clearFormData();
          return;
        }
      }

      Object.keys(data).forEach(key => {
        if (key !== 'timestamp') {
          const element = document.getElementById(key);
          if (element && data[key]) {
            element.value = data[key];
          }
        }
      });

      console.log('Чернетка форми завантажена');

    } catch (error) {
      console.error('Помилка завантаження чернетки:', error);
      this.clearFormData();
    }
  }

  /**
   * Очищення збережених даних форми
   */
  clearFormData() {
    localStorage.removeItem('taizeFormDraft');

    if (window.mapInstance && window.mapInstance.removeTempMarker) {
      window.mapInstance.removeTempMarker();
    }
  }

  /**
   * Налаштування попереднього перегляду
   */
  setupPreview() {
    const form = document.getElementById('event-form');
    if (!form) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'btn btn-secondary';
      previewButton.innerHTML = '👁️ Попередній перегляд';
      previewButton.addEventListener('click', () => this.showPreview());

      submitButton.parentNode.insertBefore(previewButton, submitButton);
    }
  }

  /**
   * Показ попереднього перегляду
   */
  showPreview() {
    if (!this.validateForm()) {
      this.showError('Спочатку заповніть всі обов\'язкові поля коректно');
      return;
    }

    const formData = this.getFormData();

    const previewEvent = {
      id: 'preview',
      title: formData.title,
      date: formData.date,
      location: formData.location,
      lat: parseFloat(formData.lat),
      lng: parseFloat(formData.lng),
      description: formData.description,
      fullDescription: formData.fullDescription || formData.description,
      programLink: formData.programLink,
      photos: this.parsePhotos(formData.photos),
      createdAt: new Date().toISOString()
    };

    if (window.app && window.app.showEventDetails) {
      window.app.showEventDetails('preview', previewEvent);
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
   * Парсинг фотографій
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
   * Налаштування імпорту/експорту
   */
  setupImportExport() {
    const adminSection = document.getElementById('admin-section');
    if (!adminSection) return;

    const exportImportDiv = document.createElement('div');
    exportImportDiv.className = 'import-export-section';
    exportImportDiv.innerHTML = `
            <h3>📊 Управління даними</h3>
            <div style="margin: 20px 0; display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="adminManager.exportData()" class="btn btn-secondary">
                    📥 Експортувати події
                </button>
                <button onclick="adminManager.importData()" class="btn btn-secondary">
                    📤 Імпортувати події
                </button>
                <button onclick="adminManager.exportStatistics()" class="btn btn-secondary">
                    📈 Статистика
                </button>
                <button onclick="adminManager.clearAllData()" class="btn btn-danger">
                    🗑️ Очистити всі дані
                </button>
                <input type="file" id="import-file" accept=".json" style="display: none;">
            </div>
        `;

    adminSection.appendChild(exportImportDiv);

    // Обробник файлу імпорту
    const importFile = document.getElementById('import-file');
    if (importFile) {
      importFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          this.handleImportFile(e.target.files[0]);
        }
      });
    }
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
          version: window.app ? window.app.VERSION : '1.0.0',
          totalEvents: window.app ? window.app.events.length : 0
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)],
        { type: 'application/json' });
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

        const confirmMessage = `
Імпортувати ${data.events.length} подій?
${data.metadata ? `\nДата експорту: ${new Date(data.metadata.exportDate).toLocaleString('uk-UA')}` : ''}
\nЦе замінить всі існуючі дані!
                `.trim();

        if (confirm(confirmMessage)) {
          if (window.app) {
            window.app.events = data.events;
            window.app.saveEvents();
            window.app.refreshUI();
          }

          this.showSuccess(`${data.events.length} подій успішно імпортовано!`);
        }

      } catch (error) {
        console.error('Помилка імпорту:', error);
        this.showError('Помилка імпорту: ' + error.message);
      } finally {
        // Очищення input файлу
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
   * Експорт статистики
   */
  exportStatistics() {
    try {
      if (!window.app || !window.app.events) {
        this.showError('Немає даних для аналізу');
        return;
      }

      const stats = this.generateStatistics(window.app.events);

      const csvContent = this.convertStatisticsToCSV(stats);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `taize-statistics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess('Статистику експортовано');

    } catch (error) {
      console.error('Помилка експорту статистики:', error);
      this.showError('Не вдалося експортувати статистику');
    }
  }

  /**
   * Генерація статистики
   */
  generateStatistics(events) {
    const now = new Date();
    const currentYear = now.getFullYear();

    const stats = {
      total: events.length,
      past: 0,
      future: 0,
      currentYear: 0,
      withPhotos: 0,
      withPrograms: 0,
      locations: {},
      monthlyDistribution: {},
      averagePhotos: 0
    };

    let totalPhotos = 0;

    events.forEach(event => {
      const eventDate = new Date(event.date);
      const eventYear = eventDate.getFullYear();
      const eventMonth = eventDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

      // Підрахунок минулих та майбутніх подій
      if (eventDate < now) {
        stats.past++;
      } else {
        stats.future++;
      }

      // Події поточного року
      if (eventYear === currentYear) {
        stats.currentYear++;
      }

      // Події з фотографіями
      if (event.photos && event.photos.length > 0) {
        stats.withPhotos++;
        totalPhotos += event.photos.length;
      }

      // Події з програмами
      if (event.programLink) {
        stats.withPrograms++;
      }

      // Розподіл по локаціях
      const location = event.location || 'Не вказано';
      stats.locations[location] = (stats.locations[location] || 0) + 1;

      // Місячний розподіл
      stats.monthlyDistribution[eventMonth] = (stats.monthlyDistribution[eventMonth] || 0) + 1;
    });

    stats.averagePhotos = stats.withPhotos > 0 ? (totalPhotos / stats.withPhotos).toFixed(1) : 0;

    return stats;
  }

  /**
   * Конвертація статистики в CSV
   */
  convertStatisticsToCSV(stats) {
    let csv = 'Статистика подій спільноти Тезе\n\n';
    csv += 'Загальна статистика\n';
    csv += 'Показник,Значення\n';
    csv += `Всього подій,${stats.total}\n`;
    csv += `Минулі події,${stats.past}\n`;
    csv += `Майбутні події,${stats.future}\n`;
    csv += `Події поточного року,${stats.currentYear}\n`;
    csv += `Події з фотографіями,${stats.withPhotos}\n`;
    csv += `Події з програмами,${stats.withPrograms}\n`;
    csv += `Середня кількість фото,${stats.averagePhotos}\n\n`;

    csv += 'Розподіл по локаціях\n';
    csv += 'Локація,Кількість подій\n';
    Object.entries(stats.locations).forEach(([location, count]) => {
      csv += `"${location}",${count}\n`;
    });

    csv += '\nМісячний розподіл\n';
    csv += 'Місяць,Кількість подій\n';
    Object.entries(stats.monthlyDistribution).forEach(([month, count]) => {
      csv += `"${month}",${count}\n`;
    });

    return csv;
  }

  /**
   * Очищення всіх даних
   */
  clearAllData() {
    const confirmMessage = `
УВАГА! Ця дія незворотна!

Це видалить:
• Всі події
• Збережені чернетки
• Налаштування

Ви впевнені?
        `.trim();

    if (confirm(confirmMessage)) {
      const doubleConfirm = prompt('Введіть "ВИДАЛИТИ" для підтвердження:');

      if (doubleConfirm === 'ВИДАЛИТИ') {
        try {
          localStorage.removeItem('taizeEvents');
          localStorage.removeItem('taizeMetadata');
          localStorage.removeItem('taizeFormDraft');

          if (window.app) {
            window.app.events = [];
            window.app.refreshUI();
          }

          this.showSuccess('Всі дані очищено');

          // Перезавантаження сторінки для повного очищення
          setTimeout(() => {
            location.reload();
          }, 2000);

        } catch (error) {
          console.error('Помилка очищення даних:', error);
          this.showError('Не вдалося очистити всі дані');
        }
      } else {
        this.showInfo('Дані не були видалені');
      }
    }
  }

  /**
   * Налаштування додаткових функцій
   */
  setupAdvancedFeatures() {
    this.setupKeyboardShortcuts();
    this.setupFormAutoComplete();
    this.setupQuickActions();
  }

  /**
   * Налаштування гарячих клавіш
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+S для збереження чернетки
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveFormData();
        this.showInfo('Чернетку збережено');
      }

      // Ctrl+Enter для попереднього перегляду
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.showPreview();
      }

      // Escape для очищення форми
      if (e.key === 'Escape' && e.target.closest('#admin-section')) {
        this.clearForm();
      }
    });
  }

  /**
   * Налаштування автодоповнення форми
   */
  setupFormAutoComplete() {
    const locationInput = document.getElementById('event-location');
    if (!locationInput) return;

    // Список популярних локацій
    const popularLocations = [
      'Церква Святого Миколая, Івано-Франківськ',
      'Костел Святого Антонія, Львів',
      'Парафіяльний дім, Тернопіль',
      'Катедральний собор, Чернівці',
      'Парафія Воздвиження Чесного Хреста, Калуш'
    ];

    // Створення datalist для автодоповнення
    const datalist = document.createElement('datalist');
    datalist.id = 'location-suggestions';

    popularLocations.forEach(location => {
      const option = document.createElement('option');
      option.value = location;
      datalist.appendChild(option);
    });

    locationInput.setAttribute('list', 'location-suggestions');
    locationInput.parentNode.appendChild(datalist);
  }

  /**
   * Налаштування швидких дій
   */
  setupQuickActions() {
    const form = document.getElementById('event-form');
    if (!form) return;

    const quickActionsDiv = document.createElement('div');
    quickActionsDiv.className = 'quick-actions';
    quickActionsDiv.innerHTML = `
            <h4>🚀 Швидкі дії</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="adminManager.fillSampleData()">
                    📝 Заповнити прикладом
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="adminManager.clearForm()">
                    🧹 Очистити форму
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="adminManager.duplicateLastEvent()">
                    📋 Дублювати останню подію
                </button>
            </div>
        `;

    // Додавання перед формою
    form.parentNode.insertBefore(quickActionsDiv, form);
  }

  /**
   * Заповнення форми прикладом
   */
  fillSampleData() {
    const sampleData = {
      'event-title': 'Молитовна зустріч у дусі Тезе',
      'event-location': 'Місцева парафія',
      'event-description': 'Спільна молитва з піснями, читанням Священного Писання та медитацією в тиші',
      'event-full-description': 'Запрошуємо всіх на молитовну зустріч у дусі спільноти Тезе. Програма включає спільні пісні, час тихої молитви та читання Слова Божого. Після молитви буде можливість поспілкуватися за чашкою чаю.',
      'event-program-link': 'https://taize.fr/uk'
    };

    // Встановлення дати на наступну неділю о 18:00
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
    nextSunday.setHours(18, 0, 0, 0);
    sampleData['event-date'] = nextSunday.toISOString().slice(0, 16);

    Object.entries(sampleData).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value;
      }
    });

    this.showInfo('Форму заповнено прикладом');
  }

  /**
   * Дублювання останньої події
   */
  duplicateLastEvent() {
    if (!window.app || !window.app.events || window.app.events.length === 0) {
      this.showError('Немає подій для дублювання');
      return;
    }

    const lastEvent = window.app.events[window.app.events.length - 1];

    // Заповнення форми даними останньої події
    document.getElementById('event-title').value = lastEvent.title + ' (копія)';
    document.getElementById('event-location').value = lastEvent.location;
    document.getElementById('event-lat').value = lastEvent.lat;
    document.getElementById('event-lng').value = lastEvent.lng;
    document.getElementById('event-description').value = lastEvent.description;
    document.getElementById('event-full-description').value = lastEvent.fullDescription || '';
    document.getElementById('event-program-link').value = lastEvent.programLink || '';

    if (lastEvent.photos && lastEvent.photos.length > 0) {
      document.getElementById('event-photos').value = lastEvent.photos.join(', ');
    }

    // Встановлення дати на тиждень пізніше
    const eventDate = new Date(lastEvent.date);
    eventDate.setDate(eventDate.getDate() + 7);
    document.getElementById('event-date').value = eventDate.toISOString().slice(0, 16);

    this.showSuccess('Останню подію продубльовано');
  }

  /**
   * Очищення форми
   */
  clearForm() {
    const form = document.getElementById('event-form');
    if (form) {
      form.reset();
      this.clearFormData();

      // Очищення всіх помилок валідації
      form.querySelectorAll('.field-error').forEach(error => error.remove());
      form.querySelectorAll('input, textarea').forEach(field => {
        field.style.borderColor = '#e0e0e0';
        field.style.boxShadow = '';
      });
    }

    this.showInfo('Форму очищено');
  }

  /**
   * Утилітарні функції
   */

  /**
   * Дебаунсинг функції
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
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

  /**
   * Показ сучасних повідомлень замість alert
   */
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

    // Створення сповіщення
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const colors = {
      error: { bg: '#fee', border: '#e74c3c', text: '#c0392b' },
      success: { bg: '#efe', border: '#27ae60', text: '#1e8449' },
      info: { bg: '#e3f2fd', border: '#2196f3', text: '#1976d2' }
    };

    const color = colors[type] || colors.info;

    notification.style.cssText = `
            background: ${color.bg};
            border: 2px solid ${color.border};
            color: ${color.text};
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            font-weight: 500;
            position: relative;
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
        `;

    notification.innerHTML = `
            ${message}
            <span style="position: absolute; top: 5px; right: 10px; font-size: 18px; opacity: 0.6;">×</span>
        `;

    // Додавання стилів анімації
    if (!document.getElementById('notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'notification-styles';
      styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
      document.head.appendChild(styles);
    }

    // Додавання в контейнер
    container.appendChild(notification);

    // Автоматичне видалення
    const autoRemove = setTimeout(() => {
      this.removeNotification(notification);
    }, 5000);

    // Видалення по кліку
    notification.addEventListener('click', () => {
      clearTimeout(autoRemove);
      this.removeNotification(notification);
    });
  }

  /**
   * Видалення сповіщення
   */
  removeNotification(notification) {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

// Глобальна ініціалізація
let adminManager;

document.addEventListener('DOMContentLoaded', () => {
  adminManager = new AdminManager();
});

// Експорт для можливого використання як модуль
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminManager;
}