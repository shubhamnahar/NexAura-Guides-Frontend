chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ status: "alive" });
    return true;
  }

  if (message.type === "CAPTURE_SCREEN") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ error: "No active tab to capture" });
        return;
      }

      chrome.tabs.captureVisibleTab(
        tabs[0].windowId,
        { format: "png" },
        (image) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ image });
          }
        }
      );
    });
    return true; // keep message channel open
  }

  if (msg.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs[0]?.id ?? null });
    });
    return true;
  }
});
