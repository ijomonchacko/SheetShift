import { loadPdf, renderPageToCanvas } from "./pdfjsSetup.js";
import { extractChordTokens } from "./embeddedText.js";
import { ocrPageChords } from "./ocr.js";
import { transposeChord, simplifyChord, toNashville, isLikelyChord, isChordCandidate, isChordToken } from "./theory.js";
import { mergeSplitTokens } from "./ocrRepair.js";

/**
 * @typedef ChordBox
 * @property {string} text
 * @property {number} confidence  0-100 (100 = exact embedded text)
 * @property {"text"|"ocr"} method
 * @property {number} x0 @property {number} y0
 * @property {number} x1 @property {number} y1   PDF point space, origin
 *   bottom-left (matches pdf-lib / the PDF spec), so these can be handed
 *   straight to pdfOverlay.js.
 * @property {number} pageIndex 0-based
 */

/**
 * @param {ArrayBuffer} arrayBuffer  the uploaded PDF's bytes
 * @param {[number,number,number]|[number,number,number][]} chordColors
 *   one 0..255 RGB color, or an array of up to a few colors
 * @param {object} opts
 * @param {number} [opts.scale] render scale (≈150dpi is scale 2.0833)
 * @param {number} [opts.topMarginRatio] fraction of page height treated as
 *   header/title and excluded from detection
 * @param {boolean} [opts.marginFirstPageOnly] apply the header margin to
 *   page 1 only (later pages usually have no title block)
 * @param {boolean} [opts.preferEmbeddedText] try the exact text layer first
 *   and fall back to OCR for pages without one (default true)
 * @param {(msg:string, i:number, n:number)=>void} [opts.onProgress]
 */
export async function detectChords(arrayBuffer, chordColors, opts = {}) {
  const {
    scale = 150 / 72,
    topMarginRatio = 0.12,
    marginFirstPageOnly = true,
    preferEmbeddedText = true,
    strength = "balanced", // detection strength: precise | balanced | aggressive
    maxPages = 50,         // cap pages scanned on very long PDFs
    excludeRegions = [], // [{x0,y0,x1,y1}] in FRACTIONAL page coords
    onProgress = () => {},
  } = opts;

  // Normalize to a list of colors.
  const colors = Array.isArray(chordColors[0]) ? chordColors : [chordColors];

  const pdfDoc = await loadPdf(arrayBuffer.slice(0));
  const numPages = pdfDoc.numPages;
  const allBoxes = [];
  let usedOcr = false;

  // Guard runaway work: OCR at 300 DPI is memory/CPU heavy, so cap how many
  // pages we process on very long PDFs and report it to the UI.
  const pagesToScan = Math.min(numPages, maxPages);
  const truncated = numPages > pagesToScan ? pagesToScan : 0;

  for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
    onProgress(`Reading page ${pageNum} of ${pagesToScan}…`, pageNum - 1, pagesToScan);
    const page = await pdfDoc.getPage(pageNum);

    const marginRatio = pageTopMarginRatio(pageNum, topMarginRatio, marginFirstPageOnly);

    // PDF page size in points, straight from pdf.js's unscaled viewport, plus
    // the scaled viewport so device-pixel boxes map back to points without a
    // rendered canvas (text-layer pages skip rendering entirely).
    const unscaled = page.getViewport({ scale: 1 });
    const pw = unscaled.width, ph = unscaled.height;
    const scaled = page.getViewport({ scale });
    const sx = pw / scaled.width, sy = ph / scaled.height;
    const toPdfBox = (b, text, confidence, method) => ({
      text,
      confidence,
      method,
      x0: b.x * sx,
      x1: (b.x + b.w) * sx,
      y0: ph - (b.y + b.h) * sy, // flip: device is top-down, PDF points bottom-up
      y1: ph - b.y * sy,
      pageIndex: pageNum - 1,
    });

    // ---------- 1. embedded text layer (exact, color-independent) ----------
    if (preferEmbeddedText) {
      const { items, textLength } = await extractChordTokens(page, scale, {
        topMarginRatio: marginRatio,
      });
      if (textLength >= 20) {
        // This page has a real text layer — trust it entirely. Notation
        // software often draws one chord as SEPARATE text runs ("E" +
        // "sus2", "A" + "m", "F#" + "m"), so the same fragment-merging
        // used for OCR applies here too.
        const pageBoxes = items.map((it) => toPdfBox(it, it.text, 100, "text"));
        const merged = mergeSplitTokens(pageBoxes, 1.2);
        allBoxes.push(...merged.filter((b) => isChordCandidate(b.text)));
        continue;
      }
      // else: scanned/flattened page → OCR below.
    }

    // ---------- 2. OCR (scanned / image pages with no text layer) ----------
    // Read the WHOLE page and keep only the words that are real chords. This is
    // color-independent and robust: unlike per-color pixel masking it never
    // turns staff lines, note-name letters or other musical symbols into
    // "chords". Chord text is small, so render the OCR pass at a higher DPI.
    //
    // Prefer the stronger ONNX PP-OCR engine; if its models can't load, fall
    // back to the bundled Tesseract pipeline. Both return the same chord boxes.
    usedOcr = true;
    onProgress(`Scanning page ${pageNum} of ${pagesToScan} for chords…`, pageNum - 1, pagesToScan);
    const OCR_SCALE = Math.max(scale, 300 / 72);
    const { canvas: ocrCanvas } = await renderPageToCanvas(pdfDoc, pageNum, OCR_SCALE);
    const ocrTopMargin = Math.round(ocrCanvas.height * marginRatio);
    // Lazy-load the heavy ONNX engine only when we actually hit an image page.
    let words = null;
    try {
      const { tryOnnxPageChords } = await import("./onnxOcr.js");
      words = await tryOnnxPageChords(ocrCanvas, { topMarginPx: ocrTopMargin, strength });
    } catch {
      words = null;
    }
    if (!words || words.length === 0) words = await ocrPageChords(ocrCanvas, { topMarginPx: ocrTopMargin, strength });
    const osx = pw / ocrCanvas.width, osy = ph / ocrCanvas.height;
    const wordBoxes = words.map((it) => ({
      text: it.text,
      confidence: it.confidence,
      method: "ocr",
      x0: it.x * osx,
      x1: (it.x + it.w) * osx,
      y0: ph - (it.y + it.h) * osy,
      y1: ph - it.y * osy,
      pageIndex: pageNum - 1,
    }));
    allBoxes.push(...wordBoxes.filter((b) => isChordToken(b.text)));
  }

  return { boxes: allBoxes, numPages, usedOcr, truncated };
}

