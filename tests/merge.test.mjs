import assert from "node:assert/strict";
import { mergeSplitTokens } from "../src/lib/ocrRepair.js";

// helper: build a row of boxes from [text, x0, width] triples, height 11
const row = (y, parts) => parts.map(([text, x0, w]) => ({
  text, x0, x1: x0 + w, y0: y, y1: y + 11, pageIndex: 0, confidence: 90, method: "ocr",
}));
const texts = (boxes) => boxes.map((b) => b.text);

export const tests = [
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
