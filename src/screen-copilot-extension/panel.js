/***************************************************
 *  NexAura Panel UI (runs inside iframe)
 *  Completely isolated from webpage DOM
 ***************************************************/

// Helpers to talk to content.js
// async function getActiveTabId() {
//   const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
//   return tabs[0]?.id;
// }

// async function getActiveTabId() {
//   return new Promise((resolve) => {
//     chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB" }, (res) => {
//       resolve(res?.tabId || null);
//     });
//   });
// }

function sendToContent(msg) {
  return new Promise((resolve) => {
    window.postMessage({ fromPanel: true, msg }, "*");

    window.addEventListener("message", function handler(e) {
      if (e.data.fromContent && e.data.replyTo === msg.type) {
        window.removeEventListener("message", handler);
        resolve(e.data.response);
      }
    });
  });
}

// function sendToContent(msg) {
//   return (async () => {
//     const tabId = await getActiveTabId();
//     if (!tabId) {
//       return { ok: false, error: "No active tab" };
//     }
//     return new Promise((resolve) => {
//       chrome.tabs.sendMessage(tabId, msg, (res) => {
//         if (chrome.runtime.lastError) {
//           resolve({ ok: false, error: chrome.runtime.lastError.message });
//         } else {
//           resolve(res);
//         }
//       });
//     });
//   })();
// }

// Optional: wait until content.js responds to PING_CONTENT
async function waitForContentScript() {
  while (true) {
    const res = await sendToContent({ type: "PING_CONTENT" });
    if (res && res.ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

// (async () => {
document.addEventListener("DOMContentLoaded", async () => {
  await waitForContentScript();

  //-------------------------------------------------
  // DO NOT replace UI — panel.html already contains it
  // We now only need to attach logic and event handlers
  //-------------------------------------------------

  const messagesEl = document.getElementById("messages");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const recordBtn = document.getElementById("recordBtn");
  const fetchGuidesBtn = document.getElementById("fetchGuidesBtn");
  const nextStepBtn = document.getElementById("nextStepBtn");
  const closeBtn = document.getElementById("closeBtn");

  let recording = false;
  let currentPlaybackGuide = null;
  let currentPlaybackIndex = 0;

  //-----------------------------------------
  // UI helpers
  //-----------------------------------------
  function addMessage(role, html) {
    const d = document.createElement("div");
    d.className = "msg " + (role === "user" ? "user" : "bot");
    d.innerHTML = html;
    messagesEl.appendChild(d);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  }

  //-----------------------------------------
  // CHAT SEND
  //-----------------------------------------
  sendBtn.onclick = async () => {
    const text = msgInput.value.trim();
    if (!text) return;

    addMessage("user", escapeHtml(text));
    msgInput.value = "";
    addMessage("bot", "🤔 Thinking...");

    const res = await sendToContent({ type: "PANEL_ANALYZE", question: text });

    messagesEl.lastElementChild.remove();

    if (!res || !res.ok) return addMessage("bot", "❌ No Response");

    addMessage(
      "bot",
      `<pre>${escapeHtml(JSON.stringify(res.data, null, 2))}</pre>`
    );
  };

  msgInput.onkeypress = (e) => e.key === "Enter" && sendBtn.click();

  //-----------------------------------------
  // RECORD GUIDE
  //-----------------------------------------
  recordBtn.onclick = async () => {
    if (!recording) {
      const r = await sendToContent({ type: "START_RECORDING" });
      if (!r?.ok) return addMessage("bot", "❌ Failed to start recording");

      recording = true;
      recordBtn.textContent = "Stop Recording";
      return addMessage("bot", "🔴 Recording started.");
    }

    const r = await sendToContent({ type: "STOP_RECORDING" });
    recording = false;
    recordBtn.textContent = "Record Guide";

    if (!r?.ok) return addMessage("bot", "❌ Failed to stop recording");

    addMessage("bot", `✨ Recorded ${r.steps.length} steps.`);
  };

  //-----------------------------------------
  // FETCH GUIDES
  //-----------------------------------------
  fetchGuidesBtn.onclick = async () => {
    const res = await sendToContent({ type: "GET_GUIDES" });
    if (!res?.ok) return addMessage("bot", "❌ Could not fetch guides");
    addMessage("bot", "<pre>" + JSON.stringify(res.guides, null, 2) + "</pre>");
  };

  //-----------------------------------------
  // CLOSE PANEL
  //-----------------------------------------
  closeBtn.onclick = () => {
    document.getElementById("nexaura-root")?.remove();
  };

  addMessage("bot", "👋 NexAura ready.");
})();
