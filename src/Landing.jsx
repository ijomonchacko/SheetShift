import React, { useLayoutEffect, useRef, useState } from "react";
import { linkTo } from "./Root";
import SiteNav from "./components/SiteNav.jsx";
import Footer from "./components/Footer.jsx";
import { StaffField, FifthsWheel, ChartPlate, MorphPlate } from "./components/art/Art.jsx";
import { ArrowUR, ArrowR, Check, Play, Bolt, Sliders, Layers, Lock, FileDrop } from "./components/art/Marks.jsx";
import { initLanding } from "./lib/anim.js";
import "./site.css";

/* ── content ─────────────────────────────────────────────────────── */

const SOURCES = ["MuseScore", "Finale", "Sibelius", "Dorico", "LilyPond", "OnSong", "Guitar Pro", "Scanned handouts"];

const STEPS = [
  { n: "01", t: "Drop the PDF", d: "Drag in a chord chart or lead sheet. It is opened and read on your own machine — the file never touches a network." },
  { n: "02", t: "Pick the key", d: "Choose a destination on the circle of fifths, or nudge by semitones. Capo suggestions come along for free." },
  { n: "03", t: "Check the read", d: "Every chord the detector found is boxed on the rendered page. Correct, add or delete anything before you commit." },
  { n: "04", t: "Take the PDF", d: "Old symbols are covered, new ones drawn at the same coordinate. Everything else about the page is untouched." },
];

const WHY = [
  { I: Bolt,    t: "Seconds, not rewrites", d: "From dropped file to finished download in about the time it takes to tune a string." },
  { I: Sliders, t: "Theory-true spelling",   d: "Accidentals follow the destination key signature. Slash basses, sus and altered qualities all move correctly." },
  { I: Layers,  t: "Setlists and exports",   d: "Queue a whole set, transpose it as one job, merge to a single PDF, or export ChordPro." },
  { I: Lock,    t: "Private by construction", d: "No upload, no account, no telemetry on your files. Install it once and it keeps working offline." },
];

const CASES = [
  {
    k: "By key · enharmonic control",
    t: "It's written in C. She sings it in A.",
    d: "Two taps on the wheel and the whole chart drops a minor third — spelled the way you would write it out by hand, not the way a naive find-and-replace would.",
    f: "Circle of fifths · semitone mode",
  },
  {
    k: "Setlist · merged export",
    t: "Five songs. One rehearsal.",
    d: "Queue the set, apply the same treatment to every chart, merge to a single PDF and print for the whole band before the coffee goes cold.",
    f: "Batch transposition · single-file output",
  },
  {
    k: "OCR · on-page review",
    t: "A photocopy from 1994.",
    d: "OCR reads the scan, repairs the misreads it already knows about, and flags the two symbols it doubted so you can fix them in a couple of clicks.",
    f: "Confidence scoring · flagged tokens",
  },
];

const FAQ = [
  ["Is my PDF uploaded anywhere?",
   "No. Rendering, chord detection, transposition and PDF writing all happen inside your browser tab. The only network traffic is your browser fetching the app itself — and, the first time you process a scan, the OCR language model."],
  ["What kinds of charts work best?",
   "Chord charts and lead sheets exported from notation software — MuseScore, Finale, Sibelius, Dorico and friends. Their chord symbols are read exactly from the PDF's own text layer. Scans work too, through OCR, and simply want a closer look at the review step."],
  ["How accurate is the detection?",
   "On digital exports it is exact, because no guessing is involved. On scans it is high but not perfect, so every token carries a confidence score, systematic misreads are repaired automatically, and anything doubtful is flagged before you generate."],
  ["Does it change my chart's layout?",
   "No. The original PDF is edited rather than rebuilt. Each old chord symbol is covered and the new one is drawn at the same coordinate, at the same size, in the same colour — so lyrics, melody, spacing and page breaks stay precisely where they were."],
  ["What does it cost?",
   "Nothing. There is no account, no quota and no paid tier."],
];

