import { normalizeText } from "../guideSchema";

export function queryByCss(win, selector) {
  if (!selector) return [];
  try {
    return Array.from(win.document.querySelectorAll(selector)).filter(
      (el) => el instanceof win.Element
    );
  } catch (e) {
    return [];
  }
}

export function queryById(win, id) {
  if (!id) return [];
  const el = win.document.getElementById(id);
  return el ? [el] : [];
}

export function queryByRole(win, role, name) {
  if (!role) return [];
  const all = win.document.querySelectorAll(`[role="${role}"]`);
  const normName = normalizeText(name);
  return Array.from(all).filter((el) => {
    if (!(el instanceof win.Element)) return false;
    if (!name) return true;
    const label =
      normalizeText(el.getAttribute("aria-label")) ||
      normalizeText(el.textContent || "");
    return label.includes(normName) || normName.includes(label);
  });
}

export function queryByText(win, text, tagHint) {
  const norm = normalizeText(text);
  if (!norm) return [];
  const selector =
    tagHint && tagHint !== "*"
      ? tagHint
      : "a,button,input,textarea,select,label,div,span,li,p,h1,h2,h3,h4,h5,h6";
  const nodes = win.document.querySelectorAll(selector);
  return Array.from(nodes).filter((el) => {
    if (!(el instanceof win.Element)) return false;
    const label = normalizeText(el.textContent || el.value || "");
    return label.includes(norm) || norm.includes(label);
  });
}
