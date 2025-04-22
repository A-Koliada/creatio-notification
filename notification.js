// Conditional logging for debugging
const isDebug = true; // Set to false in production
function log(...args) {
  if (isDebug) console.log(...args);
}

document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const title = decodeURIComponent(params.get("title"));
  const message = decodeURIComponent(params.get("message"));
  const date = decodeURIComponent(params.get("date"));
  const url = decodeURIComponent(params.get("url") || "");

  document.getElementById("notification-title").textContent = title;
  document.getElementById("notification-message").textContent = message;
  document.getElementById("notification-date").textContent = date;

  // Handle link display
  const linkElement = document.getElementById("notification-link");
  if (url) {
    linkElement.href = url;
    linkElement.textContent = "Перейти до запису";
    linkElement.style.display = "block";
    log(`✅ Link for notification ${id}: ${url}`);
  } else {
    linkElement.style.display = "none";
    log(`⚠️ No valid URL for notification ${id}`);
  }

  // Load settings for auto-close
  chrome.storage.sync.get({ notificationTimeout: 0 }, (settings) => {
    if (settings.notificationTimeout > 0) {
      log(`🕒 Auto-close enabled, closing after ${settings.notificationTimeout} seconds.`);
      setTimeout(() => {
        log("🔒 Closing popup automatically.");
        window.close();
      }, settings.notificationTimeout * 1000);
    } else {
      log("ℹ️ Auto-close disabled. Manual close required.");
    }
  });

  // Handle "Close" button
  const closeBtn = document.getElementById("closeWindow");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      log("🔒 'Close' button clicked.");
      window.close();
    });
  } else {
    log("⚠️ 'Close' button not found.");
  }

  // Handle "Mark as Read" button
  const markBtn = document.getElementById("markAsRead");
  if (markBtn) {
    markBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      log(`✅ 'Mark as Read' clicked for notification ID: ${id}`);
      chrome.runtime.sendMessage({ action: "markAsRead", id: id }, () => {
        window.close();
      });
    });
  } else {
    log("⚠️ 'Mark as Read' button not found.");
  }

  // Handle container click (excluding buttons and links)
  const container = document.querySelector(".notification-container");
  if (container) {
    container.addEventListener("click", function (e) {
      if (!e.target.closest("button") && !e.target.closest("a") && url) {
        log(`🖱️ Notification clicked, opening URL: ${url}`);
        window.open(url, "_blank");
        chrome.runtime.sendMessage({ action: "markAsRead", id: id }, () => {
          window.close();
        });
      }
    });
  } else {
    log("⚠️ Notification container not found.");
  }
});