/* ── accordion ───────────────────────────────────────────────────── */

/* Open/close is a `grid-template-rows: 0fr → 1fr` transition, so the
   panel animates to its natural height with no measuring and no JS. */
function Faq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="ss-faq">
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div className={`ss-q${isOpen ? " is-open" : ""}`} key={q}>
            <button
              type="button"
              className="ss-q-btn"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-btn-${i}`}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span className="ss-q-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="ss-q-q">{q}</span>
              <span className="ss-q-sign" aria-hidden="true" />
            </button>
            <div className="ss-q-body" id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`}>
              <div><p>{a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function Landing() {
  const root = useRef(null);
  // useLayoutEffect, not useEffect: the starting states must be written
  // before the browser paints, or the hero flashes in fully formed and
  // then jumps back to animate.
  useLayoutEffect(() => initLanding(root.current), []);

  return (
    <div className="ss" ref={root}>
      <SiteNav />

      {/* ══════════ HERO ══════════ */}
      <section className="ss-hero">
        <div className="ss-hero-bg" aria-hidden="true">
          <div className="ss-hero-bg-in">
            <StaffField />
            <i className="ss-hero-play" />
          </div>
        </div>

        <div className="ss-wrap ss-hero-grid">
          <div>
            <p className="ss-kicker" data-anim="rise">PDF chord transposition</p>

            <h1 className="ss-d1">
              <span className="ss-line"><span>Any chart.</span></span>
              <span className="ss-line"><span>Any key.</span></span>
              <span className="ss-line"><span>Same page.</span></span>
            </h1>

            <p className="ss-lede ss-hero-sub" data-anim="rise">
              SheetShift lifts the chord symbols out of your PDF, transposes them
              with real music theory, and writes them back into the original
              page — same spacing, same typeface, same colour. Nothing is
              re-typeset. Nothing is uploaded.
            </p>

            <div className="ss-hero-cta" data-anim="rise">
              <a className="ss-btn ss-btn--lg" href="/app" onClick={linkTo("/app")} data-magnetic>
                Transpose a chart <ArrowUR className="ss-arrow" />
              </a>
              <a className="ss-btn ss-btn--lg ss-btn--ghost" href="/app" onClick={linkTo("/app")}>
                <Play /> Open the sample
              </a>
            </div>

            <p className="ss-hero-note" data-anim="fade">
              <b>Free</b> · no account · <b>100%</b> in your browser · works offline
            </p>
          </div>

          <div data-hero-art className="ss-hero-stage">
            <div className="ss-panel">
              <div className="ss-panel-bar">
                <span className="ss-panel-dots"><i /><i /><i /></span>
                golden-hour.pdf — key of <b data-morph-key style={{ color: "var(--ss-chord)", marginLeft: 4 }}>C</b>
                <i className="ss-panel-progress" />
              </div>
              <div className="ss-panel-body"><MorphPlate /></div>
              <div className="ss-panel-foot">
                <span>11 chords · 3 systems · 2 pages</span>
                <span className="ss-panel-ok">Layout preserved</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SOURCE RAIL ══════════ */}
      <div className="ss-rail">
        <div className="ss-wrap ss-rail-in">
          <span className="ss-rail-lbl">Reads charts from</span>
          <div className="ss-rail-track">
            <div className="ss-rail-set">{SOURCES.map((s) => <span key={s}>{s}</span>)}</div>
            <div className="ss-rail-set" aria-hidden="true">{SOURCES.map((s) => <span key={s}>{s}</span>)}</div>
          </div>
        </div>
      </div>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="ss-sec" id="how">
        <div className="ss-wrap">
          <div className="ss-head">
            <p className="ss-kicker" data-anim="rise">How it works</p>
            <h2 className="ss-d2" data-anim="rise">Four steps.<br />About ten seconds.</h2>
            <p className="ss-lede" data-anim="rise">
              No account to create, no file to upload, no waiting for a queue on
              somebody else's server. The whole pipeline runs on the machine in
              front of you.
            </p>
            <i className="ss-head-rule" data-rule />
          </div>

          <div className="ss-steps">
            <i className="ss-steps-rail" />
            <i className="ss-steps-dot" />
            {STEPS.map((s) => (
              <div className="ss-step" key={s.n} data-anim="rise">
                <span className="ss-step-ghost" aria-hidden="true">{s.n}</span>
                <span className="ss-step-n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURE ROWS ══════════ */}
      <section className="ss-sec ss-sec--rule" id="features">
        <div className="ss-wrap">
          <div className="ss-head">
            <p className="ss-kicker" data-anim="rise">Capabilities</p>
            <h2 className="ss-d2" data-anim="rise">Precision where it counts.</h2>
            <i className="ss-head-rule" data-rule />
          </div>

          <div style={{ marginTop: "clamp(56px, 7vw, 96px)" }}>
            {/* row 1 — layout preservation */}
            <div className="ss-row">
              <div className="ss-row-copy">
                <h3 className="ss-d3" data-anim="rise">The layout never moves.<br />Only the chords do.</h3>
                <p className="ss-body" data-anim="rise">
                  SheetShift does not re-engrave your chart. It edits the PDF you
                  already have — covering each old chord symbol and drawing the
                  replacement at the same coordinate, in the same face, at the
                  same size and in the same colour.
                </p>
                <ul className="ss-row-list">
                  <li data-anim="rise"><Check /><span>Positioned to the point, not to the nearest line</span></li>
                  <li data-anim="rise"><Check /><span>Original typeface and chord colour preserved</span></li>
                  <li data-anim="rise"><Check /><span>Lyrics, melody, page breaks and margins untouched</span></li>
                </ul>
                <a className="ss-link" data-anim="rise" href="/docs#how-detection-works" onClick={linkTo("/docs#how-detection-works")}>
                  How detection works <ArrowR />
                </a>
              </div>
              <div className="ss-row-art" data-anim="fade">
                <div className="ss-panel"><ChartPlate /></div>
              </div>
            </div>

            {/* row 2 — theory */}
            <div className="ss-row ss-row--flip">
              <div className="ss-row-copy">
                <h3 className="ss-d3" data-anim="rise">Real theory,<br />not string replacement.</h3>
                <p className="ss-body" data-anim="rise">
                  Transposition is a spelling problem before it is an arithmetic
                  one. SheetShift walks the circle of fifths, resolves the
                  destination key signature, and then writes every chord the way
                  a musician would write it by hand.
                </p>
                <ul className="ss-row-list">
                  <li data-anim="rise"><Check /><span>E♭ major gets B♭ — never A♯</span></li>
                  <li data-anim="rise"><Check /><span>Slash basses, sus, add, 6/9 and altered qualities all move</span></li>
                  <li data-anim="rise"><Check /><span>By key or by interval, in either direction</span></li>
                  <li data-anim="rise"><Check /><span>Nashville numbers and capo suggestions on request</span></li>
                </ul>
                <a className="ss-link" data-anim="rise" href="/docs#quick-start" onClick={linkTo("/docs#quick-start")}>
                  Read the quick start <ArrowR />
                </a>
              </div>
              <div className="ss-row-art" data-anim="fade" data-wheel>
                <div className="ss-panel">
                  <div className="ss-panel-bar">
                    <span className="ss-panel-dots"><i /><i /><i /></span>
                    Circle of fifths — scroll to move
                  </div>
                  <div className="ss-panel-body" style={{ padding: 28 }}>
                    <FifthsWheel />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ WHY ══════════ */}
      <section className="ss-sec ss-sec--rule" id="why">
        <div className="ss-wrap">
          <div className="ss-head ss-head--center">
            <p className="ss-kicker" data-anim="rise">Why SheetShift</p>
            <h2 className="ss-d2" data-anim="rise">The difference is everything.</h2>
          </div>
          <div className="ss-grid">
            {WHY.map(({ I, t, d }) => (
              <article className="ss-card" key={t} data-anim="rise">
                <span className="ss-card-ico"><I /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>

          {/* stats sit inside the same band, on the same rhythm */}
          <div className="ss-stats">
            <div className="ss-stat" data-anim="fade">
              <span className="ss-stat-v" data-count="12">12</span>
              <span className="ss-stat-l">Keys, both directions</span>
            </div>
            <div className="ss-stat" data-anim="fade">
              <span className="ss-stat-v" data-count="100" data-suffix="%">100%</span>
              <span className="ss-stat-l">On-device processing</span>
            </div>
            <div className="ss-stat" data-anim="fade">
              <span className="ss-stat-v">0</span>
              <span className="ss-stat-l">Files ever uploaded</span>
            </div>
            <div className="ss-stat" data-anim="fade">
              <span className="ss-stat-v" data-count="10" data-prefix="~" data-suffix="s">~10s</span>
              <span className="ss-stat-l">Typical chart, start to finish</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SCENARIOS ══════════ */}
      <section className="ss-sec ss-sec--rule">
        <div className="ss-wrap">
          <div className="ss-head">
            <p className="ss-kicker" data-anim="rise">Made for working musicians</p>
            <h2 className="ss-d2" data-anim="rise">Every stage. Every Sunday.</h2>
          </div>
          <div className="ss-grid ss-grid--3">
            {CASES.map((c) => (
              <article className="ss-qcard" key={c.t} data-anim="rise">
                <span className="ss-qcard-t">{c.k}</span>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
                <span className="ss-qcard-f">{c.f}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="ss-sec ss-sec--rule" id="faq">
        <div className="ss-wrap ss-faq-grid">
          <div className="ss-faq-aside">
            <p className="ss-kicker" data-anim="rise">FAQ</p>
            <h2 className="ss-d2" data-anim="rise">Questions,<br />answered.</h2>
            <p className="ss-body" data-anim="rise">
              The short version: nothing is uploaded, nothing is re-typeset,
              and nothing costs anything.
            </p>
            <a className="ss-link" data-anim="rise" href="/docs" onClick={linkTo("/docs")}>
              Read the full documentation <ArrowR />
            </a>
          </div>

          <div data-anim="fade">
            <Faq items={FAQ} />
          </div>
        </div>
      </section>

      {/* ══════════ CLOSING MODULE ══════════ */}
      <section className="ss-cta">
        <div className="ss-wrap">
          <div className="ss-cta-card" data-anim="rise">
            <div className="ss-cta-copy">
              <p className="ss-kicker">Start now</p>
              <h2 className="ss-d2">Your next key<br />starts here.</h2>
              <p className="ss-lede">
                Drop a chart in and you will have the new key before rehearsal.
                Free, no sign-up, and the file never leaves your machine.
              </p>
              <div className="ss-cta-btns">
                <a className="ss-btn ss-btn--lg" href="/app" onClick={linkTo("/app")} data-magnetic>
                  Open SheetShift <ArrowUR className="ss-arrow" />
                </a>
                <a className="ss-btn ss-btn--lg ss-btn--ghost" href="/docs" onClick={linkTo("/docs")}>
                  Read the docs
                </a>
              </div>
            </div>

            <a className="ss-drop" href="/app" onClick={linkTo("/app")} data-drop>
              <span className="ss-drop-ico"><FileDrop /></span>
              <strong>Drop a PDF chart here</strong>
              <span className="ss-drop-sub">
                or choose a file — it is read on your device, never uploaded
              </span>
              <span className="ss-drop-hint">
                Opens the app <ArrowUR />
              </span>
            </a>
          </div>

          <ul className="ss-cta-bar" data-anim="fade">
            <li><Check /> No account, ever</li>
            <li><Check /> Works offline once installed</li>
            <li><Check /> Nothing leaves your device</li>
          </ul>
        </div>
      </section>

      <Footer />
    </div>
  );
}
