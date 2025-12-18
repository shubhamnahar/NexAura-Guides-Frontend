import { appendLog } from "../storage/store";

export function log(level, message, meta = {}) {
  try {
    console[level === "error" ? "error" : "log"]("[nexaura]", message, meta);
  } catch (e) {
    /* ignore */
  }
  appendLog({ level, message, meta }).catch(() => {});
}