export function pageTopMarginRatio(pageNum, topMarginRatio, marginFirstPageOnly) {
  return marginFirstPageOnly && pageNum > 1 ? 0 : topMarginRatio;
}

/**
 * Turn detected boxes into a render plan.
 *
 * @param {ChordBox[]} boxes
 * @param {number} semitones
 * @param {boolean} preferFlats
 * @param {object} [options]
 * @param {boolean} [options.simplify]  strip extensions (Cmaj9 → C)
 * @param {string|null} [options.nashvilleKey]  output Nashville numbers
 *   relative to this key instead of transposing
 * @returns [{ box, oldText, newText }] ready for pdfOverlay.js
 */
export function planTransposition(boxes, semitones, preferFlats, options = {}) {
  const { simplify = false, nashvilleKey = null } = options;
  return boxes.map((box) => {
    // Only transpose tokens that actually parse as chords. Colored title or
    // lyric words (e.g. "Amazing", "Glory") start with A-G and would otherwise
    // have their first letter transposed. Leave them untouched.
    if (!isLikelyChord(box.text)) {
      return { box, oldText: box.text, newText: box.text };
    }
    const source = simplify ? simplifyChord(box.text) : box.text;
    const newText = nashvilleKey
      ? toNashville(source, nashvilleKey)
      : transposeChord(source, semitones, preferFlats);
    return { box, oldText: box.text, newText };
  });
}

/** Recompute newText for an existing plan with different output options. */
export function replanTransposition(plan, semitones, preferFlats, options = {}) {
  const { simplify = false, nashvilleKey = null } = options;
  return plan.map((item) => {
    if (!isLikelyChord(item.oldText)) {
      return { ...item, newText: item.oldText };
    }
    const source = simplify ? simplifyChord(item.oldText) : item.oldText;
    const newText = nashvilleKey
      ? toNashville(source, nashvilleKey)
      : transposeChord(source, semitones, preferFlats);
    return { ...item, newText };
  });
}
