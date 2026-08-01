import assert from "node:assert/strict";
import {
  transposeChord, isLikelyChord, simplifyChord, toNashville, capoSuggestions, isChordCandidate, isChordToken,
} from "../src/lib/theory.js";

export const tests = [
  ["reference transpositions", () => {
    const cases = [
      ["C", 2, false, "D"], ["Am", 2, false, "Bm"], ["F♯m7", 1, false, "Gm7"],
      ["Bb", 2, false, "C"], ["C", -2, true, "B♭"], ["G7", 5, false, "C7"],
      ["Esus4", 1, false, "Fsus4"], ["Dmaj7", 3, true, "Fmaj7"],
      ["F#", 2, false, "G♯"], ["Fsus2", 2, false, "Gsus2"],
    ];
    for (const [t, s, flats, want] of cases) {
      assert.equal(transposeChord(t, s, flats), want, `${t} ${s>0?"+":""}${s}`);
    }
  }],
  ["slash bass transposes", () => {
    assert.equal(transposeChord("C/G", 2, false), "D/A");
    assert.equal(transposeChord("D/F♯", -2, false), "C/E");
    assert.equal(transposeChord("Am7/G", 2, false), "Bm7/A");
  }],
  ["chord grammar accepts real chords", () => {
    for (const t of ["C", "Am", "F#", "Bb", "Cmaj7", "Gsus2", "A7sus4", "Cadd9",
                     "Em7b5", "Ddim", "C6/9", "D/F#", "Am7/G", "C(add9)", "A4"]) {
      assert.ok(isLikelyChord(t), t);
    }
  }],
  ["chord grammar rejects OCR garbage", () => {
    for (const t of ["F5u52", "Am?q", "Cxyz", "Gsusx", "B%", "Ehello", "G1"]) {
      assert.ok(!isLikelyChord(t), t);
    }
  }],
  ["simplify strips extensions", () => {
    assert.equal(simplifyChord("Cmaj9"), "C");
    assert.equal(simplifyChord("Am7"), "Am");
    assert.equal(simplifyChord("F♯m7b5"), "F♯m");
    assert.equal(simplifyChord("Am7/G"), "Am/G");
  }],
  ["nashville numbers", () => {
    assert.equal(toNashville("C", "C"), "1");
    assert.equal(toNashville("Am7", "C"), "6m7");
    assert.equal(toNashville("C/E", "C"), "1/3");
    assert.equal(toNashville("Bb", "C"), "♭7");
  }],
  ["capo suggestions", () => {
    const eb = capoSuggestions("E♭", false, 5);
    assert.deepEqual(eb[0], { capo: 1, shape: "D" });
    assert.ok(eb.some((s) => s.capo === 3 && s.shape === "C"));
  }],
  ["isChordCandidate keeps real chords", () => {
    for (const t of ["C", "Am7", "F♯m7b5", "G/B", "Csus4", "D/F#"]) {
      assert.ok(isChordCandidate(t), t);
      assert.ok(isChordCandidate(t, { fromOcr: true }), `${t} (ocr)`);
    }
  }],
  ["isChordCandidate drops title/lyric words from exact text", () => {
    for (const t of ["Amazing", "Grace", "Chorus", "Before", "Ending", "Glory"]) {
      assert.ok(!isChordCandidate(t), t);
      assert.ok(!isChordCandidate(t, { fromOcr: true }), `${t} (ocr)`);
    }
  }],
  ["isChordCandidate keeps short OCR misreads for review", () => {
    // Short, root-led garbage is likely a mangled chord — keep it (flagged).
    for (const t of ["F5u52", "Am?q", "G7b"]) {
      assert.ok(isChordCandidate(t, { fromOcr: true }), `${t} (ocr)`);
      assert.ok(!isChordCandidate(t), `${t} (exact should drop)`);
    }
  }],
  ["isChordToken requires an uppercase root", () => {
    for (const t of ["C", "Am7", "F#m", "G/B", "Csus4", "D/F#"]) assert.ok(isChordToken(t), t);
    // lowercase lyric words that would otherwise parse as chords
    for (const t of ["am", "be", "g", "dad", "cage"]) assert.ok(!isChordToken(t), t);
  }],
  ["transpose edge cases: slash chords, suffixes, wraparound", () => {
    assert.equal(transposeChord("C/E", 2, false), "D/F♯");   // bass moves too
    assert.equal(transposeChord("Am7/G", 2, false), "Bm7/A");
    assert.equal(transposeChord("Cmaj7", 2, false), "Dmaj7"); // quality preserved
    assert.equal(transposeChord("F♯m7b5", 1, false), "Gm7b5");
    assert.equal(transposeChord("B", 1, false), "C");         // wrap B→C
    assert.equal(transposeChord("E", -1, false), "D♯");       // negative
  }],
  ["enharmonic spelling follows preferFlats", () => {
    assert.equal(transposeChord("C", 1, true), "D♭");
    assert.equal(transposeChord("C", 1, false), "C♯");
  }],
  ["Nashville numbers relative to key", () => {
    assert.equal(toNashville("C", "C"), "1");
    assert.equal(toNashville("F", "C"), "4");
    assert.equal(toNashville("G", "C"), "5");
    assert.equal(toNashville("Am", "C"), "6m");
  }],
  ["simplify strips extensions to the triad", () => {
    assert.equal(simplifyChord("Cmaj9"), "C");
    assert.equal(simplifyChord("Am7"), "Am");
  }],
];
