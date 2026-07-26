import { loadPdf, renderPageToCanvas } from "./pdfjsSetup.js";

/**
 * Print-optimized output: renders every page of the PDF to images in a
 * minimal print window (no app chrome, one page per sheet) and invokes the
 * browser's print dialog.
 */
export async function printPdf(bytes, title = "SheetShift chart") {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes).slice();
  const doc = await loadPdf(copy);
  const urls = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { canvas } = await renderPageToCanvas(doc, n, 2);
    urls.push(canvas.toDataURL("image/png"));
  }

  const w = window.open("", "_blank");
  if (!w) throw new Error("Your browser blocked the print window — allow pop-ups and try again.");
  w.document.write(`<!doctype html>
<html><head><title>${title.replace(/</g, "&lt;")}</title>
<style>
  * { margin: 0; padding: 0; }
  img { display: block; width: 100%; page-break-after: always; }
  img:last-child { page-break-after: auto; }
  @media screen { body { background: #444; } img { margin: 12px auto; max-width: 800px; box-shadow: 0 2px 12px rgba(0,0,0,0.5); } }
</style></head><body>
${urls.map((u) => `<img src="${u}" />`).join("\n")}
<script>window.onload = () => setTimeout(() => window.print(), 150);</script>
</body></html>`);
  w.document.close();
}
