import React, { useEffect, useRef, useState } from "react";
import { loadPdf, renderPageToCanvas } from "../lib/pdfjsSetup.js";
import { isLikelyChord } from "../lib/theory.js";

/**
 * Visual overlay review: the rendered page with every detected chord box
 * drawn on it. Click a box to correct its text; click empty space to add a
 * chord the detector missed.
 *
 * Props:
 *   fileBytes  ArrayBuffer of the ORIGINAL pdf
 *   plan       [{box:{pageIndex,x0,y0,x1,y1,confidence,method}, oldText, newText}]
 *   onEdit(index, correctedOldText)
 *   onAdd(box, text)   box in PDF-point space {pageIndex,x0,y0,x1,y1}
 */
export default function OverlayReview({ fileBytes, plan, onEdit, onAdd }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [geom, setGeom] = useState(null); // { scalePx, pageH, pageW } for coord mapping
  const geomRef = useRef(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [popup, setPopup] = useState(null); // {x, y, mode:'edit'|'add', index?, pdfBox?}
  const [draft, setDraft] = useState("");

  const pageItems = plan
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.box.pageIndex === pageNum - 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await loadPdf(fileBytes.slice(0));
        if (cancelled) return;
        setNumPages(doc.numPages);
        const page = await doc.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const availW = (wrapRef.current?.clientWidth || 640) - 2;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scalePx = (availW / base.width);
        const { canvas } = await renderPageToCanvas(doc, pageNum, scalePx * dpr);
        if (cancelled) return;
        geomRef.current = { scalePx, pageW: base.width, pageH: base.height };
        setGeom(geomRef.current);

        const display = canvasRef.current;
        display.width = canvas.width;
        display.height = canvas.height;
        display.style.width = `${Math.round(canvas.width / dpr)}px`;
        display.style.height = `${Math.round(canvas.height / dpr)}px`;
        display.getContext("2d").drawImage(canvas, 0, 0);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileBytes, pageNum, plan.length]);

  // PDF points (bottom-up) → CSS px in the wrapper (top-down).
  function boxToCss(box) {
    const g = geom;
    if (!g) return { left: 0, top: 0, width: 0, height: 0 };
    return {
      left: box.x0 * g.scalePx,
      top: (g.pageH - box.y1) * g.scalePx,
      width: (box.x1 - box.x0) * g.scalePx,
      height: (box.y1 - box.y0) * g.scalePx,
    };
  }

  function handleStageClick(e) {
    if (popup) { setPopup(null); return; }
    const g = geomRef.current;
    const stage = wrapRef.current;
    if (!g || !stage) return;
    const rect = stage.getBoundingClientRect();
    const cssX = e.clientX - rect.left + stage.scrollLeft;
    const cssY = e.clientY - rect.top + stage.scrollTop;

    // Median box size for the new chord's footprint.
    const sizes = plan.map((p) => ({ w: p.box.x1 - p.box.x0, h: p.box.y1 - p.box.y0 }))
      .sort((a, b) => a.w - b.w);
    const med = sizes[Math.floor(sizes.length / 2)] || { w: 24, h: 11 };

    const px = cssX / g.scalePx;               // PDF x
    const pyTop = cssY / g.scalePx;            // top-down PDF units
    const y1 = g.pageH - pyTop + med.h / 2;    // convert to bottom-up
    const pdfBox = {
      pageIndex: pageNum - 1,
      x0: Math.max(0, px - med.w / 2),
      x1: Math.min(g.pageW, px + med.w / 2),
      y0: Math.max(0, y1 - med.h),
      y1: Math.min(g.pageH, y1),
      confidence: 100,
      method: "manual",
    };
    setDraft("");
    setPopup({ x: cssX, y: cssY, mode: "add", pdfBox });
  }

  function handleBoxClick(e, index, item) {
    e.stopPropagation();
    const css = boxToCss(item.box);
    setDraft(item.oldText);
    setPopup({ x: css.left, y: css.top + css.height + 6, mode: "edit", index });
  }

  function commitPopup() {
    const text = draft.trim();
    if (popup?.mode === "edit") {
      if (text) onEdit(popup.index, text);
    } else if (popup?.mode === "add" && text) {
      onAdd(popup.pdfBox, text);
    }
    setPopup(null);
  }

  return (
    <div className="overlay-review">
      <div className="overlay-toolbar">
        <span className="overlay-hint">Click a box to correct it · click empty space to add a missed chord</span>
        {numPages > 1 && (
          <div className="pdfpreview-pager">
            <button type="button" className="pdfpreview-btn" disabled={pageNum <= 1}
                    onClick={() => { setPopup(null); setPageNum((n) => n - 1); }} aria-label="Previous page">‹</button>
            <span className="pdfpreview-count">Page {pageNum} of {numPages}</span>
            <button type="button" className="pdfpreview-btn" disabled={pageNum >= numPages}
                    onClick={() => { setPopup(null); setPageNum((n) => n + 1); }} aria-label="Next page">›</button>
          </div>
        )}
      </div>

      <div className="overlay-stage" ref={wrapRef} onClick={handleStageClick}>
        <canvas ref={canvasRef} className="overlay-canvas" />
        {pageItems.map(({ item, index }) => {
          const css = boxToCss(item.box);
          const suspect = !isLikelyChord(item.oldText);
          const lowConf = item.box.method === "ocr" && (item.box.confidence ?? 100) < 85;
          const cls = ["overlay-box", suspect ? "is-suspect" : lowConf ? "is-lowconf" : ""].join(" ");
          return (
            <button
              key={index}
              type="button"
              className={cls}
              style={{ left: css.left - 3, top: css.top - 3, width: css.width + 6, height: css.height + 6 }}
              title={`${item.oldText} → ${item.newText}`}
              onClick={(e) => handleBoxClick(e, index, item)}
            >
              <span className="overlay-box-label">{item.newText}</span>
            </button>
          );
        })}

        {popup && (
          <div className="overlay-popup" style={{ left: Math.max(4, popup.x - 60), top: popup.y }}
               onClick={(e) => e.stopPropagation()}>
            <span className="overlay-popup-title">
              {popup.mode === "edit" ? "Correct chord" : "Add missed chord"}
            </span>
            <input
              autoFocus
              className="chord-edit-input"
              placeholder="e.g. Gm7"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPopup();
                if (e.key === "Escape") setPopup(null);
              }}
            />
            <div className="overlay-popup-actions">
              <button type="button" className="btn btn-primary btn-xs" onClick={commitPopup}>
                {popup.mode === "edit" ? "Save" : "Add"}
              </button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPopup(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
