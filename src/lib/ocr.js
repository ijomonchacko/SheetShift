import { createWorker } from "tesseract.js";
import { cleanOcrToken } from "./ocrRepair";

let workerPromise = null;

/** Lazily create and cache a single tesseract.js worker for the session. */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: "7", // treat each crop as a single line
        // NOTE: this previously only allowed digits 2/4/7/9 -- any chord
        // using 0/1/3/5/6/8 (m6, 11ths, 13ths, etc.) was forced into the
        // wrong character by tesseract having no valid digit to output.
        tessedit_char_whitelist:
          "ABCDEFGabcdefghijklmnopqrstuvwxyz0123456789♯♭#b/+-()",
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}

/**
 * OCR one chord token given its mask + pixel box. Renders the isolated
 * glyph (mask pixels only, everything else white) to a small canvas,
 * upscaled for legibility, then runs tesseract on it.
 */
export async function ocrBox(mask, width, height, box, { pad = 10, upscale = 3 } = {}) {
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(width, box.x + box.w + pad);
  const y1 = Math.min(height, box.y + box.h + pad);
  const w = x1 - x0, h = y1 - y0;

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d");
  const img = sctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcP = (y0 + y) * width + (x0 + x);
      const dstI = (y * w + x) * 4;
      const on = mask[srcP];
      const v = on ? 0 : 255; // black glyph on white background
      img.data[dstI] = v; img.data[dstI + 1] = v; img.data[dstI + 2] = v; img.data[dstI + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);

  const big = document.createElement("canvas");
  big.width = w * upscale;
  big.height = h * upscale;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(small, 0, 0, big.width, big.height);

  const worker = await getWorker();
  const { data } = await worker.recognize(big);
  const cleaned = cleanOcrToken(data.text);
  return { text: cleaned, confidence: Math.round(data.confidence ?? 0) };
}
