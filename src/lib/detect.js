import { loadPdf, renderPageToCanvas } from "./pdfjsSetup.js";
import { detectBoxes } from "./colorMask.js";
import { detectBoxesOffThread } from "./maskWorkerClient.js";
import { extractChordTokens } from "./embeddedText.js";
import { ocrBox, ocrPageChords } from "./ocr.js";
import { transposeChord, simplifyChord, toNashville, isLikelyChord, isChordCandidate } from "./theory.js";
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
    excludeRegions = [], // [{x0,y0,x1,y1}] in FRACTIONAL page coords
    onProgress = () => {},
  } = opts;

  // Normalize to a list of colors.
  const colors = Array.isArray(chordColors[0]) ? chordColors : [chordColors];

  const pdfDoc = await loadPdf(arrayBuffer.slice(0));
  const numPages = pdfDoc.numPages;
  const allBoxes = [];
  let usedOcr = false;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress(`Reading page ${pageNum} of ${numPages}…`, pageNum - 1, numPages);
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

    // ---------- 2. OCR fallback (scanned/flattened pages) ----------
    usedOcr = true;
    onProgress(`Rendering page ${pageNum} of ${numPages}…`, pageNum - 1, numPages);
    const { canvas } = await renderPageToCanvas(pdfDoc, pageNum, scale);
    const topMarginPx = Math.round(canvas.height * marginRatio);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pxExcludeRegions = excludeRegions.map((r) => ({
      x0: r.x0 * canvas.width, y0: r.y0 * canvas.height,
      x1: r.x1 * canvas.width, y1: r.y1 * canvas.height,
    }));

    // colorMask's thresholds were tuned against a ~150dpi render — scale
    // them to whatever DPI was actually requested.
    const REFERENCE_SCALE = 150 / 72;
    const k = scale / REFERENCE_SCALE;
    const boxOpts = {
      topMarginPx,
      excludeRegions: pxExcludeRegions,
      dilateW: Math.max(6, Math.round(40 * k)),
      dilateH: Math.max(4, Math.round(14 * k)),
      minW: Math.max(6, Math.round(15 * k)),
      minH: Math.max(6, Math.round(15 * k)),
      rowTol: Math.max(40, Math.round(280 * k)),
      gapSplit: Math.max(6, Math.round(25 * k)),
    };

    // Mask + component analysis runs off the main thread when possible so
    // big pages don't freeze the UI; falls back to sync automatically.
    const { boxes, mask } = await detectBoxesOffThread(imageData, colors, boxOpts)
      .catch(() => detectBoxes(imageData, colors, boxOpts));

    onProgress(`Reading chord symbols on page ${pageNum} of ${numPages}…`, pageNum - 1, numPages);
    const pageBoxes = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const { text, confidence } = await ocrBox(mask, canvas.width, canvas.height, b);
      if (!text) continue;
      pageBoxes.push(toPdfBox(b, text, confidence, "ocr"));
    }
    let pageResult = mergeSplitTokens(pageBoxes).filter((b) => isChordCandidate(b.text, { fromOcr: true }));

    // Color-independent fallback: when no distinct-color chords were found the
    // page is likely black-on-white notation (chords the same ink as the
    // staff). Read the WHOLE page with OCR and keep the words that are real
    // chords — no color required. Chord text is small, so re-render at a
    // higher DPI for the OCR pass to improve recognition.
    if (pageResult.length === 0) {
      onProgress(`Scanning page ${pageNum} of ${numPages} for chords…`, pageNum - 1, numPages);
      const OCR_SCALE = Math.max(scale, 300 / 72);
      const { canvas: ocrCanvas } = await renderPageToCanvas(pdfDoc, pageNum, OCR_SCALE);
      const ocrTopMargin = Math.round(ocrCanvas.height * marginRatio);
      const words = await ocrPageChords(ocrCanvas, { topMarginPx: ocrTopMargin });
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
      pageResult = mergeSplitTokens(wordBoxes).filter((b) => isChordCandidate(b.text, { fromOcr: true }));
    }
    allBoxes.push(...pageResult);
  }

  return { boxes: allBoxes, numPages, usedOcr };
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
