const STORAGE_KEY = "nexaura_guide_store_v2";

export async function readStore() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      resolve(data[STORAGE_KEY] || { guides: [], sessions: {}, logs: [] });
    });
  });
}

export async function writeStore(store) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: store }, () => resolve());
  });
}

export async function appendLog(entry) {
  const store = await readStore();
  const logs = Array.isArray(store.logs) ? store.logs.slice(-49) : [];
  logs.push({ ts: Date.now(), ...entry });
  store.logs = logs;
  await writeStore(store);
}
