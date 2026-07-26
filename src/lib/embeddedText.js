// Embedded-text chord detection: for digitally-exported PDFs (MuseScore,
// Finale, Sibelius…) the chord symbols exist as real text in the PDF. We
// read them EXACTLY via pdf.js getTextContent() — no OCR, no misreads —
// and use the already-rendered canvas only to check each token's COLOR
// (pdf.js does not expose per-glyph fill color through getTextContent).
//
// A page with no meaningful text layer falls back to the OCR pipeline.

import { pdfjsLib } from "./pdfjsSetup.js";
import { maskForColors } from "./colorMask.js";

/**
 * Extract colored text tokens from one page.
 *
 * @param page       pdf.js page object
 * @param canvas     the page already rendered at `scale` (top-down pixels)
 * @param scale      render scale used for `canvas`
 * @param colors     [[r,g,b], …] 0-255 chord colors to match
 * @param opts       { tol, minColorFraction, topMarginPx }
 * @returns          { items: [{text, x, y, w, h}], textLength }
 *                   x/y/w/h in canvas pixel space (top-down)
 */
export async function extractColoredTokens(page, canvas, scale, colors, opts = {}) {
  // minColorFraction: colored glyphs measure ~0.15–0.25 ink coverage in
  // their box; non-matching (black) text measures ~0. 0.10 splits the two
  // clusters with margin on both sides.
  const { tol = 60, minColorFraction = 0.1, topMarginPx = 0 } = opts;

  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = maskForColors(imageData, colors, tol);

  let textLength = 0;
  const items = [];

  for (const item of content.items) {
    const str = (item.str || "").trim();
    textLength += str.length;
    if (!str) continue;

    // Device-space transform for this text run.
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontH = Math.hypot(tx[2], tx[3]);       // device font height
    const runW = item.width * scale;              // device run width
    const xLeft = tx[4];
    const yBase = tx[5];                          // baseline, top-down space
    const top = yBase - fontH;
    if (top < topMarginPx) continue;

    // Split the run into whitespace-separated tokens, positioning each by
    // its character offset (monospace-ish approximation is fine here — the
    // color check + tight mask bbox recovers the true box below).
    const chars = item.str.length || 1;
    const perChar = runW / chars;
    let idx = 0;
    for (const raw of item.str.split(/(\s+)/)) {
      if (!raw.trim()) { idx += raw.length; continue; }
      const tokX = xLeft + idx * perChar;
      const tokW = raw.length * perChar;
      idx += raw.length;

      // Color check: fraction of mask pixels inside the token's box.
      const x0 = Math.max(0, Math.floor(tokX));
      const x1 = Math.min(canvas.width, Math.ceil(tokX + tokW));
      const y0 = Math.max(0, Math.floor(top));
      const y1 = Math.min(canvas.height, Math.ceil(yBase + fontH * 0.25));
      if (x1 <= x0 || y1 <= y0) continue;

      let on = 0, total = 0;
      // Tight bbox of matching pixels (better than the estimated box).
      let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++;
          if (mask[y * canvas.width + x]) {
            on++;
            if (x < mnX) mnX = x;
            if (x > mxX) mxX = x;
            if (y < mnY) mnY = y;
            if (y > mxY) mxY = y;
          }
        }
      }
      if (total === 0 || on / total < minColorFraction) continue;

      items.push({
        text: raw.trim(),
        x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1,
      });
    }
  }

  // Reading order: rows top-to-bottom, then left-to-right.
  items.sort((a, b) => (Math.abs(a.y - b.y) > Math.max(a.h, b.h) ? a.y - b.y : a.x - b.x));

  return { items, textLength };
}
