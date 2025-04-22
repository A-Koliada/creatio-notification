
// Умовне логування для дебагінгу
const isDebug = true; // Встановити false у продакшені
function log(...args) {
  if (isDebug) console.log(...args);
}

log("✅ background.js запущено");

// Функція зміни іконки (on/off)
function updateIcon(status) {
  const onIcon = {
    "16": "images/icon-16.png",
    "32": "images/icon-32.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  };
  const offIcon = {
    "16": "images/icon-16.png",
    "32": "images/icon-32.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  };
  chrome.action.setIcon({ path: status ? onIcon : offIcon });
}

// Глобальні змінні
let creationEndpoint = "";
const openedNotifications = {};
let bringToFrontIntervalId = null;

// Функція для періодичного оновлення фокусу вікон
function startBringToFrontInterval(intervalSeconds) {
  if (bringToFrontIntervalId) {
    clearInterval(bringToFrontIntervalId);
  }
  bringToFrontIntervalId = setInterval(() => {
    for (const [notificationId, winId] of Object.entries(openedNotifications)) {
      chrome.windows.get(winId, {}, (window) => {
        if (chrome.runtime.lastError || !window) {
          log(`⚠️ Вікно ${winId} не існує, видаляємо з openedNotifications`);
          delete openedNotifications[notificationId];
        } else {
          chrome.windows.update(winId, { focused: true, drawAttention: true }, () => {
            log(`🔔 Вікно ${winId} переміщено на передній план`);
          });
        }
      });
    }
  }, intervalSeconds * 1000);
}

// Функція для отримання CSRF-токена
async function getCsrfToken() {
  if (!chrome.cookies) {
    log("❌ chrome.cookies API недоступне. Перевірте дозволи в manifest.json.");
    return "";
  }

  if (!creationEndpoint) {
    log("⚠️ creationEndpoint не ініціалізований.");
    return "";
  }

  return new Promise(resolve => {
    chrome.cookies.get({ url: creationEndpoint, name: "BPMCSRF" }, (cookie) => {
      if (cookie) {
        log("🔑 Отримано BPMCSRF token:", cookie.value);
        resolve(cookie.value);
      } else {
        log("⚠️ BPMCSRF token не знайдено для URL:", creationEndpoint);
        resolve("");
      }
    });
  });
}

// Отримання URL Creatio та інтервалу із налаштувань
chrome.storage.sync.get({
  creatioUrl: "",
  bringToFrontInterval: 20
}, (items) => {
  if (items.creatioUrl && items.creatioUrl.trim()) {
    creationEndpoint = items.creatioUrl.trim().replace(/\/$/, "");
    log("🔧 Отримано URL з налаштувань:", creationEndpoint);
    updateIcon(true);
  } else {
    log("⚠️ URL Creatio не задано в налаштуваннях.");
    updateIcon(false);
  }
  startBringToFrontInterval(items.bringToFrontInterval);
});

// Функція відправлення повідомлень до popup
function sendMessageToPopup(message) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      log("⚠️ Popup закритий, повідомлення не надіслано.");
    }
  });
}

// Функція відкриття спливаючого вікна
function openNotificationWindow(notification) {
  if (openedNotifications[notification.id]) {
    log(`ℹ️ Вікно для повідомлення ${notification.id} уже відкрите.`);
    return;
  }

  const params = new URLSearchParams({
    id: notification.id,
    title: encodeURIComponent(notification.title),
    message: encodeURIComponent(notification.message),
    date: encodeURIComponent(notification.date),
    url: encodeURIComponent(notification.url)
  });

  chrome.windows.create({
    url: `notification.html?${params.toString()}`,
    type: "popup",
    width: 400,
    height: 250,
    top: 100,
    left: 100,
    focused: true
  }, (newWindow) => {
    if (newWindow && newWindow.id) {
      chrome.windows.update(newWindow.id, { focused: true, drawAttention: true });
      openedNotifications[notification.id] = newWindow.id;
      log(`🔔 Відкрито спливаюче вікно для повідомлення ${notification.id}, windowId: ${newWindow.id}`);
    }
  });
}

