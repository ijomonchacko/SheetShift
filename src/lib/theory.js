// Direct port of chordtranspose/theory.py. See that file for the reference
// implementation and comments -- kept in sync intentionally.
//
// Extended beyond the Python version with:
//   - slash-bass transposition (C/G +2 -> D/A, not D/G)
//   - isLikelyChord(): a suffix grammar so OCR garbage that happens to start
//     with A-G (e.g. "F5u52" for "Fsus2") is flagged for review instead of
//     silently passing through.

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const NATURAL_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CHORD_RE = /^([A-Ga-g])([♯♭#b]?)(.*)$/;
const STRAY_ROOT_TAIL = /^(?:0|1|2|3|4|8|10|12)$/;

const KEY_USES_FLATS = {
  C: false, G: false, D: false, A: false, E: false, B: false,
  "F♯": false, "C♯": false,
  F: true, "B♭": true, "E♭": true, "A♭": true, "D♭": true, "G♭": true,
  Bb: true, Eb: true, Ab: true, Db: true, Gb: true,
  Am: false, Em: false, Bm: false, "F♯m": false, "C♯m": false,
  "G♯m": false, "D♯m": false, "A♯m": false,
  Dm: true, Gm: true, Cm: true, Fm: true, "B♭m": true, "E♭m": true,
  Bbm: true, Ebm: true,
};

export function parseChord(token) {
  const m = CHORD_RE.exec((token || "").trim());
  if (!m) return null;
  const [, letter, accidental, suffix] = m;
  let idx = NATURAL_INDEX[letter.toUpperCase()];
  if (accidental === "♯" || accidental === "#") idx += 1;
  else if (accidental === "♭" || accidental === "b") idx -= 1;
  return { letter: letter.toUpperCase(), accidental, suffix, semitone: ((idx % 12) + 12) % 12 };
}

/** Transpose one pitch name (letter + optional accidental) by semitones. */
function transposeNote(note, semitones, preferFlats) {
  const parsed = parseChord(note);
  if (!parsed) return note;
  const newIndex = ((parsed.semitone + semitones) % 12 + 12) % 12;
  const table = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return table[newIndex];
}

export function transposeChord(token, semitones, preferFlats = false) {
  const parsed = parseChord(token);
  if (!parsed) return token;

  // Transpose a slash bass note too: C/G +2 should become D/A, not D/G.
  let suffix = parsed.suffix;
  const slash = /^(.*)\/([A-Ga-g][♯♭#b]?)$/.exec(suffix);
  if (slash) {
    suffix = slash[1] + "/" + transposeNote(slash[2], semitones, preferFlats);
  }

  const root = transposeNote(
    parsed.letter + (parsed.accidental || ""),
    semitones,
    preferFlats
  );
  return root + suffix;
}

function stripKeyQuality(key) {
  key = key.trim();
  for (const suffix of ["minor", "major", "min", "maj", "m"]) {
    if (key.toLowerCase().endsWith(suffix) && key.length > suffix.length) {
      return key.slice(0, key.length - suffix.length);
    }
  }
  return key;
}

export function semitonesBetween(fromKey, toKey) {
  const a = parseChord(stripKeyQuality(fromKey));
  const b = parseChord(stripKeyQuality(toKey));
  if (!a || !b) throw new Error(`Could not parse key names: ${fromKey} -> ${toKey}`);
  let diff = ((b.semitone - a.semitone) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  return diff;
}

export function keyPrefersFlats(key) {
  key = key.trim();
  if (key in KEY_USES_FLATS) return KEY_USES_FLATS[key];
  const root = stripKeyQuality(key);
  if (root in KEY_USES_FLATS) return KEY_USES_FLATS[root];
  return ["F", "B♭", "E♭", "A♭", "D♭", "Bb", "Eb", "Ab", "Db"].includes(root);
}

/* ============================================================
   Chord-suffix grammar for flagging OCR misreads
   ============================================================ */

// Extension numbers that may sit DIRECTLY on a root: C4 C5 C6 C7 C9 C11 C13.
// 1/2/3/8/10/12 are deliberately absent — they are not chord extensions, so
// "G1"/"G2"/"G3" is never a chord. It is a real "G" that swallowed a stray
// fragment (half a glyph, a stem, a slur end) sitting next to it.
const ROOT_EXT = "(?:4|5|6|7|9|11|13)";
// Altered/added tones always carry an accidental: b5, ♯9, #11, b13.
const ALT_EXT = "(?:[♯♭#b](?:4|5|6|9|11|13))";

// One "quality/extension chunk". Each alternative consumes at least one
// character, so the `(?:CHUNK)*` below can never spin on an empty match.
const CHUNK = [
  `(?:maj|Maj|MAJ|M|Δ)${ROOT_EXT}?`,        // Cmaj7, CM7, and bare "DM"
  "(?:min|Min|m)(?:6|7|9|11|13)?",          // Am, Am7, Cmin9
  "(?:sus|Sus)(?:2|4)?",                    // sus, sus2, sus4
  "(?:add|Add)(?:2|4|6|9|11|13)",           // add9 (a bare "add" is not one)
  "(?:dim|Dim|°|o(?![a-z]))(?:7)?",         // Cdim, C°7
  "(?:aug|Aug|\\+)",                        // Caug, C+
  "(?:ø|Ø)(?:7)?",                          // half-diminished
  "(?:alt|no3|no5)",
  ROOT_EXT,                                 // C7, C13, C5
  ALT_EXT,                                  // 7b9, maj7#11
  "-(?:5|9)",                               // 7-5 shorthand
].join("|");

const SUFFIX_RE = new RegExp(
  "^" +
    `(?:${CHUNK})*` +                            // m7, maj9, 7sus4, madd9, m7b5
    `(?:\\((?:${CHUNK})+\\)(?:${CHUNK})*)?` +    // (b5), (add9), m(maj7)
    "(?:/9)?" +                                  // the "6" of 6/9 is a chunk
    "(?:/[A-Ga-g][♯♭#b]?)?" +                    // slash bass: /G, /F♯
    "$"
);

/**
 * Stricter check than parseChord: true only when the whole token looks like
 * a real chord symbol. Use for "flag this for review" decisions — OCR output
 * like "F5u52" or "Am?q" starts with a valid root but has a garbage suffix.
 */
export function isLikelyChord(token) {
  const parsed = parseChord(token);
  if (!parsed) return false;
  // Long suffixes are garbage by definition and would make the alternation
  // above backtrack for a while, so reject them before running the regex.
  if (parsed.suffix.length > 14) return false;
  return SUFFIX_RE.test(parsed.suffix);
}

/**
 * Is this text-layer token a chord symbol? Chord roots are conventionally
 * written with an UPPERCASE letter A–G, so lowercase "am"/"be"/"g" is lyric
 * text. Combined with the full suffix grammar this is a strong,
 * exporter-agnostic classifier that needs no color.
 */
export function isChordToken(token) {
  const t = (token || "").trim();
  return /^[A-G]/.test(t) && isLikelyChord(t);
}

/**
 * Decide whether a detected token should be kept as a chord at all.
 *
 * Detection finds colored ink; that alone can't tell a chord ("Gm7") from a
 * colored title or lyric word ("Amazing", "Chorus") that merely starts with
 * A-G. This is the semantic gate: keep it only if it actually reads like a
 * chord symbol.
 *
 *   - Exact embedded text has no misreads, so it must parse as a real chord
 *     (isLikelyChord). Title/lyric words are dropped.
 *   - OCR can mangle a real chord ("Fsus2" -> "F5u52"), so a SHORT, root-led
 *     token with no long letter run is kept for the user to review, while
 *     word-shaped tokens ("Amazing") are still dropped.
 */
export function isChordCandidate(token, { fromOcr = false } = {}) {
  const t = (token || "").trim();
  if (!t) return false;
  if (isLikelyChord(t)) return true;
  if (!fromOcr) return false;                 // exact text → title/lyric, not a chord
  const parsed = parseChord(t);
  if (!parsed) return false;                  // doesn't even start with a root note
  if (t.length > 6) return false;             // long colored words are titles/lyrics
  if (/[A-Za-z]{4,}/.test(t)) return false;   // 4+ letters in a row = a word
  return true;                                // short root-led garbage → likely a misread chord
}

/**
 * True when `token` is chord material that carries no root of its own — the
 * pieces a detector splits a symbol into: "m", "M", "♯", "b", "sus4", "7",
 * "add9". Used to tell a genuine fragment ("D" + "M") apart from a blob that
 * merely landed next to a chord ("G" + "1").
 */
export function isChordSuffix(token) {
  let t = (token || "").trim();
  if (!t || t.length > 14) return false;
  if (/^[♯♭#b]/.test(t)) t = t.slice(1);   // a bare accidental counts
  return t === "" || SUFFIX_RE.test(t);
}

/**
 * Chord-adjacent fragments that should be glued to a neighbor rather than
 * treated as standalone symbols: suffix runs plus stray OCR digits/accidentals.
 */
export function isLooseChordFragment(token) {
  let t = (token || "").trim();
  if (!t || t.length > 14) return false;
  if (isChordSuffix(t)) return true;
  return STRAY_ROOT_TAIL.test(t) || /^[♯♭#b]$/.test(t);
}

/* ============================================================
   Music features: simplification, Nashville numbers, capo helper
   ============================================================ */

/**
 * Strip extensions for beginner arrangements: Cmaj9 -> C, Am7 -> Am,
 * F♯m7b5 -> F♯m, G7sus4 -> G, C/G stays C/G (the bass matters for the
 * left hand). Minor quality is kept; everything else goes.
 */
export function simplifyChord(token) {
  const parsed = parseChord(token);
  if (!parsed) return token;
  let suffix = parsed.suffix;
  let bass = "";
  const slash = /^(.*)\/([A-Ga-g][♯♭#b]?)$/.exec(suffix);
  if (slash) { suffix = slash[1]; bass = "/" + slash[2]; }
  // minor if the quality starts with m/min but NOT maj
  const isMinor = /^m(?!aj)/i.test(suffix) || /^min/i.test(suffix);
  const isDim = /^(dim|°|o(?![a-z]))/.test(suffix);
  const quality = isDim ? "dim" : isMinor ? "m" : "";
  return parsed.letter + (parsed.accidental || "") + quality + bass;
}

// Major-scale semitone offsets for Nashville degrees 1..7.
const DEGREE_OFFSETS = { 0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7" };
const FLAT_DEGREES = { 1: "♭2", 3: "♭3", 6: "♭5", 8: "♭6", 10: "♭7" };

function degreeFor(semitone, keySemitone) {
  const off = ((semitone - keySemitone) % 12 + 12) % 12;
  return DEGREE_OFFSETS[off] ?? FLAT_DEGREES[off] ?? String(off);
}

/**
 * Convert a chord symbol to the Nashville number system relative to a key
 * root (e.g. in C: Am7 -> 6m7, C/E -> 1/3, F♯dim -> ♯4dim… flats preferred
 * for out-of-scale roots).
 */
export function toNashville(token, keyName_) {
  const parsed = parseChord(token);
  const key = parseChord(stripKeyQuality(keyName_ || "C"));
  if (!parsed || !key) return token;

  let suffix = parsed.suffix;
  let bass = "";
  const slash = /^(.*)\/([A-Ga-g][♯♭#b]?)$/.exec(suffix);
  if (slash) {
    suffix = slash[1];
    const bp = parseChord(slash[2]);
    if (bp) bass = "/" + degreeFor(bp.semitone, key.semitone);
  }
  return degreeFor(parsed.semitone, key.semitone) + suffix + bass;
}

// Guitar-friendly open keys and their semitones.
const OPEN_MAJOR = [["C", 0], ["G", 7], ["D", 2], ["A", 9], ["E", 4]];
const OPEN_MINOR = [["Am", 9], ["Em", 4], ["Dm", 2]];

/**
 * Capo suggestions for a target key: "capo N, play <shape> shapes".
 * Returns up to `limit` options sorted by capo position (0 = no capo).
 */
export function capoSuggestions(targetKeyName, minor = false, limit = 3) {
  const target = parseChord(stripKeyQuality(targetKeyName || ""));
  if (!target) return [];
  const shapes = minor ? OPEN_MINOR : OPEN_MAJOR;
  const out = [];
  for (const [shape, semi] of shapes) {
    const capo = ((target.semitone - semi) % 12 + 12) % 12;
    if (capo <= 7) out.push({ capo, shape });
  }
  out.sort((a, b) => a.capo - b.capo);
  return out.slice(0, limit);
}
