// Conditional logging for debugging
const isDebug = true;
function log(...args) {
  if (isDebug) console.log(...args);
}

// Current language state
let currentLanguage = 'en';

// Localization function
function getTranslation(key, lang = currentLanguage) {
  const langData = translations[lang] || translations.en;
  const keys = key.split('.');
  let value = langData;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) return key;
  }
  return value;
}

// Update UI translations
function updateLocalizedTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = getTranslation(key);
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', getTranslation(key));
  });
}

// Initialize notification
document.addEventListener("DOMContentLoaded", function() {
  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const notification = {
    id: params.get("id"),
    title: decodeURIComponent(params.get("title") || getTranslation('notification.defaultTitle')),
    message: decodeURIComponent(params.get("message") || getTranslation('notification.defaultMessage')),
    date: decodeURIComponent(params.get("date") || new Date().toISOString()),
    url: decodeURIComponent(params.get("url") || ""),
    lang: params.get("lang") || 'en'
  };

  // Set current language
  currentLanguage = notification.lang;
  document.documentElement.setAttribute('data-current-language', currentLanguage);

  // Update UI with notification data
  document.getElementById("notification-title").textContent = notification.title;
  document.getElementById("notification-message").textContent = notification.message;
  document.getElementById("notification-date").textContent = new Date(notification.date).toLocaleString();

  // Handle link display
  const linkElement = document.getElementById("notification-link");
  if (notification.url) {
    linkElement.href = notification.url;
    linkElement.style.display = "flex";
  } else {
    linkElement.style.display = "none";
  }

  // Apply translations
  updateLocalizedTexts();

  // Load settings for auto-close
  chrome.storage.sync.get({ 
    notificationTimeout: 0,
    language: 'en'
  }, (settings) => {
    if (settings.notificationTimeout > 0) {
      log(`Auto-close set for ${settings.notificationTimeout} seconds`);
      setTimeout(() => {
        window.close();
      }, settings.notificationTimeout * 1000);
    }
    
    if (settings.language !== currentLanguage) {
      currentLanguage = settings.language;
      updateLocalizedTexts();
    }
  });

  // Setup event handlers
  setupEventHandlers(notification);
});

function setupEventHandlers(notification) {
  // Close button
  const closeBtn = document.getElementById("closeWindow");
  if (closeBtn) {
    closeBtn.addEventListener("click", function() {
      log("Closing notification window");
      window.close();
    });
  }

  // Mark as Read button
  const markBtn = document.getElementById("markAsRead");
  if (markBtn) {
    markBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      log(`Marking notification ${notification.id} as read`);
      chrome.runtime.sendMessage({ 
        action: "markAsRead", 
        id: notification.id 
      }, () => {
        window.close();
      });
    });
  }

  // Container click handler
  const container = document.querySelector(".notification-container");
  if (container && notification.url) {
    container.addEventListener("click", function(e) {
      if (!e.target.closest("button") && !e.target.closest("a")) {
        log(`Opening URL: ${notification.url}`);
        window.open(notification.url, "_blank");
        chrome.runtime.sendMessage({
          action: "markAsRead",
          id: notification.id
        }, () => {
          window.close();
        });
      }
    });
  }
}

// Handle language updates from other parts of extension
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "languageChanged") {
    currentLanguage = message.language;
    document.documentElement.setAttribute('data-current-language', currentLanguage);
    updateLocalizedTexts();
    log(`Language changed to: ${currentLanguage}`);
  }
});

/*
*********************************
* A-Koliada 
* https://a-koliada.github.io/
*********************************
*/