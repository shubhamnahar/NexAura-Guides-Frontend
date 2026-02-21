// background.js — MV3 service worker
// Implements "Background Master" pattern: background owns recording state in chrome.storage.local.

const RECORDING_KEY = "nexaura_recording_session";
const frameRegistry = new Map();

async function getRecordingState() {
  // FIXED: Changed from session to local to avoid the strict 1MB session limit
  const data = await chrome.storage.local.get(RECORDING_KEY);
  return (
    data[RECORDING_KEY] || {
      active: false,
      tabId: null,
      steps: [],
      startedAt: null,
    }
  );
}

async function setRecordingState(next) {
  // FIXED: Changed from session to local
  await chrome.storage.local.set({ [RECORDING_KEY]: next });
}

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
});

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  registerFrame(sender);

  (async () => {
    const state = await getRecordingState();

    switch (message.type) {
      case "PING":
        sendResponse({ status: "alive" });
        return;

      case "CAPTURE_SCREEN": {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]) {
            sendResponse({ error: "No active tab to capture" });
            return;
          }
          // FIXED: Compressing image to jpeg at 50% quality to prevent hitting the 5MB storage limit
          chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: "jpeg", quality: 50 }, (image) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ image });
            }
          });
        });
        return true;
      }

      case "GET_TAB_ID":
        sendResponse({ tabId: sender?.tab?.id ?? null });
        return;

      case "GET_FRAME_ID":
        sendResponse({ frameId: sender?.frameId ?? 0 });
        return;

      // Recording control
      case "START_RECORDING": {
        const tabId = sender?.tab?.id ?? message.tabId ?? null;
        await setRecordingState({
          active: true,
          tabId,
          steps: [],
          startedAt: Date.now(),
        });
        sendResponse({ ok: true });
        return;
      }

      case "STOP_RECORDING": {
        await setRecordingState({ active: false, tabId: null, steps: [], startedAt: null });
        sendResponse({ ok: true });
        return;
      }

      case "RECORD_STEP": {
        if (!state.active) {
          sendResponse({ ok: false, error: "Not recording" });
          return;
        }
        const step = { ...message.payload, timestamp: Date.now() };
        state.steps.push(step);
        await setRecordingState(state);
        sendResponse({ ok: true });
        return;
      }

      case "GET_RECORDING_STATE":
        sendResponse({ ok: true, state });
        return;

      case "CLEAR_RECORDING":
        await setRecordingState({ active: false, tabId: null, steps: [], startedAt: null });
        sendResponse({ ok: true });
        return;

      // Playback delegation (existing functionality preserved)
      case "DELEGATE_PLAYBACK_STEP": {
        const tabId = sender?.tab?.id;
        const requesterFrameId = sender?.frameId;
        if (typeof tabId !== "number") {
          sendResponse({ ok: false, error: "Missing tab reference" });
          return;
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
          const ids = Array.from(frames).filter(
            (fid) => (typeof requesterFrameId === "number" ? fid !== requesterFrameId : true)
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

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })();

  return true; // keep channel open for async responses
});

// Navigation: append NAVIGATION step and re-inject content on new URL
chrome.webNavigation.onCommitted.addListener(async (details) => {
  const state = await getRecordingState();
  if (!state.active || state.tabId !== details.tabId) return;

  state.steps.push({
    type: "NAVIGATION",
    url: details.url,
    timestamp: Date.now(),
  });
  await setRecordingState(state);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content.js"],
    });
  } catch (e) {
    console.warn("Re-inject failed", e);
  }
});

// If recorded tab closes, stop recording
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getRecordingState();
  if (state.active && state.tabId === tabId) {
    await setRecordingState({ active: false, tabId: null, steps: [], startedAt: null });
  }
});