import { createWorker, PSM } from "tesseract.js";
import { cleanOcrToken } from "./ocrRepair";
import { isChordToken } from "./theory.js";

let workerPromise = null;

// Per-box OCR reads one isolated glyph crop, so it uses a single-line segmentation
// mode and a chord-only character whitelist.
const CHORD_WHITELIST = "ABCDEFGabcdefghijklmnopqrstuvwxyz0123456789♯♭#b/+-()";

/** Lazily create and cache a single tesseract.js worker for the session. */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE, // treat each crop as a single line
        // NOTE: this previously only allowed digits 2/4/7/9 -- any chord
        // using 0/1/3/5/6/8 (m6, 11ths, 13ths, etc.) was forced into the
        // wrong character by tesseract having no valid digit to output.
        tessedit_char_whitelist: CHORD_WHITELIST,
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
 * Color-independent OCR detection for image/scanned pages where chords are NOT
 * a distinct color (e.g. black chord symbols over black notation). Runs
 * tesseract over the WHOLE rendered page in sparse-text mode, then keeps only
 * the words that read as real chords, are confident, and cluster at the chord
 * text size — mirroring the text-layer strategy (chord grammar + size), but on
 * OCR output instead of the embedded text.
 *
 * @param image  an HTMLCanvasElement / ImageBitmap / anything tesseract accepts
 * @returns [{ text, confidence, x, y, w, h }]  boxes in the image's pixel space
 */
export async function ocrPageChords(image, { topMarginPx = 0, minConfidence = 50 } = {}) {
  const worker = await getWorker();
  // Whole-page pass: sparse text, and DROP the chord whitelist so lyrics/titles
  // are read as themselves (and rejected by the grammar) rather than being
  // forced into chord-looking characters.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: "",
  });
  let words;
  try {
    const { data } = await worker.recognize(image);
    words = data.words || [];
  } finally {
    // Restore the per-box configuration for any subsequent ocrBox() calls.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: CHORD_WHITELIST,
    });
  }

  const cands = [];
  for (const w of words) {
    const raw = (w.text || "").trim();
    if (!raw) continue;
    const b = w.bbox || {};
    if ((b.y0 ?? 0) < topMarginPx) continue;
    const cleaned = cleanOcrToken(raw);
    if (!isChordToken(cleaned)) continue;
    if ((w.confidence ?? 0) < minConfidence) continue;
    const width = b.x1 - b.x0, height = b.y1 - b.y0;
    cands.push({
      text: cleaned,
      confidence: Math.round(w.confidence ?? 0),
      x: b.x0, y: b.y0, w: width, h: height,
      cx: b.x0 + width / 2, cy: b.y0 + height / 2,
    });
  }
  if (cands.length < 3) return cands.map(strip);

  // Size clustering: real chords share a text height. Pick the most populous
  // height bucket and keep tokens near it — this drops oversized misreads (a
  // clef/time-signature read as a letter) and undersized fragments (a stray
  // note-name letter), which is the main source of noise on dense notation.
  const hist = new Map();
  for (const c of cands) { const k = Math.round(c.h / 4) * 4; hist.set(k, (hist.get(k) || 0) + 1); }
  const domH = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0] || cands[0].h;

  const near = cands
    .filter((c) => c.h >= domH * 0.6 && c.h <= domH * 1.9)
    .sort((a, b) => b.confidence - a.confidence);

  // De-duplicate overlapping reads of the same symbol (keep the most
  // confident), which sparse-text OCR occasionally emits.
  const out = [];
  for (const c of near) {
    if (out.some((o) => Math.abs(o.cx - c.cx) < domH && Math.abs(o.cy - c.cy) < domH * 0.8)) continue;
    out.push(c);
  }
  return out.map(strip);
}

function strip({ text, confidence, x, y, w, h }) {
  return { text, confidence, x, y, w, h };
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
