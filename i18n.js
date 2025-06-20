let currentLanguage = 'en';

function setLanguage(lang) {
  currentLanguage = lang;
  chrome.storage.sync.set({ language: lang });
  applyTranslations();
}

function getTranslation(key) {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) return key;
  }
  return value;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = getTranslation(key);
    
    // Для атрибутів title, placeholder тощо
    if (el.hasAttribute('data-i18n-title')) {
      el.setAttribute('title', getTranslation(el.getAttribute('data-i18n-title')));
    }
    if (el.hasAttribute('data-i18n-placeholder')) {
      el.setAttribute('placeholder', getTranslation(el.getAttribute('data-i18n-placeholder')));
    }
  });
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = getTranslation(key);
    if (el.tagName === 'INPUT' && el.type !== 'button' && el.type !== 'submit') {
      el.value = translation;
    } else {
      el.textContent = translation;
    }
  });

  // Обробка підказок (title)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', getTranslation(key));
  });
}


// Ініціалізація при завантаженні
chrome.storage.sync.get({ language: 'en' }, (items) => {
  currentLanguage = items.language;
  applyTranslations();
});