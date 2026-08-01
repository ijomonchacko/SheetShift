# SheetShift

**Transpose PDF chord charts and lead sheets to a new key — right in your browser, in seconds.**

SheetShift reads the chords in a PDF, lets you pick a new key (or shift by an interval), and hands back a transposed PDF that looks exactly like the original — same layout, lyrics, spacing, and fonts, just with the chords changed. Everything runs on your device; your files are never uploaded.

---

## Why SheetShift

- **Keeps your chart intact.** It doesn't rebuild the page. The original PDF is preserved and only the chord symbols are covered and redrawn in place, so lyrics, staves, and spacing stay exactly where they were.
- **Works with the tools you already use.** Charts exported from MuseScore, Finale, Sibelius, Dorico, and LilyPond are read exactly from their text layer. Scanned or image-only PDFs are handled by OCR.
- **Private by design.** Rendering, chord detection, and PDF generation all happen locally in the browser. Nothing is sent to a server, and after the first visit it works offline.
- **Free, no account, no limits.**

---

## Features

### Flexible transposition
- **Circle-of-fifths wheel** — tap a "from" key and a "to" key to transpose; the interval is shown as you go.
- **By interval** — shift up or down by a set number of semitones.
- **Major / minor** aware, with a relative-minor view on the wheel.
- **Nashville numbers** — output chords as a number system relative to the key instead of letter names.
- **Enharmonic control** — choose automatic sharp/flat spelling, or force sharps or flats.
- **Simplify** — reduce extended chords to their triad (e.g. `Cmaj9` → `C`).
- **Capo suggestions** to play in an easier shape.

### Smart chord detection
- **Exact text extraction** for digitally-exported PDFs — chords are read directly from the embedded text, with no OCR and no guessing. They're identified by chord spelling and by the font/size the chart uses for chords, so it's completely color-independent.
- **In-browser PP-OCR** for scanned and image-only PDFs — a modern text detector + recognizer (PaddleOCR PP-OCR) running via ONNX Runtime Web with **WebGPU acceleration**, and an automatic Tesseract fallback if needed.
- **Music-aware filtering** — chords are separated from staff lines, note-name letters, fingerings, page/measure numbers, and other musical marks using chord grammar, text-size clustering, and chord-line structure. Numbers like `8` or `67` won't be turned into chords.
- **Detection strength** — choose Precise, Balanced, or Aggressive to trade false positives against catching every last chord.

### Review before you commit
- **Two review modes** — a compact before → after chip list, or an **on-page overlay** where detected chords are highlighted directly on your chart.
- **Edit, add, or delete** any chord — corrections re-transpose instantly.
- **Confidence flags** — low-confidence OCR reads are highlighted and summarised so you know what to double-check.
- **Find & replace** across all detected chords, plus **undo/redo**.

### Faithful output
- Transposed chords are drawn in a **matched font, size, and color** over the original chords, preserving the chart's look.
- **Font choices** — bundled fonts (Arial-compatible and more), any font installed on your computer, or upload your own `.ttf`/`.otf`.
- Pick the **ink color** for the new chords, with an eyedropper to match your chart.

### Built for real use
- **Setlist mode** — queue several PDFs and work through them one after another.
- **Session resume** — pick up where you left off.
- **Installable PWA** — add it to your device and use it offline; OCR models and assets are cached after first use.
- **Accessible** — keyboard-operable controls (including the key wheel) and clear focus states.
- **Light & dark themes.**

---

## How it works

1. **Drop in a PDF** chord chart or lead sheet (one, or several for a setlist).
2. **Pick the new key** on the circle-of-fifths wheel, or shift by an interval.
3. **Review** the detected chords in the list or on the page, and fix anything that needs it.
4. **Download** a transposed PDF that matches your original.

All four steps happen entirely in your browser.

---

## Under the hood

SheetShift is a client-only web app — a static site with no backend or API.

- **React + Vite** front end.
- **pdf.js** for rendering and text extraction.
- **onnxruntime-web** (WebGPU/WASM) running **PP-OCRv3** detection + recognition, with **tesseract.js** as a fallback.
- **pdf-lib** + **fontkit** for layout-preserving PDF output.

Because it's fully client-side, your charts never leave your device.
