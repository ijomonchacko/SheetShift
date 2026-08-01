# Changelog

All notable changes to SheetShift are documented here.

## Unreleased

### Detection
- **New primary OCR engine**: PP-OCRv3 (text detection + recognition) running fully in the browser via ONNX Runtime Web, with WebGPU acceleration and automatic WASM fallback. Falls back to the bundled Tesseract engine if the models can't load.
- **Color-independent detection** for scanned/image PDFs: chords are found by chord grammar, text size, and chord-line structure rather than ink color, so black-on-black notation works and staff lines / note letters / numbers are no longer mistaken for chords.
- **Detection strength** control (Precise / Balanced / Aggressive) to trade recall against precision.
- Digit-disambiguation pass to stop misread numbers (e.g. `8`→`B`, `67`→`G7`) becoming chords.
- Text-layer PDFs are read exactly from the embedded text (no OCR), identified by chord spelling and font.

### Performance
- ONNX Runtime WASM loads from a pinned CDN and is cached by the service worker for offline use (a true self-host from `/public` isn't compatible with Vite's dev server).- OCR models are cached (Cache Storage) so they download once per browser.
- Build split into cacheable vendor chunks (pdf.js, tesseract, onnxruntime, pdf-lib, react); the app-shell chunk is now a fraction of its former size.
- Offline support via a service worker (app shell precached; OCR models/WASM cached on first use).

### UX / UI
- Refreshed settings hierarchy: numbered step chips, per-step descriptions, flatter modern cards, softer shadows.
- Right-hand preview stays pinned on large screens while the left settings column scrolls.
- Per-chord confidence surfaced with an "N to review" summary.
- Redesigned chord-color picker and Advanced settings; toggle switches for boolean options.
- Mobile/tablet fixes: prevented iOS focus-zoom, constrained preview/overlay canvases, fixed the mobile-menu "Open the app" button.
- Accessibility: consistent keyboard focus rings, keyboard-operable circle-of-fifths wheel.

### Reliability
- Very long PDFs are capped at 50 scanned pages with a clear notice.
- Improved processing animation with real progress.

### Engineering
- CI workflow runs unit tests + production build on every push/PR.
- Expanded unit tests (transposition edge cases, Nashville, OCR repair, chord grammar).

### Known issues
- Two `npm audit` advisories (moderate/high) originate from the dev toolchain (esbuild/Vite) and affect the local dev server only, not the static production build. Fixing requires a breaking Vite major upgrade and is deferred.
