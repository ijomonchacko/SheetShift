// Web Worker: runs the CPU-heavy mask → dilate → connected-components
// pipeline off the main thread so the UI never janks on big pages.
import { detectBoxes } from "./colorMask.js";

self.onmessage = (e) => {
  const { id, width, height, buffer, colors, opts } = e.data;
  try {
    const imageData = { data: new Uint8ClampedArray(buffer), width, height };
    const { boxes, mask } = detectBoxes(imageData, colors, opts);
    // Transfer the mask back (boxes are small plain objects).
    self.postMessage({ id, boxes, mask }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
