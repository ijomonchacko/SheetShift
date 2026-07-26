import { PDFDocument } from "pdf-lib";

/** Merge several PDFs (Uint8Array/ArrayBuffer each) into one, in order. */
export async function mergePdfs(pdfBytesList) {
  const merged = await PDFDocument.create();
  for (const bytes of pdfBytesList) {
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return merged.save();
}
