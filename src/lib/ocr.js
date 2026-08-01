import { createWorker, PSM } from "tesseract.js";
import { cleanOcrToken } from "./ocrRepair";
import { isChordToken } from "./theory.js";

let workerPromise = null;

// Per-box OCR reads one isolated glyph crop, so it uses a single-line segmentation
// mode and a chord-only character whitelist.
const CHORD_WHITELIST = "ABCDEFGabcdefghijklmnopqrstuvwxyz0123456789♯♭#b/+-()";

// Detection-strength presets. "Precise" favors avoiding false positives (fewer
// stray letters); "Aggressive" favors catching every chord (more to review).
const STRENGTH_KNOBS = {
  precise:    { minConfidence: 55, hLo: 0.78, hHi: 1.35, bareMin: 3, bareAvg: 74, bareItem: 60, single: 72, dbThresh: 0.32, boxThresh: 0.55, expand: 0.4 },
  balanced:   { minConfidence: 45, hLo: 0.62, hHi: 1.55, bareMin: 2, bareAvg: 62, bareItem: 48, single: 60, dbThresh: 0.28, boxThresh: 0.42, expand: 0.4 },
  aggressive: { minConfidence: 38, hLo: 0.5,  hHi: 1.8,  bareMin: 2, bareAvg: 54, bareItem: 42, single: 52, dbThresh: 0.22, boxThresh: 0.3,  expand: 0.45 },
};

/** Resolve a detection-strength preset ("precise"|"balanced"|"aggressive"). */
export function chordFilterKnobs(strength = "balanced") {
  return STRENGTH_KNOBS[strength] || STRENGTH_KNOBS.balanced;
}

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
export async function ocrPageChords(image, { topMarginPx = 0, strength = "balanced" } = {}) {
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

  // Turn tesseract words into raw candidates and run them through the shared
  // music-aware chord filter (grammar + size + row/spread + geometry).
  const items = words.map((w) => {
    const b = w.bbox || {};
    return { text: w.text, confidence: w.confidence ?? 0, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
  });
  let out = filterChordCandidates(items, { topMarginPx, strength });

  // Disambiguation pass. Bare single letters are the tokens that get confused
  // with misread digits (8→B, 6→G, 0→O/D) — a measure number or fingering can
  // read as a letter in the full-page pass. Re-read each ALONE: single-char OCR
  // on a clean, isolated, upscaled crop is reliable, so anything that comes back
  // a digit is a number, not a chord. (Browser only — needs a canvas to crop.)
  const canCrop = typeof document !== "undefined" && image && typeof image.getContext === "function";
  const bare = out.filter((c) => /^[A-G]$/.test(c.text));
  if (canCrop && bare.length) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_CHAR,
        tessedit_char_whitelist: "0123456789ABCDEFGabcdefg#b/",
      });
      for (const c of bare) {
        const read = await readIsolatedChar(worker, image, c);
        if (/^[0-9]/.test(read)) c._drop = true;
      }
    } catch {
      /* on any failure keep the originals */
    } finally {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: CHORD_WHITELIST,
      });
    }
  }

  return out.filter((c) => !c._drop).map(strip);
}

/** Re-OCR one box in isolation (single character) and return the raw reading. */
async function readIsolatedChar(worker, image, box, { pad = 4, upscale = 4 } = {}) {
  const sx = Math.max(0, Math.floor(box.x - pad));
  const sy = Math.max(0, Math.floor(box.y - pad));
  const sw = Math.min(image.width - sx, Math.ceil(box.w + pad * 2));
  const sh = Math.min(image.height - sy, Math.ceil(box.h + pad * 2));
  if (sw <= 0 || sh <= 0) return "";
  const c = document.createElement("canvas");
  c.width = Math.max(1, sw * upscale);
  c.height = Math.max(1, sh * upscale);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const { data } = await worker.recognize(c);
  return (data.text || "").trim().replace(/\s+/g, "");
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
 * Music-aware chord filter. Takes raw detected words and keeps only real chords
 * using chord grammar, box geometry, the dominant text height, and
 * chord-line/row structure.
 *
 * `strength` ("precise" | "balanced" | "aggressive") trades precision for
 * recall via the shared STRENGTH_KNOBS presets.
 *
 * @param items [{ text, confidence, x, y, w, h }] raw detections (image px)
 * @returns [{ text, confidence, x, y, w, h }] chords in reading order-ish
 */
export function filterChordCandidates(items, { topMarginPx = 0, strength = "balanced" } = {}) {
  const K = chordFilterKnobs(strength);
  const cands = [];
  for (const it of items) {
    const raw = (it.text || "").trim();
    if (!raw) continue;
    // A chord ALWAYS starts with a note letter A–G on the page. A leading digit
    // or symbol is a measure/page number, a fingering or a musical mark — this
    // is what stops "8"→B, "67"→G7 style number-to-chord conversions.
    if (!/^[A-Ga-g]/.test(raw)) continue;
    if ((it.y ?? 0) < topMarginPx) continue;
    if ((it.confidence ?? 0) < K.minConfidence) continue;
    const cleaned = cleanOcrToken(raw);
    if (!isChordToken(cleaned)) continue;
    const width = it.w, height = it.h;
    if (!(height > 0)) continue;
    // Geometry: a chord box is ~one glyph per character wide. Too wide = a lyric
    // run / staff line; too thin = a stem or barline.
    if (width < height * 0.22 || width > height * (cleaned.length + 1)) continue;
    cands.push({
      text: cleaned,
      confidence: Math.round(it.confidence ?? 0),
      x: it.x, y: it.y, w: width, h: height,
      cx: it.x + width / 2, cy: it.y + height / 2,
      strong: hasChordQuality(cleaned),
    });
  }
  if (cands.length < 4) return cands.filter((c) => c.strong).map(strip);

  // Dominant chord text height (real chords cluster here).
  const hist = new Map();
  for (const c of cands) { const k = Math.round(c.h / 2) * 2; hist.set(k, (hist.get(k) || 0) + 1); }
  const Hd = Number([...hist.entries()].sort((a, b) => b[1] - a[1])[0][0]) || cands[0].h;

  const tight = cands
    .filter((c) => c.h >= Hd * K.hLo && c.h <= Hd * K.hHi)
    .sort((a, b) => a.cy - b.cy);

  // Cluster into horizontal chord rows.
  const rows = [];
  for (const c of tight) {
    let r = rows.find((r) => Math.abs(r.y - c.cy) < Hd * 0.9);
    if (!r) { r = { y: c.cy, items: [] }; rows.push(r); }
    r.items.push(c);
  }
  const cxs = tight.map((c) => c.cx);
  const contentW = (cxs.length ? Math.max(...cxs) - Math.min(...cxs) : 0) || 1;

  const keep = [];
  for (const r of rows) {
    if (r.items.length === 1) {
      const it = r.items[0];
      if (it.strong && it.confidence >= K.single) keep.push(it);
      continue;
    }
    if (r.items.some((i) => i.strong)) { keep.push(...r.items); continue; }
    // All-bare row: require a genuine chord-line shape — several letters spread
    // across a good fraction of the width, confidently read.
    const span = Math.max(...r.items.map((i) => i.cx)) - Math.min(...r.items.map((i) => i.cx));
    const avg = r.items.reduce((s, i) => s + i.confidence, 0) / r.items.length;
    if (r.items.length >= K.bareMin && span >= contentW * 0.33 && avg >= K.bareAvg && r.items.every((i) => i.confidence >= K.bareItem)) {
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
