import assert from "node:assert/strict";
import { mergeSplitTokens } from "../src/lib/ocrRepair.js";

// helper: build a row of boxes from [text, x0, width] triples, height 11
const row = (y, parts) => parts.map(([text, x0, w]) => ({
  text, x0, x1: x0 + w, y0: y, y1: y + 11, pageIndex: 0, confidence: 90, method: "ocr",
}));
const texts = (boxes) => boxes.map((b) => b.text);

export const tests = [
  ["superscript suffix runs merge (notation-software style)", () => {
    // "E" tall root + smaller raised "sus2" run, as MuseScore draws them
    const boxes = [
      { text: "E", x0: 60, x1: 69, y0: 600, y1: 613, pageIndex: 0, confidence: 100, method: "text" },
      { text: "sus2", x0: 69.5, x1: 88, y0: 605, y1: 613, pageIndex: 0, confidence: 100, method: "text" },
    ];
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["Esus2"]);
  }],
  ["A + m and A + M merge", () => {
    const am = row(600, [["A", 60, 9], ["m", 70, 8]]);
    assert.deepEqual(texts(mergeSplitTokens(am)), ["Am"]);
    const aM = row(600, [["A", 60, 9], ["M", 70, 8]]);
    assert.deepEqual(texts(mergeSplitTokens(aM)), ["AM"]);
  }],
  ["D + M merges back into DM", () => {
    const boxes = row(600, [["D", 60, 9], ["M", 71, 10]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["DM"]);
  }],
  ["split chord fragments still merge with a wider gap", () => {
    const boxes = row(600, [["D", 60, 9], ["M", 84, 10]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["DM"]);
  }],
  ["F# + m with slight overlap merges", () => {
    const boxes = [
      { text: "F#", x0: 60, x1: 74, y0: 600, y1: 613, pageIndex: 0, confidence: 100, method: "text" },
      { text: "m", x0: 73, x1: 82, y0: 602, y1: 611, pageIndex: 0, confidence: 100, method: "text" },
    ];
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["F#m"]);
  }],
  ["small stray fragments collapse into their chord", () => {
    const boxes = row(600, [["G", 60, 9], ["I", 74, 6]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["G"]);
  }],
  ["G + 1 stray fragment collapses back to G", () => {
    const boxes = row(600, [["G", 60, 9], ["1", 71, 7]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["G"]);
  }],

  ["F # m fragments merge into F#m", () => {
    const boxes = row(600, [["F", 60, 8], ["#", 70, 6], ["m", 78, 9]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["F#m"]);
  }],
  ["E sus 2 fragments merge into Esus2", () => {
    const boxes = row(600, [["E", 60, 8], ["sus", 70, 22], ["2", 94, 7]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["Esus2"]);
  }],
  ["C 7 merges but separate chords don't", () => {
    const boxes = row(600, [["C", 60, 8], ["7", 70, 6], ["Am", 160, 20], ["F", 260, 8]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["C7", "Am", "F"]);
  }],
  ["adjacent complete chords never merge even when close", () => {
    const boxes = row(600, [["Am", 60, 20], ["F", 84, 8], ["G", 96, 9]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["Am", "F", "G"]);
  }],
  ["far-apart fragments stay separate", () => {
    const boxes = row(600, [["F", 60, 8], ["#", 200, 6]]);
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["F", "#"]);
  }],
  ["different rows never merge", () => {
    const boxes = [
      { text: "F", x0: 60, x1: 68, y0: 600, y1: 611, pageIndex: 0, confidence: 90, method: "ocr" },
      { text: "#", x0: 70, x1: 76, y0: 540, y1: 551, pageIndex: 0, confidence: 90, method: "ocr" },
    ];
    assert.deepEqual(texts(mergeSplitTokens(boxes)), ["F", "#"]);
  }],
  ["merged box unions coordinates and keeps min confidence", () => {
    const boxes = [
      { text: "F", x0: 60, x1: 68, y0: 600, y1: 611, pageIndex: 0, confidence: 95, method: "ocr" },
      { text: "#", x0: 70, x1: 76, y0: 602, y1: 613, pageIndex: 0, confidence: 60, method: "ocr" },
    ];
    const [m] = mergeSplitTokens(boxes);
    assert.equal(m.text, "F#");
    assert.equal(m.x1, 76);
    assert.equal(m.y1, 613);
    assert.equal(m.confidence, 60);
  }],
];
