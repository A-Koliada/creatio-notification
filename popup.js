// Conditional logging
const isDebug = true;
function log(...args) {
  if (isDebug) console.log('[CreatioNotifier]', ...args);
}

// State management
const state = {
  notifications: [],
  currentLanguage: 'en',
  isLoading: false
};

// DOM Elements
const elements = {
  container: document.getElementById("notifications"),
  refreshBtn: document.getElementById("refreshBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  markAllReadBtn: document.getElementById("markAllReadBtn"),
  unreadCounter: document.getElementById("unreadCount"),
  languageDisplay: document.getElementById("currentLanguageDisplay")
};

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initPopup();
    setupEventListeners();
    loadNotifications();
  } catch (error) {
    log('Initialization error:', error);
    showErrorState();
  }
});

async function initPopup() {
  // Load language settings
  const { language = 'en' } = await chrome.storage.sync.get('language');
  state.currentLanguage = language;
  document.documentElement.setAttribute('data-current-language', state.currentLanguage);
  updateLanguageDisplay();
  
  // Apply translations
  updateLocalizedTexts();
}

function setupEventListeners() {
  // Refresh button
  elements.refreshBtn?.addEventListener('click', () => {
    log('Manual refresh triggered');
    loadNotifications();
  });

  // Settings button
  elements.settingsBtn?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Mark all as read
  elements.markAllReadBtn?.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: "markAllRead" });
      loadNotifications();
    } catch (error) {
      log('Error marking all as read:', error);
    }
  });

  // Language change listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "languageChanged") {
      state.currentLanguage = message.language;
      document.documentElement.setAttribute('data-current-language', state.currentLanguage);
      updateLocalizedTexts();
      updateLanguageDisplay();
      log('Language changed to:', state.currentLanguage);
    }
  });
}

async function loadNotifications() {
  try {
    setLoadingState(true);
    
    const response = await chrome.runtime.sendMessage({ action: "getNotifications" });
    if (response?.success) {
      state.notifications = response.notifications || [];
      renderNotifications();
      updateUnreadCounter();
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    log('Failed to load notifications:', error);
    showErrorState();
  } finally {
    setLoadingState(false);
  }
}

function renderNotifications() {
  if (!elements.container) return;

  if (!state.notifications.length) {
    elements.container.innerHTML = `
      <div class="empty-state" data-i18n="noNotifications">
        ${getTranslation('noNotifications')}
      </div>
    `;
    return;
  }

  elements.container.innerHTML = state.notifications.map(notification => `
    <div class="notification-item clickable-container" data-id="${notification.id}">
      <div class="notification-header">
        <strong>${notification.title}</strong>
        <span class="notification-date">
          ${new Date(notification.date).toLocaleString()}
        </span>
      </div>
      <p>${notification.message}</p>
      ${notification.url ? `
        <a href="${notification.url}" class="notification-link" target="_blank" data-i18n="goToRecord">
          ${getTranslation('goToRecord')}
        </a>
      ` : ''}
      <button class="mark-read" data-id="${notification.id}" data-i18n="markAsRead">
        ${getTranslation('markAsRead')}
      </button>
    </div>
  `).join('');

  // Add event listeners to new elements
  document.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', handleNotificationClick);
  });

  document.querySelectorAll('.mark-read').forEach(btn => {
    btn.addEventListener('click', handleMarkAsRead);
  });
}

function handleNotificationClick(e) {
  const notificationId = e.currentTarget.getAttribute('data-id');
  const notification = state.notifications.find(n => n.id === notificationId);
  
  if (!notification?.url) return;
  if (e.target.tagName === 'A' || e.target.classList.contains('mark-read')) return;

  window.open(notification.url, '_blank');
  chrome.runtime.sendMessage({ 
    action: "markAsRead", 
    id: notification.id 
  });
}

async function handleMarkAsRead(e) {
  e.stopPropagation();
  const notificationId = e.target.getAttribute('data-id');
  
  try {
    await chrome.runtime.sendMessage({ 
      action: "markAsRead", 
      id: notificationId 
    });
    loadNotifications();
  } catch (error) {
    log('Error marking as read:', error);
  }
}

// Helper functions
function setLoadingState(isLoading) {
  state.isLoading = isLoading;
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) {
    spinner.style.display = isLoading ? 'flex' : 'none';
  }
}

function showErrorState() {
  if (!elements.container) return;
  
  elements.container.innerHTML = `
    <div class="error-state">
      <p class="error-message" data-i18n="loadError"></p>
      <ul class="error-checklist">
        <li data-i18n="loadErrorChecklist1"></li>
        <li data-i18n="loadErrorChecklist2"></li>
        <li data-i18n="loadErrorChecklist3"></li>
      </ul>
      <button id="retryBtn" class="retry-button" data-i18n="retryButton"></button>
    </div>
  `;
  
    // Застосуємо переклади
  updateLocalizedTexts();
  
  // Додамо обробник події для кнопки
  document.getElementById("retryBtn")?.addEventListener('click', loadNotifications);
}

function updateUnreadCounter() {
  if (elements.unreadCounter) {
    elements.unreadCounter.textContent = state.notifications.length;
  }
}

function updateLanguageDisplay() {
  if (elements.languageDisplay) {
    elements.languageDisplay.textContent = state.currentLanguage.toUpperCase();
  }
}

// Localization functions
function getTranslation(key) {
  const langData = translations[state.currentLanguage] || translations.en;
  return key.split('.').reduce((obj, k) => obj?.[k], langData) || key;
}

function updateLocalizedTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = getTranslation(el.getAttribute('data-i18n'));
  });
}


function updateLocalizedTexts() {
  // Оновлення звичайного тексту
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = getTranslation(el.getAttribute('data-i18n'));
  });
  
  // Оновлення підказок
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', getTranslation(el.getAttribute('data-i18n-title')));
  });
}
/*
*********************************
* A-Koliada 
* https://a-koliada.github.io/
*********************************
*/