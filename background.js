// Conditional logging for debugging
const isDebug = true; // Set to false in production
function log(...args) {
  if (isDebug) console.log(...args);
}

log("✅ background.js started");

// Function to update extension icon (on/off)
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

// Global variables
let creationEndpoint = "";
const openedNotifications = {};
let bringToFrontIntervalId = null;

// Function to periodically bring notification windows to front
function startBringToFrontInterval(intervalSeconds) {
  if (bringToFrontIntervalId) {
    clearInterval(bringToFrontIntervalId);
  }
  bringToFrontIntervalId = setInterval(() => {
    for (const [notificationId, winId] of Object.entries(openedNotifications)) {
      chrome.windows.get(winId, {}, (window) => {
        if (chrome.runtime.lastError || !window) {
          log(`⚠️ Window ${winId} does not exist, removing from openedNotifications`);
          delete openedNotifications[notificationId];
        } else {
          chrome.windows.update(winId, { focused: true, drawAttention: true }, () => {
            log(`🔔 Window ${winId} brought to front`);
          });
        }
      });
    }
  }, intervalSeconds * 1000);
}

// Function to retrieve CSRF token
async function getCsrfToken() {
  if (!chrome.cookies) {
    log("❌ chrome.cookies API unavailable. Check permissions in manifest.json.");
    return "";
  }

  if (!creationEndpoint) {
    log("⚠️ creationEndpoint not initialized.");
    return "";
  }

  return new Promise(resolve => {
    chrome.cookies.get({ url: creationEndpoint, name: "BPMCSRF" }, (cookie) => {
      if (cookie) {
        log("🔑 Retrieved BPMCSRF token:", cookie.value);
        resolve(cookie.value);
      } else {
        log("⚠️ BPMCSRF token not found for URL:", creationEndpoint);
        resolve("");
      }
    });
  });
}

// Load Creatio URL and interval from storage
chrome.storage.sync.get({
  creatioUrl: "",
  bringToFrontInterval: 20
}, (items) => {
  if (items.creatioUrl && items.creatioUrl.trim()) {
    creationEndpoint = items.creatioUrl.trim().replace(/\/$/, "");
    log("🔧 Loaded URL from settings:", creationEndpoint);
    updateIcon(true);
  } else {
    log("⚠️ Creatio URL not set in settings.");
    updateIcon(false);
  }
  startBringToFrontInterval(items.bringToFrontInterval);
});

// Function to send messages to popup
function sendMessageToPopup(message) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      log("⚠️ Popup closed, message not sent.");
    }
  });
}

// Function to open notification window
function openNotificationWindow(notification) {
  if (openedNotifications[notification.id]) {
    log(`ℹ️ Window for notification ${notification.id} already open.`);
    return;
  }

  const params = new URLSearchParams({
    id: notification.id,
    title: encodeURIComponent(notification.title),
    message: encodeURIComponent(notification.message),
    date: encodeURIComponent(notification.date),
    url: encodeURIComponent(notification.url || "")
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
      log(`🔔 Opened popup window for notification ${notification.id}, windowId: ${newWindow.id}`);
    }
  });
}

// Function to fetch notifications
async function fetchNotifications() {
  if (!creationEndpoint) {
    log("🚫 Creatio URL not set. Skipping notification fetch.");
    updateBadge(0);
    return [];
  }

  const url = `${creationEndpoint}/0/odata/ArkWebNotification?$filter=ArkIsRead eq false&$orderby=CreatedOn desc&$expand=ArkSysEntitySchema`;
  log("🌐 Fetching from Creatio:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "include"
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Server returned status: ${response.status} ${response.statusText}. Details: ${errorText}`);
      updateIcon(false);
      throw new Error(`Server returned status: ${response.status} ${response.statusText}`);
    }

    updateIcon(true);
    const data = await response.json();
    log("📩 Received data:", data);

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
      "Activity": "Activities_FormPage",
      "Order": "Orders_FormPage",
      "Contract": "Contracts_FormPage"
    };

    const notifications = data.value.map(item => {
      const schemaName = item.ArkSysEntitySchema?.Name;
      const moduleCaption = moduleMapping[schemaName] || schemaName;
      const subjectId = item.ArkSubjectId;

      if (!moduleCaption || !subjectId) {
        log(`⚠️ Invalid data for notification ${item.Id}: ModuleCaption=${moduleCaption}, SubjectId=${subjectId}, ArkSysEntitySchema=`, item.ArkSysEntitySchema);
        return {
          id: item.Id,
          title: item.ArkPopupTitle || item.ArkSubjectCaption || "Нове сповіщення",
          message: item.ArkDescription || "Без тексту",
          date: item.CreatedOn || "Невідома дата",
          url: ""
        };
      }

      return {
        id: item.Id,
        title: item.ArkPopupTitle || item.ArkSubjectCaption || "Нове сповіщення",
        message: item.ArkDescription || "Без тексту",
        date: item.CreatedOn || "Невідома дата",
        url: `${creationEndpoint}/0/Shell/?autoOpenIdLogin=true#Card/${moduleCaption}/edit/${subjectId}`
      };
    });

    sendMessageToPopup({ action: "updatePopup", notifications: notifications });

    notifications.forEach((notification) => {
      if (notification.url) {
        openNotificationWindow(notification);
      }
    });

    return notifications;
  } catch (error) {
    log("❌ Error fetching notifications:", error.message);
    updateBadge(0);
    return [];
  }
}

// Function to update badge
function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
}

// Function to mark all notifications as read and close their windows
async function markAllNotificationsAsRead() {
  const notifications = await fetchNotifications();
  for (const notification of notifications) {
    await markNotificationAsRead(notification.id);
  }
  // Close all open notification windows
  for (const [notificationId, winId] of Object.entries(openedNotifications)) {
    chrome.windows.remove(winId, () => {
      if (chrome.runtime.lastError) {
        log(`⚠️ Could not close window ${winId}: ${chrome.runtime.lastError.message}`);
      } else {
        log(`🔒 Closed window ${winId} for notification ${notificationId}`);
      }
      delete openedNotifications[notificationId];
    });
  }
}

// Function to mark a single notification as read
async function markNotificationAsRead(notificationId) {
  log(`✅ Marking notification ${notificationId} as read`);
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
      throw new Error(`Server error: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    log(`📩 Notification ${notificationId} marked as read`);
    fetchNotifications();
    sendMessageToPopup({ action: "updatePopup" });
  } catch (error) {
    log(`❌ Error marking ${notificationId} as read:`, error.message);
  }
}

// Handle messages from popup.js and options.js
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
      log("🔧 Updated URL from settings:", creationEndpoint);
      updateIcon(true);
    } else {
      log("⚠️ Creatio URL not set.");
      updateIcon(false);
    }
    startBringToFrontInterval(bringToFrontInterval);
    return false;
  }

  return false;
});

// Start checking notifications on extension install
chrome.runtime.onInstalled.addListener(() => {
  log("🚀 Extension installed. Starting notification check...");
  fetchNotifications();
});

// Schedule periodic notification checks
chrome.alarms.create("checkNotifications", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkNotifications") {
    fetchNotifications();
  }
});