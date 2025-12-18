// Vision fallback using OpenCV.js template matching on a captured screenshot.
// This runs only if a template image is available and OpenCV loads successfully.

let cvReady = null;

function loadOpenCV() {
  if (cvReady) return cvReady;
  cvReady = new Promise((resolve) => {
    if (window.cv && window.cv.imread) {
      resolve(window.cv);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.onload = () => {
      if (window.cv && window.cv.imread) {
        resolve(window.cv);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return cvReady;
}

async function loadImageToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}

async function captureScreenshot() {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_SCREEN" }, (resp) => {
        if (chrome.runtime.lastError || resp?.error) {
          reject(new Error(chrome.runtime.lastError?.message || resp?.error));
          return;
        }
        resolve(resp?.image || null);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function visionFindElement(stepTarget, debug = []) {
  try {
    const templateId = stepTarget?.vision?.templateId;
    if (!templateId) return null;
    const cv = await loadOpenCV();
    if (!cv) {
      debug.push({ type: "warn", message: "OpenCV not available" });
      return null;
    }

    const [screenshot, templateCanvas] = await Promise.all([
      captureScreenshot(),
      loadImageToCanvas(templateId),
    ]);
    if (!screenshot) return null;
    const screenshotCanvas = await loadImageToCanvas(screenshot);

    const src = cv.imread(screenshotCanvas);
    const templ = cv.imread(templateCanvas);
    const result = new cv.Mat();
    cv.matchTemplate(src, templ, result, cv.TM_CCOEFF_NORMED);
    const minMax = cv.minMaxLoc(result);
    const { maxLoc, maxVal } = minMax;
    src.delete();
    templ.delete();
    result.delete();

    if (maxVal < 0.4) {
      debug.push({ type: "info", message: "vision score too low", score: maxVal });
      return null;
    }

    const centerX = maxLoc.x + templateCanvas.width / 2;
    const centerY = maxLoc.y + templateCanvas.height / 2;
    const el = document.elementFromPoint(centerX, centerY);
    if (el && el instanceof Element) {
      debug.push({ type: "info", message: "vision matched", score: maxVal });
      return el;
    }
    return null;
  } catch (e) {
    debug.push({ type: "error", message: e?.message || "vision error" });
    return null;
  }
}
