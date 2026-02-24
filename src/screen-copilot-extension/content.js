// content.js — page logic + iframe sidebar host

(function () {
  if (
    window.location.protocol === "file:" ||
    document.contentType === "application/pdf"
  ) {
    console.debug("NexAura: blocked on PDF/file");
    return;
  }
  if (window.nexauraContentInitialized) {
    console.log("NexAura content already initialized");
    return;
  }
  window.nexauraContentInitialized = true;
  console.log("NexAura content starting…");

  const isTopFrame = window.top === window;

  function scaleBboxByDpr(rect) {
  const dpr = window.devicePixelRatio || 1;
  return {
    x: rect.left * dpr,
    y: rect.top * dpr,
    width: rect.width * dpr,
    height: rect.height * dpr,
    dpr: dpr
  };
}

  const PENDING_STEP_KEY = "nexaura_pending_step";
  const REPLAY_DELAY_MS = 50;
  let recoveredPendingStep = null;

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
  window.addEventListener("message", handleOverlayFrameMessage);
  window.addEventListener("message", handleRepairOverlayMessage);
  document.addEventListener("click", checkPlaybackInteraction, true);
  document.addEventListener("submit", checkPlaybackInteraction, true);
  document.addEventListener("input", checkPlaybackInteraction, true);
  document.addEventListener("change", checkPlaybackInteraction, true);

  window.addEventListener("message", handleOverlayFrameMessage);
  window.addEventListener("message", handleRepairOverlayMessage);

  // --- NEW: EVENT MASKING TO PROTECT SPA DROPDOWNS ---
  // This stops SPAs (like LinkedIn) from closing dropdowns when you click the extension
  // --- NEW: EVENT MASKING TO PROTECT SPA DROPDOWNS ---
  // This stops SPAs (like LinkedIn) from closing dropdowns when you click the extension
  function blockExtensionFocusLoss(e) {
    if (!overlayMode && !isRecording && !repairActive) return;

    // 1. Standard Check: Is the focus explicitly targeting our iframes?
    const isTargetingExtension = 
      e.target === overlayFrame || e.target === iframe || e.target === repairOverlay;
      
    const isRelatedToExtension = 
      e.relatedTarget === overlayFrame || e.relatedTarget === iframe || e.relatedTarget === repairOverlay;

    // 2. The Browser Security Workaround: 
    // Browsers often set relatedTarget to 'null' when focusing an iframe.
    // To catch this, we check if the user's mouse is physically hovering over our UI!
    const isHoveringExtension = 
      (overlayFrame && overlayFrame.matches(':hover')) ||
      (iframe && iframe.matches(':hover')) ||
      (repairOverlay && repairOverlay.matches(':hover'));

    // If any of these are true, the user is interacting with the Copilot. Kill the event!
    if (isTargetingExtension || isRelatedToExtension || isHoveringExtension) {
      e.stopImmediatePropagation();
    }
  }

  // We catch ALL focus-related events in the CAPTURE phase (true).
  // This guarantees we intercept them before React's root listeners even know they happened.
  window.addEventListener("focusout", blockExtensionFocusLoss, true);
  window.addEventListener("blur", blockExtensionFocusLoss, true);
  window.addEventListener("focusin", blockExtensionFocusLoss, true);
  window.addEventListener("focus", blockExtensionFocusLoss, true);
  // ---------------------------------------------------

  // We use "true" to catch the event in the CAPTURE phase, 
  // hitting it before React's root listeners can see it.
  window.addEventListener("focusout", blockExtensionFocusLoss, true);
  window.addEventListener("blur", blockExtensionFocusLoss, true);
  // ---------------------------------------------------


  // ... rest of your variables ...

  let iframe = null;
  let isProcessingInteraction = false; // <--- ADD THIS LOCK
  let isRecording = false;
  let currentGuideSteps = [];
  let isProgrammaticallyClicking = false; // kept for possible future auto-actions
  let playbackGuide = null;
  let currentStepIndex = 0;
  let peekHandle = null;
  let peekButton = null;
  let panelVisible = false;
  let isPeekThrough = false;
  let overlayFrame = null;
  let overlayFrameReady = false;
  let overlayVisible = false;
  let overlayState = getDefaultOverlayState();
  let overlayPendingState = null;
  let overlayMode = null;
  let overlayPrimaryAction = null;
  let overlaySecondaryAction = null;
  let pendingRecordingSteps = null;
  let lastHighlightedStepIndex = null;
  let repairOverlay = null;
  let repairActive = false;
  let repairSelectMode = false;
  let repairStepIndex = null;
  let activePlaybackElement = null;
  let activePlaybackStep = null;
  let stepInteractionCompleted = true; // defaults true so initial Start works
  const RECORDING_STATE_KEY_PREFIX = "nexaura_recording_state";
  let recordingStateKey = null;
  let currentTabId = null;
  let currentFrameId = null;
  const recordingStorage = chrome.storage.local;
  const recordingStorageArea = "local";
  let suppressStorageEvents = false;
  let restoreRecordingPromise = null;
  const moduleCache = {};
  const readyPromise = initializeRecorderContext();
  let overlayDrag = null;

  // Recover any step that was synchronously persisted before the previous page unload.
  (function recoverPendingStep() {
    try {
      const raw = sessionStorage.getItem(PENDING_STEP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      recoveredPendingStep = parsed;
      // Send it to the background immediately so it gets persisted.
      try {
        chrome.runtime.sendMessage({ type: "RECORD_STEP", payload: parsed }, () => {});
      } catch (err) {
        console.warn("NexAura: background handoff failed during recovery", err);
      }
      sessionStorage.removeItem(PENDING_STEP_KEY);
    } catch (err) {
      console.warn("NexAura: failed to recover pending step", err);
      try {
        sessionStorage.removeItem(PENDING_STEP_KEY);
      } catch (_) {}
    }
  })();

  async function loadModule(path) {
    if (!moduleCache[path]) {
      moduleCache[path] = import(chrome.runtime.getURL(path));
    }
    return moduleCache[path];
  }

  function requestCurrentTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("GET_TAB_ID failed:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(res?.tabId ?? null);
      });
    });
  }

  function requestCurrentFrameId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_FRAME_ID" }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "GET_FRAME_ID failed:",
            chrome.runtime.lastError.message
          );
          resolve(null);
          return;
        }
        resolve(typeof res?.frameId === "number" ? res.frameId : null);
      });
    });
  }

  async function initializeRecorderContext() {
    // Global recording key so recording can persist across new tabs (e.g., docs opening a new tab).
    const tabId = await requestCurrentTabId();
    currentTabId = tabId == null
      ? `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`
      : tabId;
    const frameId = await requestCurrentFrameId();
    currentFrameId = typeof frameId === "number" ? frameId : 0;
    recordingStateKey = `${RECORDING_STATE_KEY_PREFIX}_global`;
    bootstrap();
  }

  function withRecordingStorage(fn) {
    return new Promise((resolve) => {
      fn(() => resolve());
    });
  }

  function readRecordingStateFromStorage() {
    const key = recordingStateKey;
    return new Promise((resolve) => {
      recordingStorage.get([key], (data) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "Failed to read recording state:",
            chrome.runtime.lastError.message
          );
          resolve(null);
          return;
        }
        resolve(data[key] || null);
      });
    });
  }

  function writeRecordingStateToStorage(state) {
    const key = recordingStateKey;
    return new Promise((resolve) => {
      recordingStorage.set(
        {
          [key]: state,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Failed to persist recording state:",
              chrome.runtime.lastError.message
            );
          }
          resolve();
        }
      );
    });
  }

  async function syncSharedState() {
    const payload = {
      recording: isRecording,
      steps: currentGuideSteps,
      pendingSteps: pendingRecordingSteps,
      playbackActive: !!playbackGuide,
      playbackGuide,
      playbackIndex: currentStepIndex,
      lastHighlightedStepIndex,
      stepInteractionCompleted,
    };
    suppressStorageEvents = true;
    try {
      await writeRecordingStateToStorage(payload);
    } finally {
      suppressStorageEvents = false;
    }
  }

  // Force a sync before navigation/unload to preserve steps across SPA navigations.
  window.addEventListener(
    "pagehide",
    () => {
      if (!isRecording && !playbackGuide) return;
      writeRecordingStateToStorage({
        recording: isRecording,
        steps: currentGuideSteps,
        pendingSteps: pendingRecordingSteps,
        playbackActive: !!playbackGuide,
        playbackGuide,
        playbackIndex: currentStepIndex,
        lastHighlightedStepIndex,
        stepInteractionCompleted,
      });
    },
    { capture: true }
  );

  async function clearRecordingStateStorage() {
    pendingRecordingSteps = null;
    await writeRecordingStateToStorage({
      recording: false,
      steps: [],
      pendingSteps: null,
      playbackActive: false,
      playbackGuide: null,
      playbackIndex: 0,
      lastHighlightedStepIndex: null,
    });
  }

  async function setPendingRecordedSteps(steps) {
    if (Array.isArray(steps) && steps.length > 0) {
      pendingRecordingSteps = steps.slice();
    } else {
      pendingRecordingSteps = null;
    }
    await syncSharedState();
  }

  function applyRecordingStateSnapshot(snapshot) {
    if (!snapshot) return;
    const shouldRecord = !!snapshot.recording;
    const newSteps = Array.isArray(snapshot.steps)
      ? snapshot.steps.slice()
      : [];
    const newPending =
      Array.isArray(snapshot.pendingSteps) && snapshot.pendingSteps.length > 0
        ? snapshot.pendingSteps.slice()
        : null;
    const hasPlayback = !!snapshot.playbackActive && !!snapshot.playbackGuide;
    const storedPlaybackGuide = hasPlayback ? snapshot.playbackGuide : null;
    const storedPlaybackIndex = hasPlayback ? snapshot.playbackIndex || 0 : 0;
    const storedLastHighlighted =
      typeof snapshot.lastHighlightedStepIndex === "number"
        ? snapshot.lastHighlightedStepIndex
        : null;
    stepInteractionCompleted =
      snapshot.stepInteractionCompleted !== undefined
        ? snapshot.stepInteractionCompleted
        : true;

    currentGuideSteps = newSteps;
    pendingRecordingSteps = newPending;

    if (shouldRecord && !isRecording) {
      resumeRecordingFromState();
    } else if (!shouldRecord && isRecording) {
      detachRecordingHooks();
    }

    if (hasPlayback) {
      playbackGuide = storedPlaybackGuide;
      currentStepIndex = storedPlaybackIndex;
      lastHighlightedStepIndex = storedLastHighlighted;
      if (isTopFrame) {
        enterPlaybackOverlay();
        updatePlaybackOverlay();
      }
    } else if (playbackGuide) {
      playbackGuide = null;
      currentStepIndex = 0;
      lastHighlightedStepIndex = null;
      if (isTopFrame) {
        exitPlaybackOverlay();
      }
    }
  }

  // ===== Create iframe sidebar =====
  function createIframe() {
    if (!isTopFrame) return;
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
    ensurePeekHandle();
    updatePeekHandle();
  }

  async function restoreRecordingStateIfNeeded() {
    if (restoreRecordingPromise) return restoreRecordingPromise;
    restoreRecordingPromise = (async () => {
      const saved = await readRecordingStateFromStorage();
      if (!saved) return;

      applyRecordingStateSnapshot(saved);
      if (recoveredPendingStep) {
        if (saved.recording) {
          // --- NEW: DEDUPLICATE STEPS ON RELOAD ---
          const alreadyExists = currentGuideSteps.some(
            (s) => s.createdAt === recoveredPendingStep.createdAt
          );
          if (!alreadyExists) {
            currentGuideSteps.push(recoveredPendingStep);
          }
          // ----------------------------------------
          recoveredPendingStep = null;
          await syncSharedState();
        } else {
          recoveredPendingStep = null;
        }
      }
      if (saved.recording && isTopFrame) {
        chrome.runtime.sendMessage(
          {
            type: "OVERLAY_RECORDING_RESUMED",
            stepsCount: currentGuideSteps.length,
          },
          () => {}
        );
      }
    })().catch((err) => console.warn("restoreRecordingState error:", err));
    return restoreRecordingPromise;
  }

  function bootstrap() {
    const start = () => {
      createIframe();
      restoreRecordingStateIfNeeded();
    };
    if (document.body) {
      start();
    } else {
      window.addEventListener("DOMContentLoaded", start, { once: true });
    }
  }

  // ---------- selector helper (robust) ----------
  function normalizeText(str) {
    if (!str) return "";
    return str.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getCssSelector(el) {
    if (!(el instanceof Element)) return "";

    const GOOD_ATTRS = [
      "data-testid",
      "data-test",
      "gh", // Gmail internal tag
      "data-tooltip",
      "aria-label",
      "data-action",
      "data-id",
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

  function getTextSnapshotInfo(el) {
    let node = el;
    for (let depth = 0; depth < 5 && node; depth++) {
      const raw = node.innerText || node.textContent || "";
      const normalized = normalizeText(raw);
      if (normalized) {
        return {
          text: normalized.slice(0, 300),
          tagName: node.tagName ? node.tagName.toLowerCase() : null,
        };
      }
      node = node.parentElement;
    }
    return {
      text: null,
      tagName: el && el.tagName ? el.tagName.toLowerCase() : null,
    };
  }

  // ---------- highlights ----------
  // ---------- highlights ----------
  function showLiveHighlight(highlights = [], duration = 5000) {
    document.querySelectorAll(".nex-hl").forEach((n) => n.remove());
    
    highlights.forEach((h) => {
      // 1. ADD PADDING: Expand the box slightly so tiny elements aren't choked
      const padding = 8;
      const top = h.y - padding;
      const left = h.x - padding;
      const width = h.w + (padding * 2);
      const height = h.h + (padding * 2);

      const box = document.createElement("div");
      box.className = "nex-hl";
      Object.assign(box.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 2147483643,
        pointerEvents: "none",
        border: "3px solid #E87C32",
        backgroundColor: "rgba(232,124,50,0.1)",
        borderRadius: "8px",
        
        // 2. THE SPOTLIGHT: Dims the rest of the screen and adds an inner/outer glow
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px 4px rgba(232,124,50,0.6) inset, 0 0 20px 4px rgba(232,124,50,0.6)",
        transition: "all 0.3s ease-out"
      });

      // 3. PULSE ANIMATION: Makes the box "breathe" to catch the eye
      box.animate([
        { transform: 'scale(1)', opacity: 0.85 },
        { transform: 'scale(1.04)', opacity: 1 },
        { transform: 'scale(1)', opacity: 0.85 }
      ], {
        duration: 1500,
        iterations: Infinity,
        easing: "ease-in-out"
      });

      if (h.summary) {
        const label = document.createElement("div");
        Object.assign(label.style, {
          position: "absolute",
          top: `100%`,
          left: "50%",
          transform: "translateX(-50%)", // Center the label perfectly
          marginTop: "14px",
          background: "#151522",
          border: "1px solid #E87C32",
          color: "#fff",
          padding: "8px 14px",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "700",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
        });
        label.textContent = h.summary;
        
        // Add a little triangle pointing up to the highlight box
        const arrow = document.createElement("div");
        Object.assign(arrow.style, {
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: "6px",
          borderStyle: "solid",
          borderColor: "transparent transparent #E87C32 transparent",
        });
        
        label.appendChild(arrow);
        box.appendChild(label);
      }
      
      document.documentElement.appendChild(box);
      
      // Auto-remove if a duration is provided (0 means stay forever)
      if (duration > 0) {
        setTimeout(() => {
          if (box.parentElement) box.remove();
        }, duration);
      }
    });
  }

  // ---------- playback interaction listener ----------
  function checkPlaybackInteraction(e) {
    if (overlayMode !== "playback") return;
    if (!activePlaybackElement || stepInteractionCompleted) return;
    const target = e.target;
    if (!target || !(target instanceof Element)) return;
    if (!activePlaybackElement.contains(target) && activePlaybackElement !== target) return;

    const isTypeEvent = e.type === "input" || e.type === "change";
    const isClickEvent = e.type === "click" || e.type === "submit";

    if (activePlaybackStep?.action === "type") {
      if (!isTypeEvent) return;
    } else {
      if (!isClickEvent) return;
    }

    stepInteractionCompleted = true;
    setOverlayState({ primaryEnabled: true });
    syncSharedState();
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

  function persistPendingStep(step) {
    try {
      sessionStorage.setItem(PENDING_STEP_KEY, JSON.stringify(step));
    } catch (err) {
      console.warn("NexAura: failed to persist pending step", err);
    }
  }

  function clearPendingStep() {
    try {
      sessionStorage.removeItem(PENDING_STEP_KEY);
    } catch (err) {
      console.warn("NexAura: failed to clear pending step", err);
    }
  }

  function captureScreenWithTimeout(timeoutMs = 200) {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(null);
      }, timeoutMs);
      captureScreen()
        .then((img) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(img);
        })
        .catch(() => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(null);
        });
    });
  }

  // ---------- recording ----------
  async function handleInteraction(event) {
    if (!isRecording || isProgrammaticallyClicking) return;
    
    // --- NEW: UX DOUBLE-CLICK LOCK ---
    if (isProcessingInteraction) {
      // If the user clicks again while we are grabbing the screenshot, 
      // completely block it so it doesn't navigate out of order!
      if (event.isTrusted) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      return;
    }
    // ---------------------------------

    if (!event.isTrusted) return;

    const target =
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement || null;
    if (!target) return;
    if (peekHandle && peekHandle.contains(target)) return;

    // Activate the lock!
    isProcessingInteraction = true;

    try {
      // Freeze the page immediately so we can persist the step safely.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const actionType = event.type === "submit" ? "submit" : "click";
      const actionable =
        actionType === "submit" ? target.closest("form") || target : target;
      const submitter =
        actionType === "submit"
          ? event.submitter ||
            (target.matches &&
            target.matches('button[type="submit"],input[type="submit"]')
              ? target
              : actionable.querySelector &&
                actionable.querySelector('button[type="submit"],input[type="submit"]')) ||
            null
          : null;

      // Visual feedback to confirm we caught the interaction.
      try {
        const rect = actionable.getBoundingClientRect();
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
          3000 // Increased duration to ensure it's captured in the screenshot
        );
      } catch (err) {
        console.warn("NexAura: highlight failed", err);
      }

      // Give the browser a moment to paint the highlight before capturing the screen
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Determine input/value semantics.
      const isInput =
        (actionable.tagName === "INPUT" &&
          /text|email|search|password|tel|url/i.test(actionable.type)) ||
        actionable.tagName === "TEXTAREA";
      const isContentEditable = actionable.isContentEditable;

      // Capture rich target metadata.
      let capturedTarget = null;
      try {
        const { captureTarget } = await loadModule(
          "core/recording/captureTarget.js"
        );
        capturedTarget = captureTarget(actionable, {
          id: currentFrameId,
          href: window.location.href,
        });
        // Scale bbox by DPR for correct highlight position
        if (capturedTarget?.vision?.bbox) {
          capturedTarget.vision.bbox = scaleBboxByDpr(actionable.getBoundingClientRect());
        }
      } catch (e) {
        console.warn("captureTarget failed", e);
      }

      const finderLocator =
        capturedTarget?.preferredLocators?.find(
          (l) => l?.type === "css" && l.confidence >= 0.75
        ) || null;
      const selector = finderLocator?.value || getCssSelector(actionable);
      if (!selector) {
        console.warn("NexAura: couldn't generate selector");
      }

      let action = actionType === "submit" ? "submit" : "click";
      let value = null;
      if (action !== "submit") {
        if (isInput) {
          action = "type";
          value = actionable.value || "";
        } else if (isContentEditable) {
          action = "type";
          value = actionable.innerText || "";
        }
      }

      const textHint = (actionable.innerText || actionable.textContent || "").trim();
      const defaultInstruction = textHint
        ? `Interact: ${textHint.slice(0, 60)}`
        : "Step recorded";
      let instruction = defaultInstruction;
      try {
        const prompted = prompt("Describe this step:", defaultInstruction);
        if (prompted && prompted.trim()) {
          instruction = prompted.trim();
        }
      } catch (_) {}

      const finalTarget = capturedTarget ? { ...capturedTarget } : {};
      finalTarget.innerText = textHint;

      const step = {
        selector,
        instruction,
        action,
        value,
        tagName: actionable.tagName ? actionable.tagName.toLowerCase() : null,
        target: finalTarget,
        screenshot: null,
        frameId: currentFrameId,
        frameHref: window.location.href,
        createdAt: Date.now(),
        eventType: actionType,
      };

      // Persist synchronously so we survive reloads.
      persistPendingStep(step);

      // Wait for the screenshot (up to 2500ms) before sending to the background
      try {
        const screenshot = await captureScreenWithTimeout(2500);
        if (screenshot) {
          step.screenshot = screenshot;
          persistPendingStep(step); // refresh with screenshot
        }
      } catch (err) {
        console.warn("NexAura: screenshot (fast) failed", err);
      }

      // NOW send to background, ensuring the screenshot is attached if it succeeded
      const sendToBackground = new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "RECORD_STEP", payload: step }, (res) => {
          if (chrome.runtime.lastError) {
            console.warn("RECORD_STEP failed:", chrome.runtime.lastError.message);
            resolve(false);
            return;
          }
          if (res?.ok) {
            clearPendingStep();
          }
          resolve(true);
        });
      });

      currentGuideSteps.push(step);

      // We await these so they finish before we trigger the actual click replay
      await syncSharedState().catch((err) =>
        console.warn("NexAura: async syncSharedState failed", err)
      );
      await sendToBackground;

      // Replay the user's intended action after a short pause.
      setTimeout(() => {
        try {
          isProgrammaticallyClicking = true;
          if (actionType === "submit") {
            const form = actionable.closest("form") || actionable;
            if (form && typeof form.requestSubmit === "function") {
              form.requestSubmit(submitter || undefined);
            } else if (form && typeof form.submit === "function") {
              form.submit();
            } else if (typeof actionable.submit === "function") {
              actionable.submit();
            } else {
              actionable.click();
            }
          } else {
            const eventInit = {
              view: window,
              bubbles: true,
              cancelable: true,
              composed: true, // Crucial for Shadow DOMs and React event delegation
              buttons: (event && event.buttons) || 1,
              clientX: (event && event.clientX) || 0,
              clientY: (event && event.clientY) || 0,
              screenX: (event && event.screenX) || 0,
              screenY: (event && event.screenY) || 0,
              ctrlKey: (event && event.ctrlKey) || false,
              altKey: (event && event.altKey) || false,
              shiftKey: (event && event.shiftKey) || false,
              metaKey: (event && event.metaKey) || false
            };

            // 1. Dispatch a full sequence of events for SPAs like React and for complex players like YouTube
            actionable.dispatchEvent(new MouseEvent("mousedown", eventInit));
            actionable.dispatchEvent(new MouseEvent("mouseup", eventInit));
            actionable.dispatchEvent(new MouseEvent("click", eventInit));

            // 2. Fallback: If it's an SVG or span inside an <a> tag, and the SPA 
            // didn't handle the simulated event, force the native behavior
            const anchor = actionable.closest("a");
            if (anchor && anchor.href && !anchor.href.startsWith("javascript:") && !anchor.getAttribute('href').startsWith('#')) {
               // If the click wasn't caught by the SPA router, manually navigate
               window.location.href = anchor.href;
            }
          }
        } catch (err) {
          console.warn("NexAura: replay failed", err);
        } finally {
          setTimeout(() => {
            isProgrammaticallyClicking = false;
            isProcessingInteraction = false; // <--- RELEASE THE LOCK ON SUCCESS
          }, 0);
        }
      }, REPLAY_DELAY_MS);
      
    } catch (err) {
      console.error("NexAura: Error processing interaction", err);
      isProcessingInteraction = false; // <--- RELEASE THE LOCK ON ERROR
    }
  }

  function attachRecordingHooks() {
    if (isRecording) return;
    isRecording = true;
    document.addEventListener("click", handleInteraction, true);
    document.addEventListener("submit", handleInteraction, true);
    if (isTopFrame) {
      enterRecordingOverlay();
    }
  }

  function detachRecordingHooks() {
    if (!isRecording) return;
    isRecording = false;
    document.removeEventListener("click", handleInteraction, true);
    document.removeEventListener("submit", handleInteraction, true);
    if (isTopFrame) {
      exitRecordingOverlay();
    }
  }

  async function startRecording() {
    if (isRecording) return;
    pendingRecordingSteps = null;
    currentGuideSteps = [];
    attachRecordingHooks();
    await syncSharedState();
  }

  async function resumeRecordingFromState() {
    attachRecordingHooks();
  }

  async function stopRecording() {
    if (!isRecording) return;
    detachRecordingHooks();
    await syncSharedState();
  }

  // ---------- wait for element ----------
  function findElementsBySelector(selector) {
    if (!selector) return [];
    try {
      return Array.from(document.querySelectorAll(selector)).filter(
        (el) => el instanceof Element
      );
    } catch (e) {
      console.warn("findElementBySelector: invalid selector", selector, e);
      return [];
    }
  }

  function findElementByTextSnapshot(tagName, textSnapshot) {
    const normalizedTarget = normalizeText(textSnapshot);
    if (!normalizedTarget) return null;
    const fallbackSelectorList =
      "a,button,input,textarea,select,label,div,span,li,p,h1,h2,h3,h4,h5,h6,section,article,td,tr";
    const selectorOrder = [];
    if (tagName) selectorOrder.push(tagName.toLowerCase());
    selectorOrder.push(fallbackSelectorList);
    selectorOrder.push("*:not(script):not(style)");
    const seen = new Set();
    for (const selector of selectorOrder) {
      let fallbackMatch = null;
      const scope = document.querySelectorAll(selector);
      for (const candidate of scope) {
        if (!(candidate instanceof Element)) continue;
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        const candidateText = normalizeText(
          candidate.innerText || candidate.textContent || ""
        );
        if (!candidateText) continue;
        if (candidateText === normalizedTarget) {
          return candidate;
        }
        if (
          !fallbackMatch &&
          (candidateText.includes(normalizedTarget) ||
            normalizedTarget.includes(candidateText))
        ) {
          fallbackMatch = candidate;
        }
      }
      if (fallbackMatch) {
        return fallbackMatch;
      }
    }
    return null;
  }

  function isElementVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function computeCandidateScore(el, targetMeta, action) {
    if (!el) return 0;
    let score = 0;
    const fp = targetMeta?.fingerprint || {};
    const tag = el.tagName ? el.tagName.toLowerCase() : null;
    if (fp.tag && tag === fp.tag) score += 2.5;
    if (fp.tag && tag && tag !== fp.tag) score -= 1.5; // penalize wrong tag

    const role = el.getAttribute("role");
    if (fp.role && role && role.toLowerCase() === fp.role) score += 1.2;
    if (fp.role && role && role.toLowerCase() !== fp.role) score -= 0.5;

    if (fp.ariaLabel) {
      const aria = normalizeText(el.getAttribute("aria-label"));
      if (aria && aria === normalizeText(fp.ariaLabel)) score += 1.2;
    }
    if (fp.text) {
      const txt = normalizeText(el.textContent || el.value || "");
      if (txt) {
        if (txt === fp.text) {
          score += 1.5;
        } else if (txt.includes(fp.text) || fp.text.includes(txt)) {
          score += 0.6;
        }
      }
    }
    if (fp.classTokens && fp.classTokens.length) {
      const classes = new Set(Array.from(el.classList || []));
      const hits = fp.classTokens.filter((c) => classes.has(c)).length;
      score += hits * 0.3;
    }
    if (action === "click") {
      const roleAttr = (el.getAttribute("role") || "").toLowerCase();
      const typeAttr = (el.getAttribute("type") || "").toLowerCase();
      const isButtonish =
        tag === "button" ||
        roleAttr === "button" ||
        roleAttr === "menuitem" ||
        tag === "a";
      if (isButtonish) score += 1.5;
      const isInputControl =
        tag === "input" || tag === "textarea" || tag === "select";
      if (isInputControl && !isButtonish) score -= 1.5;
      if (typeAttr === "search" || typeAttr === "text") score -= 0.8;
    }
    if (isElementVisible(el)) score += 0.5;
    return score;
  }

  function shouldDiscardCandidate(el, targetMeta, action) {
    if (!el) return true;
    if (action !== "click") return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : null;
    const role = (el.getAttribute("role") || "").toLowerCase();
    const fp = targetMeta?.fingerprint || {};
    const targetTag = fp.tag || null;
    const targetRole = fp.role || null;

    const isInputControl =
      tag === "input" || tag === "textarea" || tag === "select";
    const isButtonish =
      tag === "button" ||
      role === "button" ||
      role === "menuitem" ||
      tag === "a";

    // If the target was recorded as a button-ish control, skip plain inputs.
    if (
      (targetTag === "button" || targetRole === "button") &&
      isInputControl &&
      !isButtonish
    ) {
      return true;
    }

    // If target fingerprint text exists, discard candidates whose text is empty when target text is non-empty.
    if (fp.text) {
      const candidateText = normalizeText(el.textContent || el.value || "");
      if (!candidateText) return true;
    }

    return false;
  }

  async function findElementForStep(step, maxAttempts = 10, delayMs = 300) {
    if (!step) return null;
    const targetMeta = step.target || null;
    for (let i = 0; i < maxAttempts; i++) {
      const candidates = [];
      const selectorMatches = findElementsBySelector(step.selector);

      // Text-based disambiguation for repeated selectors (e.g., Trello cards with the same data-testid).
      let filteredMatches = selectorMatches;
      const recordedText =
        typeof step?.target?.innerText === "string"
          ? step.target.innerText.trim()
          : "";
      if (recordedText && selectorMatches.length > 1) {
        const textMatches = selectorMatches.filter((el) => {
          const txt = (el.innerText || el.textContent || "").trim();
          return txt && txt.includes(recordedText);
        });
        if (textMatches.length) {
          filteredMatches = textMatches;
        }
      }

      filteredMatches.forEach((el) => {
        if (!el) return;
        candidates.push({ el, reason: "selector" });
      });

      if (step.textSnapshot) {
        const searchTag = step.textTagName || step.tagName;
        const textMatches = findElementByTextSnapshot(
          searchTag,
          step.textSnapshot
        );
        if (textMatches) {
          candidates.push({ el: textMatches, reason: "text" });
        }
      }

      const scored = candidates
        .filter(
          (c) =>
            c.el &&
            isElementVisible(c.el) &&
            !shouldDiscardCandidate(c.el, targetMeta, step.action)
        )
        .map((c) => {
          let score = computeCandidateScore(c.el, targetMeta, step.action);
          if (document.activeElement === c.el) score += 0.5;
          score += 0.2;
          return { ...c, score };
        });

      if (scored.length) {
        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score >= 0.5) {
          return scored[0].el;
        }
      }

      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return null;
  }

  function delegatePlaybackStep(step) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "DELEGATE_PLAYBACK_STEP",
          targetFrameId:
            typeof step?.frameId === "number" ? step.frameId : undefined,
          targetFrameHref: step?.frameHref,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, error: "No response from frame." });
        }
      );
    });
  }

  // ---------- playback ----------
  async function startPlayback(guide) {
    // Require auth token to run guides fetched from backend.
    const token = await new Promise((resolve) =>
      chrome.storage.local.get("nexaura_token", (data) =>
        resolve(data?.nexaura_token || null)
      )
    );
    if (!token) {
      alert("Please log in to NexAura before running a guide.");
      return { ok: false, error: "Not authenticated" };
    }

    let normalized = guide;
    try {
      const { migrateGuide } = await loadModule("core/guideSchema.js");
      normalized = migrateGuide(guide);
    } catch (e) {
      console.warn("migrateGuide failed", e);
    }
    playbackGuide = normalized || guide;
    currentStepIndex = 0;
    lastHighlightedStepIndex = null;
    stepInteractionCompleted = true; // RESET THE LOCK
    await syncSharedState();
    // Panel / overlay will call EXECUTE_NEXT_PLAYBACK_STEP manually
    return { ok: true };
  }

  async function finishPlayback() {
    playbackGuide = null;
    currentStepIndex = 0;
    lastHighlightedStepIndex = null;
    stepInteractionCompleted = true; // RESET THE LOCK
    showLiveHighlight([]);
    await syncSharedState();
  }

  async function showPlaybackStep(options = {}) {
    if (!playbackGuide) return { ok: false, error: "No guide active." };

    if (currentStepIndex >= playbackGuide.steps.length) {
      await finishPlayback();
      return { ok: false, error: "Guide finished." };
    }

    const step = playbackGuide.steps[currentStepIndex];
    const shouldSkipDelegation = !!options.skipDelegation;
    const resolveOpts = { timeoutMs: 6000, retries: 1 };
    if (!shouldSkipDelegation) {
      const frameMatches =
        typeof step.frameId !== "number" || step.frameId === currentFrameId;
      if (!frameMatches) {
        return delegatePlaybackStep(step);
      }
    }

    let resolveTargetFn = null;
    try {
      const mod = await loadModule("core/locatorEngine/resolveTarget.js");
      resolveTargetFn = mod.resolveTarget;
    } catch (e) {
      console.warn("resolveTarget module failed", e);
    }

    let el = null;
    if (resolveTargetFn && step.target) {
      const res = await resolveTargetFn(step.target, resolveOpts);
      if (res?.status === "SUCCESS" && res.element) {
        el = res.element;
      }
    }

    if (!el) {
      const fallback = await findElementForStep(step, 12, 300);
      el = fallback;
    }

    if (!el) {
      // Try vision fallback if template present
      if (step?.target?.vision?.templateId) {
        try {
          const { visionFindElement } = await loadModule(
            "core/vision/visionFallback.js"
          );
          const visionEl = await visionFindElement(step.target, []);
          if (visionEl) {
            el = visionEl;
          }
        } catch (e) {
          console.warn("vision fallback failed", e);
        }
      }
    }

    if (!el) {
      if (!shouldSkipDelegation) {
        const delegated = await delegatePlaybackStep(step);
        if (delegated?.ok) {
          return delegated;
        }
      }
      repairStepIndex = currentStepIndex;
      if (isTopFrame) {
        showRepairOverlay({
          screenshot:
            step?.target?.vision?.templateId || step?.screenshot || null,
        });
        setOverlayVisible(false);
      }
      chrome.runtime.sendMessage(
        { type: "PLAYBACK_STEP_NOT_FOUND", stepIndex: currentStepIndex, step },
        () => {}
      );
      return { ok: false, error: "Element not found." };
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
    activePlaybackElement = el;
    activePlaybackStep = step;
    stepInteractionCompleted = false;

    // NO automatic click/type. User manually interacts with the element.
    chrome.runtime.sendMessage(
      { type: "PLAYBACK_STEP_READY", stepIndex: currentStepIndex, step },
      () => {}
    );

    lastHighlightedStepIndex = currentStepIndex;
    currentStepIndex++;

    chrome.runtime.sendMessage(
      { type: "PLAYBACK_CONTINUE", stepIndex: currentStepIndex },
      () => {}
    );

    await syncSharedState();

    return {
      ok: true,
      nextIndex: currentStepIndex,
      highlightedIndex: lastHighlightedStepIndex,
      remaining:
        playbackGuide && playbackGuide.steps
          ? playbackGuide.steps.length - currentStepIndex
          : 0,
    };
  }

  // ---------- server helpers ----------
  async function fetchGuidesFromServer() {
    const tokenObj = await new Promise((r) =>
      chrome.storage.local.get("nexaura_token", r)
    );
    const token = tokenObj?.nexaura_token;
    if (!token) throw new Error("No token. Please log in.");
    const cache = await readScreenshotCache();
    const res = await fetch("http://127.0.0.1:8000/api/guides/", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch guides");
    const guides = await res.json();
    const userId = getUserIdFromToken(token);
    let scopedGuides = guides;
    if (userId) {
      const filtered = guides.filter((g) => g.owner_id === userId);
      scopedGuides = filtered.length ? filtered : guides;
    }
    return scopedGuides.map((g) => hydrateGuideScreenshots(g, cache));
  }

  function getUserIdFromToken(token) {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      // common JWT claim names: sub or user_id
      return payload.sub || payload.user_id || null;
    } catch (e) {
      return null;
    }
  }

  async function saveGuideToServer(guide) {
    const tokenObj = await new Promise((r) =>
      chrome.storage.local.get("nexaura_token", r)
    );
    const token = tokenObj?.nexaura_token;
    if (!token) throw new Error("No token. Please log in.");
    
    const cachePayload = {};
    (guide.steps || []).forEach((s, idx) => {
      if (s.screenshot) {
        cachePayload[idx + 1] = s.screenshot;
      }
    });

    const payload = {
      name: guide.name,
      shortcut: guide.shortcut,
      description: guide.description,
      steps: (guide.steps || []).map((s) => ({
        selector: s.selector || s?.target?.preferredLocators?.[0]?.value || "",
        instruction: s.instruction || "",
        action: s.action || null,
        target: s.target || null,
        screenshot: s.screenshot || null,
      })),
    };

    const res = await fetch("http://127.0.0.1:8000/api/guides/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "unknown" }));
      throw new Error(err.detail || "Failed to save guide");
    }
    
    const saved = await res.json();
    
    // --- NEW: GARBAGE COLLECTION ---
    // Instead of saving these massive images permanently, we 
    // clear the temporary recording storage to free up the browser's RAM!
    await clearRecordingStateStorage();
    // -------------------------------
    
    return saved;
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

  // screenshot cache for repair/vision (local only)
  async function readScreenshotCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get("nexaura_screenshot_cache", (data) => {
        resolve(data?.nexaura_screenshot_cache || {});
      });
    });
  }

  async function writeScreenshotCache(guideId, stepMap) {
    return new Promise((resolve) => {
      chrome.storage.local.get("nexaura_screenshot_cache", (data) => {
        const cache = data?.nexaura_screenshot_cache || {};
        cache[guideId] = { ...(cache[guideId] || {}), ...stepMap };
        chrome.storage.local.set({ nexaura_screenshot_cache: cache }, () =>
          resolve()
        );
      });
    });
  }

  function hydrateGuideScreenshots(guide, cache) {
    if (!guide || !cache) return guide;
    const guideCache = cache[guide.id];
    if (!guideCache) return guide;
    const steps = Array.isArray(guide.steps) ? guide.steps.slice() : [];
    steps.forEach((s, idx) => {
      const shot = guideCache[s.step_number || idx + 1];
      if (shot) {
        if (!s.target) s.target = {};
        if (!s.target.vision) s.target.vision = {};
        s.target.vision.templateId = shot;
        s.screenshot = shot;
      }
    });
    return { ...guide, steps };
  }

  function getPanelWidth() {
    if (!isTopFrame || !iframe) return 400;
    const parsed = parseInt(iframe.style.width, 10);
    if (!Number.isNaN(parsed)) return parsed;
    return iframe.getBoundingClientRect().width || 400;
  }

  function updatePeekHandle() {
    if (!isTopFrame || !peekHandle) return;
    const offset = panelVisible ? getPanelWidth() + 12 : 0;
    peekHandle.style.transform = `translate3d(-${offset}px, -50%, 0)`;
    peekHandle.style.display = panelVisible ? "flex" : "none";
  }

  function updatePeekButtonLabel() {
    if (!isTopFrame || !peekButton) return;
    peekButton.textContent = isPeekThrough ? "Return chat" : "Peek through";
    peekButton.setAttribute(
      "aria-label",
      isPeekThrough
        ? "Return focus to NexAura panel"
        : "Peek through panel so you can click the page"
    );
    peekButton.setAttribute("aria-pressed", isPeekThrough ? "true" : "false");
  }

  function showPanel() {
    if (!isTopFrame || !iframe) return;
    if (!iframe) return;
    iframe.style.transform = "translateX(0%)";
    panelVisible = true;
    setPeekThrough(false);
    updatePeekHandle();
  }

  function hidePanel() {
    if (!isTopFrame || !iframe) return;
    if (!iframe) return;
    iframe.style.transform = "translateX(100%)";
    panelVisible = false;
    setPeekThrough(false);
    updatePeekHandle();
  }

  function setPeekThrough(enabled) {
    if (!isTopFrame) return;
    isPeekThrough = enabled;
    if (iframe) {
      iframe.style.pointerEvents = enabled ? "none" : "auto";
      iframe.style.opacity = enabled ? "0.35" : "1";
      iframe.style.filter = enabled ? "saturate(0.4)" : "none";
    }
    updatePeekButtonLabel();
  }

  function ensurePeekHandle() {
    if (!isTopFrame) return;
    if (peekHandle) return;

    peekHandle = document.createElement("div");
    peekHandle.id = "nexaura-peek-handle";
    Object.assign(peekHandle.style, {
      position: "fixed",
      top: "50%",
      right: "16px",
      transform: "translate3d(0, -50%, 0)",
      zIndex: 2147483647,
      display: "none",
    });

    peekButton = document.createElement("button");
    peekButton.type = "button";
    peekButton.textContent = "Peek through";
    Object.assign(peekButton.style, {
      border: "none",
      borderRadius: "999px 0 0 999px",
      padding: "10px 18px",
      fontSize: "13px",
      fontWeight: "600",
      color: "#fff",
      background: "linear-gradient(135deg,#D93B3B 0%,#E87C32 100%)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    peekButton.addEventListener("click", () => {
      setPeekThrough(!isPeekThrough);
    });

    peekHandle.appendChild(peekButton);
    document.body.appendChild(peekHandle);
    updatePeekButtonLabel();

    window.addEventListener("resize", () => {
      updatePeekHandle();
    });
  }

  function getDefaultOverlayState() {
    return {
      title: "",
      body: "",
      primaryLabel: "",
      primaryEnabled: true,
      secondaryLabel: "",
      secondaryEnabled: true,
      secondaryVisible: false,
    };
  }

  function ensureOverlayFrame() {
    if (!isTopFrame) return null;
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", () => { ensureOverlayFrame(); }, { once: true });
      return null;
    }
    if (overlayFrame && overlayFrame.isConnected) return overlayFrame;

    overlayFrame = document.createElement("iframe");
    overlayFrame.id = "nexaura-overlay-frame";
    Object.assign(overlayFrame.style, {
      position: "fixed",
      bottom: "24px",                  // Lifted slightly
      left: "50%",                     // Move to horizontal center
      transform: "translateX(-50%)",   // Perfect mathematical centering
      right: "auto",                   // Clear right-alignment
      width: "280px",                  
      height: "150px",
      border: "none",
      borderRadius: "16px",
      overflow: "hidden",
      background: "transparent",
      boxShadow: "0 18px 45px rgba(0,0,0,0.4)",
      zIndex: 2147483646,
      display: overlayVisible ? "block" : "none",
      pointerEvents: "auto",
    });
    overlayFrame.src = chrome.runtime.getURL("overlay.html");
    overlayFrame.sandbox = "allow-scripts allow-same-origin";
    overlayFrameReady = false;
    document.body.appendChild(overlayFrame);
    deliverOverlayState();
    return overlayFrame;
  }

  // ---------- overlay drag support ----------
  function beginOverlayDrag(payload) {
    if (!overlayFrame) return;
    const rect = overlayFrame.getBoundingClientRect();
    overlayDrag = {
      startScreenX: payload?.screenX || 0,
      startScreenY: payload?.screenY || 0,
      startLeft: rect.left,
      startTop: rect.top,
    };

    overlayFrame.style.right = "auto";
    overlayFrame.style.bottom = "auto";
    
    // Remove the centering transform so the drag math uses raw coordinates!
    overlayFrame.style.transform = "none"; 

    overlayFrame.style.left = `${rect.left}px`;
    overlayFrame.style.top = `${rect.top}px`;
    overlayFrame.style.transition = "none";
  }

  function updateOverlayDrag(payload) {
    if (!overlayDrag || !overlayFrame) return;
    const dx = (payload?.screenX || 0) - overlayDrag.startScreenX;
    const dy = (payload?.screenY || 0) - overlayDrag.startScreenY;
    const w = overlayFrame.getBoundingClientRect().width;
    const h = overlayFrame.getBoundingClientRect().height;
    
    // Keep it on screen
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;
    const nextX = Math.min(Math.max(8, overlayDrag.startLeft + dx), maxX);
    const nextY = Math.min(Math.max(8, overlayDrag.startTop + dy), maxY);
    
    overlayFrame.style.left = `${nextX}px`;
    overlayFrame.style.top = `${nextY}px`;
  }

  function endOverlayDrag() {
    overlayDrag = null;
    if (overlayFrame) {
      overlayFrame.style.transition = "box-shadow 0.2s ease";
    }
  }

  function handleOverlayFrameMessage(event) {
    if (!overlayFrame || event.source !== overlayFrame.contentWindow) return;
    const data = event.data || {};
    const { type, payload } = data;

    // --- NEW: CATCH DRAG EVENTS ---
    if (type === "NEXAURA_OVERLAY_DRAG_START") {
      beginOverlayDrag(payload);
      return;
    }
    if (type === "NEXAURA_OVERLAY_DRAG_MOVE") {
      updateOverlayDrag(payload);
      return;
    }
    if (type === "NEXAURA_OVERLAY_DRAG_END") {
      endOverlayDrag();
      return;
    }
    // ------------------------------

    if (type === "NEXAURA_OVERLAY_READY") {
      overlayFrameReady = true;
      if (overlayPendingState) {
        overlayFrame.contentWindow.postMessage(
          { type: "NEXAURA_SET_STATE", payload: overlayPendingState },
          "*"
        );
      } else {
        deliverOverlayState();
      }
      return;
    }

    if (type === "NEXAURA_OVERLAY_PRIMARY") {
      if (typeof overlayPrimaryAction === "function") {
        overlayPrimaryAction();
      }
      return;
    }

    if (type === "NEXAURA_OVERLAY_SECONDARY") {
      if (typeof overlaySecondaryAction === "function") {
        overlaySecondaryAction();
      }
      return;
    }

    if (type === "NEXAURA_OVERLAY_HEIGHT") {
      const rawHeight = payload?.height || 0;
      // INCREASED MAX HEIGHT: Changed 280 to 340 so long text doesn't hide buttons
      const clamped = Math.min(Math.max(rawHeight, 120), 340);
      overlayFrame.style.height = `${clamped}px`;
    }
  }

  function deliverOverlayState() {
    if (!overlayFrame) return;
    overlayPendingState = { ...overlayState };
    if (overlayFrameReady && overlayFrame.contentWindow) {
      overlayFrame.contentWindow.postMessage(
        { type: "NEXAURA_SET_STATE", payload: overlayPendingState },
        "*"
      );
    }
  }

  function ensureRepairOverlay() {
    if (!isTopFrame) return null;
    if (repairOverlay && repairOverlay.isConnected) return repairOverlay;
    repairOverlay = document.createElement("iframe");
    Object.assign(repairOverlay.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      width: "300px",
      height: "260px",
      border: "none",
      borderRadius: "14px",
      overflow: "hidden",
      boxShadow: "0 18px 45px rgba(0,0,0,0.4)",
      zIndex: 2147483646,
      display: "none",
    });
    repairOverlay.src = chrome.runtime.getURL("repairOverlay.html");
    document.body.appendChild(repairOverlay);
    return repairOverlay;
  }

  function showRepairOverlay(payload) {
    const frame = ensureRepairOverlay();
    if (!frame) return;
    repairActive = true;
    frame.style.display = "block";
    frame.contentWindow?.postMessage({ type: "REPAIR_SHOW", payload }, "*");
  }

  function hideRepairOverlay() {
    if (!repairOverlay) return;
    repairActive = false;
    repairSelectMode = false;
    repairStepIndex = null;
    repairOverlay.style.display = "none";
  }

  function handleRepairOverlayMessage(event) {
    if (!repairOverlay || event.source !== repairOverlay.contentWindow) return;
    const data = event.data || {};
    if (data.type === "REPAIR_OVERLAY_READY") {
      return;
    }
    if (data.type === "REPAIR_CLICK_MODE") {
      repairSelectMode = true;
      document.addEventListener("click", captureRepairClick, true);
      hidePanel();
      return;
    }
    if (data.type === "REPAIR_SKIP") {
      hideRepairOverlay();
      handleOverlayStopPlayback();
      return;
    }
  }

  async function captureRepairClick(evt) {
    if (!repairSelectMode) return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.stopImmediatePropagation();
    repairSelectMode = false;
    document.removeEventListener("click", captureRepairClick, true);
    const el = evt.target;
    if (!(el instanceof Element)) {
      hideRepairOverlay();
      return;
    }
    let newTarget = null;
    try {
      const { captureTarget } = await loadModule(
        "core/recording/captureTarget.js"
      );
      newTarget = captureTarget(el, {
        id: currentFrameId,
        href: window.location.href,
      });
    } catch (e) {
      console.warn("repair capture failed", e);
    }
    if (
      playbackGuide &&
      typeof repairStepIndex === "number" &&
      playbackGuide.steps[repairStepIndex]
    ) {
      playbackGuide.steps[repairStepIndex].target = newTarget;
      if (
        !playbackGuide.steps[repairStepIndex].preferredLocators &&
        newTarget?.preferredLocators
      ) {
        playbackGuide.steps[repairStepIndex].preferredLocators =
          newTarget.preferredLocators;
      }
      // retry current step
      currentStepIndex = repairStepIndex;
    }
    hideRepairOverlay();
    setOverlayVisible(true);
    await handleOverlayNextStep();
  }

  function setOverlayState(partial) {
    if (!isTopFrame) return;
    ensureOverlayFrame();
    overlayState = { ...overlayState, ...partial };
    deliverOverlayState();
  }

  function resetOverlayState() {
    overlayState = getDefaultOverlayState();
    deliverOverlayState();
  }

  function setOverlayVisible(visible) {
    if (!isTopFrame) return;
    overlayVisible = visible;
    const frame = ensureOverlayFrame();
    if (frame) {
      frame.style.display = visible ? "block" : "none";
    }
    if (!visible) {
      overlayMode = null;
      overlayPrimaryAction = null;
      overlaySecondaryAction = null;
      resetOverlayState();
    }
  }

  function enterRecordingOverlay() {
    if (!isTopFrame) return;
    ensureOverlayFrame();
    overlayMode = "recording";
    overlayPrimaryAction = handleOverlayStopRecording;
    overlaySecondaryAction = null;
    setOverlayState({
      title: "Recording guide",
      body: "Click anywhere on the page to capture a step. Use Stop when you are done.",
      primaryLabel: "Stop recording",
      primaryEnabled: true,
      secondaryLabel: "",
      secondaryEnabled: true,
      secondaryVisible: false,
    });
    setOverlayVisible(true);
    hidePanel();
  }

  function exitRecordingOverlay() {
    if (!isTopFrame) return;
    if (overlayMode === "recording") {
      setOverlayVisible(false);
    }
  }

  function enterPlaybackOverlay() {
    if (!isTopFrame) return;
    ensureOverlayFrame();
    overlayMode = "playback";
    overlayPrimaryAction = handleOverlayNextStep;
    overlaySecondaryAction = handleOverlayStopPlayback;
    setOverlayVisible(true);
    updatePlaybackOverlay();
    hidePanel();
  }

  function exitPlaybackOverlay() {
    if (!isTopFrame) return;
    if (overlayMode === "playback") {
      setOverlayVisible(false);
    }
  }

  function updatePlaybackOverlay() {
    if (overlayMode !== "playback") return;
    ensureOverlayFrame();

    if (!playbackGuide) {
      overlayPrimaryAction = handleOverlayNextStep;
      overlaySecondaryAction = handleOverlayStopPlayback;
      setOverlayState({
        title: "Guide playback",
        body: "No guide loaded.",
        primaryLabel: "Next step",
        primaryEnabled: false,
        secondaryVisible: false,
      });
      return;
    }

    const steps = playbackGuide.steps || [];
    if (!steps.length) {
      overlaySecondaryAction = () => {
        exitPlaybackOverlay();
        showPanel();
      };
      setOverlayState({
        title: "Guide playback",
        body: "This guide has no steps.",
        primaryLabel: "Done",
        primaryEnabled: false,
        secondaryLabel: "Close",
        secondaryEnabled: true,
        secondaryVisible: true,
      });
      return;
    }

    const hasActiveStep =
      typeof lastHighlightedStepIndex === "number" &&
      lastHighlightedStepIndex < steps.length;
      
    if (!hasActiveStep && currentStepIndex >= steps.length) {
      overlayPrimaryAction = () => {
        finalizePlayback("finished");
      };
      overlaySecondaryAction = null;
      setOverlayState({
        title: "Guide playback",
        body: "Guide finished.",
        primaryLabel: "Back to Copilot",
        primaryEnabled: true,
        secondaryVisible: false,
      });
      return;
    }

    const displayIndex = hasActiveStep
      ? Math.min(lastHighlightedStepIndex, steps.length - 1)
      : Math.min(currentStepIndex, steps.length - 1);
    const step = steps[displayIndex];
    overlayPrimaryAction = handleOverlayNextStep;
    overlaySecondaryAction = handleOverlayStopPlayback;
    const isLastHighlighted =
      hasActiveStep && displayIndex === steps.length - 1;

    // --- ENFORCE BUTTON LOCK ---
    // Only lock if we are actively highlighting a step AND it's not the very end.
    let isPrimaryEnabled = true;
    if (hasActiveStep && currentStepIndex <= steps.length) {
       isPrimaryEnabled = stepInteractionCompleted;
    }

    setOverlayState({
      title: "Guide playback",
      body: `Step ${displayIndex + 1} of ${steps.length}\n${
        step.instruction || "Follow the highlighted element."
      }`,
      primaryLabel: hasActiveStep
        ? isLastHighlighted && currentStepIndex >= steps.length
          ? "Finish"
          : "Next step"
        : displayIndex === 0
        ? "Start"
        : "Next step",
        
      primaryEnabled: isPrimaryEnabled, // Apply calculated lock here
      
      secondaryLabel: "Stop",
      secondaryEnabled: true,
      secondaryVisible: true,
    });
  }

  async function handleOverlayStopRecording() {
    // --- NEW: CRITICAL FIX ---
    // Always check for restored state first. If the page just loaded,
    // we might not have pulled the data from storage yet.
    await restoreRecordingStateIfNeeded();
    // -------------------------

    if (!isRecording) {
      exitRecordingOverlay();
      showPanel();
      return;
    }
    
    setOverlayState({ primaryEnabled: false });
    await stopRecording();
    const steps = currentGuideSteps.slice();
    currentGuideSteps = [];
    await setPendingRecordedSteps(steps);
    exitRecordingOverlay();
    showPanel();
    chrome.runtime.sendMessage(
      { type: "OVERLAY_RECORDING_FINISHED", steps },
      () => {}
    );
  }

  async function handleOverlayNextStep() {
    if (!playbackGuide) return;
    setOverlayState({ primaryEnabled: false }); // Lock while searching
    const steps = playbackGuide.steps || [];
    
    // --- FIX: ACTUALLY FINISH THE GUIDE ---
    if (currentStepIndex >= steps.length) {
      // If we are out of steps, the user clicked "Finish". Shut it down!
      await finalizePlayback("finished");
      return;
    }
    // --------------------------------------

    const result = await showPlaybackStep();
    
    if (typeof result?.nextIndex === "number") {
      currentStepIndex = result.nextIndex;
    }
    if (typeof result?.highlightedIndex === "number") {
      lastHighlightedStepIndex = result.highlightedIndex;
    }

    if (!result?.ok) {
      if (result?.error === "Guide finished.") {
        return;
      }
      setOverlayState({
        body:
          result?.error ||
          "Couldn't locate that element. Make sure the page hasn't changed.",
        primaryLabel: "Try again",
        primaryEnabled: true, // Re-enable so they can click "Try again"
      });
      return;
    }

    updatePlaybackOverlay();
  }

  async function handleOverlayStopPlayback() {
    setOverlayState({ primaryEnabled: false, secondaryEnabled: false });
    await finalizePlayback("stopped");
  }

  async function finalizePlayback(reason) {
    await finishPlayback();
    exitPlaybackOverlay();
    showPanel();
    chrome.runtime.sendMessage(
      { type: "OVERLAY_PLAYBACK_FINISHED", reason },
      () => {}
    );
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== recordingStorageArea) return;
    const key = recordingStateKey;
    if (!key) return;
    const change = changes[key];
    if (!change) return;
    if (suppressStorageEvents) return;
    if (change.newValue) {
      applyRecordingStateSnapshot(change.newValue);
    }
  });

  // ---------- message handler ----------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    readyPromise
      .then(() => processRuntimeMessage(message, sendResponse))
      .catch((err) => {
        console.error("Recorder init failed:", err);
        sendResponse?.({ ok: false, error: "Recorder not ready" });
      });
    return true;
  });

  function processRuntimeMessage(message, sendResponse) {
    if (message.type === "SHOW_IFRAME") {
      showPanel();
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "HIDE_IFRAME") {
      hidePanel();
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "PING_CONTENT") {
      sendResponse?.({ ready: true });
      return;
    }

    if (message.type === "START_RECORDING") {
      (async () => {
        await startRecording();
        sendResponse?.({ ok: true });
      })();
      return true;
    }

    if (message.type === "STOP_RECORDING") {
      (async () => {
        // --- NEW: WAIT FOR RESTORE ---
        // Ensure we have loaded the steps from storage (from previous page)
        // before we finalize the recording.
        await restoreRecordingStateIfNeeded();
        // -----------------------------

        await stopRecording();
        showPanel();
        const steps = currentGuideSteps.slice();
        currentGuideSteps = [];
        await setPendingRecordedSteps(steps);
        sendResponse?.({ ok: true, steps });
      })();
      return true;
    }

    if (message.type === "START_PLAYBACK") {
      (async () => {
        await startPlayback(message.guide);
        enterPlaybackOverlay();
        sendResponse?.({ ok: true });
      })();
      return true;
    }

    if (message.type === "EXECUTE_NEXT_PLAYBACK_STEP") {
      (async () => {
        const result = await showPlaybackStep();
        if (overlayMode === "playback") {
          updatePlaybackOverlay();
        }
        sendResponse?.(result);
      })();
      return true;
    }

    if (message.type === "EXECUTE_DELEGATED_PLAYBACK_STEP") {
      (async () => {
        const result = await showPlaybackStep({ skipDelegation: true });
        sendResponse?.(result);
      })();
      return true;
    }

    if (message.type === "STOP_PLAYBACK") {
      finishPlayback().then(() => {
        exitPlaybackOverlay();
        showPanel();
        sendResponse?.({ ok: true });
      });
      return true;
    }

    if (message.type === "PANEL_SHOW_CHAT") {
      showPanel();
      exitRecordingOverlay();
      exitPlaybackOverlay();
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === "GET_PANEL_STATE") {
      sendResponse?.({
        recording: isRecording,
        stepsCount: currentGuideSteps.length,
        pendingStepsCount: pendingRecordingSteps
          ? pendingRecordingSteps.length
          : 0,
        overlayMode,
        playbackActive: !!playbackGuide,
        playbackIndex: currentStepIndex,
        playbackTotal: playbackGuide?.steps ? playbackGuide.steps.length : 0,
        playbackGuideName: playbackGuide ? playbackGuide.name : null,
        playbackGuideShortcut: playbackGuide
          ? playbackGuide.shortcut || null
          : null,
      });
      return;
    }

    if (message.type === "GET_PENDING_RECORDING") {
      sendResponse?.({
        ok: true,
        steps: pendingRecordingSteps ? pendingRecordingSteps.slice() : [],
      });
      return;
    }

    if (message.type === "CONSUME_PENDING_RECORDING") {
      (async () => {
        pendingRecordingSteps = null;
        await syncSharedState();
        sendResponse?.({ ok: true });
      })();
      return true;
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
  }

  console.log("✅ NexAura content initialized");
})();
