// captureTarget.js — captures target selectors plus a relative anchor

import { normalizeText } from "../guideSchema.js";
import { finder as medvFinder } from "../locatorEngine/finderLib.js";

export function captureTarget(element, frameInfo = {}) {
  if (!(element instanceof Element)) return null;
  const locatorList = [];
  const displayText = (element.innerText || element.textContent || "").trim();

  const id = element.id;
  if (id) locatorList.push({ type: "id", value: id, confidence: 0.9 });

  // Trello-specific: prefer stable card/list IDs over generic test IDs.
  const dataCardId = element.getAttribute("data-card-id");
  if (dataCardId) {
    locatorList.push({
      type: "css",
      value: `[data-card-id="${dataCardId}"]`,
      confidence: 1.1, // outranks text / data-testid
    });
  }
  const dataListId = element.getAttribute("data-list-id");
  if (dataListId) {
    locatorList.push({
      type: "css",
      value: `[data-list-id="${dataListId}"]`,
      confidence: 1.0,
    });
  }

  const dataTest = element.getAttribute("data-testid") || element.getAttribute("data-test");
  if (dataTest) {
    locatorList.push({
      type: "css",
      value: `[data-testid="${dataTest}"]`,
      confidence: 0.85,
      textFilter: displayText || undefined, // disambiguate repeated testids (e.g., Trello cards)
    });
  }

  const ariaLabel = element.getAttribute("aria-label");
  const role = element.getAttribute("role");
  if (role) locatorList.push({ type: "role", role, name: ariaLabel || "", confidence: 0.7 });

  const finderSelector = buildFinderSelector(element);
  if (finderSelector)
    locatorList.push({
      type: "css",
      value: finderSelector,
      confidence: 0.75,
      textFilter: displayText || undefined,
    });

  const cssPath = buildCssPath(element);
  if (cssPath)
    locatorList.push({
      type: "css",
      value: cssPath,
      confidence: 0.5,
      textFilter: displayText || undefined,
    });

  const xpath = buildXPath(element);
  if (xpath) locatorList.push({ type: "xpath", value: xpath, confidence: 0.4 });

  const text = normalizeText(element.innerText || element.textContent || "");
  // Prefer human-readable labels (e.g., "compose", "checkout") above other locators.
  if (text && text.length >= 3) {
    locatorList.push({
      type: "text",
      value: text,
      tag: element.tagName.toLowerCase(),
      confidence: 1.0, // make text the top-priority locator
    });
  }

  const ancestorTrail = buildAncestorTrail(element);
  const siblingIndex = computeSiblingIndex(element);

  const fingerprint = {
    tag: element.tagName.toLowerCase(),
    role: role || null,
    ariaLabel: ariaLabel || null,
    text: text || null,
    attrs: collectAttrs(element),
    classTokens: Array.from(element.classList || []),
  };

  const anchor = findStableAnchor(element);
  const containerAnchor = getContainerAnchor(element);

  return {
    preferredLocators: locatorList,
    fingerprint,
    innerText: displayText || null,
    context: {
      ancestorTrail,
      siblingIndex,
      nearbyAnchors: collectNearbyAnchors(element),
      frame: frameInfo,
    },
    anchor,
    containerAnchor,
    vision: {
      templateId: null,
      bbox: readBBox(element),
    },
    history: {
      lastSuccessfulLocator: null,
      successCounts: {},
    },
  };
}

// Container anchoring: find nearest parent with a meaningful header/title
export function getContainerAnchor(targetElement) {
  const MAX_DEPTH = 5;
  let node = targetElement;
  let depth = 0;

  const headerSelector =
    "h1,h2,h3,h4,h5,h6,[role=\"heading\"],[class*=\"header\"],[class*=\"title\"],[data-testid=\"list-header\"],.list-header";

  const buildSelector = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const classes = Array.from(el.classList || []).filter((c) => /^[a-z0-9_-]+$/i.test(c));
    if (classes.length) return `${el.tagName.toLowerCase()}.${classes.join(".")}`;
    return el.tagName.toLowerCase();
  };

  const containsText = (el, txt) => {
    if (!el || !txt) return false;
    const norm = normalizeText(el.innerText || el.textContent || "");
    return norm.includes(txt);
  };

  while (node && depth < MAX_DEPTH) {
    const parent = node.parentElement;
    if (!parent) break;

    const headers = parent.querySelectorAll(headerSelector);
    for (const hdr of headers) {
      if (!(hdr instanceof Element)) continue;
      const txt = normalizeText(hdr.innerText || hdr.textContent || "");
      if (!txt || txt.length < 2) continue;
      // avoid self-referencing
      if (hdr.contains(targetElement)) continue;
      if (containsText(targetElement, txt)) continue;

      return {
        selector: buildSelector(parent),
        text: txt,
        matchType: "text-inside",
      };
    }

    node = parent;
    depth++;
  }
  return null;
}

