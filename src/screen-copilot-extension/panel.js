/***************************************************
 *  NexAura Panel UI (runs inside iframe)
 *  Completely isolated from webpage DOM
 ***************************************************/

// Helpers to talk to content.js
async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id;
  }
  
  function sendToContent(msg) {
    return (async () => {
      const tabId = await getActiveTabId();
      if (!tabId) {
        return { ok: false, error: "No active tab" };
      }
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res);
          }
        });
      });
    })();
  }
  
  // Optional: wait until content.js responds to PING_CONTENT
  async function waitForContentScript() {
    while (true) {
      const res = await sendToContent({ type: "PING_CONTENT" });
      if (res && res.ready) return;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  
  (async () => {
    await waitForContentScript();
  
    const app = document.getElementById("app");
  
    // ===============
    // LAYOUT
    // ===============
    app.innerHTML = `
      <div id="header" style="
        padding: 15px 20px;
        background: linear-gradient(135deg, #D93B3B 0%, #E87C32 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
        font-size: 20px;
      ">
        NexAura
        <button id="closeBtn" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 5px 10px;
          border-radius: 5px;
          cursor: pointer;
        ">✕</button>
      </div>
  
      <div id="messages" style="
        flex: 1;
        padding: 15px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      "></div>
  
      <div id="inputArea" style="
        padding: 12px;
        background: #242424;
        border-top: 1px solid rgba(255,255,255,0.1);
        display: flex;
        flex-direction: column;
        gap: 8px;
      ">
        <input id="msgInput" placeholder="Ask something…" style="
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #444;
          background: #333;
          color: white;
          font-size: 14px;
        "/>
  
        <div style="display:flex; gap:8px;">
          <button id="recordBtn" style="
            flex:1;
            padding:10px;
            border-radius:8px;
            border:none;
            background:#444;
            color:white;
            cursor:pointer;
          ">Record Guide</button>
        </div>
  
        
  
        <button id="sendBtn" style="
          width:100%;
          padding:12px;
          border-radius:8px;
          border:none;
          background:linear-gradient(135deg,#D93B3B 0%,#E87C32 100%);
          color:white;
          font-weight:bold;
          cursor:pointer;
        ">Send</button>
      </div>
    `;
  
    // ===============
    // ELEMENT REFS
    // ===============
    const messagesEl = document.getElementById("messages");
    const msgInput = document.getElementById("msgInput");
    const sendBtn = document.getElementById("sendBtn");
    const recordBtn = document.getElementById("recordBtn");
    const nextStepBtn = document.getElementById("nextStepBtn");
    const closeBtn = document.getElementById("closeBtn");
  
    let recording = false;
    let currentPlaybackGuide = null;
    let currentPlaybackIndex = 0;

    function resetNextStepButton() {
      nextStepBtn.disabled = true;
      nextStepBtn.style.cursor = "not-allowed";
      nextStepBtn.style.background = "#333";
      nextStepBtn.style.color = "#ccc";
      nextStepBtn.textContent = "Next step ▶";
    }

    async function handleRecordedSteps(steps) {
      const safeSteps = Array.isArray(steps) ? steps : [];
      if (!safeSteps.length) {
        addMessage("bot", "No steps were recorded, so nothing to save.");
        await sendToContent({ type: "CONSUME_PENDING_RECORDING" });
        return;
      }

      addMessage(
        "bot",
        `Recorded <strong>${safeSteps.length}</strong> steps. Let's save this as a guide.`
      );

      const name = prompt("Name this guide", "My Guide");
      if (!name) {
        addMessage("bot", "❎ Cancelled saving guide.");
        await sendToContent({ type: "CONSUME_PENDING_RECORDING" });
        return;
      }
      const shortcut = prompt(
        "Shortcut (e.g. /my-guide)",
        `/${name.toLowerCase().replace(/\s+/g, "-")}`
      );
      const desc = prompt("Short description", "");

      const safeShortcut =
        shortcut && shortcut.trim()
          ? shortcut.trim()
          : "/" + name.toLowerCase().replace(/\s+/g, "-");

      const safeDescription =
        desc && desc.trim() ? desc.trim() : "Guide recorded with NexAura";

      const guide = {
        name: name.trim(),
        shortcut: safeShortcut,
        description: safeDescription,
        steps: safeSteps,
      };

      const saveRes = await sendToContent({ type: "SAVE_GUIDE", guide });
      if (saveRes?.ok) {
        addMessage(
          "bot",
          `✅ Guide saved: <strong>${escapeHtml(
            guide.name
          )}</strong> (shortcut: <code>${escapeHtml(guide.shortcut)}</code>)`
        );
        await sendToContent({ type: "CONSUME_PENDING_RECORDING" });
      } else {
        addMessage(
          "bot",
          `<strong>Error saving guide:</strong> ${escapeHtml(
            saveRes?.error || "unknown"
          )}`
        );
        addMessage(
          "bot",
          "You can try saving again without re-recording by using the existing steps."
        );
      }
    }
  
    // utility to add message bubble
    function addMessage(role, html) {
      const d = document.createElement("div");
      d.className = "msg " + (role === "user" ? "user" : "bot");
      Object.assign(d.style, {
        maxWidth: "85%",
        padding: "10px 14px",
        borderRadius: "10px",
        fontSize: "14px",
        lineHeight: "1.4",
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        background:
          role === "user"
            ? "linear-gradient(135deg,#D93B3B 0%,#E87C32 100%)"
            : "#262626",
        color: "#f0f0f0",
      });
      d.innerHTML = html;
      messagesEl.appendChild(d);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  
    function escapeHtml(s) {
      if (typeof s !== "string") s = String(s);
      return s.replace(/[&<>"']/g, (m) => {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m];
      });
    }
  
    // ===============
    // CHAT SEND
    // ===============
    sendBtn.addEventListener("click", async () => {
        const text = msgInput.value.trim();
        if (!text) return;
      
        // --- 1️⃣ If user types /something → try to run guide ---
        if (text.startsWith("/")) {
          msgInput.value = "";
          addMessage("user", escapeHtml(text));
      
          const shortcut = text.trim().toLowerCase();
      
          addMessage("bot", `🔎 Looking for guide <code>${escapeHtml(shortcut)}</code>...`);
      
          const res = await sendToContent({ type: "GET_GUIDES" });
      
          if (!res?.ok) {
            addMessage("bot", `<strong>Error:</strong> ${escapeHtml(res?.error || "Failed to fetch guides")}`);
            return;
          }
      
          const guides = res.guides || [];
          const match = guides.find(g => g.shortcut.toLowerCase() === shortcut);
      
          if (!match) {
            addMessage("bot", `❌ No guide found with shortcut <code>${escapeHtml(shortcut)}</code>`);
            return;
          }
      
          // Start playback of guide
          currentPlaybackGuide = match;
          currentPlaybackIndex = 0;
      
          addMessage(
            "bot",
            `▶️ Running guide: <strong>${escapeHtml(
              match.name
            )}</strong><br/>Use the mini playback box on the page to move through each step.`
          );
      
          const startRes = await sendToContent({
            type: "START_PLAYBACK",
            guide: match,
          });
      
          if (!startRes?.ok) {
            addMessage("bot", `<strong>Error:</strong> ${escapeHtml(startRes?.error || "Could not start playback")}`);
            return;
          }
      
          // Enable next step button
          nextStepBtn.disabled = false;
          nextStepBtn.style.cursor = "pointer";
          nextStepBtn.style.background = "#1f6feb";
          nextStepBtn.style.color = "#fff";
          nextStepBtn.textContent = "Start step 1 ▶";
      
          return;
        }
      
        // --- 2️⃣ Otherwise: normal chat message (Analyze screen) ---
        addMessage("user", escapeHtml(text));
        msgInput.value = "";
        addMessage("bot", "🤔 Thinking...");
      
        const res = await sendToContent({ type: "PANEL_ANALYZE", question: text });
      
        const last = messagesEl.lastElementChild;
        if (last && last.textContent && last.textContent.includes("Thinking")) {
          last.remove();
        }
      
        if (!res || !res.ok) {
          addMessage(
            "bot",
            `<strong>Error:</strong> ${escapeHtml(res?.error || "No response")}`
          );
          return;
        }
      
        try {
          const data = res.data;
          const out = typeof data?.result === "string"
            ? data.result
            : JSON.stringify(data, null, 2);
      
          addMessage("bot", `<pre style="white-space:pre-wrap; margin:0;">${escapeHtml(out)}</pre>`);
        } catch (err) {
          addMessage("bot", `<pre>${escapeHtml(String(err))}</pre>`);
        }
      });
      
  
    msgInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendBtn.click();
      }
    });
  
    // ===============
    // RECORD GUIDE
    // ===============
    recordBtn.addEventListener("click", async () => {
      if (!recording) {
        const r = await sendToContent({ type: "START_RECORDING" });
        if (r?.ok) {
          recording = true;
          recordBtn.textContent = "Stop Recording";
          addMessage(
            "bot",
            "🔴 Recording started — a mini box on the page lets you stop while keeping the UI clear."
          );
        } else {
          addMessage(
            "bot",
            `<strong>Error:</strong> ${escapeHtml(
              r?.error || "Couldn't start recording"
            )}`
          );
        }
      } else {
        const r = await sendToContent({ type: "STOP_RECORDING" });
        recording = false;
        recordBtn.textContent = "Record Guide";

        if (!r?.ok) {
          addMessage(
            "bot",
            `<strong>Error stopping recording:</strong> ${escapeHtml(
              r?.error || "unknown"
            )}`
          );
          return;
        }

        const steps = r.steps || [];
        await handleRecordedSteps(steps);
      }
    });
  
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "OVERLAY_RECORDING_RESUMED") {
        if (!recording) {
          recording = true;
          recordBtn.textContent = "Stop Recording";
          addMessage(
            "bot",
            "⏺ Recording resumed on this page — use the floating recorder to keep adding steps or stop when finished."
          );
        }
      }

      if (message.type === "OVERLAY_RECORDING_FINISHED") {
        recording = false;
        recordBtn.textContent = "Record Guide";
        const steps = message.steps || [];
        handleRecordedSteps(steps).catch((err) =>
          console.error("Error saving overlay recording", err)
        );
      }

      if (message.type === "OVERLAY_PLAYBACK_FINISHED") {
        currentPlaybackGuide = null;
        currentPlaybackIndex = 0;
        resetNextStepButton();
        const reason = message.reason === "stopped" ? "⏹" : "✅";
        addMessage(
          "bot",
          `${reason} Guide playback ${message.reason === "stopped" ? "stopped" : "finished"}.`
        );
      }
    });

    async function hydratePanelState() {
      try {
        const state = await sendToContent({ type: "GET_PANEL_STATE" });
        if (!state) return;

        if (state.recording) {
          recording = true;
          recordBtn.textContent = "Stop Recording";
          addMessage(
            "bot",
            "⏺ Recording is still active — continue using the floating recorder or stop when you’re done."
          );
        }

        if (state.pendingStepsCount > 0) {
          const pending = await sendToContent({ type: "GET_PENDING_RECORDING" });
          if (pending?.ok && pending.steps?.length) {
            await handleRecordedSteps(pending.steps);
          }
        }

        if (state.playbackActive && state.playbackGuideName) {
          try {
            const guidesRes = await sendToContent({ type: "GET_GUIDES" });
            if (guidesRes?.ok) {
              const guides = guidesRes.guides || [];
              let match = null;
              if (state.playbackGuideShortcut) {
                match = guides.find(
                  (g) => g.shortcut === state.playbackGuideShortcut
                );
              }
              if (!match) {
                match = guides.find(
                  (g) => g.name === state.playbackGuideName
                );
              }
              if (match) {
                currentPlaybackGuide = match;
                currentPlaybackIndex = state.playbackIndex || 0;
                nextStepBtn.disabled = false;
                nextStepBtn.style.cursor = "pointer";
                nextStepBtn.style.background = "#1f6feb";
                nextStepBtn.style.color = "#fff";
                const steps = match.steps || [];
                if (currentPlaybackIndex >= steps.length) {
                  nextStepBtn.textContent = "Finish ▶";
                } else {
                  nextStepBtn.textContent = `Resume step (${currentPlaybackIndex + 1}/${
                    steps.length
                  }) ▶`;
                }
                addMessage(
                  "bot",
                  `▶️ Playback is still running for <strong>${escapeHtml(
                    match.name
                  )}</strong>. Use the floating controller or the Next Step button here to continue.`
                );
              } else {
                addMessage(
                  "bot",
                  "▶️ A guide playback is still active. Use the floating controller to keep going."
                );
              }
            }
          } catch (err) {
            console.error("hydratePanelState playback resume error:", err);
          }
        }
      } catch (err) {
        console.error("hydratePanelState error:", err);
      }
    }

    hydratePanelState();

    if (nextStepBtn) {
      nextStepBtn.addEventListener("click", async () => {
        if (!currentPlaybackGuide) return;
        const steps = currentPlaybackGuide.steps || [];

        if (currentPlaybackIndex >= steps.length) {
          addMessage("bot", "✅ Guide finished.");
          resetNextStepButton();
          currentPlaybackGuide = null;
          currentPlaybackIndex = 0;
          return;
        }
    
        const step = steps[currentPlaybackIndex];
        const stepNumber = currentPlaybackIndex + 1;
        addMessage(
          "bot",
          `▶ Step ${stepNumber} of ${steps.length}: <strong>${escapeHtml(
            step.instruction || ""
          )}</strong><br/><small>The element on the page will be highlighted — now you click or type there yourself.</small>`
        );
    
        const res = await sendToContent({ type: "EXECUTE_NEXT_PLAYBACK_STEP" });
        if (!res?.ok) {
          addMessage(
            "bot",
                  `<strong>Error highlighting step:</strong> ${escapeHtml(
              res?.error || "unknown"
            )}`
          );
          return;
        }
    
        currentPlaybackIndex++;
        if (currentPlaybackIndex >= steps.length) {
          nextStepBtn.textContent = "Finish ▶";
        } else {
          nextStepBtn.textContent = `Next step (${currentPlaybackIndex + 1}/${
            steps.length
          }) ▶`;
        }
      });
    } else {
      console.warn("Next step button not found in panel UI");
    }
  
    // ===============
    // CLOSE PANEL
    // ===============
    closeBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId) return;
        chrome.tabs.sendMessage(tabId, { type: "HIDE_IFRAME" }, { frameId: 0 });
      });
    });
  
    // ===============
    // Initial welcome
    // ===============
    addMessage(
      "bot",
      "👋 Hi — ask about this page or record guides. To run an existing guide, type its shortcut like <code>/checkout</code>. When running a guide, use <strong>Next step ▶</strong>; the element will be highlighted and you perform the action yourself."
    );
  })();
  
