// Constrained post-OCR correction for chord symbols.
//
// Tesseract's LSTM engine largely ignores tessedit_char_whitelist, so single
// chord letters routinely come back as look-alike digits (A→4, G→6, B→8,
// D→0, E→3) and suffix characters get swapped the other way (2→z, 9→q/g,
// s→5). Instead of trusting the raw read, we search the space of known
// character confusions for the nearest string that parses as a real chord —
// and NEVER touch a read that is already valid.
//
// Pure module (no tesseract import) so it can be unit-tested in Node.

import { isLikelyChord } from "./theory.js";

/** Exact-match systematic misreads (ported from image_extract.py). */
export const OCR_FIXES = {
  kK: "F", KF: "F", FE: "F", EF: "F", EK: "F", kk: "F",
  Al: "A7", AI: "A7", "A/": "A7", A1: "A7",
  Gi: "G7", "G/": "G7",
  Ci: "C7", "C/": "C7",
  Ei: "E7", "E/": "E7",
  Bi: "B7", "B/": "B7",
  Di: "D7", "D/": "D7",
  "E-": "E",
  CH: "C♯",
};

/**
 * Characters tesseract confuses on chord glyphs, mapped to what they are
 * most likely to actually be. Applied one substitution at a time (then two),
 * keeping the first candidate that parses as a valid chord.
 */
const ALTERNATIVES = {
  // digits misread where a letter belongs
  "0": ["D"],
  "3": ["E"],
  "4": ["A"],
  "6": ["G"],
  "8": ["B"],
  "9": ["G"],
  "1": ["7"],
  // letters misread where a digit belongs
  l: ["7", "1"],
  I: ["7"],
  q: ["9"],
  g: ["9"],
  z: ["2"],
  Z: ["2"],
  S: ["5"],
  // sharp glyph misread mid-token
  H: ["♯"],
  t: ["♯"],
};

/** Regex repairs for multi-character systematic confusions. */
function regexRepairs(t) {
  let s = t;
  // Sharp read as H / tt right after a note letter: FH -> F♯, GHm7 -> G♯m7.
  s = s.replace(/^([A-Ga-g])(?:H|tt)/, "$1♯");
  // "rn" is the classic OCR read of "m" (Arn7 -> Am7).
  s = s.replace(/rn/g, "m");
  // sus family: 5us / su5 / 5u5 -> sus ; susz/susZ -> sus2.
  s = s.replace(/5u5|5us|su5/gi, "sus");
  s = s.replace(/sus[zZ]/g, "sus2");
  // add family: addg / addq -> add9.
  s = s.replace(/add[gq]/g, "add9");
  // maj family: mai -> maj.
  s = s.replace(/ma[iI]/g, "maj");
  // Trailing stray punctuation OCR sometimes appends.
  s = s.replace(/[.,'`]+$/, "");
  return s;
}

/**
 * Breadth-first search over character substitutions (up to `maxSubs` at
 * once). Returns the first grammar-valid candidate, or null.
 */
function substitutionRepair(token, maxSubs = 2) {
  if (token.length === 0 || token.length > 10) return null;
  const seen = new Set([token]);
  let frontier = [token];
  for (let depth = 0; depth < maxSubs; depth++) {
    const next = [];
    for (const t of frontier) {
      for (let i = 0; i < t.length; i++) {
        const alts = ALTERNATIVES[t[i]];
        if (!alts) continue;
        for (const a of alts) {
          const cand = t.slice(0, i) + a + t.slice(i + 1);
          if (seen.has(cand)) continue;
          seen.add(cand);
          if (isLikelyChord(cand)) return cand;
          next.push(cand);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Clean one raw OCR token. Correct reads pass through untouched; invalid
 * reads go through exact fixes, regex repairs, then constrained
 * substitution search. If nothing produces a valid chord, the raw read is
 * returned as-is (the UI flags it for manual review).
 */
export function cleanOcrToken(text) {
  const t = (text || "").trim();
  if (OCR_FIXES[t]) return OCR_FIXES[t];
  if (isLikelyChord(t)) return t;

  const rx = regexRepairs(t);
  if (isLikelyChord(rx)) return rx;

  const sub = substitutionRepair(rx);
  if (sub) return sub;

  return t;
}

/**
 * Re-join chord symbols the box detector split into fragments — a sharp
 * glyph or wide letter-spacing can turn "F♯m" into "F" + "#" + "m", or
 * "Esus2" into "E" + "sus" + "2".
 *
 * Two neighbors on the same text row merge when the horizontal gap between
 * them is small (≈ within one glyph-height) AND merging makes sense:
 *   - the combined text parses as a real chord while at least one piece
 *     doesn't ("F" + "#" → "F#", "F#" + "m" → "F#m", "C" + "7" → "C7"), or
 *   - neither piece parses on its own (fragments of one symbol).
 * Two adjacent complete chords ("Am" "F") never merge — their combined
 * text isn't a valid chord.
 *
 * Pure function over PDF-point boxes (exported for unit tests).
 */
export function mergeSplitTokens(pageBoxes, gapFactor = 1.0) {
  if (pageBoxes.length < 2) return pageBoxes;
  const out = [];
  let cur = { ...pageBoxes[0] };

  // Chord suffixes are often drawn as smaller, superscript-shifted runs
  // ("E" + "ˢᵘˢ²"), so row matching must tolerate partial vertical overlap.
  const sameRow = (a, b) => {
    const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return overlap > 0.3 * Math.min(a.y1 - a.y0, b.y1 - b.y0);
  };

  for (let i = 1; i < pageBoxes.length; i++) {
    const next = pageBoxes[i];
    const h = Math.max(cur.y1 - cur.y0, next.y1 - next.y0);
    const gap = next.x0 - cur.x1;
    const closeEnough = sameRow(cur, next) && gap >= -h && gap <= h * gapFactor;

    if (closeEnough) {
      const combined = cleanOcrToken(cur.text + next.text);
      const curValid = isLikelyChord(cur.text);
      const nextValid = isLikelyChord(next.text);
      const shouldMerge =
        (isLikelyChord(combined) && (!curValid || !nextValid)) ||
        (!curValid && !nextValid);
      if (shouldMerge) {
        cur = {
          ...cur,
          text: combined,
          x1: Math.max(cur.x1, next.x1),
          y0: Math.min(cur.y0, next.y0),
          y1: Math.max(cur.y1, next.y1),
          confidence: Math.min(cur.confidence ?? 100, next.confidence ?? 100),
        };
        continue;
      }
    }
    out.push(cur);
    cur = { ...next };
  }
  out.push(cur);
  return out;
}
