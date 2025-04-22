document.addEventListener('DOMContentLoaded', function() {
  // Елементи DOM
  const refreshIntervalInput = document.getElementById('refreshInterval');
  const notificationTimeoutTypeSelect = document.getElementById('notificationTimeoutType');
  const timeoutValueGroup = document.getElementById('timeoutValueGroup');
  const notificationTimeoutInput = document.getElementById('notificationTimeout');
  const bringToFrontIntervalInput = document.getElementById('bringToFrontInterval');
  const creatioUrlInput = document.getElementById('creatioUrl');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusElement = document.getElementById('status');

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
      bringToFrontInterval: 20,
      creatioUrl: ''
    }, function(items) {
      refreshIntervalInput.value = items.refreshInterval;
      
      if (items.notificationTimeout > 0) {
        notificationTimeoutTypeSelect.value = 'auto';
        notificationTimeoutInput.value = items.notificationTimeout;
        timeoutValueGroup.style.display = 'block';
      } else {
        notificationTimeoutTypeSelect.value = 'manual';
        notificationTimeoutInput.value = 5;
        timeoutValueGroup.style.display = 'none';
      }
      
      bringToFrontIntervalInput.value = items.bringToFrontInterval;
      creatioUrlInput.value = items.creatioUrl;
    });
  }
  
  // Відображення/приховування поля для часу автозакриття
  function toggleTimeoutValueVisibility() {
    if (notificationTimeoutTypeSelect.value === 'auto') {
      timeoutValueGroup.style.display = 'block';
    } else {
      timeoutValueGroup.style.display = 'none';
    }
  }
  
  // Збереження налаштувань
  function saveOptions() {
    const refreshInterval = Math.max(10, parseInt(refreshIntervalInput.value));
    let notificationTimeout = 0;
    
    if (notificationTimeoutTypeSelect.value === 'auto') {
      notificationTimeout = parseInt(notificationTimeoutInput.value);
      if (isNaN(notificationTimeout) || notificationTimeout < 1) {
        notificationTimeout = 5;
      }
    }
    
    const bringToFrontInterval = Math.max(5, parseInt(bringToFrontIntervalInput.value));
    const creatioUrl = creatioUrlInput.value.trim();
    
    chrome.storage.sync.set({
      refreshInterval: refreshInterval,
      notificationTimeout: notificationTimeout,
      bringToFrontInterval: bringToFrontInterval,
      creatioUrl: creatioUrl
    }, function() {
      showStatus('Налаштування збережено', 'success');
      refreshIntervalInput.value = refreshInterval;
      notificationTimeoutInput.value = notificationTimeout || 5;
      bringToFrontIntervalInput.value = bringToFrontInterval;
      
      if (notificationTimeout > 0) {
        notificationTimeoutTypeSelect.value = 'auto';
        timeoutValueGroup.style.display = 'block';
      } else {
        notificationTimeoutTypeSelect.value = 'manual';
        timeoutValueGroup.style.display = 'none';
      }
      
      chrome.runtime.sendMessage({
        action: "settingsUpdated",
        settings: {
          refreshInterval: refreshInterval,
          notificationTimeout: notificationTimeout,
          bringToFrontInterval: bringToFrontInterval,
          creatioUrl: creatioUrl
        }
      });
    });
  }
  
  // Скидання налаштувань
  function resetOptions() {
    const defaultSettings = {
      refreshInterval: 10,
      notificationTimeout: 0,
      bringToFrontInterval: 20,
      creatioUrl: ''
    };
    
    chrome.storage.sync.set(defaultSettings, function() {
      refreshIntervalInput.value = defaultSettings.refreshInterval;
      notificationTimeoutTypeSelect.value = 'manual';
      notificationTimeoutInput.value = 5;
      timeoutValueGroup.style.display = 'none';
      bringToFrontIntervalInput.value = defaultSettings.bringToFrontInterval;
      creatioUrlInput.value = '';
      
      showStatus('Налаштування скинуто до стандартних', 'success');
      
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
    
    setTimeout(function() {
      statusElement.textContent = '';
      statusElement.className = 'status';
    }, 3000);
  }
});