// Функція отримання сповіщень
async function fetchNotifications() {
  if (!creationEndpoint) {
    log("🚫 URL Creatio не задано. Пропускаємо запит сповіщень.");
    updateBadge(0);
    return [];
  }

  const url = `${creationEndpoint}/0/odata/ArkWebNotification?$filter=ArkIsRead eq false&$orderby=CreatedOn desc&$expand=ArkSysEntitySchema`;
  log("🌐 Виконання запиту до Creatio:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "include"
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Сервер повернув статус: ${response.status} ${response.statusText}. Деталі: ${errorText}`);
      updateIcon(false);
      throw new Error(`Сервер повернув статус: ${response.status} ${response.statusText}`);
    }

    updateIcon(true);
    const data = await response.json();
    log("📩 Отримані дані:", data);

    if (!data.value || data.value.length === 0) {
      updateBadge(0);
      return [];
    }

    updateBadge(data.value.length);

    const moduleMapping = {
      "Contact": "Contacts_FormPage",
      "Account": "Accounts_FormPage",
      "Lead": "Leads_FormPage",
      "Opportunity": "Opportunities_FormPage",
      "Case": "Cases_FormPage",
      "Activity": "Activities_FormPage"
    };

    const notifications = data.value.map(item => {
      const schemaName = item.ArkSysEntitySchema?.Name;
      const moduleCaption = moduleMapping[schemaName] || schemaName;
      const subjectId = item.ArkSubjectId;

      if (!moduleCaption || !subjectId) {
        log(`⚠️ Некоректні дані для повідомлення ${item.Id}: ModuleCaption=${moduleCaption}, SubjectId=${subjectId}, ArkSysEntitySchema=`, item.ArkSysEntitySchema);
        return {
          id: item.Id,
          title: item.ArkPopupTitle || item.ArkSubjectCaption || "Нове сповіщення",
          message: item.ArkDescription || "Без тексту",
          date: item.CreatedOn || "Невідома дата",
          url: "" // Повертаємо порожній URL, якщо немає коректних даних
        };
      }

      return {
        id: item.Id,
        title: item.ArkPopupTitle || item.ArkSubjectCaption || "Нове сповіщення",
        message: item.ArkDescription || "Без тексту",
        date: item.CreatedOn || "Невідома дата",
        url: `${creationEndpoint}/0/Shell/?autoOpenIdLogin=true#Card/${moduleCaption}/edit/${subjectId}`
      };
    }).filter(notification => notification.url); // Фільтруємо сповіщення без URL

    sendMessageToPopup({ action: "updatePopup", notifications: notifications });

    notifications.forEach((notification) => {
      openNotificationWindow(notification);
    });

    return notifications;
  } catch (error) {
    log("❌ Помилка отримання сповіщень:", error.message);
    updateBadge(0);
    return [];
  }
}

// Функція оновлення бейджа
function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
}

// Функція позначення всіх повідомлень як прочитаних
async function markAllNotificationsAsRead() {
  const notifications = await fetchNotifications();
  for (const notification of notifications) {
    await markNotificationAsRead(notification.id);
  }
}

// Функція позначення повідомлення як прочитаного
async function markNotificationAsRead(notificationId) {
  log(`✅ Позначаємо повідомлення ${notificationId} як прочитане`);
  try {
    const csrfToken = await getCsrfToken();
    const response = await fetch(`${creationEndpoint}/0/odata/ArkWebNotification(${notificationId})`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "BPMCSRF": csrfToken || ""
      },
      credentials: "include",
      body: JSON.stringify({ ArkIsRead: true })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Помилка сервера: ${response.status} ${response.statusText}. Деталі: ${errorText}`);
    }

    log(`📩 Повідомлення ${notificationId} позначене як прочитане`);
    fetchNotifications();
    sendMessageToPopup({ action: "updatePopup" });
  } catch (error) {
    log(`❌ Помилка при позначенні ${notificationId}:`, error.message);
  }
}

// Обробка повідомлень від popup.js та options.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getNotifications") {
    fetchNotifications().then((notifications) => {
      sendResponse({ success: true, notifications: notifications });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.action === "markAsRead") {
    markNotificationAsRead(message.id).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.action === "markAllRead") {
    markAllNotificationsAsRead().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.action === "settingsUpdated") {
    const { creatioUrl, bringToFrontInterval } = message.settings;
    if (creatioUrl && creatioUrl.trim()) {
      creationEndpoint = creatioUrl.trim().replace(/\/$/, "");
      log("🔧 Оновлено URL з налаштувань:", creationEndpoint);
      updateIcon(true);
    } else {
      log("⚠️ URL Creatio не задано.");
      updateIcon(false);
    }
    startBringToFrontInterval(bringToFrontInterval);
    return false;
  }

  return false;
});

// Запуск перевірки сповіщень
chrome.runtime.onInstalled.addListener(() => {
  log("🚀 Розширення встановлено. Запуск перевірки сповіщень...");
  fetchNotifications();
});

// Автоматичне оновлення сповіщень кожні 30 секунд
chrome.alarms.create("checkNotifications", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkNotifications") {
    fetchNotifications();
  }
});
