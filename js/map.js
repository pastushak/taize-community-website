// Клас для роботи з картою
class MapManager {
  constructor() {
    this.map = null;
    this.markers = [];
    this.init();
  }

  // Ініціалізація карти
  init() {
    // Центр карти - приблизно між західними областями України
    const centerLat = 49.0;
    const centerLng = 24.5;

    this.map = L.map('map').setView([centerLat, centerLng], 8);

    // Додавання шару OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(this.map);

    // Додавання кастомних стилів для попапів
    this.addCustomStyles();

    // Збереження посилання на інстанс карти глобально
    window.mapInstance = this;
  }

  // Додавання кастомних стилів
  addCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
            .leaflet-popup-content-wrapper {
                border-radius: 10px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            }
            .leaflet-popup-content {
                margin: 15px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .leaflet-popup-tip {
                background: white;
            }
        `;
    document.head.appendChild(style);
  }

  // Відображення подій на карті
  displayEventsOnMap() {
    // Очищення існуючих маркерів
    this.clearMarkers();

    if (!app || !app.events) return;

    // Додавання маркерів для кожної події
    app.events.forEach(event => {
      this.addEventMarker(event);
    });

    // Автоматичне підлаштування масштабу карти під всі маркери
    if (this.markers.length > 0) {
      const group = new L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // Додавання маркера для події
  addEventMarker(event) {
    // Перевірка валідності координат
    if (isNaN(event.lat) || isNaN(event.lng)) {
      console.warn(`Неправильні координати для події: ${event.title}`);
      return;
    }

    // Створення кастомної іконки
    const customIcon = this.createCustomIcon(event);

    // Створення маркера
    const marker = L.marker([event.lat, event.lng], { icon: customIcon })
      .addTo(this.map);

    // Створення контенту попапа
    const popupContent = this.createPopupContent(event);

    // Прив'язка попапа до маркера
    marker.bindPopup(popupContent, {
      maxWidth: 350,
      className: 'custom-popup'
    });

    // Додавання обробників подій
    marker.on('click', () => {
      // Центрування карти на маркері при кліку
      this.map.setView([event.lat, event.lng], Math.max(this.map.getZoom(), 12));
    });

    this.markers.push(marker);
  }

  // Створення кастомної іконки для маркера
  createCustomIcon(event) {
    // Визначення кольору іконки залежно від дати події
    const eventDate = new Date(event.date);
    const now = new Date();
    const isPastEvent = eventDate < now;

    const iconColor = isPastEvent ? '#95a5a6' : '#667eea';

    return L.divIcon({
      className: 'custom-marker',
      html: `
                <div style="
                    background: ${iconColor};
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    position: relative;
                ">
                    ✟
                    ${!isPastEvent ? '<div style="position: absolute; top: -5px; right: -5px; background: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>' : ''}
                </div>
            `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });
  }

  // Створення контенту попапа
  createPopupContent(event) {
    const eventDate = new Date(event.date);
    const now = new Date();
    const isPastEvent = eventDate < now;

    return `
            <div class="event-popup">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; flex: 1;">${event.title}</h3>
                    ${!isPastEvent ? '<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">МАЙБУТНЯ</span>' : ''}
                </div>
                
                <div class="date" style="color: ${isPastEvent ? '#95a5a6' : '#667eea'}; font-weight: bold; margin-bottom: 8px;">
                    📅 ${this.formatDateForPopup(event.date)}
                </div>
                
                <div style="margin-bottom: 8px;">
                    📍 <strong>${event.location}</strong>
                </div>
                
                <div class="description" style="margin-bottom: 10px; line-height: 1.4; color: #34495e;">
                    ${event.description}
                </div>
                
                ${event.photos && event.photos.length > 0 ?
        `<div class="photos" style="margin: 10px 0;">
                        ${event.photos.slice(0, 3).map((photo, index) =>
          `<img src="${photo}" 
                                  alt="Фото події ${index + 1}" 
                                  onclick="app.openImageModal('${photo}')"
                                  style="width: 70px; height: 50px; object-fit: cover; border-radius: 5px; margin-right: 5px; cursor: pointer; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
                                  onerror="this.style.display='none'">`
        ).join('')}
                        ${event.photos.length > 3 ? `<span style="font-size: 12px; color: #7f8c8d;">+${event.photos.length - 3} ще</span>` : ''}
                    </div>` : ''
      }
                
                <div style="margin-top: 10px; text-align: center;">
                    <button class="view-details" onclick="app.showEventDetails(${event.id})" 
                            style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; border: none; padding: 8px 16px; border-radius: 15px; cursor: pointer; font-size: 12px; font-weight: 500;">
                        📖 Детальніше
                    </button>
                </div>
            </div>
        `;
  }

  // Форматування дати для попапа
  formatDateForPopup(dateString) {
    const date = new Date(dateString);
    const options = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleString('uk-UA', options);
  }

  // Очищення всіх маркерів
  clearMarkers() {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers = [];
  }

  // Додавання маркера для нової події (використовується в адмін-панелі)
  addTemporaryMarker(lat, lng) {
    // Видалити попередній тимчасовий маркер, якщо є
    if (this.tempMarker) {
      this.map.removeLayer(this.tempMarker);
    }

    // Створити новий тимчасовий маркер
    this.tempMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'temp-marker',
        html: `
                    <div style="
                        background: #e74c3c;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                        animation: pulse 1.5s infinite;
                    "></div>
                    <style>
                        @keyframes pulse {
                            0% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.2); opacity: 0.7; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    </style>
                `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(this.map);

    // Центрувати карту на новому маркері
    this.map.setView([lat, lng], Math.max(this.map.getZoom(), 12));
  }

  // Видалення тимчасового маркера
  removeTempMarker() {
    if (this.tempMarker) {
      this.map.removeLayer(this.tempMarker);
      this.tempMarker = null;
    }
  }

  // Отримання координат по кліку на карту
  enableLocationPicking(callback) {
    this.map.once('click', (e) => {
      const { lat, lng } = e.latlng;
      this.addTemporaryMarker(lat, lng);
      callback(lat, lng);
    });

    // Змінити курсор на хрестик
    this.map.getContainer().style.cursor = 'crosshair';

    // Повідомлення користувачу
    const notification = L.popup()
      .setLatLng(this.map.getCenter())
      .setContent('Клікніть на карту для вибору місця події')
      .openOn(this.map);

    setTimeout(() => {
      this.map.closePopup(notification);
      this.map.getContainer().style.cursor = '';
    }, 3000);
  }

  // Пошук місця за назвою (використовує Nominatim API)
  async searchLocation(query) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ua`
      );
      const results = await response.json();

      if (results.length > 0) {
        const result = results[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        this.map.setView([lat, lng], 15);
        this.addTemporaryMarker(lat, lng);

        return { lat, lng, display_name: result.display_name };
      } else {
        throw new Error('Місце не знайдено');
      }
    } catch (error) {
      console.error('Помилка пошуку:', error);
      alert('Не вдалося знайти зазначене місце. Спробуйте інший запит.');
      return null;
    }
  }

  // Отримання поточних меж карти
  getBounds() {
    return this.map.getBounds();
  }

  // Встановлення меж карти
  setBounds(bounds) {
    this.map.fitBounds(bounds);
  }
}

// Ініціалізація карти після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  // Невелика затримка для гарантії, що DOM повністю завантажений
  setTimeout(() => {
    new MapManager();
  }, 100);
});