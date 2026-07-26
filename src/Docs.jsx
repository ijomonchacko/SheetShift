import React, { useEffect } from "react";
import { linkTo } from "./Root";
import Footer from "./components/Footer";

const SECTIONS = [
  { id: "quick-start", label: "Quick start" },
  { id: "how-detection-works", label: "How detection works" },
  { id: "reviewing-chords", label: "Reviewing chords" },
  { id: "review-tools", label: "Review tools" },
  { id: "transposition-modes", label: "Transposition modes" },
  { id: "output-options", label: "Output options" },
  { id: "setlists", label: "Setlists & batch" },
  { id: "advanced-settings", label: "Advanced settings" },
  { id: "fonts", label: "Fonts & styling" },
  { id: "sharing", label: "Sharing & exports" },
  { id: "offline", label: "Offline & sessions" },
  { id: "privacy", label: "Privacy" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "limitations", label: "Limitations" },
];

export default function Docs() {
  // Honor a #hash deep-link on first load.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }), 60);
    }
  }, []);

  return (
    <div className="docs-page">
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="/" onClick={linkTo("/")}>
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
                <circle cx="12" cy="12" r="4.2" fill="currentColor" />
              </svg>
            </span>
            SheetShift
          </a>
          <div className="nav-links">
            <a href="/" onClick={linkTo("/")}>Home</a>
            <a href="/docs" onClick={linkTo("/docs")} aria-current="page" className="is-current">Docs</a>
          </div>
          <a className="btn btn-primary btn-sm" href="/app" onClick={linkTo("/app")}>
            Open the app
          </a>
        </div>
      </nav>

      <div className="docs-layout">
        {/* ---------- sidebar ---------- */}
        <aside className="docs-sidebar" aria-label="Documentation sections">
          <p className="docs-sidebar-title">Documentation</p>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`/docs#${s.id}`} onClick={linkTo(`/docs#${s.id}`)}>{s.label}</a>
              </li>
            ))}
          </ul>
        </aside>

        {/* ---------- content ---------- */}
        <article className="docs-content">
          <p className="kicker">Docs</p>
          <h1>Using SheetShift</h1>
          <p className="docs-lede">
            Everything you need to know about transposing PDF chord charts with
            SheetShift — from the 60-second happy path to what every advanced
            setting actually does.
          </p>

          <section id="quick-start">
            <h2>Quick start</h2>
            <ol className="docs-steps">
              <li><strong>Open the app</strong> — head to <a href="/app" onClick={linkTo("/app")}>sheetshift.vercel.app/app</a>.</li>
              <li><strong>Drop in your PDF</strong> — any chord chart or lead sheet with chord symbols. Exports from MuseScore, Finale or Sibelius work best.</li>
              <li><strong>Pick your keys</strong> — tap the song's current key, then the key you want, on the circle of fifths. The interval is shown as you pick.</li>
              <li><strong>Preview</strong> — hit <em>Preview detected chords</em> and skim the list. Anything flagged in red didn't parse as a real chord; click it to fix.</li>
              <li><strong>Generate &amp; download</strong> — your transposed PDF keeps the original layout, lyrics and spacing.</li>
            </ol>
          </section>

          <section id="how-detection-works">
            <h2>How detection works</h2>
            <p>
              SheetShift uses a two-tier pipeline. For digitally-exported PDFs
              (MuseScore, Finale, Sibelius…) it reads the chart's <strong>embedded
              text layer directly</strong> — chord symbols come back exactly as
              printed, with no OCR involved. The rendered page is used only to
              check each token's color, so lyrics and headings are ignored. You'll
              see an <em>"Exact · embedded text"</em> badge when this path was used.
            </p>
            <p>
              For scanned or flattened PDFs with no text layer, it falls back to
              optical detection: render the page, isolate the pixels matching your
              chord color (maroon by default — use the eyedropper or auto-detect
              if yours differs), group them into tokens, and read each one with
              OCR. Every OCR read carries a confidence score, and low-confidence
              reads are flagged for review.
            </p>
            <div className="docs-callout">
              The first OCR run in a browser session downloads the language model
              (~5–10&nbsp;MB). Everything after that runs fully offline — and with
              the app installed as a PWA, so does the rest of SheetShift.
            </div>
          </section>

          <section id="reviewing-chords">
            <h2>Reviewing chords</h2>
            <p>
              The preview lists every detected symbol as a <em>before → after</em> chip.
              Click any chip to correct the original reading — the transposed value
              updates automatically. Chips outlined in red are symbols that don't
              parse as a chord (e.g. OCR read "Gm7" as "Gm?"); fix these before
              generating.
            </p>
            <p>
              A good habit: compare the chord <em>count</em> per page against your
              original. A missing chord usually means its color didn't match (see
              the eyedropper) or it sits inside the header margin (see below).
            </p>
          </section>

          <section id="review-tools">
            <h2>Review tools</h2>
            <ul>
              <li><strong>Two views</strong> — review as a chip <em>list</em>, or <em>on the page</em>: an overlay view drawing every detected box on the rendered chart so you can see exactly where each chord was found.</li>
              <li><strong>Click-to-add</strong> — in the on-page view, click any empty spot to add a chord the detector missed.</li>
              <li><strong>Undo / redo</strong> — every edit is reversible (Ctrl+Z / Ctrl+Shift+Z, or the ↩ ↪ buttons).</li>
              <li><strong>Bulk find &amp; replace</strong> — fix the same misread everywhere at once (e.g. all <code>Gm?</code> → <code>Gm7</code>).</li>
              <li><strong>Keyboard navigation</strong> — ← → moves between chips, Enter edits.</li>
              <li><strong>Confidence flags</strong> — OCR reads under 85% confidence are marked ⚠ and can be sorted first; invalid chords are outlined red.</li>
            </ul>
          </section>

          <section id="transposition-modes">
            <h2>Transposition modes</h2>
            <h3>By key</h3>
            <p>
              Pick the current key and the target key on the circle of fifths, with
              a Major/Minor toggle. SheetShift computes the shortest interval and —
              importantly — spells accidentals to match the destination key:
              transpose to E♭ and you'll get B♭, not A♯.
            </p>
            <h3>By interval</h3>
            <p>
              Shift everything by a fixed number of semitones (e.g. −2 for a chart
              a whole step down for a capo-2 arrangement). Positive numbers move up,
              negative down. Spelling defaults to sharps.
            </p>
          </section>

          <section id="output-options">
            <h2>Output options</h2>
            <p>Under <em>Advanced → Output</em>:</p>
            <ul>
              <li><strong>Nashville numbers</strong> — instead of a new key, write chords as scale degrees relative to the song's key (in C: Am7 → 6m7, C/E → 1/3).</li>
              <li><strong>Enharmonic override</strong> — force ♯ or ♭ spellings when the automatic choice isn't how your band writes it (D♭ vs C♯).</li>
              <li><strong>Simplify</strong> — strip extensions for beginner arrangements: Cmaj9 → C, Am7 → Am (slash basses are kept).</li>
            </ul>
            <p>
              After a successful transposition you'll also get <strong>capo
              suggestions</strong> for the target key — e.g. "Capo 3, play C shapes"
              for E♭ — plus a <strong>side-by-side compare</strong> of the original
              and transposed pages.
            </p>
          </section>

          <section id="setlists">
            <h2>Setlists &amp; batch</h2>
            <p>
              Drop <strong>several PDFs</strong> at once (or add more later) and
              they queue up as a setlist. Work through them one at a time with the
              same key settings — after each chart generates, hit <em>Next
              chart</em>. When two or more are done, <em>Download setlist</em>
              merges every transposed chart into a single PDF in order.
            </p>
          </section>

          <section id="advanced-settings">
            <h2>Advanced settings</h2>
            <table className="docs-table">
              <thead>
                <tr><th>Setting</th><th>What it does</th><th>Default</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Font</td>
                  <td>The typeface used to draw the new chord symbols. Pick a bundled font, one installed on your computer, or upload a .ttf/.otf.</td>
                  <td>DejaVu Sans (Bold)</td>
                </tr>
                <tr>
                  <td>Font size</td>
                  <td>Fixed size in points for the new chords. Leave empty to match each original symbol's size automatically.</td>
                  <td>Auto</td>
                </tr>
                <tr>
                  <td>Chord color</td>
                  <td>The color the detector looks for <em>and</em> draws with. Use the eyedropper to click a chord in your chart for an exact match.</td>
                  <td>Maroon</td>
                </tr>
                <tr>
                  <td>Scan DPI</td>
                  <td>Rendering resolution for detection. Higher catches small print but is slower. 150 suits most charts; try 200–300 for dense or scanned pages.</td>
                  <td>150</td>
                </tr>
                <tr>
                  <td>Header margin</td>
                  <td>Fraction of the page height (0–1) ignored at the top, so colored titles/headers aren't misread as chords.</td>
                  <td>0.12</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="fonts">
            <h2>Fonts &amp; styling</h2>
            <p>SheetShift can draw the new chords in three kinds of font:</p>
            <ul>
              <li>
                <strong>Bundled fonts</strong> — a set of freely-licensed families,
                including metric-compatible stand-ins for common chart fonts:
                Liberation Sans (≈&nbsp;Arial), Carlito (≈&nbsp;Calibri), Caladea
                (≈&nbsp;Cambria), Liberation Serif (≈&nbsp;Times New Roman),
                Liberation Mono (≈&nbsp;Courier), plus DejaVu Sans/Serif and Poppins.
              </li>
              <li>
                <strong>Fonts on your computer</strong> — in Chrome or Edge, choose
                <em> "Choose from this computer…"</em> in the Font menu to browse
                every font installed on your machine. The font file is read locally
                and embedded straight into the PDF; it is never uploaded.
              </li>
              <li>
                <strong>Uploaded font files</strong> — any .ttf or .otf file works
                in every browser.
              </li>
            </ul>
            <div className="docs-callout">
              Matching your chart's original font makes the transposed chords close
              to invisible as edits. If your chart was made with Arial, pick
              Liberation Sans — the widths match exactly.
            </div>
          </section>

          <section id="sharing">
            <h2>Sharing &amp; exports</h2>
            <ul>
              <li><strong>Settings links</strong> — <em>Copy settings link</em> encodes your key/interval choices in the URL (e.g. <code>/app?from=C&amp;to=Eb</code>), so a band leader can send "open your chart and transpose to E♭" links. Files are never part of the link.</li>
              <li><strong>ChordPro export</strong> — download the reviewed chords as a <code>.cho</code> file for OnSong, SongBook and similar apps.</li>
              <li><strong>Print</strong> — a print-optimized view renders each page clean and full-bleed, one per sheet, straight to your printer.</li>
            </ul>
          </section>

          <section id="offline">
            <h2>Offline &amp; sessions</h2>
            <ul>
              <li><strong>Install as an app</strong> — SheetShift is a PWA: use your browser's "Install app" option and it works offline (including OCR, once the model has been downloaded on first use).</li>
              <li><strong>Session restore</strong> — after detection, your reviewed chords are kept in the browser's own storage. If the tab closes or refreshes, you'll be offered a one-click <em>Resume last session</em>.</li>
              <li><strong>Dark mode</strong> — follows your OS by default; the sun/moon button in the top bar overrides it.</li>
            </ul>
          </section>

          <section id="privacy">
            <h2>Privacy</h2>
            <p>
              SheetShift is a static site with no backend. Your PDF is opened,
              rendered, read and rewritten entirely by JavaScript running in your
              browser tab. There are no uploads, no accounts, no analytics on your
              files, and closing the tab removes everything.
            </p>
            <p>
              The only network activity after the page loads is a one-time download
              of the OCR language model from a CDN.
            </p>
          </section>

          <section id="troubleshooting">
            <h2>Troubleshooting</h2>
            <dl className="docs-faqlist">
              <dt>No chords were found</dt>
              <dd>
                Your chart's chord color probably isn't maroon. Open
                <em> Advanced → Chord color</em>, click <em>Pick from PDF</em>, and
                click directly on a chord symbol in the page preview.
              </dd>
              <dt>Some chords are missing</dt>
              <dd>
                Raise the Scan DPI to 200–300 (small symbols), or lower the header
                margin if chords sit very close to the top of the page.
              </dd>
              <dt>A chord was misread</dt>
              <dd>
                Click its chip in the preview and type the correct symbol — the
                transposed value updates instantly.
              </dd>
              <dt>Titles or headings got detected as chords</dt>
              <dd>
                If they're the same color as your chords, raise the header margin
                (e.g. 0.15–0.2) so the top of the page is ignored.
              </dd>
              <dt>"Choose from this computer" shows an error</dt>
              <dd>
                The Local Font Access API is Chrome/Edge-only and needs your
                permission. In other browsers, upload the .ttf/.otf file instead.
              </dd>
              <dt>Generation succeeded but chords look wrong in the PDF</dt>
              <dd>
                Check the font size setting (leave it on Auto unless you need a
                fixed size), and verify corrections were made <em>before generating</em>.
              </dd>
            </dl>
          </section>

          <section id="limitations">
            <h2>Limitations</h2>
            <ul>
              <li>Detection is OCR-based for every PDF — always use the preview step.</li>
              <li>Large, high-DPI pages process on your CPU, so very long charts take longer.</li>
              <li>Nothing is saved between visits — download your file before closing the tab.</li>
              <li>Chord symbols inside images-of-images (e.g. a photo of a photocopied chart) may need a higher DPI and more corrections.</li>
            </ul>
          </section>

          <div className="docs-cta">
            <a className="btn btn-primary btn-lg" href="/app" onClick={linkTo("/app")}>
              Open SheetShift
            </a>
          </div>
        </article>
      </div>

      <Footer />
    </div>
  );
}
