import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
const data = new Uint8Array(fs.readFileSync('gagulath malayil ninum.pdf'));
const loadingTask = pdfjsLib.getDocument({ data });
const pdf = await loadingTask.promise;
console.log('pages', pdf.numPages);
for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  console.log('page', i, 'items', content.items.length);
}
