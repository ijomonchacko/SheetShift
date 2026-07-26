import React from "react";

/* ══════════════════════════════════════════════════════════════════
   Generated vector art. Everything is drawn from arithmetic rather
   than hand-placed, so it stays crisp at any size, weighs almost
   nothing, and re-colours itself from the theme tokens.
   ══════════════════════════════════════════════════════════════════ */

/* ── 1 · Engraved staff field ─────────────────────────────────────
   Background plate for the hero and the CTA band: hand-engraved
   music paper — five-line staves with a slow drift, crossed by the
   concentric rings of a circle of fifths.
   ---------------------------------------------------------------- */
export function StaffField({ rings = true }) {
  const W = 1600;
  const H = 1000;

  // staves: 5 hairlines, gently bowed so they read as engraved, not printed
  const staves = [];
  for (let i = 0; i < 7; i++) {
    const base = 70 + i * 148;
    const bow = (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 6);
    for (let l = 0; l < 5; l++) {
      const y = base + l * 9;
      staves.push(
        <path
          key={`s${i}-${l}`}
          d={`M-40 ${y} Q ${W / 2} ${y + bow} ${W + 40} ${y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          opacity={0.16 - l * 0.008}
          data-staff=""
        />
      );
    }
    // bar lines
    for (let b = 1; b < 5; b++) {
      const x = (W / 5) * b + (i % 2 ? 40 : -20);
      staves.push(
        <line
          key={`b${i}-${b}`}
          x1={x} y1={base - 2} x2={x} y2={base + 38}
          stroke="currentColor" strokeWidth="0.9" opacity="0.13"
        />
      );
    }
  }

  // sparse noteheads sitting on the staves
  const notes = [];
  const seed = [0.14, 0.38, 0.52, 0.71, 0.86, 0.24, 0.63, 0.44, 0.79, 0.31];
  for (let i = 0; i < 7; i++) {
    for (let n = 0; n < 3; n++) {
      const k = (i * 3 + n) % seed.length;
      const x = seed[k] * W;
      const y = 70 + i * 148 + ((k % 5) * 4.5);
      notes.push(
        <ellipse
          key={`n${i}-${n}`}
          cx={x} cy={y} rx="5.2" ry="3.9"
          transform={`rotate(-18 ${x} ${y})`}
          fill="currentColor" opacity="0.13"
        />
      );
    }
  }

  // concentric rings — the circle of fifths, half off-canvas
  const ringEls = [];
  if (rings) {
    const cx = 1250, cy = 340;
    for (let r = 110; r <= 620; r += 62) {
      ringEls.push(
        <circle key={`r${r}`} cx={cx} cy={cy} r={r}
          fill="none" stroke="currentColor" strokeWidth="0.9"
          opacity={0.13 - r / 12000} data-ring="" />
      );
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ringEls.push(
        <line key={`t${i}`}
          x1={cx + Math.cos(a) * 110} y1={cy + Math.sin(a) * 110}
          x2={cx + Math.cos(a) * 620} y2={cy + Math.sin(a) * 620}
          stroke="currentColor" strokeWidth="0.9" opacity="0.07" />
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g data-staff-layer="">{staves}{notes}</g>
      <g data-ring-layer="">{ringEls}</g>
    </svg>
  );
}

/* ── 2 · Circle of fifths ─────────────────────────────────────────
   A real circle of fifths: majors outside, relative minors inside,
   a hand that swings to the selected key.
   ---------------------------------------------------------------- */
const MAJ = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
const MIN = ["a", "e", "b", "f♯", "c♯", "g♯", "d♯", "b♭", "f", "c", "g", "d"];

export function FifthsWheel({ active = 0, label = "C" }) {
  const C = 200;          // centre
  const R_OUT = 178;
  const R_MAJ = 158;
  const R_MID = 132;
  const R_MIN = 110;
  const R_IN = 86;

  const pt = (r, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };

  // one 30-degree segment centred on twelve o'clock — the hand group is
  // rotated to whichever key is active, carrying these with it.
  const seg = Math.PI / 12;                 // half of 30 degrees
  const on = (r, sign) => [C + Math.sin(sign * seg) * r, C - Math.cos(seg) * r];
  const arc = (r) => {
    const [x1, y1] = on(r, -1), [x2, y2] = on(r, 1);
    return `M${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const wedge = (ri, ro) => {
    const [ax, ay] = on(ro, -1), [bx, by] = on(ro, 1);
    const [cx2, cy2] = on(ri, 1), [dx, dy] = on(ri, -1);
    return `M${ax} ${ay} A ${ro} ${ro} 0 0 1 ${bx} ${by} L${cx2} ${cy2} A ${ri} ${ri} 0 0 0 ${dx} ${dy} Z`;
  };

  const spokes = [];
  for (let i = 0; i < 12; i++) {
    const a = ((i - 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    spokes.push(
      <line key={i}
        x1={C + Math.cos(a) * R_IN} y1={C + Math.sin(a) * R_IN}
        x2={C + Math.cos(a) * R_OUT} y2={C + Math.sin(a) * R_OUT}
        className="ss-wheel-spoke" />
    );
  }

  return (
    <svg className="ss-wheel" viewBox="0 0 400 400" role="img"
         aria-label="Circle of fifths key selector">
      <circle cx={C} cy={C} r={R_OUT} className="ss-wheel-ring" />
      <circle cx={C} cy={C} r={R_MID} className="ss-wheel-ring" />
      <circle cx={C} cy={C} r={R_IN} className="ss-wheel-ring" />
      {spokes}

      {MAJ.map((k, i) => {
        const [x, y] = pt(R_MAJ, i);
        return (
          <text key={k} x={x} y={y}
                className={`ss-wheel-lbl${i === active ? " is-on" : ""}`}
                data-wheel-maj={i}>{k}</text>
        );
      })}
      {MIN.map((k, i) => {
        const [x, y] = pt(R_MIN, i);
        return <text key={k} x={x} y={y} className="ss-wheel-lbl" opacity="0.6">{k}</text>;
      })}

      {/* swinging hand, with the active segment lit behind it */}
      <g data-wheel-hand="" style={{ transformOrigin: `${C}px ${C}px` }}>
        <path className="ss-wheel-glow" d={wedge(R_IN, R_OUT)} />
        <path className="ss-wheel-arc" d={arc(R_OUT - 6)} />
        <line x1={C} y1={C - R_IN + 4} x2={C} y2={C - R_MID + 6} className="ss-wheel-hand" />
        <circle cx={C} cy={C - R_MID + 6} r="4.5" className="ss-wheel-dot" />
      </g>

      <circle cx={C} cy={C} r="3" className="ss-wheel-dot" />
      <text x={C} y={C - 8} className="ss-wheel-core" data-wheel-core="">{label}</text>
      <text x={C} y={C + 30} className="ss-wheel-cap">TARGET KEY</text>
    </svg>
  );
}

/* ── 3 · Lead-sheet plate with a live review cursor ───────────────
   The "review on the page" artwork, drawn as an actual sheet: title
   block, numbered systems, chord symbols boxed where the detector
   found them, and a marching-ants cursor that walks from chord to
   chord reporting the confidence it scored.
   ---------------------------------------------------------------- */
const SYSTEMS = [
  {
    n: "1",
    lyric: "Walking down the avenue as evening settles in",
    chords: [
      { t: "D",     x: "1%",  c: "0.99" },
      { t: "Bm7",   x: "27%", c: "0.98" },
      { t: "Gsus2", x: "54%", c: "0.96" },
      { t: "A7",    x: "80%", c: "0.61", flag: true },
    ],
  },
  {
    n: "2",
    lyric: "Every window catches light and throws it back again",
    chords: [
      { t: "Em7",  x: "1%",  c: "0.99" },
      { t: "A",    x: "38%", c: "0.99" },
      { t: "D/F♯", x: "70%", c: "0.94" },
    ],
  },
  {
    n: "3",
    lyric: "And I could stay forever in this golden hour",
    chords: [
      { t: "G",     x: "1%",  c: "0.99" },
      { t: "A/C♯",  x: "34%", c: "0.93" },
      { t: "Bm",    x: "62%", c: "0.98" },
      { t: "Gmaj7", x: "84%", c: "0.97" },
    ],
  },
];

export function ChartPlate() {
  return (
    <div className="ss-sheet" aria-hidden="true">
      <div className="ss-sheet-head">
        <span className="ss-panel-dots"><i /><i /><i /></span>
        <span className="ss-sheet-title">Golden Hour</span>
        <span className="ss-sheet-meta">key of D · 3/4 · ♩ = 72</span>
      </div>

      <div className="ss-sheet-body">
        <i className="ss-panel-beam" />
        {SYSTEMS.map((sys) => (
          <div className="ss-sheet-sys" key={sys.n}>
            <span className="ss-sheet-n">{sys.n}</span>
            <div className="ss-sheet-stave">
              <div className="ss-chart-chords">
                {sys.chords.map((c, j) => (
                  <span key={j}
                        className={`ss-box${c.flag ? " ss-box--flag" : ""}`}
                        style={{ left: c.x }}
                        data-box=""
                        data-conf={c.c}
                  >
                    {c.t}
                    {c.flag && <i className="ss-box-tag">?</i>}
                  </span>
                ))}
              </div>
              <div className="ss-chart-lyric">{sys.lyric}</div>
              <div className="ss-chart-rule" />
            </div>
          </div>
        ))}

        {/* review cursor — GSAP walks it from box to box */}
        <span className="ss-cursor" data-cursor>
          <span className="ss-cursor-tag" data-cursor-tag>conf 0.99</span>
        </span>
      </div>

      <div className="ss-sheet-foot">
        <span>11 of 11 chords located</span>
        <span data-review-count>1 flagged for review</span>
      </div>
    </div>
  );
}

/* ── 4 · Key-morph plate ──────────────────────────────────────────
   Same chart, four keys. GSAP cross-fades the rows so the chords
   visibly move while the lyrics stay put — the product in one image.
   ---------------------------------------------------------------- */
const MORPH = [
  { key: "C",  rows: [["C", "Am7", "Fsus2", "G"],      ["Dm7", "G", "C", "Am"],      ["Fmaj7", "G/B", "Am7", "G"]] },
  { key: "D",  rows: [["D", "Bm7", "Gsus2", "A"],      ["Em7", "A", "D", "Bm"],      ["Gmaj7", "A/C♯", "Bm7", "A"]] },
  { key: "E♭", rows: [["E♭", "Cm7", "A♭sus2", "B♭"],   ["Fm7", "B♭", "E♭", "Cm"],    ["A♭maj7", "B♭/D", "Cm7", "B♭"]] },
  { key: "E",  rows: [["E", "C♯m7", "Asus2", "B"],     ["F♯m7", "B", "E", "C♯m"],    ["Amaj7", "B/D♯", "C♯m7", "B"]] },
];
const MORPH_LYRICS = [
  "Walking down the avenue as evening settles in",
  "Every window catches light and throws it back",
  "And I could stay forever in this golden hour",
];

export function MorphPlate() {
  return (
    <div className="ss-chart" aria-hidden="true">
      {MORPH_LYRICS.map((lyric, r) => (
        <div className="ss-chart-sys" key={r}>
          <div className="ss-chart-chords">
            {MORPH.map((m, k) => (
              <span key={k} data-morph={k}
                    style={{ left: 0, opacity: k === 0 ? 1 : 0, width: "100%" }}>
                {m.rows[r].map((c, ci) => (
                  <b key={ci}
                     style={{
                       position: "absolute",
                       left: `${ci * 26}%`,
                       fontWeight: 600,
                     }}>{c}</b>
                ))}
              </span>
            ))}
          </div>
          <div className="ss-chart-lyric">{lyric}</div>
          <div className="ss-chart-rule" />
        </div>
      ))}
    </div>
  );
}
