// popup.js — auto-open the chatbot panel on click
(async () => {
  const statusEl = document.createElement("div");
  statusEl.style.fontSize = "13px";
  statusEl.style.marginTop = "8px";
  document.body.appendChild(statusEl);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.startsWith("http")) {
      statusEl.textContent = "Open a regular http/https page to use Screen Copilot.";
      return;
    }
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "SHOW_IFRAME" },
        { frameId: 0 },
        (resp) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(resp);
          }
        }
      );
    });
    statusEl.textContent = "Panel opening…";
  } catch (e) {
    console.warn("Popup failed to open panel", e);
    statusEl.textContent = "Couldn't open panel. Reload the page and try again.";
    return;
  } finally {
    // Wake background service worker and close after a short delay so the user sees status.
    chrome.runtime.sendMessage({ type: "PING" }, () => {});
    setTimeout(() => window.close(), 1200);
  }
})();
