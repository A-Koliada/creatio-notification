document.addEventListener("DOMContentLoaded", function () {
  getNotifications();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updatePopup") {
      displayNotifications(message.notifications);
    }
  });

  // Обробник кнопки "Налаштування"
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", function () {
      chrome.runtime.openOptionsPage();
    });
  } else {
    console.error("❌ Кнопка 'Налаштування' не знайдена!");
  }

  // Обробник кнопки "Оновити"
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      getNotifications();
    });
  } else {
    console.error("❌ Кнопка 'Оновити' не знайдена!");
  }

  // Обробник кнопки "Прочитати все"
  const markAllReadBtn = document.getElementById("markAllReadBtn");
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", function () {
      chrome.runtime.sendMessage({ action: "markAllRead" }, (response) => {
        if (response && response.success) {
          getNotifications();
        } else {
          console.error("❌ Помилка при позначенні всіх як прочитаних:", response && response.error);
        }
      });
    });
  } else {
    console.error("❌ Кнопка 'Прочитати все' не знайдена!");
  }
});

function getNotifications() {
  chrome.runtime.sendMessage({ action: "getNotifications" }, function (response) {
    if (response && response.success) {
      displayNotifications(response.notifications);
    } else {
      console.error("❌ Помилка отримання повідомлень:", response && response.error);
    }
  });
}

function displayNotifications(notifications) {
  const container = document.getElementById("notifications");
  container.innerHTML = "";

  if (!notifications || notifications.length === 0) {
    container.innerHTML = "<p>Немає нових повідомлень.</p>";
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.classList.add("notification-item");
    item.innerHTML = `
      <strong>${notification.title}</strong>
      <p>${notification.message}</p>
      <span class="notification-date">${new Date(notification.date).toLocaleString()}</span>
      <button class="mark-read" data-id="${notification.id}">Прочитано</button>
    `;
    container.appendChild(item);

    // Обробник для кнопки "Прочитано"
    item.querySelector(".mark-read").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      markAsRead(notification.id);
    });

    // При кліку на блок (якщо не натиснуто кнопку), переходимо за посиланням та позначаємо як прочитане
    item.addEventListener("click", function (e) {
      if (!e.target.classList.contains("mark-read")) {
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
      console.error("❌ Помилка позначення як прочитаного:", response && response.error);
    }
  });
}
