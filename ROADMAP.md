# SheetShift — Feature Roadmap

A checklist of features for this codebase. Checked items have shipped.
Unchecked items carry a note on the external setup they need (accounts,
npm installs, or CI runners that can't be configured from inside the app).

## Detection & OCR accuracy

- [x] **Read embedded PDF text when available** — parse the content stream for
      text-based PDFs (via `pdf.js` `getTextContent()` + color heuristics) and
      only fall back to OCR for scanned charts. Biggest accuracy win possible.
- [x] **Confidence scores in the review list** — surface tesseract's per-token
      confidence and sort/flag low-confidence chips first.
- [x] **Multiple chord colors** — let users add 2–3 chord colors (some charts
      use different colors per section).
- [x] **Auto color detection** — histogram the rendered page and suggest the
      most likely chord color instead of assuming maroon.
- [x] **Per-page header margin** — page 1 often has a title block the other
      pages don't; allow "first page only" margin.
- [x] **Visual overlay review** — show detected boxes drawn on the rendered
      page so users can see *where* each chord was found (and spot misses).
- [x] **Click-to-add missed chords** — click a spot on the page preview to add
      a chord the detector missed.

## Transposition & music features

- [x] **Capo helper** — "play in G shapes with capo 2" suggestions alongside
      the raw transposition.
- [x] **Enharmonic override** — per-song toggle between C♯/D♭ spellings when
      the auto choice isn't what the band uses.
- [x] **Nashville numbers output** — convert chord symbols to the Nashville
      number system instead of a new key.
- [x] **Chord simplification mode** — optionally strip extensions
      (Cmaj9 → C) for beginner arrangements.
- [x] **Transpose preview on the wheel** — hovering a target key shows the
      first few converted chords live before running detection.

## Editor & UX

- [x] **Undo / redo in the review list** — currently an edit is final.
- [x] **Bulk find-and-replace** — fix the same misread everywhere at once
      ("change all `Gm?` to `Gm7`").
- [x] **Keyboard navigation** — arrow between chips, Enter to edit.
- [x] **Side-by-side preview** — original page next to the transposed page in
      the done state.
- [x] **Recent files / session restore** — keep the last plan in
      `IndexedDB` so a refresh doesn't lose the review work.
- [x] **Drag-and-drop multiple PDFs** — queue several charts and batch-export.
- [x] **Dark mode** — the design tokens are already centralized in
      `:root`; add a `prefers-color-scheme` variant.

## Output

- [x] **Export the whole setlist as one merged PDF** (needs multi-file
      support above; `pdf-lib` can merge).
- [x] **Watermark-free print stylesheet** — a print-optimized route that
      renders the transposed chart for direct printing.
- [x] **Share link with embedded settings** — encode key/interval choices in
      the URL query so a band leader can send "open your chart and transpose
      to E♭" links.
- [x] **ChordPro export** — output detected chords + positions as a
      `.cho`/`.crd` text file for apps like OnSong.

## Platform

- [x] **PWA / offline support** — service worker + manifest so the app (and
      cached OCR model) works with no connection; "Install app" prompt.
- [ ] **Self-hosted OCR language data** *(external setup: requires downloading `eng.traineddata` (~11 MB) into `public/` — do this once from a machine with internet: `curl -L -o public/eng.traineddata.gz https://github.com/naptha/tessdata/raw/gh-pages/4.0.0/eng.traineddata.gz`, then set `langPath: "/"` in `createWorker`)* — serve `eng.traineddata` from
      `/public` instead of the tesseract CDN (removes the only third-party
      network dependency).
- [x] **Web Worker for detection** — move the mask/OCR pipeline off the main
      thread so the UI never janks on big charts.
- [x] **Error reporting opt-in** — a "copy debug info" button on the error
      state (never automatic, keeps the privacy promise).

## Growth / SEO

- [ ] **Per-key landing pages** *(external setup: needs a prerendering plugin (`vite-plugin-ssg` or similar) installed via npm)* — static pages like "/transpose-to-e-flat"
      targeting long-tail searches (needs prerendering, e.g. `vite-plugin-ssg`).
- [ ] **Blog / guides section** *(external setup: a content project — needs articles written; the /docs route shows the pattern to follow)* — "how to transpose for capo", "keys for
      female vocalists" — content that links into the tool.
- [x] **Demo chart** — a "Try with a sample chart" button so visitors can
      experience the flow without their own PDF.
- [ ] **Open Graph per route** *(external setup: partially done (per-route `document.title` ships now); full OG tags per route need prerendering or edge middleware)* — distinct titles/descriptions for /app and
      /docs (needs prerendering or edge middleware).
- [ ] **Analytics (privacy-friendly)** *(external setup: needs a Plausible/Umami account; add their one-line script to index.html)* — e.g. Plausible/Umami page counts
      only; keep the "no analytics on your files" promise intact.

## Quality

- [x] **Unit tests in CI** — `theory.js` and `ocrRepair.js` are pure and
      already tested ad-hoc; wire them into `vitest` + GitHub Actions.
- [x] **E2E smoke test** — Playwright flow (upload → preview → generate) with
      a fixture PDF on every push.
- [ ] **Lighthouse budget** *(external setup: wire `lhci` into the GitHub Actions workflow once the repo is on GitHub)* — keep the landing page ≥95 performance/SEO.
