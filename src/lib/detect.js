import { loadPdf, renderPageToCanvas } from "./pdfjsSetup.js";
import { detectBoxes } from "./colorMask.js";
import { detectBoxesOffThread } from "./maskWorkerClient.js";
import { extractColoredTokens } from "./embeddedText.js";
import { ocrBox } from "./ocr.js";
import { transposeChord, simplifyChord, toNashville } from "./theory.js";
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
    marginFirstPageOnly = false,
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
    onProgress(`Rendering page ${pageNum} of ${numPages}…`, pageNum - 1, numPages);
    const { canvas, page } = await renderPageToCanvas(pdfDoc, pageNum, scale);

    const marginRatio = marginFirstPageOnly && pageNum > 1 ? 0 : topMarginRatio;
    const topMarginPx = Math.round(canvas.height * marginRatio);

    // PDF page size in points, straight from pdf.js's unscaled viewport
    const unscaled = page.getViewport({ scale: 1 });
    const pw = unscaled.width, ph = unscaled.height;
    const sx = pw / canvas.width, sy = ph / canvas.height;
    const toPdfBox = (b, text, confidence, method) => ({
      text,
      confidence,
      method,
      x0: b.x * sx,
      x1: (b.x + b.w) * sx,
      y0: ph - (b.y + b.h) * sy, // flip: canvas is top-down, PDF points bottom-up
      y1: ph - b.y * sy,
      pageIndex: pageNum - 1,
    });

    // ---------- 1. embedded text layer (exact, no OCR) ----------
    if (preferEmbeddedText) {
      const { items, textLength } = await extractColoredTokens(page, canvas, scale, colors, {
        topMarginPx,
      });
      if (textLength >= 20) {
        // This page has a real text layer — trust it entirely.
        for (const it of items) {
          allBoxes.push(toPdfBox(it, it.text, 100, "text"));
        }
        continue;
      }
      // else: scanned/flattened page → OCR below.
    }

    // ---------- 2. OCR fallback ----------
    usedOcr = true;
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
    allBoxes.push(...mergeSplitTokens(pageBoxes));
  }

  return { boxes: allBoxes, numPages, usedOcr };
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
    const source = simplify ? simplifyChord(item.oldText) : item.oldText;
    const newText = nashvilleKey
      ? toNashville(source, nashvilleKey)
      : transposeChord(source, semitones, preferFlats);
    return { ...item, newText };
  });
}
