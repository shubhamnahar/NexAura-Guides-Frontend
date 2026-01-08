const frameRegistry = new Map();

function registerFrame(sender) {
  const tabId = sender?.tab?.id;
  const frameId = sender?.frameId;
  if (typeof tabId !== "number" || typeof frameId !== "number") return;
  let frames = frameRegistry.get(tabId);
  if (!frames) {
    frames = new Set();
    frameRegistry.set(tabId, frames);
  }
  frames.add(frameId);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  frameRegistry.delete(tabId);
});
chrome.action.onClicked.addListener((tab) => {
  // ❌ Block PDFs and file URLs
  if (tab.url.startsWith("file://") || tab.url.includes(".pdf")) {
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  registerFrame(sender);

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

  if (message.type === "GET_TAB_ID") {
    sendResponse({ tabId: sender?.tab?.id ?? null });
    return true;
  }

  if (message.type === "GET_FRAME_ID") {
    sendResponse({ frameId: sender?.frameId ?? 0 });
    return true;
  }

  if (message.type === "DELEGATE_PLAYBACK_STEP") {
    const tabId = sender?.tab?.id;
    const requesterFrameId = sender?.frameId;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "Missing tab reference" });
      return true;
    }
    const targetFrameId = message.targetFrameId;
    const targetFrameHref = message.targetFrameHref;

    const sendToFrame = (frameId, onMiss) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "EXECUTE_DELEGATED_PLAYBACK_STEP" },
        { frameId },
        (response) => {
          if (chrome.runtime.lastError) {
            if (typeof onMiss === "function") {
              onMiss(chrome.runtime.lastError.message);
            } else {
              sendResponse({
                ok: false,
                error: chrome.runtime.lastError.message,
              });
            }
            return;
          }
          if (response) {
            sendResponse(response);
          } else if (typeof onMiss === "function") {
            onMiss("No response");
          } else {
            sendResponse({ ok: false, error: "No response" });
          }
        }
      );
    };

    const tryRegistryFrames = () => {
      const frames = frameRegistry.get(tabId);
      if (!frames || frames.size === 0) {
        sendResponse({ ok: false, error: "No other frames available" });
        return;
      }
      const ids = Array.from(frames).filter((fid) =>
        typeof requesterFrameId === "number" ? fid !== requesterFrameId : true
      );
      if (!ids.length) {
        sendResponse({ ok: false, error: "No other frames available" });
        return;
      }
      const iterate = (index) => {
        if (index >= ids.length) {
          sendResponse({
            ok: false,
            error: "Element not found in other frames",
          });
          return;
        }
        sendToFrame(ids[index], () => iterate(index + 1));
      };
      iterate(0);
    };

    const tryHrefLookup = () => {
      if (!targetFrameHref) {
        tryRegistryFrames();
        return;
      }
      chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
        if (chrome.runtime.lastError || !Array.isArray(frames)) {
          tryRegistryFrames();
          return;
        }
        const match = frames.find((f) => f.url === targetFrameHref);
        if (match) {
          sendToFrame(match.frameId, tryRegistryFrames);
        } else {
          const altMatch = frames.find(
            (f) => targetFrameHref && f.url.startsWith(targetFrameHref)
          );
          if (altMatch) {
            sendToFrame(altMatch.frameId, tryRegistryFrames);
          } else {
            tryRegistryFrames();
          }
        }
      });
    };

    if (typeof targetFrameId === "number") {
      sendToFrame(targetFrameId, () => {
        tryHrefLookup();
      });
    } else {
      tryHrefLookup();
    }
    return true;
  }
});
