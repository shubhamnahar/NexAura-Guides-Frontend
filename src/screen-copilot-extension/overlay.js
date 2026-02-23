(function () {
  let titleEl, bodyEl, primaryBtn, secondaryBtn, buttonsWrapper, dragHandle;
  let currentState = {
    title: "",
    body: "",
    primaryLabel: "",
    primaryEnabled: true,
    secondaryLabel: "",
    secondaryEnabled: true,
    secondaryVisible: false,
  };

  function sendMessage(type, payload) {
    if (!window.parent) return;
    window.parent.postMessage({ type, payload }, "*");
  }

  function updateLayout() {
    const height = document.body.scrollHeight;
    sendMessage("NEXAURA_OVERLAY_HEIGHT", { height });
  }

  function render() {
    if (!titleEl) return;
    titleEl.textContent = currentState.title || "";
    bodyEl.textContent = currentState.body || "";

    primaryBtn.textContent = currentState.primaryLabel || "";
    primaryBtn.disabled = !currentState.primaryEnabled;
    primaryBtn.style.display = currentState.primaryLabel ? "inline-flex" : "none";

    if (currentState.secondaryVisible) {
      secondaryBtn.style.display = "inline-flex";
      secondaryBtn.textContent = currentState.secondaryLabel || "";
      secondaryBtn.disabled = !currentState.secondaryEnabled;
    } else {
      secondaryBtn.style.display = "none";
    }

    buttonsWrapper.style.display =
      primaryBtn.style.display === "none" &&
      secondaryBtn.style.display === "none"
        ? "none"
        : "flex";

    updateLayout();
  }

  function applyState(patch = {}) {
    currentState = { ...currentState, ...patch };
    render();
  }

  function init() {
    titleEl = document.getElementById("title");
    bodyEl = document.getElementById("bodyText");
    primaryBtn = document.getElementById("primaryBtn");
    secondaryBtn = document.getElementById("secondaryBtn");
    buttonsWrapper = document.getElementById("buttons");
    dragHandle = document.getElementById("dragHandle");

    primaryBtn.addEventListener("click", () => {
      sendMessage("NEXAURA_OVERLAY_PRIMARY");
    });
    secondaryBtn.addEventListener("click", () => {
      sendMessage("NEXAURA_OVERLAY_SECONDARY");
    });
    if (dragHandle) {
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        sendMessage("NEXAURA_OVERLAY_DRAG_MOVE", {
          screenX: e.screenX,
          screenY: e.screenY,
        });
      };
      const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        sendMessage("NEXAURA_OVERLAY_DRAG_END", {
          screenX: e?.screenX,
          screenY: e?.screenY,
        });
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", endDrag, true);
        window.removeEventListener("pointercancel", endDrag, true);
      };
      dragHandle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        dragging = true;
        sendMessage("NEXAURA_OVERLAY_DRAG_START", {
          screenX: e.screenX,
          screenY: e.screenY,
        });
        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", endDrag, true);
        window.addEventListener("pointercancel", endDrag, true);
      });
    }

    render();
    sendMessage("NEXAURA_OVERLAY_READY");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.type !== "NEXAURA_SET_STATE") return;
    applyState(data.payload || {});
  });

  window.addEventListener("load", init);
})();
