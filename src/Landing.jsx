import React from "react";
import { linkTo } from "./Root";
import Footer from "./components/Footer";

/* ---------- tiny inline icons (no icon library needed) ---------- */
const I = {
  logo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  wheel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" opacity="0.6" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  font: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19 11 5h2l6 14M7.5 14h9" />
    </svg>
  ),
  drop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3s6.5 6.6 6.5 11a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3Z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  ),
};

/* ---------- decorative circle-of-fifths for the hero ---------- */
function HeroWheel() {
  const KEYS = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
  const CX = 130, CY = 130, R_OUT = 124, R_IN = 78;
  const polar = (r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const wedge = (i) => {
    const s = i * 30 - 15, e = i * 30 + 15;
    const [x1, y1] = polar(R_OUT, s), [x2, y2] = polar(R_OUT, e);
    const [x3, y3] = polar(R_IN, e), [x4, y4] = polar(R_IN, s);
    return `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${R_IN} ${R_IN} 0 0 0 ${x4} ${y4} Z`;
  };
  return (
    <svg viewBox="0 0 260 260" className="hero-wheel" aria-hidden="true">
      {KEYS.map((k, i) => {
        const [lx, ly] = polar((R_OUT + R_IN) / 2, i * 30);
        const cls = i === 0 ? "hw-wedge is-from" : i === 2 ? "hw-wedge is-to" : "hw-wedge";
        return (
          <g key={k}>
            <path d={wedge(i)} className={cls} />
            <text x={lx} y={ly} className="hw-label">{k}</text>
          </g>
        );
      })}
      <path d={`M ${polar(R_OUT + 9, 0)} A ${R_OUT + 9} ${R_OUT + 9} 0 0 1 ${polar(R_OUT + 9, 60)}`} className="hw-arc" />
      <circle cx={CX} cy={CY} r={R_IN - 4} className="hw-hub" />
      <text x={CX} y={CY - 8} className="hw-hub-line1">C → D</text>
      <text x={CX} y={CY + 14} className="hw-hub-line2">+2 semitones</text>
    </svg>
  );
}

/* ---------- mock "before/after" chart card for the hero ---------- */
function HeroChart() {
  const line = (chords, lyric, after) => (
    <div className="hc-line">
      <div className={`hc-chords${after ? " is-after" : ""}`}>
        {chords.map((c, i) => <span key={i} style={{ left: c[1] + "%" }}>{c[0]}</span>)}
      </div>
      <div className="hc-lyric">{lyric}</div>
    </div>
  );
  return (
    <div className="hero-chart" aria-hidden="true">
      <div className="hc-window">
        <div className="hc-titlebar"><span /><span /><span />
          <em>wonderwall.pdf</em>
        </div>
        <div className="hc-body">
          <div className="hc-side">
            <div className="hc-tag">Original · C</div>
            {line([["C", 0], ["Am", 38], ["F", 72]], "Today is gonna be the day…")}
            {line([["G", 4], ["C", 55]], "…that they're gonna throw it back")}
          </div>
          <div className="hc-divider">{I.arrow}</div>
          <div className="hc-side">
            <div className="hc-tag is-after">Transposed · D</div>
            {line([["D", 0], ["Bm", 38], ["G", 72]], "Today is gonna be the day…", true)}
            {line([["A", 4], ["D", 55]], "…that they're gonna throw it back", true)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      {/* ============ NAV ============ */}
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="/" onClick={linkTo("/")}>
            <span className="brand-mark">{I.logo}</span>
            SheetShift
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href="/docs" onClick={linkTo("/docs")}>Docs</a>
          </div>
          <a className="btn btn-primary btn-sm" href="/app" onClick={linkTo("/app")}>
            Open the app
          </a>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="pill">
              <span className="pill-dot" />
              100% in your browser — files never leave your device
            </div>
            <h1>
              Change the key of any chord chart <span className="grad">in seconds</span>
            </h1>
            <p className="hero-sub">
              Drop in a PDF lead sheet, pick your new key on the circle of fifths,
              and download a clean transposed copy — original layout, lyrics and
              formatting untouched.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary btn-lg" href="/app" onClick={linkTo("/app")}>
                Transpose a PDF {I.arrow}
              </a>
              <a className="btn btn-ghost btn-lg" href="#how">See how it works</a>
            </div>
            <ul className="hero-points">
              <li>{I.check} Free, no sign-up</li>
              <li>{I.check} No uploads to any server</li>
              <li>{I.check} Works with MuseScore, Finale &amp; Sibelius exports</li>
            </ul>
          </div>
          <div className="hero-visual">
            <HeroWheel />
            <HeroChart />
          </div>
        </div>
      </header>

      {/* ============ HOW IT WORKS ============ */}
      <section className="section" id="how">
        <div className="section-inner">
          <p className="kicker">How it works</p>
          <h2>Three steps to a new key</h2>
          <div className="steps">
            <div className="step-card">
              <div className="step-icon">{I.file}</div>
              <div className="step-n">01</div>
              <h3>Drop in your PDF</h3>
              <p>Any chord chart or lead sheet with chord symbols — drag it straight onto the page.</p>
            </div>
            <div className="step-card">
              <div className="step-icon">{I.wheel}</div>
              <div className="step-n">02</div>
              <h3>Pick your keys</h3>
              <p>Tap the current key and the target key on an interactive circle of fifths — or shift by semitones.</p>
            </div>
            <div className="step-card">
              <div className="step-icon">{I.drop}</div>
              <div className="step-n">03</div>
              <h3>Review &amp; download</h3>
              <p>Check every detected chord, fix any misreads with one click, and download the transposed PDF.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="section section-alt" id="features">
        <div className="section-inner">
          <p className="kicker">Features</p>
          <h2>Small tool, sharp details</h2>
          <div className="features">
            <div className="feature-card">
              <div className="feature-icon">{I.lock}</div>
              <h3>Private by design</h3>
              <p>Rendering, chord detection and PDF generation all run locally in your browser. Your music never touches a server.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">{I.wheel}</div>
              <h3>Circle-of-fifths picker</h3>
              <p>Choose keys the way musicians think — on the wheel, with major/minor toggle and the interval shown as you pick.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">{I.eye}</div>
              <h3>Review before you print</h3>
              <p>Every detected chord is listed as an editable before → after chip, with uncertain reads flagged for you.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">{I.drop}</div>
              <h3>Color-matched output</h3>
              <p>An eyedropper lets you click the exact chord color in your chart so the new chords blend right in.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">{I.font}</div>
              <h3>Your fonts, embedded</h3>
              <p>Pick a bundled font or upload your own .ttf/.otf so the transposed chords match your chart's style.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">{I.check}</div>
              <h3>Correct spelling, always</h3>
              <p>Sharps and flats follow the target key — transpose to E♭ and you'll get B♭, not A♯.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="section" id="faq">
        <div className="section-inner section-narrow">
          <p className="kicker">FAQ</p>
          <h2>Questions, answered</h2>
          <div className="faq">
            <details>
              <summary>Is my PDF uploaded anywhere?</summary>
              <p>No. The whole pipeline — rendering, OCR chord detection, and writing the new PDF — runs in your browser. The only network request is your browser downloading the app itself (and the OCR model on first use).</p>
            </details>
            <details>
              <summary>What kinds of PDFs work best?</summary>
              <p>Chord charts and lead sheets exported from notation software (MuseScore, Finale, Sibelius…) where chord symbols are printed in a distinct color or clear positions above the lyrics. Scanned charts work too, but expect to review the detected chords more carefully.</p>
            </details>
            <details>
              <summary>How accurate is the chord detection?</summary>
              <p>Chords are read with OCR from the rendered page, so accuracy is high on clean digital exports but not guaranteed. That's why there's always a review step: every chord is shown as an editable before → after pair, and anything that doesn't parse as a real chord is flagged.</p>
            </details>
            <details>
              <summary>Does it change my chart's layout?</summary>
              <p>No — the original PDF is kept intact. Old chord symbols are covered and the new ones are drawn in the same spot, same size, same color, so lyrics, melody and spacing stay exactly where they were.</p>
            </details>
            <details>
              <summary>What does it cost?</summary>
              <p>Nothing. It's free, with no account and no limits.</p>
            </details>
          </div>
        </div>
      </section>

      {/* ============ CTA BAND ============ */}
      <section className="cta-band">
        <div className="cta-inner">
          <h2>Ready when your capo isn't</h2>
          <p>Transpose your first chart in under a minute.</p>
          <a className="btn btn-inverse btn-lg" href="/app" onClick={linkTo("/app")}>
            Open SheetShift {I.arrow}
          </a>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <Footer />
    </div>
  );
}
