console.log("✅ background.js запущено");

// Функція зміни іконки (on/off)
function updateIcon(status) {
  const onIcon = {
    "16": "images/iconon-16.png",
    "48": "images/iconon-48.png",
    "128": "images/iconon-128.png"
  };
  const offIcon = {
    "16": "images/iconoff-16.png",
    "48": "images/iconoff-48.png",
    "128": "images/iconoff-128.png"
  };
  chrome.action.setIcon({ path: status ? onIcon : offIcon });
}

// Глобальні змінні
let creationEndpoint = "";
const openedNotifications = {}; // Збереження ID відкритих спливаючих вікон

// Функція для отримання CSRF-токена
async function getCsrfToken() {
  return new Promise(resolve => {
    chrome.cookies.get({ url: creationEndpoint, name: "BPMCSRF" }, (cookie) => {
      if (cookie) {
        resolve(cookie.value);
      } else {
        console.warn("⚠️ BPMCSRF token not found");
        resolve("");
      }
    });
  });
}

// Отримання URL Creatio із налаштувань
chrome.storage.sync.get({ creatioUrl: "" }, (items) => {
  if (items.creatioUrl && items.creatioUrl.trim()) {
    creationEndpoint = items.creatioUrl.trim();
    console.log("🔧 Отримано URL з налаштувань:", creationEndpoint);
    updateIcon(true);
  } else {
    console.warn("⚠️ URL Creatio не задано в налаштуваннях.");
    updateIcon(false);
  }
});

// Функція відправлення повідомлень до popup з перевіркою
function sendMessageToPopup(message) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("⚠️ Popup закритий, повідомлення не надіслано.");
    }
  });
}

// Функція відкриття спливаючого вікна для повідомлення
function openNotificationWindow(notification) {
  if (openedNotifications[notification.id]) {
    console.log(`ℹ️ Вікно для повідомлення ${notification.id} уже відкрите.`);
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
      openedNotifications[notification.id] = newWindow.id;
      console.log(`🔔 Відкрито спливаюче вікно для повідомлення ${notification.id}, windowId: ${newWindow.id}`);
      chrome.windows.update(newWindow.id, { focused: true });
    }
  });
}

// Функція отримання сповіщень з Creatio
async function fetchNotifications() {
  if (!creationEndpoint) {
    console.warn("🚫 Не задано URL Creatio.");
    updateBadge(0);
    return [];
  }
  
  const url = `${creationEndpoint}/0/odata/UsrNotification?$filter=UsrisRead eq false&$orderby=CreatedOn desc`;
  console.log("🌐 Виконання запиту до Creatio:", url);
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "include"
    });
    
    if (!response.ok) {
      updateIcon(false);
      throw new Error(`Сервер повернув статус: ${response.status} ${response.statusText}`);
    }
    
    updateIcon(true);
    const data = await response.json();
    console.log("📩 Отримані дані:", data);
    
    if (!data.value || data.value.length === 0) {
      updateBadge(0);
      return [];
    }
    
    updateBadge(data.value.length);
    
    const notifications = data.value.map(item => ({
      id: item.Id,
      title: item.UsrTitle || "Нове сповіщення",
      message: item.Usrmessage || "Без тексту",
      date: item.CreatedOn || "Невідома дата",
      url: `${creationEndpoint}/0/Shell/?autoOpenIdLogin=true#Card/Contacts_FormPage/edit/${item.UsrContactId}`
    }));
    
    sendMessageToPopup({ action: "updatePopup", notifications: notifications });
    
    // Відкриваємо спливаючі вікна для нових повідомлень
    notifications.forEach((notification) => {
      openNotificationWindow(notification);
    });
    
    return notifications;
  } catch (error) {
    console.error("❌ Помилка отримання сповіщень:", error.message);
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
  console.log(`✅ Позначаємо повідомлення ${notificationId} як прочитане`);
  try {
    const csrfToken = await getCsrfToken();
    const response = await fetch(`${creationEndpoint}/0/odata/UsrNotification(${notificationId})`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "BPMCSRF": csrfToken
      },
      credentials: "include",
      body: JSON.stringify({ UsrisRead: true })
    });
    
    if (!response.ok) {
      throw new Error(`Помилка сервера: ${response.status}`);
    }
    
    console.log(`📩 Повідомлення ${notificationId} позначене як прочитане`);
    fetchNotifications();
    sendMessageToPopup({ action: "updatePopup" });
  } catch (error) {
    console.error(`❌ Помилка при позначенні ${notificationId}:`, error);
  }
}

// Обробка повідомлень від popup.js
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
  
  return false;
});

// Запуск перевірки сповіщень при встановленні розширення
chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Розширення встановлено. Запуск перевірки сповіщень...");
  fetchNotifications();
});

// Автоматичне оновлення кожні 30 секунд
chrome.alarms.create("checkNotifications", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkNotifications") {
    fetchNotifications();
  }
});
