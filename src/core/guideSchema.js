// Core guide schema (v2) with lightweight runtime validation & migration.
// This is intentionally framework-agnostic JS so it can be used in content scripts.

export const GUIDE_VERSION = 2;

export function defaultLocatorHistory() {
  return {
    lastSuccessfulLocator: null,
    successCounts: {},
  };
}

export function buildEmptyStepTarget() {
  return {
    preferredLocators: [],
    fingerprint: {
      tag: null,
      role: null,
      ariaLabel: null,
      text: null,
      attrs: {},
      classTokens: [],
    },
    context: {
      ancestorTrail: [],
      siblingIndex: null,
      nearbyAnchors: [],
      frame: {
        id: null,
        href: null,
      },
    },
    vision: {
      templateId: null,
      bbox: null,
    },
    history: defaultLocatorHistory(),
  };
}

export function migrateStep(rawStep, now = Date.now()) {
  const step = {
    id: rawStep.id || null,
    step_number: rawStep.step_number || rawStep.stepNumber || 0,
    action: rawStep.action || "click",
    instruction: rawStep.instruction || rawStep.text || "",
    target: buildEmptyStepTarget(),
    createdAt: rawStep.createdAt || now,
    updatedAt: now,
    version: GUIDE_VERSION,
  };

  // Legacy selector
  if (rawStep.selector) {
    step.target.preferredLocators.push({
      type: "css",
      value: rawStep.selector,
      confidence: 0.6,
    });
  }

  // Legacy text snapshot fields
  if (rawStep.textSnapshot) {
    step.target.preferredLocators.push({
      type: "text",
      value: rawStep.textSnapshot,
      confidence: 0.35,
    });
    step.target.fingerprint.text = normalizeText(rawStep.textSnapshot);
  }
  if (rawStep.textTagName) {
    step.target.fingerprint.tag = rawStep.textTagName;
  }
  if (rawStep.tagName) {
    step.target.fingerprint.tag = rawStep.tagName;
  }

  // Frame
  if (rawStep.frameId != null || rawStep.frameHref) {
    step.target.context.frame = {
      id: rawStep.frameId ?? null,
      href: rawStep.frameHref ?? null,
    };
  }

  // Vision metadata
  if (rawStep.screenshot || rawStep.screenshot_path) {
    step.target.vision.templateId =
      rawStep.screenshot_path || rawStep.screenshot || null;
  }

  return step;
}

export function migrateGuide(rawGuide, now = Date.now()) {
  if (!rawGuide) return null;
  const steps =
    Array.isArray(rawGuide.steps) && rawGuide.steps.length
      ? rawGuide.steps.map((s) => migrateStep(s, now))
      : [];
  return {
    id: rawGuide.id || null,
    name: rawGuide.name || "Untitled Guide",
    shortcut: rawGuide.shortcut || `/${slugify(rawGuide.name || "guide")}`,
    description: rawGuide.description || "",
    steps,
    createdAt: rawGuide.createdAt || now,
    updatedAt: now,
    version: GUIDE_VERSION,
  };
}

export function validateGuide(guide) {
  if (!guide || typeof guide !== "object") return false;
  const hasBasics =
    typeof guide.name === "string" &&
    typeof guide.shortcut === "string" &&
    Array.isArray(guide.steps);
  return hasBasics;
}

export function normalizeText(str) {
  if (!str) return "";
  return String(str).replace(/\s+/g, " ").trim().toLowerCase();
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
