const preview = document.getElementById("preview");
const holder = document.getElementById("imgHolder");
const primary = document.getElementById("primary");
const secondary = document.getElementById("secondary");

window.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "REPAIR_SHOW") {
    if (data.payload?.screenshot) {
      holder.style.display = "block";
      preview.src = data.payload.screenshot;
    } else {
      holder.style.display = "none";
      preview.src = "";
    }
  }
});

primary.addEventListener("click", () => {
  parent.postMessage({ type: "REPAIR_CLICK_MODE" }, "*");
});

secondary.addEventListener("click", () => {
  parent.postMessage({ type: "REPAIR_SKIP" }, "*");
});

parent.postMessage({ type: "REPAIR_OVERLAY_READY" }, "*");
