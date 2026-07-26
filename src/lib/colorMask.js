// Port of chordtranspose/image_extract.py's box-detection pipeline
// (mask -> dilate -> connected components -> tight bbox -> row clustering
// -> gap-based token splitting), operating on an ImageData/Uint8ClampedArray
// instead of a numpy array + OpenCV.

/** Binary mask (Uint8Array, 1 = match) of pixels close to targetRgb. */
export function maskForColor(imageData, targetRgb, tol = 60) {
  const { data, width, height } = imageData;
  const [tr, tg, tb] = targetRgb;
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < width * height; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.abs(r - tr) < tol && Math.abs(g - tg) < tol && Math.abs(b - tb) < tol) {
      mask[p] = 1;
    }
  }
  return mask;
}

/** Separable box dilation (equivalent to cv2.dilate with a rectangular kernel). */
export function dilate(mask, width, height, kw, kh) {
  const hw = Math.floor(kw / 2), hh = Math.floor(kh / 2);
  const tmp = new Uint8Array(width * height);
  // horizontal pass
  for (let y = 0; y < height; y++) {
    let count = 0;
    const row = y * width;
    for (let x = -hw; x < width; x++) {
      const addX = x + hw;
      if (addX < width && mask[row + addX]) count++;
      const remX = x - hw - 1;
      if (remX >= 0 && mask[row + remX]) count--;
      if (x >= 0) tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  // vertical pass
  const out = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = -hh; y < height; y++) {
      const addY = y + hh;
      if (addY < height && tmp[addY * width + x]) count++;
      const remY = y - hh - 1;
      if (remY >= 0 && tmp[remY * width + x]) count--;
      if (y >= 0) out[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

/** Connected components (4-connectivity) on `dilated`, with each component's
 * TIGHT bounding box recomputed from the original (non-dilated) `mask` --
 * mirrors the numpy/OpenCV version's "recompute tight bbox" step so boxes
 * hug the real glyphs rather than the inflated dilation kernel.
 */
export function connectedComponents(dilated, mask, width, height) {
  const labels = new Int32Array(width * height); // 0 = unlabeled
  let nextLabel = 1;
  const stackX = new Int32Array(width * height);
  const stackY = new Int32Array(width * height);

  const boxes = []; // { minX, minY, maxX, maxY } in ORIGINAL-mask pixel space

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!dilated[p] || labels[p]) continue;

      const label = nextLabel++;
      let sp = 0;
      stackX[sp] = x; stackY[sp] = y; sp++;
      labels[p] = label;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let sawOriginal = false;

      while (sp > 0) {
        sp--;
        const cx = stackX[sp], cy = stackY[sp];
        const cp = cy * width + cx;

        if (mask[cp]) {
          sawOriginal = true;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
        }

        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (dilated[np] && !labels[np]) {
            labels[np] = label;
            stackX[sp] = nx; stackY[sp] = ny; sp++;
          }
        }
      }

      if (sawOriginal) {
        boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
      }
    }
  }
  return boxes;
}

/** Column-gap analysis used both to reject tiny noise boxes and to split a
 * box that actually contains multiple chord tokens written close together
 * (e.g. "Dm Am Dm") while leaving single wide tokens ("Dsus2") intact.
 */
function splitByColumnGaps(mask, width, height, box, gapSplit, minW) {
  const pad = 5;
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(width, box.x + box.w + pad);
  const y1 = Math.min(height, box.y + box.h + pad);

  const colHasPixel = new Uint8Array(x1 - x0);
  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1; y++) {
      if (mask[y * width + x]) { colHasPixel[x - x0] = 1; break; }
    }
  }

  const runs = [];
  let inRun = false, start = 0;
  for (let i = 0; i < colHasPixel.length; i++) {
    if (colHasPixel[i] && !inRun) { start = i; inRun = true; }
    if (!colHasPixel[i] && inRun) { runs.push([start, i]); inRun = false; }
  }
  if (inRun) runs.push([start, colHasPixel.length]);
  if (runs.length === 0) return [box];

  const groups = [[runs[0]]];
  for (let i = 1; i < runs.length; i++) {
    const r = runs[i];
    const lastGroup = groups[groups.length - 1];
    const lastEnd = lastGroup[lastGroup.length - 1][1];
    if (r[0] - lastEnd > gapSplit) groups.push([r]);
    else lastGroup.push(r);
  }
  if (groups.length === 1) return [box];

  const out = [];
  for (const g of groups) {
    const gx0 = x0 + g[0][0];
    const gx1 = x0 + g[g.length - 1][1];
    if (gx1 - gx0 < minW) continue;
    out.push({ x: gx0, y: box.y, w: gx1 - gx0, h: box.h });
  }
  return out.length ? out : [box];
}

