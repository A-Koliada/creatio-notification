// Conditional logging for debugging
const isDebug = true; // Set to false in production
function log(...args) {
  if (isDebug) console.log(...args);
}

log("✅ background.js started");

// Global state
const state = {
  creationEndpoint: "",
  openedNotifications: {},
  currentLanguage: "en",
  bringToFrontIntervalId: null
};

// Initialize extension
initializeExtension();

// Main initialization function
function initializeExtension() {
  loadSettings();
  setupMessageListeners();
  setupAlarms();
  checkContentScript();
}

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get({
    creatioUrl: "",
    bringToFrontInterval: 20,
    language: "en"
  }, (items) => {
    if (items.creatioUrl && items.creatioUrl.trim()) {
      state.creationEndpoint = items.creatioUrl.trim().replace(/\/$/, "");
      log("🔧 Loaded URL from settings:", state.creationEndpoint);
    }
    
    state.currentLanguage = items.language;
    startBringToFrontInterval(items.bringToFrontInterval);
    updateIcon(true);
  });
}

// Setup message listeners
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case "getNotifications":
        handleGetNotifications(sendResponse);
        return true;
      case "markAsRead":
        handleMarkAsRead(message.id, sendResponse);
        return true;
      case "markAllRead":
        handleMarkAllRead(sendResponse);
        return true;
      case "settingsUpdated":
        handleSettingsUpdate(message.settings);
        break;
      case "updateAuthStatus":
        updateIcon(message.authorized);
        break;
      case "languageChanged":
        handleLanguageChange(message.language);
        break;
      case "contentScriptReady":
        log("✅ Content script ready");
        break;
    }
    return false;
  });
}

// Setup alarms for periodic checks
function setupAlarms() {
  chrome.alarms.create("checkNotifications", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkNotifications") {
      fetchNotifications();
    }
  });
}

// Check if content script is injected
function checkContentScript() {
  chrome.tabs.query({ url: "*://*.creatio.com/*" }, (tabs) => {
    tabs.forEach(tab => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(err => log("⚠️ Content script injection error:", err));
    });
  });
}

