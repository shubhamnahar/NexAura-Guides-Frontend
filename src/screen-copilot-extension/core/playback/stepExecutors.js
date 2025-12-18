import { resolveTarget } from "../locatorEngine/resolveTarget.js";
import { StepStatus } from "./state.js";
import { isVisible } from "../locatorEngine/scoreMatch.js";

export async function executeStep(step, options = {}) {
  const abortSignal = options.signal;
  const timeoutMs = options.timeoutMs || 8000;
  const retries = options.retries ?? 1;
  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    if (abortSignal?.aborted) {
      return { status: StepStatus.SKIPPED, error: "cancelled" };
    }
    try {
      const res = await runOnce(step, timeoutMs, abortSignal);
      if (res.status === StepStatus.SUCCESS) {
        return res;
      }
      lastErr = res.error || "unknown";
    } catch (e) {
      lastErr = e?.message || "unknown";
    }
    attempt++;
    await wait(200 * attempt);
  }
  return { status: StepStatus.RECOVERABLE_FAIL, error: lastErr || "failed" };
}

async function runOnce(step, timeoutMs, signal) {
  const timer = createTimeout(timeoutMs, "step timeout");
  try {
    const targetRes = await resolveTarget(step.target || step, {
      timeoutMs,
    });
    if (targetRes.status !== "SUCCESS" || !targetRes.element) {
      return { status: StepStatus.RECOVERABLE_FAIL, error: targetRes.error || "not found" };
    }
    const el = targetRes.element;
    ensureInView(el);
    if (!isVisible(el)) {
      return { status: StepStatus.RECOVERABLE_FAIL, error: "element not visible" };
    }
    await performAction(el, step.action || "click", step.value);
    return { status: StepStatus.SUCCESS };
  } finally {
    timer.clear();
    if (signal?.aborted) {
      return { status: StepStatus.SKIPPED, error: "cancelled" };
    }
  }
}

function ensureInView(el) {
  try {
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  } catch (e) {
    /* ignore */
  }
}

async function performAction(el, action, value) {
  if (action === "type") {
    el.focus();
    el.value = value || "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (action === "click") {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
    return;
  }
  el.click();
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function createTimeout(ms, label) {
  const id = setTimeout(() => {
    console.warn(label || "timeout");
  }, ms);
  return { clear: () => clearTimeout(id) };
}
