document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const title = decodeURIComponent(params.get("title"));
  const message = decodeURIComponent(params.get("message"));
  const date = decodeURIComponent(params.get("date"));
  const url = decodeURIComponent(params.get("url")); // Розкодований URL Creatio

  document.getElementById("notification-title").textContent = title;
  document.getElementById("notification-message").textContent = message;
  document.getElementById("notification-date").textContent = date;

  // Завантаження налаштувань для автоматичного закриття
  chrome.storage.sync.get({ notificationTimeout: 0 }, (settings) => {
    if (settings.notificationTimeout > 0) {
      console.log(`Автозакриття увімкнено, вікно буде закрито після ${settings.notificationTimeout} секунд.`);
      setTimeout(() => {
        console.log("Закриваємо спливаюче вікно автоматично.");
        window.close();
      }, settings.notificationTimeout * 1000);
    } else {
      console.log("Автозакриття відсутнє. Вікно буде закрито в ручному режимі.");
    }
  });

  // Обробник кнопки "Закрити"
  const closeBtn = document.getElementById("closeWindow");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      console.log("Натиснуто кнопку 'Закрити'.");
      window.close();
    });
  } else {
    console.warn("Кнопка 'Закрити' не знайдена.");
  }

  // Обробник кнопки "Прочитано"
  const markBtn = document.getElementById("markAsRead");
  if (markBtn) {
    markBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      console.log(`Натиснуто 'Прочитано' для повідомлення з ID: ${id}`);
      chrome.runtime.sendMessage({ action: "markAsRead", id: id }, () => {
        window.close();
      });
    });
  } else {
    console.warn("Кнопка 'Прочитано' не знайдена.");
  }

  // Якщо користувач клікає на спливаюче повідомлення (але не на кнопку)
  const container = document.querySelector(".notification-container");
  if (container) {
    container.addEventListener("click", function (e) {
      if (!e.target.closest("button") && url) {
        console.log(`Клік по повідомленню з ID: ${id}, відкриваємо URL: ${url}`);
        window.open(url, "_blank");
        chrome.runtime.sendMessage({ action: "markAsRead", id: id }, () => {
          window.close();
        });
      }
    });
  } else {
    console.warn("Контейнер повідомлення не знайдено.");
  }
});

/*
document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const title = decodeURIComponent(params.get("title"));
  const message = decodeURIComponent(params.get("message"));
  const date = decodeURIComponent(params.get("date"));
  const url = decodeURIComponent(params.get("url")); // Розкодований URL Creatio

  document.getElementById("notification-title").textContent = title;
  document.getElementById("notification-message").textContent = message;
  document.getElementById("notification-date").textContent = date;

  // Завантаження налаштувань для автоматичного закриття
  chrome.storage.sync.get({
    notificationTimeoutType: "manual", // можливі значення: "auto" або "manual"
    notificationTimeout: 5             // час у секундах
  }, (settings) => {
    console.log("Налаштування автозакриття:", settings);
    if (settings.notificationTimeoutType === "auto") {
      console.log(`Автозакриття увімкнено, вікно має закритися через ${settings.notificationTimeout} секунд.`);
      setTimeout(() => {
        console.log("Закриваємо спливаюче вікно автоматично.");
        window.close();
      }, settings.notificationTimeout * 1000);
    } else {
      console.log("Режим автозакриття вимкнено. Вікно буде закриватися вручну.");
    }
  });

  // Обробник кнопки "Закрити"
  const closeBtn = document.getElementById("closeWindow");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      console.log("Натиснуто кнопку 'Закрити'.");
      window.close();
    });
  } else {
    console.warn("Кнопка 'Закрити' не знайдена.");
  }

  // Обробник кнопки "Прочитано"
  const markBtn = document.getElementById("markAsRead");
  if (markBtn) {
    markBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      console.log(`Натиснуто 'Прочитано' для повідомлення з ID: ${id}`);
      chrome.runtime.sendMessage({ action: "markAsRead", id: id }, () => {
        window.close();
      });
    });
  } else {
    console.warn("Кнопка 'Прочитано' не знайдена.");
  }

  // Якщо користувач клікає на спливаюче повідомлення (але не на кнопку)
  const container = document.querySelector(".notification-container");
  if (container) {
    container.addEventListener("click", function (e) {
      if (!e.target.closest("button") && url) {
        console.log(`Клік по повідомленню з ID: ${id}, відкриваємо URL: ${url}`);
        window.open(url, "_blank");
        chrome.runtime.sendMessage({ action: "markAsRead", id: id }, () => {
          window.close();
        });
      }
    });
  } else {
    console.warn("Контейнер повідомлення не знайдено.");
  }
});
*/