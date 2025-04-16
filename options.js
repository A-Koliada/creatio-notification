document.addEventListener('DOMContentLoaded', function() {
  // Елементи DOM t
  const refreshIntervalInput = document.getElementById('refreshInterval');
  const notificationTimeoutTypeSelect = document.getElementById('notificationTimeoutType');
  const timeoutValueGroup = document.getElementById('timeoutValueGroup');
  const notificationTimeoutInput = document.getElementById('notificationTimeout');
  const creatioUrlInput = document.getElementById('creatioUrl');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusElement = document.getElementById('status');
  

  const readButton = document.createElement("button");
  readButton.classList.add("mark-read"); // ✅ Переконайся, що цей клас не змінений
  readButton.textContent = "Прочитано";
  


  // Завантаження збережених налаштувань
  loadOptions();
  
  // Обробники подій
  notificationTimeoutTypeSelect.addEventListener('change', toggleTimeoutValueVisibility);
  saveBtn.addEventListener('click', saveOptions);
  resetBtn.addEventListener('click', resetOptions);
  
  // Завантаження налаштувань
  function loadOptions() {
    chrome.storage.sync.get({
      refreshInterval: 10,
      notificationTimeout: 0,
      creatioUrl: ''
    }, function(items) {
      refreshIntervalInput.value = items.refreshInterval;
      
      if (items.notificationTimeout > 0) {
        notificationTimeoutTypeSelect.value = 'auto';
        notificationTimeoutInput.value = items.notificationTimeout;
        timeoutValueGroup.style.display = 'block';
      } else {
        notificationTimeoutTypeSelect.value = 'manual';
        notificationTimeoutInput.value = 5; // Значення за замовчуванням
        timeoutValueGroup.style.display = 'none';
      }
      
      creatioUrlInput.value = items.creatioUrl;
    });
  }
  
  // Відображення/приховування поля для введення часу автозакриття повідомлень
  function toggleTimeoutValueVisibility() {
    if (notificationTimeoutTypeSelect.value === 'auto') {
      timeoutValueGroup.style.display = 'block';
    } else {
      timeoutValueGroup.style.display = 'none';
    }
  }
  
  // Збереження налаштувань
  function saveOptions() {
    // Перевірка мінімального значення оновлення
    const refreshInterval = Math.max(10, parseInt(refreshIntervalInput.value));
    
    // Значення для часу відображення повідомлень
    let notificationTimeout = 0; // За замовчуванням - не закривати автоматично
    
    if (notificationTimeoutTypeSelect.value === 'auto') {
      notificationTimeout = parseInt(notificationTimeoutInput.value);
      
      // Перевірка коректності значення
      if (isNaN(notificationTimeout) || notificationTimeout < 1) {
        notificationTimeout = 5; // Значення за замовчуванням
      }
    }
    
    // URL Creatio
    const creatioUrl = creatioUrlInput.value.trim();
    
    // Збереження налаштувань
    chrome.storage.sync.set({
      refreshInterval: refreshInterval,
      notificationTimeout: notificationTimeout,
      creatioUrl: creatioUrl
    }, function() {
      // Відображення повідомлення про успішне збереження
      showStatus('Налаштування збережено', 'success');
      
      // Встановлення актуальних значень в полях форми
      refreshIntervalInput.value = refreshInterval;
      
      if (notificationTimeout > 0) {
        notificationTimeoutTypeSelect.value = 'auto';
        notificationTimeoutInput.value = notificationTimeout;
        timeoutValueGroup.style.display = 'block';
      } else {
        notificationTimeoutTypeSelect.value = 'manual';
        timeoutValueGroup.style.display = 'none';
      }
      
      // Повідомлення background script про зміну налаштувань
      chrome.runtime.sendMessage({
        action: "settingsUpdated",
        settings: {
          refreshInterval: refreshInterval,
          notificationTimeout: notificationTimeout,
          creatioUrl: creatioUrl
        }
      });
    });
  }
  
  // Скидання налаштувань до стандартних
  function resetOptions() {
    const defaultSettings = {
      refreshInterval: 10,
      notificationTimeout: 0,
      creatioUrl: ''
    };
    
    // Збереження налаштувань за замовчуванням
    chrome.storage.sync.set(defaultSettings, function() {
      // Оновлення інтерфейсу
      refreshIntervalInput.value = defaultSettings.refreshInterval;
      notificationTimeoutTypeSelect.value = 'manual';
      notificationTimeoutInput.value = 5;
      timeoutValueGroup.style.display = 'none';
      creatioUrlInput.value = '';
      
      // Відображення повідомлення про успішне скидання
      showStatus('Налаштування скинуто до стандартних', 'success');
      
      // Повідомлення background script про зміну налаштувань
      chrome.runtime.sendMessage({
        action: "settingsUpdated",
        settings: defaultSettings
      });
    });
  }
  
  // Відображення статусного повідомлення
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    
    // Автоматичне приховування повідомлення через 3 секунди
    setTimeout(function() {
      statusElement.textContent = '';
      statusElement.className = 'status';
    }, 3000);
  }
});




async function fetchNotifications() {
  if (!isAuthorized || !creationEndpoint || !currentUserId) {
    console.warn("🚫 Не авторизовано або немає ID користувача.");
    updateBadge(0);
    return [];
  }

  const url = `${creationEndpoint}/0/odata/UsrNotification?$filter=UsrisRead eq false&$orderby=CreatedOn desc`;

  console.log("🌐 Виконання запиту до Creatio:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include" // Важливо для авторизації через cookies
    });

    if (!response.ok) {
      throw new Error(`Сервер повернув статус: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("📩 Отримані дані:", data);

    if (!data.value || data.value.length === 0) {
      console.warn("⚠️ Немає нових сповіщень.");
      updateBadge(0);
      return [];
    }

    updateBadge(data.value.length);

    data.value.forEach((notification) => {
      openNotificationWindow({
        id: notification.Id,
        title: notification.UsrTitle || "Нове сповіщення",
        message: notification.Usrmessage || "Без тексту",
        date: notification.CreatedOn,
        url: `${creationEndpoint}/0/Shell/?autoOpenIdLogin=true#Card/Contacts_FormPage/edit/${notification.UsrContactId}`
      });
    });

  } catch (error) {
    console.error("❌ Помилка отримання сповіщень:", error.message);
    if (error.message.includes("Failed to fetch")) {
      console.warn("🔴 Сервер недоступний або CORS блокує запит.");
    }
    updateBadge(0);
  }
}
