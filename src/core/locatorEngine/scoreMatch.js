import { normalizeText } from "../guideSchema";

export function scoreCandidate({ el, target }) {
  if (!el || !target) return 0;
  let score = 0;
  const fp = target.fingerprint || {};
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
  if (fp.classTokens && fp.classTokens.length) {
    const classes = new Set(Array.from(el.classList || []));
    const hits = fp.classTokens.filter((c) => classes.has(c)).length;
    score += hits * 0.4;
  }
  // visibility bonus
  if (isVisible(el)) score += 1;
  return score;
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
