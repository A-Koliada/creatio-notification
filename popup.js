
// Conditional logging for debugging
const isDebug = true; // Set to false in production
function log(...args) {
  if (isDebug) console.log(...args);
}

document.addEventListener("DOMContentLoaded", function () {
  getNotifications();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updatePopup") {
      displayNotifications(message.notifications);
    }
  });

  // Handle "Settings" button
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", function () {
      chrome.runtime.openOptionsPage();
    });
  } else {
    log("❌ 'Settings' button not found!");
  }

  // Handle "Refresh" button
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      getNotifications();
    });
  } else {
    log("❌ 'Refresh' button not found!");
  }

  // Handle "Mark All Read" button
  const markAllReadBtn = document.getElementById("markAllReadBtn");
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", function () {
      chrome.runtime.sendMessage({ action: "markAllRead" }, (response) => {
        if (response && response.success) {
          getNotifications();
        } else {
          log("❌ Error marking all as read:", response?.error);
        }
      });
    });
  } else {
    log("❌ 'Mark All Read' button not found!");
  }
});

function getNotifications() {
  chrome.runtime.sendMessage({ action: "getNotifications" }, function (response) {
    if (response && response.success) {
      displayNotifications(response.notifications);
    } else {
      log("❌ Error fetching notifications:", response?.error);
    }
  });
}

function displayNotifications(notifications) {
  const container = document.getElementById("notifications");
  container.innerHTML = "";

  if (!Array.isArray(notifications) || notifications.length === 0) {
    container.innerHTML = "<p>Немає нових повідомлень.</p>";
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.classList.add("notification-item", "clickable-container");
    item.innerHTML = `
      <strong>${notification.title}</strong>
      <p>${notification.message}</p>
      <span class="notification-date">${new Date(notification.date).toLocaleString()}</span>
      ${notification.url ? `<a href="${notification.url}" class="notification-link" target="_blank">Перейти до запису</a>` : ''}
      <button class="mark-read" data-id="${notification.id}">Прочитано</button>
    `;
    container.appendChild(item);

    // Handle "Mark as Read" button
    item.querySelector(".mark-read").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      markAsRead(notification.id);
    });

    // Handle item click (excluding buttons and links)
    item.addEventListener("click", function (e) {
      if (!e.target.classList.contains("mark-read") && !e.target.classList.contains("notification-link") && notification.url) {
        log(`🖱️ Notification clicked, opening URL: ${notification.url}`);
        window.open(notification.url, "_blank");
        markAsRead(notification.id);
      }
    });
  });
}

function markAsRead(notificationId) {
  chrome.runtime.sendMessage({ action: "markAsRead", id: notificationId }, function (response) {
    if (response && response.success) {
      getNotifications();
    } else {
      log("❌ Error marking as read:", response?.error);
    }
  });
}