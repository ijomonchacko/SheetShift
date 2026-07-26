# Transpose — client-only web app

A pure client-side rebuild of the `chordtranspose` tool as a React app,
deployable to Vercel as a static site with **no backend/API routes at
all**. Upload happens in the browser, chord detection runs in the browser
(rendering + OCR), and the transposed PDF is generated and downloaded
entirely client-side.

## Run it locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
npm run build   # outputs dist/
vercel deploy
```

`vercel.json` is already set up for a static Vite build (no serverless
functions).

---

## How this differs from the Flask/Python version

The Python version reads a PDF's **embedded text** directly (exact, no
OCR) when it's available, and only falls back to OCR for PDFs that have no
extractable text at all. That "read the real text" path relies on parsing
per-glyph fill color out of the PDF's low-level content stream — `pdf.js`
doesn't expose that through its public API, and reimplementing a PDF content
stream interpreter untested felt like the wrong tradeoff. So:

**This build detects chords with OCR for every PDF**, uniformly: render the
page to a canvas, isolate pixels matching the chord color, group them into
tokens, and read each one with `tesseract.js`. Since there's no
auto-detected chord color to fall back on either (same underlying reason),
there's an **eyedropper** — click the actual chord color on a preview of
page 1 instead.

Practically: always use the **preview step** before generating a file, and
compare the detected list against your original PDF, most importantly for
music you can't easily proofread by ear.

## What's actually been verified vs. what hasn't

I do **not** have network access in the environment I built this in, so I
could not run `npm install`, a dev server, or a real browser here. I could
not click through this UI. What I *could* verify, using packages that
happened to already be installed globally:

- **`src/lib/theory.js`** — ran directly through Node against the exact
  same test cases validated in the Python version. Output matched exactly.
- **`src/lib/colorMask.js`** (masking, connected components, row
  clustering, gap-splitting) — ran directly through Node against synthetic
  pixel data shaped like a real chord chart (tight multi-chord run, a
  separate far-apart chord, a second music system far below). Produced the
  correct 6 tokens in the correct reading order.
- **`src/lib/pdfOverlay.js`'s core mechanism** (load PDF → draw white
  rectangle → draw text → save) — ran directly through Node with `pdf-lib`
  against one of your real chord chart PDFs, then verified with
  `pdfplumber` that the new text landed at the exact coordinates and color
  intended, with the rest of the original page byte-identical.
- Custom **font embedding via `@pdf-lib/fontkit`** specifically — could
  **not** verify; that package wasn't available in this environment and I
  have no network to fetch it. It's used the standard, documented way
  (`pdfDoc.registerFontkit(fontkit)` then `pdfDoc.embedFont(bytes)`), but
  test this path yourself before relying on it.
- **`tesseract.js` OCR integration** — could not verify at all (needs a
  real browser/worker environment). The API usage matches tesseract.js v5's
  documented interface, but treat it as unverified until you've tried it.
- **The React components themselves** (`App.jsx`, `Wheel.jsx`, etc.) —
  written carefully and internally consistent, but never rendered in an
  actual browser. Click through the whole flow yourself first.

None of this replaces you actually running it. Treat this more like a
strong first draft than a finished, tested product.

## Architecture

```
src/
  lib/
    theory.js        chord parsing/transposition (verified, see above)
    pdfjsSetup.js     pdf.js init + page-to-canvas rendering
    colorMask.js      color isolation, connected components, row/gap logic (verified)
    ocr.js             tesseract.js wrapper + misread cleanup table
    detect.js           orchestrates render -> mask -> OCR across all pages
    pdfOverlay.js        pdf-lib: white-box + redraw onto the ORIGINAL pdf (core verified)
    fonts.js              bundled font list + loader
  components/
    Wheel.jsx          circle-of-fifths key selector
    Dropzone.jsx         drag-and-drop upload
    ColorPicker.jsx        eyedropper + manual color input
    ChordList.jsx            detected-chord preview chips
  App.jsx              ties it all together
public/fonts/          bundled TTFs (DejaVu Sans, Liberation Serif) for embedding
```

## Known limitations

- OCR-based detection for every PDF (see above) — always preview first.
- `tesseract.js` downloads its language model (~5–10 MB) from a CDN the
  first time it runs in a given browser session; that needs the *end
  user's* internet connection (fine on Vercel/production, just something
  to know).
- Large, high-DPI pages will be slower to process than the Python version,
  since everything (rendering, masking, OCR) runs on the client's CPU.
- No server means no persistence — refreshing the page loses your
  progress; download your file before closing the tab.
