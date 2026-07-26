import React, { useEffect, useRef, useState } from "react";
import { loadPdf, renderPageToCanvas } from "../lib/pdfjsSetup.js";

/**
 * Custom in-page PDF preview rendered with pdf.js.
 *
 * - "Fit" mode shows the whole page inside the box; zoom steps let you read
 *   small chords, with the stage becoming scrollable.
 * - The canvas is ALWAYS rendered at a minimum internal quality
 *   (≥ 1.5× page scale × devicePixelRatio) and downscaled by CSS, so the
 *   fitted page stays crisp instead of pixelated.
 *
 * Props:
 *   bytes — Uint8Array / ArrayBuffer of the PDF. A copy is made before
 *           handing it to pdf.js, which transfers (detaches) its input.
 */
const ZOOMS = [1, 1.5, 2, 3]; // multiples of the fit scale

export default function PdfPreview({ bytes }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  const renderSeq = useRef(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(0); // index into ZOOMS; 0 = fit
  const [status, setStatus] = useState("loading"); // loading | ready | error

  // Load the document once per `bytes`.
  useEffect(() => {
    let cancelled = false;
    docRef.current = null;
    setStatus("loading");
    setPageNum(1);
    setZoomIdx(0);
    (async () => {
      try {
        // pdf.js transfers the buffer to its worker — always pass a copy.
        const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes).slice();
        const doc = await loadPdf(copy);
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [bytes]);

  async function renderCurrent() {
    const doc = docRef.current;
    const stage = stageRef.current;
    const display = canvasRef.current;
    if (!doc || !stage || !display) return;
    const seq = ++renderSeq.current;
    try {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });

      const cs = getComputedStyle(stage);
      const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (availW <= 0 || availH <= 0) return;

      // Contain-fit scale, then the user's zoom on top of it.
      const fit = Math.min(availW / base.width, availH / base.height);
      const cssScale = fit * ZOOMS[zoomIdx];

      // Internal render quality: at least 1.5× page scale (≈108 dpi) and at
      // least the CSS size × devicePixelRatio — CSS downscaling a sharper
      // render keeps small chord text readable.
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const quality = Math.min(4, Math.max(cssScale * dpr, 1.5));
      const { canvas } = await renderPageToCanvas(doc, pageNum, quality);
      if (seq !== renderSeq.current) return; // superseded

      display.width = canvas.width;
      display.height = canvas.height;
      display.style.width = `${Math.round(base.width * cssScale)}px`;
      display.style.height = `${Math.round(base.height * cssScale)}px`;
      display.getContext("2d").drawImage(canvas, 0, 0);
    } catch (err) {
      console.error(err);
      if (seq === renderSeq.current) setStatus("error");
    }
  }

  // Re-render on page/zoom change, doc ready, and box resize.
  useEffect(() => {
    if (status !== "ready") return;
    renderCurrent();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    let t = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(renderCurrent, 150);
    });
    ro.observe(stage);
    return () => { clearTimeout(t); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pageNum, zoomIdx]);

  if (status === "error") {
    return (
      <div className="pdfpreview-fallback">
        Couldn't render the preview here — your file is still fine.
        Use <strong>Download PDF</strong> above to view it.
      </div>
    );
  }

  const zoomed = zoomIdx > 0;

  return (
    <div className="pdfpreview">
      <div className="pdfpreview-toolbar">
        <span className="pdfpreview-label">Preview</span>
        <div className="pdfpreview-controls">
          <div className="pdfpreview-zoom" role="group" aria-label="Zoom">
            <button type="button" className="pdfpreview-btn" disabled={zoomIdx <= 0}
                    onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} aria-label="Zoom out">−</button>
            <button type="button" className={`pdfpreview-fitbtn${zoomIdx === 0 ? " is-active" : ""}`}
                    onClick={() => setZoomIdx(0)}>
              {zoomIdx === 0 ? "Fit" : `${Math.round(ZOOMS[zoomIdx] * 100)}%`}
            </button>
            <button type="button" className="pdfpreview-btn" disabled={zoomIdx >= ZOOMS.length - 1}
                    onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} aria-label="Zoom in">+</button>
          </div>
          {numPages > 1 && (
            <div className="pdfpreview-pager">
              <button type="button" className="pdfpreview-btn" disabled={pageNum <= 1}
                      onClick={() => setPageNum((n) => Math.max(1, n - 1))} aria-label="Previous page">‹</button>
              <span className="pdfpreview-count">Page {pageNum} of {numPages}</span>
              <button type="button" className="pdfpreview-btn" disabled={pageNum >= numPages}
                      onClick={() => setPageNum((n) => Math.min(numPages, n + 1))} aria-label="Next page">›</button>
            </div>
          )}
        </div>
      </div>
      <div className={`pdfpreview-stage${zoomed ? " is-zoomed" : ""}`} ref={stageRef}>
        {status === "loading" && <div className="pdfpreview-loading"><span className="spinner" /></div>}
        <canvas ref={canvasRef} className="pdfpreview-canvas" />
      </div>
    </div>
  );
}
