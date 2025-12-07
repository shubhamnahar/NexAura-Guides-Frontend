// content.js — page logic + iframe sidebar host

(function () {
  if (window.nexauraContentInitialized) {
    console.log("NexAura content already initialized");
    return;
  }
  window.nexauraContentInitialized = true;
  console.log("NexAura content starting…");

  // ===== LISTEN FOR TOKEN FROM LOGIN PAGE =====
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || msg.type !== "NEXAURA_AUTH_TOKEN") return;

    console.log("Content.js received token from login page:", msg.token);

    chrome.storage.local.set({ nexaura_token: msg.token }, () => {
      console.log("Token stored in chrome.storage.local");
    });

    window.postMessage({ type: "NEXAURA_TOKEN_RECEIVED" }, "*");
  });

  // ===== State =====
  let iframe = null;
  let isRecording = false;
  let currentGuideSteps = [];
  let isProgrammaticallyClicking = false; // kept for possible future auto-actions
  let playbackGuide = null;
  let currentStepIndex = 0;

  // ===== Create iframe sidebar =====
  function createIframe() {
    if (iframe && iframe.isConnected) return;

    iframe = document.createElement("iframe");
    iframe.id = "nexaura-panel-iframe";

    Object.assign(iframe.style, {
      position: "fixed",
      top: "0",
      right: "0",
      width: "400px",
      height: "100vh",
      border: "none",
      background: "transparent",
      zIndex: "2147483647",
      transform: "translateX(100%)", // hidden by default
      transition: "transform 0.3s ease",
      pointerEvents: "auto",
    });

    // isolate panel, but allow prompts
    iframe.sandbox = "allow-scripts allow-same-origin allow-modals";

    iframe.src = chrome.runtime.getURL("panel.html");

    document.body.appendChild(iframe);
  }

  if (document.body) {
    createIframe();
  } else {
    window.addEventListener("DOMContentLoaded", createIframe);
  }

  // ---------- selector helper (robust) ----------
  function getCssSelector(el) {
    if (!(el instanceof Element)) return "";

    const GOOD_ATTRS = [
      "gh", // Gmail internal tag
      "data-tooltip",
      "aria-label",
      "data-action",
      "data-id",
      "role",
      "name",
      "placeholder",
    ];

    let node = el;

    // Try up to 5 levels up for a stable attribute
    for (let depth = 0; depth < 5 && node; depth++) {
      for (const attr of GOOD_ATTRS) {
        const val = node.getAttribute(attr);
        if (val && val.trim()) {
          const tag = node.tagName.toLowerCase();
          return `${tag}[${attr}="${val}"]`;
        }
      }
      node = node.parentElement;
    }

    // Fallback: stable classes on the clicked element
    const classes = Array.from(el.classList || []).filter((c) =>
      /^[a-zA-Z-]+$/.test(c)
    );
    if (classes.length) {
      return `${el.tagName.toLowerCase()}.${classes.join(".")}`;
    }

    // Final fallback — full nth-of-type path
    let path = [];
    node = el;

    while (node && node.nodeType === 1) {
      let selector = node.tagName.toLowerCase();

      const stableClasses = Array.from(node.classList || []).filter((c) =>
        /^[a-zA-Z-]+$/.test(c)
      );
      if (stableClasses.length > 0) {
        selector += "." + stableClasses.join(".");
      }

      let sib = node;
      let nth = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === node.tagName) nth++;
      }
      selector += `:nth-of-type(${nth})`;

      path.unshift(selector);
      node = node.parentElement;
    }

    return path.join(" > ");
  }

  // ---------- highlights ----------
  function showLiveHighlight(highlights = [], duration = 5000) {
    document.querySelectorAll(".nex-hl").forEach((n) => n.remove());
    highlights.forEach((h) => {
      const box = document.createElement("div");
      box.className = "nex-hl";
      Object.assign(box.style, {
        position: "fixed",
        top: `${h.y}px`,
        left: `${h.x}px`,
        width: `${h.w}px`,
        height: `${h.h}px`,
        zIndex: 2147483643,
        pointerEvents: "none",
        border: "3px solid #E87C32",
        backgroundColor: "rgba(232,124,50,0.15)",
        borderRadius: "6px",
        boxShadow: "0 0 15px rgba(232,124,50,0.4)",
      });
      if (h.summary) {
        const label = document.createElement("div");
        Object.assign(label.style, {
          position: "absolute",
          top: `100%`,
          left: 0,
          marginTop: "6px",
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          padding: "6px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          pointerEvents: "none",
        });
        label.textContent = h.summary;
        box.appendChild(label);
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), duration);
    });
  }

  // ---------- capture screen (used for recording + analyze) ----------
  function captureScreen() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "CAPTURE_SCREEN" }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response?.error) return reject(new Error(response.error));
        resolve(response.image); // base64 data URL
      });
    });
  }

  // ---------- recording ----------
  async function onRecordClick(event) {
    if (!isRecording || isProgrammaticallyClicking) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const selector = getCssSelector(target);
    if (!selector) {
      console.warn("NexAura: couldn't generate selector");
    }

    const rect = target.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    showLiveHighlight(
      [
        {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
          summary: "Recorded step",
        },
      ],
      1800
    );

    const isInput =
      (target.tagName === "INPUT" &&
        /text|email|search|password|tel|url/i.test(target.type)) ||
      target.tagName === "TEXTAREA";
    const isContentEditable = target.isContentEditable;

    let action = "click";
    let value = null;
    if (isInput) {
      action = "type";
      value = target.value || "";
    } else if (isContentEditable) {
      action = "type";
      value = target.innerText || "";
    }

    let instruction = prompt("Describe this step:", "");
    if (!instruction || !instruction.trim()) {
      instruction = "Step recorded";
    }

    // NEW: capture a screenshot for this step (with the highlight visible)
    let screenshot = null;
    try {
      screenshot = await captureScreen();
    } catch (e) {
      console.warn("Failed to capture step screenshot:", e);
    }

    console.log("hello--------", rect.left);

    currentGuideSteps.push({
      selector,
      instruction: instruction.trim(),
      action,
      value,
      screenshot, // base64 image for backend
      highlight: {
        x: rect.left * dpr,
        y: rect.top * dpr,
        width: rect.width * dpr,
        height: rect.height * dpr,
      },
    });
  }

  function startRecording() {
    if (isRecording) return;
    isRecording = true;
    currentGuideSteps = [];
    document.body.addEventListener("click", onRecordClick, true);
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    document.body.removeEventListener("click", onRecordClick, true);
  }

  // ---------- wait for element ----------
  async function waitForElement(selector, maxAttempts = 10, delayMs = 300) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const r = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const visible =
            r.width > 0 &&
            r.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden";
          if (visible) return el;
        }
      } catch (e) {
        console.warn("waitForElement: invalid selector", selector, e);
        return null;
      }
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return null;
  }

  // ---------- playback ----------
  async function startPlayback(guide) {
    playbackGuide = guide;
    currentStepIndex = 0;
    // Panel will call EXECUTE_NEXT_PLAYBACK_STEP manually
  }

  async function finishPlayback() {
    playbackGuide = null;
    currentStepIndex = 0;
    showLiveHighlight([]);
  }

  async function showPlaybackStep() {
    if (!playbackGuide) return;

    if (currentStepIndex >= playbackGuide.steps.length) {
      await finishPlayback();
      return;
    }

    const step = playbackGuide.steps[currentStepIndex];
    const el = await waitForElement(step.selector, 12, 300);

    if (!el) {
      chrome.runtime.sendMessage(
        { type: "PLAYBACK_STEP_NOT_FOUND", stepIndex: currentStepIndex, step },
        () => {}
      );
      return;
    }

    const r = el.getBoundingClientRect();
    showLiveHighlight(
      [
        {
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          summary: step.instruction
            ? step.instruction
            : `Step ${currentStepIndex + 1}`,
        },
      ],
      4000
    );

    // NO automatic click/type. User manually interacts with the element.
    chrome.runtime.sendMessage(
      { type: "PLAYBACK_STEP_READY", stepIndex: currentStepIndex, step },
      () => {}
    );

    currentStepIndex++;

    chrome.runtime.sendMessage(
      { type: "PLAYBACK_CONTINUE", stepIndex: currentStepIndex },
      () => {}
    );
  }

  // ---------- server helpers ----------
  async function fetchGuidesFromServer() {
    const tokenObj = await new Promise((r) =>
      chrome.storage.local.get("nexaura_token", r)
    );
    const token = tokenObj?.nexaura_token;
    if (!token) throw new Error("No token. Please log in.");
    const res = await fetch("http://127.0.0.1:8000/api/guides/", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch guides");
    return await res.json();
  }

  async function saveGuideToServer(guide) {
    const tokenObj = await new Promise((r) =>
      chrome.storage.local.get("nexaura_token", r)
    );
    const token = tokenObj?.nexaura_token;
    if (!token) throw new Error("No token. Please log in.");
    const res = await fetch("http://127.0.0.1:8000/api/guides/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(guide),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "unknown" }));
      console.log("hereeeeee error -----", err);
      throw new Error(err.detail || "Failed to save guide");
    }
    return await res.json();
  }

  async function analyzeScreenWithServer(imageBase64, question) {
    const res = await fetch("http://127.0.0.1:8000/api/analyze/analyze_live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: imageBase64, question }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Analyze failed: ${res.status} ${text}`);
    }
    return await res.json();
  }

  function injectNexAuraPanel() {
    if (document.getElementById("nex-aura-shadow-root")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "nex-aura-shadow-root";
    wrapper.style.position = "fixed";
    wrapper.style.top = "20px";
    wrapper.style.right = "20px";
    wrapper.style.zIndex = "999999999"; // max priority
    wrapper.style.width = "400px";
    wrapper.style.height = "auto";

    // Create shadow root (isolated)
    const shadow = wrapper.attachShadow({ mode: "open" });

    // Load the panel HTML inside shadow root
    fetch(chrome.runtime.getURL("panel.html"))
      .then((r) => r.text())
      .then((html) => {
        shadow.innerHTML = ``; // do NOT dump HTML with <script> into shadow

        // Load HTML safely
        fetch(chrome.runtime.getURL("panel.html"))
          .then((r) => r.text())
          .then((html) => {
            const container = document.createElement("div");
            container.innerHTML = html;
            shadow.appendChild(container);

            // Load CSS correctly
            const css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = chrome.runtime.getURL("panel.css");
            shadow.appendChild(css);

            // Load JS correctly
            const script = document.createElement("script");
            script.src = chrome.runtime.getURL("panel.js");
            shadow.appendChild(script);
          });
      });

    document.body.appendChild(wrapper);
  }

  window.addEventListener("message", async (event) => {
    if (!event.data?.fromPanel) return;
    const msg = event.data.msg;
    let response = null;

    if (msg.type === "PING_CONTENT") response = { ready: true };
    if (msg.type === "START_RECORDING") {
      startRecording();
      response = { ok: true };
    }
    if (msg.type === "STOP_RECORDING") {
      stopRecording();
      response = { ok: true, steps: currentGuideSteps };
    }

    // … add others like GET_GUIDES, SAVE_GUIDE …
    if (msg.type === "GET_ACTIVE_TAB") {
      response = await new Promise((res) =>
        chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB" }, (r) => res(r))
      );
    }

    window.postMessage({ fromContent: true, replyTo: msg.type, response }, "*");
  });

  // ---------- message handler ----------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SHOW_IFRAME") {
      if (iframe) iframe.style.transform = "translateX(0%)";
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "SHOW_PANEL") {
      injectNexAuraPanel();
    }

    if (message.type === "HIDE_IFRAME") {
      if (iframe) iframe.style.transform = "translateX(100%)";
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "PING_CONTENT") {
      sendResponse?.({ ready: true });
      return;
    }

    if (message.type === "START_RECORDING") {
      startRecording();
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "STOP_RECORDING") {
      stopRecording();
      sendResponse?.({ ok: true, steps: currentGuideSteps });
      return;
    }

    if (message.type === "START_PLAYBACK") {
      startPlayback(message.guide);
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "EXECUTE_NEXT_PLAYBACK_STEP") {
      showPlaybackStep();
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "PANEL_ANALYZE") {
      (async () => {
        try {
          const image = await captureScreen();
          const data = await analyzeScreenWithServer(
            image,
            message.question || ""
          );
          sendResponse({ ok: true, data });
        } catch (err) {
          console.error("PANEL_ANALYZE error:", err);
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    if (message.type === "GET_GUIDES") {
      (async () => {
        try {
          const guides = await fetchGuidesFromServer();
          sendResponse({ ok: true, guides });
        } catch (err) {
          console.error("GET_GUIDES error:", err);
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    if (message.type === "SAVE_GUIDE") {
      (async () => {
        try {
          const saved = await saveGuideToServer(message.guide);
          sendResponse({ ok: true, guide: saved });
        } catch (err) {
          console.error("SAVE_GUIDE error:", err);
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    if (message.type === "CAPTURE_SCREEN") {
      // Optional passthrough (not used directly now; we call captureScreen() instead)
      (async () => {
        try {
          const image = await captureScreen();
          sendResponse({ ok: true, image });
        } catch (err) {
          console.error("CAPTURE_SCREEN error:", err);
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }
  });

  console.log("✅ NexAura content initialized");
})();