/**
 * Full pipeline: mask -> dilate -> connected components -> row clustering
 * (reading order) -> gap-splitting. Returns boxes in pixel space, reading
 * order (top-to-bottom rows, left-to-right within a row).
 *
 * topMarginPx / excludeRegions (in pixel space, {x0,y0,x1,y1}) are applied
 * BEFORE clustering -- doing it after would let a row incorrectly "chain"
 * through excluded content and corrupt reading order.
 */
export function detectBoxes(imageData, targetRgb, opts = {}) {
  const {
    tol = 60,
    dilateW = 40,
    dilateH = 14,
    minW = 15,
    minH = 15,
    rowTol = 280,
    gapSplit = 25,
    topMarginPx = 0,
    excludeRegions = [],
  } = opts;
  const { width, height } = imageData;

  const mask = maskForColors(imageData, targetRgb, tol);
  const dilated = dilate(mask, width, height, dilateW, dilateH);
  const raw = connectedComponents(dilated, mask, width, height);

  const boxInRegion = (b, r) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1;
  };

  const tight = raw.filter((b) => {
    if (b.w < minW || b.h < minH) return false;
    if (b.y < topMarginPx) return false;
    if (excludeRegions.some((r) => boxInRegion(b, r))) return false;
    return true;
  });

  // row clustering: anchor to the first item's y (not a drifting average)
  tight.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const box of tight) {
    let placed = false;
    for (const row of rows) {
      if (Math.abs(row.anchor - box.y) < rowTol) {
        row.items.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push({ anchor: box.y, items: [box] });
  }

  const ordered = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    ordered.push(...row.items);
  }

  // gap-based re-split for tightly-packed multi-chord tokens
  const final = [];
  for (const box of ordered) {
    const pieces = splitByColumnGaps(mask, width, height, box, gapSplit, minW);
    final.push(...pieces);
  }
  return { boxes: final, mask };
}

/** Union mask across several target colors. */
export function maskForColors(imageData, colors, tol = 60) {
  if (!Array.isArray(colors[0])) return maskForColor(imageData, colors, tol);
  const { width, height } = imageData;
  const out = new Uint8Array(width * height);
  for (const c of colors) {
    const m = maskForColor(imageData, c, tol);
    for (let i = 0; i < out.length; i++) if (m[i]) out[i] = 1;
  }
  return out;
}

/**
 * Histogram the page for the most likely chord color: strongly colored
 * (saturated), not near-black/white/gray, quantized to 24-step bins.
 * Returns [r,g,b] or null if the page has no colored ink.
 */
export function suggestChordColor(imageData) {
  const { data, width, height } = imageData;
  const bins = new Map();
  const Q = 24;
  for (let i = 0; i < width * height * 4; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 50) continue;          // gray-ish (includes black text)
    if (mx > 245 && mn > 200) continue;  // near-white
    const key = `${Math.round(r / Q)},${Math.round(g / Q)},${Math.round(b / Q)}`;
    const e = bins.get(key);
    if (e) { e.n++; e.r += r; e.g += g; e.b += b; }
    else bins.set(key, { n: 1, r, g, b });
  }
  let best = null;
  for (const e of bins.values()) if (!best || e.n > best.n) best = e;
  if (!best || best.n < 50) return null;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}
