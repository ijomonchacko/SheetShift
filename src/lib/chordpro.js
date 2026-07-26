// ChordPro (.cho) export — chords only (SheetShift doesn't read lyrics),
// grouped into lines by their vertical position on each page. Apps like
// OnSong / SongBook import this directly.

/**
 * @param {{box:{pageIndex:number,x0:number,y0:number,y1:number}, newText:string}[]} plan
 * @param {string} title
 * @param {{fromKey?:string, toKey?:string}} meta
 * @returns {string} ChordPro file contents
 */
export function toChordPro(plan, title, meta = {}) {
  const lines = [];
  lines.push(`{title: ${title}}`);
  if (meta.toKey) lines.push(`{key: ${meta.toKey}}`);
  if (meta.fromKey && meta.toKey) {
    lines.push(`{comment: Transposed from ${meta.fromKey} to ${meta.toKey} with SheetShift}`);
  } else {
    lines.push(`{comment: Exported from SheetShift}`);
  }
  lines.push("");

  // Group by page, then cluster into rows by y (PDF points, bottom-up —
  // higher y = higher on the page).
  const pages = new Map();
  for (const item of plan) {
    const idx = item.box.pageIndex;
    if (!pages.has(idx)) pages.set(idx, []);
    pages.get(idx).push(item);
  }

  const pageIndices = [...pages.keys()].sort((a, b) => a - b);
  for (const pageIndex of pageIndices) {
    if (pageIndices.length > 1) lines.push(`{comment: Page ${pageIndex + 1}}`);
    const items = pages.get(pageIndex);
    // sort top-to-bottom (descending y), left-to-right
    items.sort((a, b) => (b.box.y1 - a.box.y1) || (a.box.x0 - b.box.x0));

    let row = [];
    let rowY = null;
    const flush = () => {
      if (row.length) lines.push(row.map((c) => `[${c}]`).join(" "));
      row = [];
    };
    for (const item of items) {
      const h = item.box.y1 - item.box.y0 || 10;
      if (rowY !== null && Math.abs(item.box.y1 - rowY) > h * 1.5) flush();
      rowY = item.box.y1;
      row.push(item.newText);
    }
    flush();
    lines.push("");
  }

  return lines.join("\n");
}