// Handle get notifications request
async function handleGetNotifications(sendResponse) {
  try {
    const notifications = await fetchNotifications();
    sendResponse({ success: true, notifications });
  } catch (error) {
    log("❌ Error handling get notifications:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle mark as read request
async function handleMarkAsRead(notificationId, sendResponse) {
  try {
    await markNotificationAsRead(notificationId);
    sendResponse({ success: true });
  } catch (error) {
    log(`❌ Error marking ${notificationId} as read:`, error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle mark all read request
async function handleMarkAllRead(sendResponse) {
  try {
    await markAllNotificationsAsRead();
    sendResponse({ success: true });
  } catch (error) {
    log("❌ Error marking all as read:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle settings update
function handleSettingsUpdate(settings) {
  if (settings.creatioUrl && settings.creatioUrl.trim()) {
    state.creationEndpoint = settings.creatioUrl.trim().replace(/\/$/, "");
    log("🔧 Updated URL from settings:", state.creationEndpoint);
    updateIcon(true);
  }
  
  if (settings.language && settings.language !== state.currentLanguage) {
    state.currentLanguage = settings.language;
    log("🌐 Language changed to:", state.currentLanguage);
  }
  
  startBringToFrontInterval(settings.bringToFrontInterval);
}

// Handle language change
function handleLanguageChange(newLanguage) {
  state.currentLanguage = newLanguage;
  chrome.storage.sync.set({ language: newLanguage });
  log("🌐 Updated language to:", newLanguage);
}

// Fetch notifications from Creatio
async function fetchNotifications() {
  if (!state.creationEndpoint) {
    log("🚫 Creatio URL not set. Skipping notification fetch.");
    updateBadge(0);
    updateIcon(false);
    return [];
  }

  const url = `${state.creationEndpoint}/0/odata/ArkWebNotification?$filter=ArkIsRead eq false&$orderby=CreatedOn desc&$expand=ArkSysEntitySchema`;
  log("🌐 Fetching from Creatio:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json", 
        "Accept": "application/json" 
      },
      credentials: "include"
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    updateIcon(true);
    const data = await response.json();
    log("📩 Received data:", data);

    if (!data.value || data.value.length === 0) {
      updateBadge(0);
      return [];
    }

    updateBadge(data.value.length);
    const notifications = processNotificationData(data.value);
    
    sendNotificationsToPopup(notifications);
    openNotificationWindows(notifications);
    
    return notifications;
  } catch (error) {
    log("❌ Error fetching notifications:", error);
    updateBadge(0);
    updateIcon(false);
    throw error;
  }
}

// Process raw notification data
function processNotificationData(notifications) {
  const moduleMapping = {
    "Contact": "Contacts_FormPage",
    "Account": "Accounts_FormPage",
    "Lead": "Leads_FormPage",
    "Opportunity": "Opportunities_FormPage",
    "Case": "Cases_FormPage",
    "Activity": "Activities_FormPage",
    "Order": "Orders_FormPage",
    "Contract": "Contracts_FormPage"
  };

  return notifications.map(item => {
    const schemaName = item.ArkSysEntitySchema?.Name;
    const moduleCaption = moduleMapping[schemaName] || schemaName;
    const subjectId = item.ArkSubjectId;

    return {
      id: item.Id,
      title: item.ArkPopupTitle || item.ArkSubjectCaption || "Notification",
      message: item.ArkDescription || "No content",
      date: item.CreatedOn || new Date().toISOString(),
      url: moduleCaption && subjectId 
        ? `${state.creationEndpoint}/0/Shell/?autoOpenIdLogin=true#Card/${moduleCaption}/edit/${subjectId}`
        : ""
    };
  });
}

// Send notifications to popup
function sendNotificationsToPopup(notifications) {
  chrome.runtime.sendMessage({ 
    action: "updatePopup", 
    notifications: notifications 
  }).catch(err => log("⚠️ Error sending to popup:", err));
}

// Open notification windows
function openNotificationWindows(notifications) {
  notifications.forEach(notification => {
    if (notification.url && !state.openedNotifications[notification.id]) {
      openNotificationWindow(notification);
    }
  });
}

// Open single notification window
function openNotificationWindow(notification) {
  const params = new URLSearchParams({
    id: notification.id,
    title: encodeURIComponent(notification.title),
    message: encodeURIComponent(notification.message),
    date: encodeURIComponent(notification.date),
    url: encodeURIComponent(notification.url || ""),
    lang: state.currentLanguage
  });

  chrome.windows.create({
    url: `notification.html?${params.toString()}`,
    type: "popup",
    width: 400,
    height: 250,
    focused: true
  }, (newWindow) => {
    if (newWindow?.id) {
      state.openedNotifications[notification.id] = newWindow.id;
      log(`🔔 Opened popup for notification ${notification.id}`);
    }
  });
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
  log(`✅ Marking notification ${notificationId} as read`);
  const csrfToken = await getCsrfToken();
  
  const response = await fetch(`${state.creationEndpoint}/0/odata/ArkWebNotification(${notificationId})`, {
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
    throw new Error(`Server error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  log(`📩 Notification ${notificationId} marked as read`);
  closeNotificationWindow(notificationId);
  fetchNotifications();
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
  const notifications = await fetchNotifications();
  await Promise.all(notifications.map(n => markNotificationAsRead(n.id)));
  closeAllNotificationWindows();
}

// Close single notification window
function closeNotificationWindow(notificationId) {
  const winId = state.openedNotifications[notificationId];
  if (winId) {
    chrome.windows.remove(winId, () => {
      delete state.openedNotifications[notificationId];
      log(`🔒 Closed window for notification ${notificationId}`);
    });
  }
}

// Close all notification windows
function closeAllNotificationWindows() {
  Object.entries(state.openedNotifications).forEach(([notificationId, winId]) => {
    chrome.windows.remove(winId, () => {
      delete state.openedNotifications[notificationId];
    });
  });
}

// Get CSRF token
async function getCsrfToken() {
  if (!chrome.cookies) {
    log("❌ chrome.cookies API unavailable");
    return "";
  }

  if (!state.creationEndpoint) {
    log("⚠️ creationEndpoint not initialized");
    return "";
  }

  return new Promise(resolve => {
    chrome.cookies.get({ 
      url: state.creationEndpoint, 
      name: "BPMCSRF" 
    }, (cookie) => {
      if (cookie) {
        log("🔑 Retrieved BPMCSRF token");
        resolve(cookie.value);
      } else {
        log("⚠️ BPMCSRF token not found");
        resolve("");
      }
    });
  });
}

// Update extension icon
function updateIcon(status) {
  const iconPath = status ? "images/iconon" : "images/iconoff";
  chrome.action.setIcon({
    path: {
      "16": `${iconPath}-16.png`,
      "32": `${iconPath}-32.png`,
      "48": `${iconPath}-48.png`,
      "128": `${iconPath}-128.png`
    }
  });
}

// Update badge count
function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
}

// Start bring to front interval
function startBringToFrontInterval(intervalSeconds) {
  if (state.bringToFrontIntervalId) {
    clearInterval(state.bringToFrontIntervalId);
  }
  
  state.bringToFrontIntervalId = setInterval(() => {
    Object.entries(state.openedNotifications).forEach(([notificationId, winId]) => {
      chrome.windows.update(winId, { focused: true }, () => {
        if (chrome.runtime.lastError) {
          delete state.openedNotifications[notificationId];
        }
      });
    });
  }, intervalSeconds * 1000);
}

// Install handler
chrome.runtime.onInstalled.addListener(() => {
  log("🚀 Extension installed");
  fetchNotifications();
});

/*
*********************************
* A-Koliada 
* https://a-koliada.github.io/
*********************************
*/