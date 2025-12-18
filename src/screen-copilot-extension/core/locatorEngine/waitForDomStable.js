export async function waitForDomStable({
  timeoutMs = 5000,
  quietPeriodMs = 250,
} = {}) {
  const start = Date.now();
  return new Promise((resolve) => {
    let lastMut = Date.now();
    const observer = new MutationObserver(() => {
      lastMut = Date.now();
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - start > timeoutMs) {
        cleanup();
        resolve({ stable: false, reason: "timeout" });
        return;
      }
      if (now - lastMut >= quietPeriodMs) {
        cleanup();
        resolve({ stable: true });
      }
    }, Math.min(quietPeriodMs, 100));

    const cleanup = () => {
      clearInterval(interval);
      observer.disconnect();
    };
  });
}
