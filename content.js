console.log("✅ Creatio Notifier content script завантажено");

function checkAuthentication() {
  try {
    const isAuthenticated =
      document.cookie.includes("AuthData") || 
      document.cookie.includes("BPMCSRF") || 
      document.cookie.includes("BPMSESSIONID");
    
    console.log("🔍 Авторизація у content.js:", isAuthenticated ? "✅ Так" : "❌ Ні");
    
    chrome.runtime.sendMessage({ 
      action: "updateAuthStatus", 
      authorized: isAuthenticated 
    });
    
    return isAuthenticated;
  } catch (error) {
    console.error("🚨 Помилка перевірки авторизації:", error);
    return false;
  }
}

// Initial check
checkAuthentication();

// Periodic check every 30 seconds
setInterval(checkAuthentication, 30000);

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkAuth") {
    const authStatus = checkAuthentication();
    sendResponse({ authorized: authStatus });
    return true;
  }
  return false;
});

// Notify background.js that content script is ready
chrome.runtime.sendMessage({ action: "contentScriptReady" })
  .then(() => console.log("✅ Content script повідомив background.js про готовність"))
  .catch((error) => console.error("🚨 Помилка при відправці повідомлення:", error));