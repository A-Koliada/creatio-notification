// content.js - оновлена версія

console.log("✅ Creatio Notifier content script завантажено");

// Перевірка авторизації через cookie
function checkAuthentication() {
  try {
    const isAuthenticated =
      document.cookie.includes("AuthData") || 
      document.cookie.includes("BPMCSRF") || 
      document.cookie.includes("BPMSESSIONID") || 
      document.cookie.includes("ASPXAUTH") || 
      document.cookie.includes("CreatioIdentityServerAuthenticated=True");

    console.log("🔍 Перевірка авторизації у content.js:", isAuthenticated ? "✅ Авторизовано" : "❌ Не авторизовано");
    return isAuthenticated;
  } catch (error) {
    console.error("🚨 Помилка перевірки авторизації:", error);
    return false;
  }
}

//---------------------
console.log("✅ content.js завантажено у вкладці Creatio");

function checkAuthStatus(callback) {
  chrome.cookies.getAll({ domain: "creatio.com" }, function (cookies) {
    const bpmSession = cookies.find(cookie => cookie.name === "BPMSESSIONID");
    const isAuthenticated = !!bpmSession;
    console.log("🔍 Авторизація у content.js:", isAuthenticated ? "✅ Так" : "❌ Ні");
    callback(isAuthenticated);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📩 Отримано повідомлення у content.js:", message);

  if (message.action === "checkAuth") {
    checkAuthStatus((isAuthenticated) => {
      sendResponse({ authorized: isAuthenticated });
    });
    return true;
  }
});


//---------------------




// Обробник повідомлень
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📩 Отримано повідомлення у content.js:", request);

  if (request.action === "checkAuth") {
    const authStatus = checkAuthentication();
    console.log("🔍 Відповідь на checkAuth:", authStatus);
    sendResponse({ authorized: authStatus });
    return true;
  }

  return false;
});

// Повідомляємо `background.js`, що `content.js` завантажено
chrome.runtime.sendMessage({ action: "contentScriptReady" })
  .then(() => console.log("✅ Content script повідомив background.js про готовність"))
  .catch((error) => console.error("🚨 Помилка при відправці повідомлення:", error));
