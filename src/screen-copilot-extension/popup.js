// popup.js — simple and correct for iframe architecture

// === OPEN CHAT PANEL ===
document.getElementById("toggleChatbot").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.startsWith("http")) {
    alert("This extension only works on regular websites.");
    return;
  }

  // Tell content.js to show the iframe
  chrome.tabs.sendMessage(tab.id, { type: "SHOW_IFRAME" }, { frameId: 0 });

  window.close();
});


// === OPEN PANEL AND LET USER RECORD INSIDE PANEL ===
document.getElementById("recordGuideBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.startsWith("http")) {
    alert("This extension only works on regular websites.");
    return;
  }

  // Just open the panel — recording happens from inside panel.js
  chrome.tabs.sendMessage(tab.id, { type: "SHOW_IFRAME" }, { frameId: 0 });

  window.close();
});


// Wake background service worker
chrome.runtime.sendMessage({ type: "PING" }, () => {});
