import React, { useMemo } from "react";

// Circle-of-fifths order, clockwise from 12 o'clock. Each slot carries both
// its major key and relative minor -- toggling "minor" relabels the same
// wedge to a different root pitch, exactly like a two-ring circle-of-fifths
// chart.
export const WHEEL = [
  { major: "C", majorSemi: 0, minor: "Am", minorSemi: 9 },
  { major: "G", majorSemi: 7, minor: "Em", minorSemi: 4 },
  { major: "D", majorSemi: 2, minor: "Bm", minorSemi: 11 },
  { major: "A", majorSemi: 9, minor: "F♯m", minorSemi: 6 },
  { major: "E", majorSemi: 4, minor: "C♯m", minorSemi: 1 },
  { major: "B", majorSemi: 11, minor: "G♯m", minorSemi: 8 },
  { major: "F♯", majorSemi: 6, minor: "D♯m", minorSemi: 3 },
  { major: "D♭", majorSemi: 1, minor: "B♭m", minorSemi: 10 },
  { major: "A♭", majorSemi: 8, minor: "Fm", minorSemi: 5 },
  { major: "E♭", majorSemi: 3, minor: "Cm", minorSemi: 0 },
  { major: "B♭", majorSemi: 10, minor: "Gm", minorSemi: 7 },
  { major: "F", majorSemi: 5, minor: "Dm", minorSemi: 2 },
];

const CX = 160, CY = 160, R_OUTER = 150, R_INNER = 96, R_ARC = 158;

function polar(r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function wedgePath(startAngle, endAngle) {
  const p1 = polar(R_OUTER, startAngle);
  const p2 = polar(R_OUTER, endAngle);
  const p3 = polar(R_INNER, endAngle);
  const p4 = polar(R_INNER, startAngle);
  return `M ${p1.x} ${p1.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${R_INNER} ${R_INNER} 0 0 0 ${p4.x} ${p4.y} Z`;
}

export function keyName(idx, minor) {
  if (idx === null || idx === undefined) return null;
  const slot = WHEEL[idx];
  return minor ? slot.minor : slot.major;
}

export function keySemitone(idx, minor) {
  if (idx === null || idx === undefined) return null;
  const slot = WHEEL[idx];
  return minor ? slot.minorSemi : slot.majorSemi;
}

/** Find the wheel index for a key name like "C", "F♯", "F#", "Am". */
export function keyIndexOf(name, minor = false) {
  if (!name) return null;
  const norm = name.replace("#", "♯").replace(/b(?=m?$)/, "♭");
  const i = WHEEL.findIndex((s) => (minor ? s.minor : s.major) === norm);
  return i === -1 ? null : i;
}

export default function Wheel({ fromIdx, toIdx, minor, onSelect, onHover }) {
  const arcPath = useMemo(() => {
    if (fromIdx === null || toIdx === null) return null;
    const start = fromIdx * 30;
    let diff = toIdx * 30 - start;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const sweep = diff >= 0 ? 1 : 0;
    const large = Math.abs(diff) > 180 ? 1 : 0;
    const p1 = polar(R_ARC, start);
    const p2 = polar(R_ARC, start + diff);
    return `M ${p1.x} ${p1.y} A ${R_ARC} ${R_ARC} 0 ${large} ${sweep} ${p2.x} ${p2.y}`;
  }, [fromIdx, toIdx]);

  return (
    <svg viewBox="0 0 320 320" className="wheel" role="img" aria-label="Circle of fifths key selector">
      <circle cx={CX} cy={CY} r={R_OUTER} className="wheel-face" />
      {WHEEL.map((slot, i) => {
        const start = i * 30 - 15, end = i * 30 + 15;
        const mid = polar((R_OUTER + R_INNER) / 2, i * 30);
        const label = minor ? slot.minor : slot.major;
        const cls = [
          "wheel-wedge",
          i === fromIdx ? "is-from" : "",
          i === toIdx ? "is-to" : "",
        ].filter(Boolean).join(" ");
        return (
          <g key={i}>
            <path
              d={wedgePath(start, end)}
              className={cls}
              tabIndex={0}
              role="button"
              aria-label={label}
              onClick={() => onSelect(i)}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); } }}
            />
            <text x={mid.x} y={mid.y} className="wheel-label">{label}</text>
          </g>
        );
      })}
      {arcPath && <path d={arcPath} className="wheel-arc is-visible" />}
      <circle cx={CX} cy={CY} r={R_INNER - 2} className="wheel-center-ring" />
    </svg>
  );
}
