// Embedded-text chord detection: for digitally-exported PDFs (MuseScore,
// Finale, Sibelius, Dorico, LilyPond, …) the chord symbols exist as real
// text in the PDF. We read them EXACTLY via pdf.js getTextContent() — no OCR,
// no misreads — and decide which tokens are chords WITHOUT relying on color.
//
// How the classification works (color-independent):
//   1. Chord grammar — a token must parse as a real chord symbol and start
//      with an uppercase root A–G (isChordToken). This alone rejects almost
//      all lyrics/titles/directions.
//   2. Font+size clustering — in every engraving app chord symbols are drawn
//      in a consistent font and size that differs from lyrics, titles and
//      performance directions. We keep the grammar-valid tokens that live in
//      the style bucket(s) dominated by chords, which removes the rare lyric
//      word ("A", "Add") that happens to look like a chord.
//
// A page with no meaningful text layer falls back to the OCR pipeline.

import { pdfjsLib } from "./pdfjsSetup.js";
import { isChordToken } from "./theory.js";

// Visible glyph height as a fraction of the em box — used to place the box
// bottom on the text baseline so overlaid replacements line up.
const CAP_HEIGHT = 0.72;

/**
 * Extract chord tokens from one page's text layer.
 *
 * @param page   pdf.js page object
 * @param scale  render scale that the caller maps boxes back through
 * @param opts   { topMarginRatio }  fraction of page height to ignore at top
 * @returns      { items: [{text, x, y, w, h}], textLength }
 *               x/y/w/h in device pixel space at `scale` (top-down); box
 *               bottom (y+h) sits on the glyph baseline.
 */
export async function extractChordTokens(page, scale, opts = {}) {
  const { topMarginRatio = 0 } = opts;
  const viewport = page.getViewport({ scale });
  const topMarginPx = Math.round(viewport.height * topMarginRatio);
  const content = await page.getTextContent();

  let textLength = 0;
  const toks = [];

  for (const item of content.items) {
    const str = (item.str || "").trim();
    textLength += str.length;
    if (!str) continue;

    // Device-space transform for this text run.
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontH = Math.hypot(tx[2], tx[3]);   // device font height (px)
    const runW = item.width * scale;          // device run width (px)
    const xLeft = tx[4];
    const yBase = tx[5];                       // baseline, top-down space
    if (yBase - fontH < topMarginPx) continue; // inside the header margin

    // Position each whitespace-separated token by its character offset. Chord
    // symbols are almost always their own run, so this is exact for them.
    const chars = item.str.length || 1;
    const perChar = runW / chars;
    let idx = 0;
    for (const seg of item.str.split(/(\s+)/)) {
      const t = seg.trim();
      if (!t) { idx += seg.length; continue; }
      const tokX = xLeft + idx * perChar;
      const tokW = seg.length * perChar;
      idx += seg.length;
      const capH = fontH * CAP_HEIGHT;
      toks.push({
        text: t,
        style: `${item.fontName}|${Math.round(fontH)}`,
        x: tokX,
        y: yBase - capH,
        w: tokW,
        h: capH,
        isChord: isChordToken(t),
      });
    }
  }

  // Which text style(s) carry the chords? A style bucket dominated by
  // grammar-valid chords is a chord style; lyric/title/direction buckets are
  // ~0% chords and get dropped.
  const buckets = new Map();
  let totalChords = 0;
  for (const tk of toks) {
    let b = buckets.get(tk.style);
    if (!b) { b = { total: 0, chords: 0 }; buckets.set(tk.style, b); }
    b.total++;
    if (tk.isChord) { b.chords++; totalChords++; }
  }
  const chordStyles = new Set();
  for (const [style, b] of buckets) {
    if (b.chords >= 1 && b.chords / b.total >= 0.5) chordStyles.add(style);
  }

  let picked = toks.filter((tk) => tk.isChord && chordStyles.has(tk.style));
  // Fallback: if style clustering can't account for most chords (e.g. a chart
  // that sets chords in the same font+size as its lyrics), keep every
  // grammar-valid token rather than discard real chords — review handles the
  // occasional lyric-word false positive.
  if (totalChords > 0 && picked.length < totalChords * 0.6) {
    picked = toks.filter((tk) => tk.isChord);
  }

  const items = picked.map((tk) => ({ text: tk.text, x: tk.x, y: tk.y, w: tk.w, h: tk.h }));

  // Reading order: rows top-to-bottom, then left-to-right.
  items.sort((a, b) => (Math.abs(a.y - b.y) > Math.max(a.h, b.h) ? a.y - b.y : a.x - b.x));

  return { items, textLength };
}
