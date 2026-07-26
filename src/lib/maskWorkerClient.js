// Main-thread client for maskWorker.js. detect.js calls this and falls
// back to the synchronous path if workers are unavailable.

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./maskWorker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, boxes, mask, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve({ boxes, mask });
  };
  worker.onerror = (err) => {
    // Fail everything in flight; detect.js falls back to the sync path.
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

/**
 * detectBoxes, but off the main thread. The ImageData's buffer is COPIED
 * (not transferred) because the caller may still need it.
 */
export function detectBoxesOffThread(imageData, colors, opts) {
  return new Promise((resolve, reject) => {
    let w;
    try {
      w = getWorker();
    } catch (err) {
      reject(err);
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    const buffer = imageData.data.buffer.slice(0);
    w.postMessage(
      { id, width: imageData.width, height: imageData.height, buffer, colors, opts },
      [buffer]
    );
  });
}
