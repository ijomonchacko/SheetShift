// High-accuracy, fully client-side OCR using PP-OCRv3 (DB text detector +
// CRNN recognizer) run through onnxruntime-web. Unlike paddle-js this is
// browser-native (no Emscripten `Module` globals, no Node built-ins): ORT loads
// its WASM from a pinned CDN and the models are served from /models/ocr/.
//
// It generally catches small/dense notation chords better than Tesseract. It is
// loaded lazily and guarded — any failure disables it for the session and the
// caller falls back to Tesseract, so detection never breaks.

import * as ort from "onnxruntime-web";
import { filterChordCandidates, chordFilterKnobs } from "./ocr.js";

// ORT loads its WASM from a pinned CDN. (Self-hosting from /public breaks Vite's
// dev server, which won't serve /public files through ORT's dynamic import();
// the service worker caches these URLs so they still work offline after first
// load.) numThreads=1 avoids needing cross-origin isolation.
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
ort.env.wasm.numThreads = 1;
// ORT emits harmless "some nodes were not assigned to the preferred EP" warnings
// when WebGPU offloads shape ops to CPU (by design). Keep the console clean.
ort.env.logLevel = "error";

const MODEL_CACHE = "sheetshift-ocr-models-v1";

// Cache-first fetch so the ~11 MB models download once per browser, then load
// instantly (and offline) on every later run.
async function cachedArrayBuffer(url) {
  try {
    const cache = await caches.open(MODEL_CACHE);
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url);
      if (!res.ok) throw new Error(`fetch failed: ${url}`);
      await cache.put(url, res.clone());
    }
    return res.arrayBuffer();
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${url}`);
    return res.arrayBuffer();
  }
}
async function cachedText(url) {
  const buf = await cachedArrayBuffer(url);
  return new TextDecoder().decode(buf);
}

const DET_URL = "/models/ocr/det.onnx";
const REC_URL = "/models/ocr/rec.onnx";
const DICT_URL = "/models/ocr/en_dict.txt";

let enginePromise = null;
let disabled = false;

function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [detBuf, recBuf, dictText] = await Promise.all([
        cachedArrayBuffer(DET_URL),
        cachedArrayBuffer(REC_URL),
        cachedText(DICT_URL),
      ]);
      // Prefer the GPU (WebGPU) execution provider for a big speedup, falling
      // back to WASM automatically when WebGPU isn't available.
      const opts = { executionProviders: ["webgpu", "wasm"], graphOptimizationLevel: "all", logSeverityLevel: 3 };
      const [det, rec] = await Promise.all([
        ort.InferenceSession.create(detBuf, opts),
        ort.InferenceSession.create(recBuf, opts),
      ]);
      // PP-OCR CTC labels: index 0 = blank, then the dictionary, then a space.
      const lines = dictText.replace(/\r/g, "").replace(/\n$/, "").split("\n");
      const labels = ["\u0000", ...lines, " "];
      return { det, rec, labels };
    })();
  }
  return enginePromise;
}

export function onnxUnavailable() {
  return disabled;
}

/**
 * Detect chords on a rendered page with the ONNX PP-OCR engine. Returns the
 * same `{text, confidence, x, y, w, h}` shape as the Tesseract path (already run
 * through the shared chord filter), or `null` if the engine is unavailable.
 */
export async function tryOnnxPageChords(canvas, { topMarginPx = 0, strength = "balanced" } = {}, timeoutMs = 60000) {
  if (disabled || typeof document === "undefined") return null;
  try {
    return await Promise.race([
      onnxPageChords(canvas, { topMarginPx, strength }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ONNX OCR timed out")), timeoutMs)),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("ONNX OCR unavailable — falling back to Tesseract:", err?.message || err);
    disabled = true;
    return null;
  }
}

async function onnxPageChords(canvas, { topMarginPx = 0, strength = "balanced" }) {
  const { det, rec, labels } = await loadEngine();
  const K = chordFilterKnobs(strength);

  // --- Detection ---
  const pre = preprocessDet(canvas);
  const detOut = await det.run({ [det.inputNames[0]]: pre.tensor });
  const probTensor = detOut[det.outputNames[0]];
  const prob = probTensor.data;
  const [, , mapH, mapW] = probTensor.dims.length === 4 ? probTensor.dims : [1, 1, pre.rh, pre.rw];
  const boxes = extractBoxes(prob, mapW, mapH, { thresh: K.dbThresh, boxThresh: K.boxThresh, expand: K.expand });

  // --- Recognition per detected region ---
  const sx = canvas.width / mapW;
  const sy = canvas.height / mapH;
  const items = [];
  for (const b of boxes) {
    const x = b.x * sx, y = b.y * sy, w = b.w * sx, h = b.h * sy;
    if (y + h < topMarginPx) continue;
    const { text, score } = await recognizeBox(rec, labels, canvas, { x, y, w, h });
    const line = (text || "").trim();
    if (!line) continue;
    const confidence = Math.max(1, Math.min(100, Math.round(score * 100)));
    // A region can hold several space-separated chords — place each by offset.
    const per = w / (line.length || 1);
    let idx = 0;
    for (const seg of line.split(/(\s+)/)) {
      const tok = seg.trim();
      if (!tok) { idx += seg.length; continue; }
      items.push({ text: tok, confidence, x: x + idx * per, y, w: seg.length * per, h });
      idx += seg.length;
    }
  }

  return filterChordCandidates(items, { topMarginPx, strength });
}

/** Resize to a multiple of 32 (max side capped) and normalize (ImageNet). */
function preprocessDet(canvas, limit = 1280) {
  const w = canvas.width, h = canvas.height;
  let ratio = Math.min(1, limit / Math.max(w, h));
  const rw = Math.max(32, Math.round((w * ratio) / 32) * 32);
  const rh = Math.max(32, Math.round((h * ratio) / 32) * 32);
  const c = document.createElement("canvas");
  c.width = rw; c.height = rh;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, rw, rh);
  const { data } = ctx.getImageData(0, 0, rw, rh);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const n = rw * rh;
  const arr = new Float32Array(3 * n);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    arr[p] = (data[i] / 255 - mean[0]) / std[0];
    arr[n + p] = (data[i + 1] / 255 - mean[1]) / std[1];
    arr[2 * n + p] = (data[i + 2] / 255 - mean[2]) / std[2];
  }
  return { tensor: new ort.Tensor("float32", arr, [1, 3, rh, rw]), rw, rh };
}

/**
 * DB post-processing (axis-aligned): threshold the probability map, label
 * connected text regions, keep confident ones, and expand each box slightly
 * (unclip approximation). Chord text is horizontal, so axis-aligned boxes are a
 * good, simple fit.
 */
function extractBoxes(prob, W, H, { thresh = 0.25, boxThresh = 0.35, minSize = 2, expand = 0.4 } = {}) {
  const bin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bin[i] = prob[i] > thresh ? 1 : 0;

  const labels = new Int32Array(W * H);
  const stackX = new Int32Array(W * H);
  const stackY = new Int32Array(W * H);
  const boxes = [];
  let label = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!bin[p] || labels[p]) continue;
      label++;
      let sp = 0; stackX[0] = x; stackY[0] = y; labels[p] = label; sp = 1;
      let minX = x, maxX = x, minY = y, maxY = y, area = 0, sum = 0;
      while (sp > 0) {
        sp--;
        const cx = stackX[sp], cy = stackY[sp], cp = cy * W + cx;
        area++; sum += prob[cp];
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const np = ny * W + nx;
          if (bin[np] && !labels[np]) { labels[np] = label; stackX[sp] = nx; stackY[sp] = ny; sp++; }
        }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (bw < minSize || bh < minSize) continue;
      if (sum / area < boxThresh) continue;
      // unclip: expand by a fraction of the shorter side
      const ex = Math.round(Math.min(bw, bh) * expand);
      boxes.push({
        x: Math.max(0, minX - ex),
        y: Math.max(0, minY - ex),
        w: Math.min(W, maxX + ex) - Math.max(0, minX - ex) + 1,
        h: Math.min(H, maxY + ex) - Math.max(0, minY - ex) + 1,
      });
    }
  }
  return boxes;
}

/** Crop a box, resize to height 48, normalize, run the recognizer + CTC decode. */
async function recognizeBox(rec, labels, canvas, box) {
  const pad = 3;
  const bx = Math.max(0, Math.floor(box.x - pad));
  const by = Math.max(0, Math.floor(box.y - pad));
  const bw = Math.min(canvas.width - bx, Math.ceil(box.w + pad * 2));
  const bh = Math.min(canvas.height - by, Math.ceil(box.h + pad * 2));
  if (bw <= 0 || bh <= 0) return { text: "", score: 0 };

  const H = 48;
  let W = Math.round((bw / bh) * H);
  W = Math.max(8, Math.min(512, W));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(canvas, bx, by, bw, bh, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const n = W * H;
  const arr = new Float32Array(3 * n);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    arr[p] = (data[i] / 255 - 0.5) / 0.5;
    arr[n + p] = (data[i + 1] / 255 - 0.5) / 0.5;
    arr[2 * n + p] = (data[i + 2] / 255 - 0.5) / 0.5;
  }
  const out = await rec.run({ [rec.inputNames[0]]: new ort.Tensor("float32", arr, [1, 3, H, W]) });
  const o = out[rec.outputNames[0]];
  const dims = o.dims; // [1, T, C]
  const T = dims[1], C = dims[2];
  const d = o.data;
  let text = "", last = 0, scoreSum = 0, scoreN = 0;
  for (let t = 0; t < T; t++) {
    let best = 0, bestv = -Infinity;
    const base = t * C;
    for (let ci = 0; ci < C; ci++) { const v = d[base + ci]; if (v > bestv) { bestv = v; best = ci; } }
    if (best !== 0 && best !== last) { text += labels[best] ?? ""; scoreSum += bestv; scoreN++; }
    last = best;
  }
  return { text, score: scoreN ? scoreSum / scoreN : 0 };
}
