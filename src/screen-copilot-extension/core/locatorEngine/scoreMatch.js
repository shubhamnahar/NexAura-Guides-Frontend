import { normalizeText } from "../guideSchema.js";

export function scoreCandidate({ el, target, frameHref }) {
  if (!el || !target) return 0;
  let score = 0;
  const fp = target.fingerprint || {};

  // Tag / role / aria / text
  if (fp.tag && el.tagName && el.tagName.toLowerCase() === fp.tag) score += 2;
  if (fp.role) {
    const role = el.getAttribute("role");
    if (role && role.toLowerCase() === fp.role) score += 1.5;
  }
  if (fp.ariaLabel) {
    const aria = normalizeText(el.getAttribute("aria-label"));
    if (aria && aria === normalizeText(fp.ariaLabel)) score += 1.5;
  }
  if (fp.text) {
    const txt = normalizeText(el.textContent || el.value || "");
    if (txt && (txt.includes(fp.text) || fp.text.includes(txt))) score += 1.2;
  }

  // Attribute matches (data-testid, id, type, name etc.)
  if (fp.attrs && typeof fp.attrs === "object") {
    for (const [key, val] of Object.entries(fp.attrs)) {
      const candidateVal = el.getAttribute(key);
      if (candidateVal && normalizeText(candidateVal) === normalizeText(String(val))) {
        score += 1.2;
      }
    }
  }

  // Class overlap
  if (fp.classTokens && fp.classTokens.length) {
    const classes = new Set(Array.from(el.classList || []));
    const hits = fp.classTokens.filter((c) => classes.has(c)).length;
    score += hits * 0.5;
  }

  // Sibling index proximity
  const siblingIndex = target.context?.siblingIndex;
  if (typeof siblingIndex === "number" && el.parentElement) {
    const children = Array.from(el.parentElement.children);
    const idx = children.indexOf(el);
    if (idx >= 0) {
      const diff = Math.abs(idx - siblingIndex);
      score += Math.max(1 - diff * 0.25, 0); // small decay
    }
  }

  // Ancestor trail similarity
  const ancTrail = target.context?.ancestorTrail;
  if (Array.isArray(ancTrail) && ancTrail.length) {
    const similarity = computeAncestorSimilarity(el, ancTrail);
    score += similarity * 2; // weight moderately
  }

  // Frame hint: if frame href matches the recorded frame, give a boost; otherwise penalize.
  const targetFrameHref = target.context?.frame?.href;
  if (targetFrameHref) {
    if (frameHref && sameOriginPrefix(frameHref, targetFrameHref)) {
      score += 1.5;
    } else if (frameHref) {
      score -= 1; // likely wrong frame
    }
  }

  if (isVisible(el)) score += 1;
  return score;
}

function computeAncestorSimilarity(el, recordedTrail) {
  const actual = [];
  let node = el;
  for (let i = 0; i < recordedTrail.length && node && node.parentElement; i++) {
    actual.push({ tag: node.tagName?.toLowerCase(), index: getIndex(node) });
    node = node.parentElement;
  }
  let matches = 0;
  for (let i = 0; i < recordedTrail.length && i < actual.length; i++) {
    const rec = recordedTrail[i];
    const act = actual[i];
    if (rec.tag && act.tag && rec.tag === act.tag) matches += 0.6;
    if (typeof rec.index === "number" && typeof act.index === "number") {
      const diff = Math.abs(rec.index - act.index);
      matches += Math.max(0.4 - diff * 0.2, 0);
    }
  }
  const maxPossible = recordedTrail.length;
  return maxPossible ? Math.min(matches / maxPossible, 1) : 0;
}

function getIndex(el) {
  if (!el.parentElement) return 0;
  return Array.from(el.parentElement.children).indexOf(el);
}

function sameOriginPrefix(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch (e) {
    return false;
  }
}

export function isVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}
