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
 * a distinct color (e.g. black chord symbols over black notation). Reads the
 * WHOLE page and keeps the words that are real chords.
 *
 * Recall is the hard part on dense notation: sparse-text segmentation misses
 * most chords, so we use tesseract's uniform-block mode, which finds far more
 * text, then lean on structure to reject the noise it also brings in:
 *   - chord grammar (isChordToken) + a modest confidence floor,
 *   - the dominant chord TEXT HEIGHT (real chords share a size; clefs, big
 *     rehearsal letters and tiny fragments do not), and
 *   - ROW membership: chords are printed in horizontal lines above the staff,
 *     so a genuine chord line holds several of them at one height. Isolated
 *     single letters (note names, dynamics) are dropped unless very confident.
 *
 * @param image  an HTMLCanvasElement / ImageBitmap / anything tesseract accepts
 * @returns [{ text, confidence, x, y, w, h }]  boxes in the image's pixel space
 */
export async function ocrPageChords(image, { topMarginPx = 0, minConfidence = 45 } = {}) {
  const worker = await getWorker();
  // Whole-page pass: uniform block segmentation finds the most chord words, and
  // DROP the chord whitelist so lyrics/titles are read as themselves (and
  // rejected by the grammar) rather than forced into chord-looking characters.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
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
      // "strong" = carries a quality/extension/accidental/bass beyond the bare
      // root (Am, F#m, G7, C/E). These are unambiguous chord names. A bare
      // single letter (A, D, G) is far more likely to be a note name, staff
      // artifact or stray mark, so it needs corroboration below.
      strong: hasChordQuality(cleaned),
    });
  }
  if (cands.length < 4) return cands.filter((c) => c.strong).map(strip);

  // Dominant chord text height (real chords cluster here).
  const hist = new Map();
  for (const c of cands) { const k = Math.round(c.h / 2) * 2; hist.set(k, (hist.get(k) || 0) + 1); }
  const Hd = Number([...hist.entries()].sort((a, b) => b[1] - a[1])[0][0]) || cands[0].h;

  // Keep only tokens at the chord text size — drops oversized letters/clefs and
  // undersized fragments.
  const tight = cands
    .filter((c) => c.h >= Hd * 0.8 && c.h <= Hd * 1.3)
    .sort((a, b) => a.cy - b.cy);

  // Cluster into horizontal rows, then judge each row. Chords are printed in
  // lines above the staff, so a real chord line contains a recognizable chord
  // name. This is what stops staff lines, commas and note letters from being
  // transposed:
  //   - a row with a strong chord is a chord line → keep all of it,
  //   - an all-bare-letter row is accepted only if it's clearly a progression
  //     (several letters, all confidently read),
  //   - a lone token is kept only if it's a strong, confident chord.
  const rows = [];
  for (const c of tight) {
    let r = rows.find((r) => Math.abs(r.y - c.cy) < Hd * 0.9);
    if (!r) { r = { y: c.cy, items: [] }; rows.push(r); }
    r.items.push(c);
  }
  const keep = [];
  for (const r of rows) {
    if (r.items.length === 1) {
      const it = r.items[0];
      if (it.strong && it.confidence >= 66) keep.push(it);
    } else if (r.items.some((i) => i.strong)) {
      keep.push(...r.items);
    } else if (r.items.length >= 2 && r.items.every((i) => i.confidence >= 76)) {
      keep.push(...r.items);
    }
  }

  // De-duplicate overlapping reads of the same symbol (keep the most confident).
  keep.sort((a, b) => b.confidence - a.confidence);
  const out = [];
  for (const c of keep) {
    if (out.some((o) => Math.abs(o.cx - c.cx) < Hd * 0.9 && Math.abs(o.cy - c.cy) < Hd * 0.8)) continue;
    out.push(c);
  }
  return out.map(strip);
}

// True when the chord carries a quality/extension/accidental/bass beyond a bare
// root letter (Am, F#m, G7, C/E, Bb) — i.e. an unambiguous chord name.
function hasChordQuality(token) {
  const m = /^[A-Ga-g][#♯b♭]?(.*)$/.exec((token || "").trim());
  return !!(m && m[1]);
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