// Finder selector with fallback structural path
function buildFinderSelector(el) {
  try {
    const selector = medvFinder(el, {
      root: document.body,
      className: (name) => /^[a-z0-9-]{1,24}$/.test(name),
      idName: () => true,
      tagName: () => true,
      attr: (name) => name.startsWith("data-"),
      seedMinLength: 1,
      optimizedMinLength: 2,
      maxNumberOfTries: 5000,
    });
    if (!selector) return null;
    const looksLikeSingleToken = !selector.includes(" ") && !selector.includes(">") && !selector.includes(":nth");
    if (looksLikeSingleToken) return buildStructuralPath(el);
    return selector;
  } catch (e) {
    return null;
  }
}

function buildStructuralPath(el) {
  const parts = [];
  let node = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 8 && node !== document.body) {
    const tag = node.tagName.toLowerCase();
    let nth = 1;
    let sib = node.previousElementSibling;
    while (sib) {
      if (sib.tagName === node.tagName) nth++;
      sib = sib.previousElementSibling;
    }
    parts.unshift(`${tag}:nth-of-type(${nth})`);
    node = node.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

function buildCssPath(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 5) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part = `${part}#${node.id}`;
      parts.unshift(part);
      break;
    }
    if (node.classList.length) {
      part += "." + Array.from(node.classList).slice(0, 2).join(".");
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function buildXPath(el) {
  if (!el || el.nodeType !== 1) return "";
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 5) {
    let idx = 1;
    let sib = node.previousSibling;
    while (sib) {
      if (sib.nodeType === 1 && sib.nodeName === node.nodeName) idx++;
      sib = sib.previousSibling;
    }
    parts.unshift(`${node.nodeName}[${idx}]`);
    node = node.parentNode;
  }
  return "/" + parts.join("/");
}

function buildAncestorTrail(el) {
  const trail = [];
  let node = el.parentElement;
  while (node && trail.length < 6) {
    trail.unshift({
      tag: node.tagName.toLowerCase(),
      index: computeSiblingIndex(node),
    });
    node = node.parentElement;
  }
  return trail;
}

function computeSiblingIndex(el) {
  if (!el || !el.parentElement) return 0;
  const siblings = Array.from(el.parentElement.children).filter((n) => n.tagName === el.tagName);
  return siblings.indexOf(el);
}

function collectAttrs(el) {
  const attrs = {};
  for (const attr of el.attributes) {
    if (attr.name === "id" || attr.name.startsWith("data-")) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

function collectNearbyAnchors(el) {
  const anchors = [];
  const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
  siblings.slice(0, 6).forEach((sib, idx) => {
    if (!(sib instanceof Element) || sib === el) return;
    anchors.push({
      tag: sib.tagName.toLowerCase(),
      text: normalizeText(sib.textContent || ""),
      offset: idx,
    });
  });
  return anchors;
}

function readBBox(el) {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

// Relative anchor finder
function findStableAnchor(element) {
  const isStable = (node) => {
    if (!(node instanceof Element)) return false;
    if (!isVisible(node)) return false;
    const text = normalizeText(node.textContent || "");
    return text && text.length > 3;
  };

  if (element.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (lbl && isStable(lbl)) {
      return { text: normalizeText(lbl.textContent || ""), tag: lbl.tagName.toLowerCase(), relation: "label_for" };
    }
  }

  let node = element;
  for (let depth = 0; depth < 4 && node; depth++) {
    const sibs = node.parentElement ? Array.from(node.parentElement.children) : [];
    for (const sib of sibs) {
      if (sib === node) continue;
      if (isStable(sib)) {
        return {
          text: normalizeText(sib.textContent || ""),
          tag: sib.tagName.toLowerCase(),
          relation: "parent_sibling",
        };
      }
    }
    if (node.parentElement && isStable(node.parentElement)) {
      return {
        text: normalizeText(node.parentElement.textContent || ""),
        tag: node.parentElement.tagName.toLowerCase(),
        relation: "ancestor",
      };
    }
    node = node.parentElement;
  }

  return null;
}

function isVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}
