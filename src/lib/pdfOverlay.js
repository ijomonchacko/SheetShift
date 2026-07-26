import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * @param {ArrayBuffer} originalPdfBytes
 * @param {{box:{pageIndex:number,x0:number,y0:number,x1:number,y1:number}, newText:string}[]} plan
 * @param {ArrayBuffer} fontBytes  a .ttf/.otf font to embed for the new text
 * @param {object} opts
 * @param {[number,number,number]} [opts.colorRgb] 0..1 RGB for the new text
 * @param {number} [opts.padding]
 * @param {number} [opts.fontSize] fixed size, or omit to auto-fit each box
 * @returns {Promise<Uint8Array>} the new PDF's bytes
 */
export async function overlayTransposedChords(originalPdfBytes, plan, fontBytes, opts = {}) {
  const {
    colorRgb = [0.667, 0, 0],
    padding = 1.5,
    fontSize = null,
    minFontSize = 6,
    maxFontSize = 96,
    autoFontScale = 1.05,
  } = opts;

  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const pages = pdfDoc.getPages();

  const byPage = new Map();
  for (const item of plan) {
    const idx = item.box.pageIndex;
    if (!byPage.has(idx)) byPage.set(idx, []);
    byPage.get(idx).push(item);
  }

  for (const [pageIndex, items] of byPage.entries()) {
    const page = pages[pageIndex];
    if (!page) continue;

    for (const { box, newText } of items) {
      const w = box.x1 - box.x0;
      const h = box.y1 - box.y0;

      page.drawRectangle({
        x: box.x0 - padding,
        y: box.y0 - padding,
        width: w + 2 * padding,
        height: h + 2 * padding,
        color: rgb(1, 1, 1),
      });

      const size = fontSize ?? fitFontSize(newText, w, h, font, minFontSize, maxFontSize, autoFontScale);
      page.drawText(newText, {
        x: box.x0,
        y: box.y0,
        size,
        font,
        color: rgb(colorRgb[0], colorRgb[1], colorRgb[2]),
      });
    }
  }

  return pdfDoc.save();
}

function fitFontSize(text, boxW, boxH, font, minSize, maxSize, scale) {
  let size = Math.max(minSize, Math.min(maxSize, boxH * scale));
  while (size > minSize) {
    if (font.widthOfTextAtSize(text, size) <= boxW * 1.15) break;
    size -= 0.5;
  }
  return size;
}
