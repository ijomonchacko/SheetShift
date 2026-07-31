import assert from "node:assert/strict";
import { cleanOcrToken } from "../src/lib/ocrRepair.js";

export const tests = [
  ["digit-for-letter mishits repaired", () => {
    const cases = [
      ["4", "A"], ["6", "G"], ["8", "B"], ["0", "D"], ["3", "E"],
      ["47", "A7"], ["4m7", "Am7"], ["0m7", "Dm7"], ["8b", "Bb"], ["6sus4", "Gsus4"],
    ];
    for (const [i, want] of cases) assert.equal(cleanOcrToken(i), want, i);
  }],
  ["sharp-as-H and sus misreads repaired", () => {
    const cases = [
      ["FH", "F♯"], ["GHm7", "G♯m7"], ["F5u52", "Fsus2"], ["Csusz", "Csus2"],
      ["Arn7", "Am7"], ["Dmai7", "Dmaj7"], ["Caddg", "Cadd9"], ["CH", "C♯"],
    ];
    for (const [i, want] of cases) assert.equal(cleanOcrToken(i), want, i);
  }],
  ["sharp read as i/e right after the root repaired", () => {
    const cases = [
      ["Fim", "F♯m"], ["Cem", "C♯m"], ["Fim7", "F♯m7"], ["Cim", "C♯m"],
      ["Gi", "G7"], ["Fi", "F♯"],
    ];
    for (const [i, want] of cases) assert.equal(cleanOcrToken(i), want, i);
    // lyric-ish fragments must NOT be coerced into sharps
    assert.equal(cleanOcrToken("Fig"), "Fig");
    assert.equal(cleanOcrToken("Fie"), "Fie");
  }],
  ["valid reads never modified", () => {
    for (const t of ["C", "F#", "Fsus2", "Am7/G", "C6", "G13", "B7", "Eb", "A4"]) {
      assert.equal(cleanOcrToken(t), t, t);
    }
  }],
  ["stray tail digits trim back to the chord root", () => {
    assert.equal(cleanOcrToken("G1"), "G");
    assert.equal(cleanOcrToken("Fmaj1"), "Fmaj");
  }],
  ["unrepairable garbage passes through for flagging", () => {
    assert.equal(cleanOcrToken("%%"), "%%");
    assert.equal(cleanOcrToken("xyz"), "xyz");
  }],
];
