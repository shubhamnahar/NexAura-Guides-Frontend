export function collectFrames() {
  const frames = [];
  try {
    frames.push({ win: window, frameId: 0, href: window.location.href });
    const walker = (win, depth = 0) => {
      const iframes = win.document.querySelectorAll("iframe");
      Array.from(iframes).forEach((frame, idx) => {
        try {
          const childWin = frame.contentWindow;
          if (childWin && childWin.document) {
            frames.push({
              win: childWin,
              frameId: `${depth + 1}:${idx}`,
              href: childWin.location.href,
            });
            if (depth < 2) {
              walker(childWin, depth + 1);
            }
          }
        } catch (e) {
          // ignore cross-origin
        }
      });
    };
    walker(window);
  } catch (e) {
    console.warn("collectFrames error", e);
  }
  return frames;
}
