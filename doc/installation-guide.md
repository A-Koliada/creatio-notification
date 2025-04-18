# Інструкція зі встановлення розширення Creatio Notifier

## 1. Підготовка файлів
1. Створіть папку `creatio-notifier` на вашому комп'ютері.
2. Створіть у цій папці всі файли, описані вище (manifest.json, background.js, popup.html, popup.js і т.д.).
3. Створіть підпапку `images` і додайте туди необхідні іконки.
4. Створіть підпапку `libs` і додайте туди jquery.min.js.

## 2. Встановлення розширення в режимі розробника
1. Відкрийте Chrome і перейдіть за адресою `chrome://extensions/`
2. Увімкніть "Режим розробника" (перемикач у правому верхньому куті).
3. Натисніть кнопку "Завантажити розпаковане розширення".
4. Виберіть папку `creatio-notifier`, яку ви створили.
5. Розширення має з'явитися в списку розширень Chrome.

## 3. Налаштування розширення
1. Натисніть на іконку розширення в панелі інструментів Chrome.
2. Якщо ви не авторизовані в Creatio, вам буде запропоновано відкрити Creatio та авторизуватися.
3. Натисніть кнопку налаштувань (⚙️) для доступу до налаштувань розширення.
4. Встановіть бажані параметри та натисніть "Зберегти".

## 4. Публікація в Chrome Web Store

Для публікації розширення в Chrome Web Store:

1. **Підготовка до публікації**:
   - Створіть обліковий запис розробника Chrome Web Store (одноразова плата $5).
   - Упакуйте розширення в ZIP-архів.
   - Підготуйте опис розширення, скріншоти та іконку розміром 128x128 пікселів.

2. **Завантаження в Chrome Web Store**:
   - Перейдіть на [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
   - Натисніть кнопку "New Item" (Новий елемент).
   - Завантажте архів з вашим розширенням.
   - Заповніть всі необхідні поля (назва, опис, категорія, тощо).
   - Завантажте скріншоти та іконки.
   - Виберіть регіони для публікації.

3. **Відправка на перевірку**:
   - Натисніть кнопку "Submit for Review" (Відправити на перевірку).
   - Очікуйте рішення від команди Chrome Web Store (зазвичай 1-3 дні).

4. **Після публікації**:
   - Після схвалення ваше розширення стане доступним у Chrome Web Store.
   - Ви можете оновлювати розширення, завантажуючи нові версії через Developer Dashboard.

## Примітки для розробників

### Вимоги безпеки Chrome Web Store:
1. **Дозволи**:
   - Розширення повинно запитувати тільки ті дозволи, які дійсно необхідні для роботи.
   - У маніфесті вказано необхідні дозволи: storage, alarms, notifications, tabs, cookies.

2. **CSP (Content Security Policy)**:
   - Уникайте використання `eval()` та inline-скриптів.
   - Всі скрипти повинні завантажуватися з пакету розширення.

3. **Приватність**