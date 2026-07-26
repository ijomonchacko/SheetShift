import React, { useEffect, useRef, useState } from "react";
import { loadPdf, renderPageToCanvas } from "../lib/pdfjsSetup.js";
import { suggestChordColor } from "../lib/colorMask.js";

function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
}

/**
 * Multi-color chord color field: up to 3 colors, each removable; add via
 * color input, the page-1 eyedropper, or one-click auto-detection.
 *
 * Props: file, colors ([[r,g,b],…]), onColorsChange, auto, onAutoChange
 */
export default function ColorPicker({ file, colors, onColorsChange, auto, onAutoChange }) {
  const canvasRef = useRef(null);
  const imgCanvasRef = useRef(null); // offscreen full-res canvas we sample from
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectMsg, setDetectMsg] = useState("");

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const buf = await file.arrayBuffer();
      const pdfDoc = await loadPdf(buf);
      const { canvas } = await renderPageToCanvas(pdfDoc, 1, 1.5);
      if (cancelled) return;
      imgCanvasRef.current = canvas;

      const display = canvasRef.current;
      const maxW = 380;
      const scale = Math.min(1, maxW / canvas.width);
      display.width = canvas.width * scale;
      display.height = canvas.height * scale;
      const ctx = display.getContext("2d");
      ctx.drawImage(canvas, 0, 0, display.width, display.height);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, file]);

  const addColor = (rgb) => {
    const next = [...colors.filter((c) => rgbToHex(c) !== rgbToHex(rgb)), rgb].slice(-3);
    onColorsChange(next);
    onAutoChange(false);
  };
  const removeColor = (i) => {
    if (colors.length <= 1) return;
    onColorsChange(colors.filter((_, j) => j !== i));
  };

  const handleEyedrop = (e) => {
    const display = canvasRef.current;
    const full = imgCanvasRef.current;
    if (!display || !full) return;
    const rect = display.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width) * full.width;
    const dy = ((e.clientY - rect.top) / rect.height) * full.height;
    const ctx = full.getContext("2d");
    const [r, g, b] = ctx.getImageData(Math.floor(dx), Math.floor(dy), 1, 1).data;
    addColor([r, g, b]);
    setOpen(false);
  };

  async function autoDetect() {
    if (!file) return;
    setDetectMsg("Scanning page 1…");
    try {
      const buf = await file.arrayBuffer();
      const pdfDoc = await loadPdf(buf);
      const { canvas } = await renderPageToCanvas(pdfDoc, 1, 1.5);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgb = suggestChordColor(imageData);
      if (rgb) {
        onColorsChange([rgb]);
        onAutoChange(false);
        setDetectMsg(`Found ${rgbToHex(rgb)}`);
      } else {
        setDetectMsg("No distinct chord color found — pick manually.");
      }
    } catch (err) {
      console.error(err);
      setDetectMsg("Couldn't scan that page.");
    }
    setTimeout(() => setDetectMsg(""), 3500);
  }

  return (
    <div className="color-field">
      <div className="color-swatches">
        {colors.map((c, i) => (
          <span key={i} className="color-swatch" style={{ background: rgbToHex(c) }} title={rgbToHex(c)}>
            {colors.length > 1 && (
              <button type="button" className="color-swatch-x" onClick={() => removeColor(i)}
                      aria-label={`Remove color ${rgbToHex(c)}`}>&times;</button>
            )}
          </span>
        ))}
        {colors.length < 3 && (
          <label className="color-add" title="Add a chord color">
            +
            <input type="color" hidden disabled={auto}
                   onChange={(e) => addColor(hexToRgb(e.target.value))} />
          </label>
        )}
      </div>

      <label className="checkbox-inline">
        <input id="colorAuto" type="checkbox" checked={auto}
               onChange={(e) => { onAutoChange(e.target.checked); if (e.target.checked) onColorsChange([[170, 0, 0]]); }} />
        <span className="checkbox-label">Default maroon</span>
      </label>

      {file && (
        <>
          <button type="button" className="eyedropper-btn" onClick={() => setOpen((v) => !v)}>
            Pick from PDF
          </button>
          <button type="button" className="eyedropper-btn" onClick={autoDetect}>
            Auto-detect
          </button>
        </>
      )}
      {detectMsg && <span className="color-detect-msg">{detectMsg}</span>}

      {open && (
        <div className="eyedropper-pop">
          {loading ? (
            <div className="eyedropper-loading">Rendering page…</div>
          ) : (
            <>
              <p className="eyedropper-hint">Click directly on a chord symbol</p>
              <canvas ref={canvasRef} onClick={handleEyedrop} className="eyedropper-canvas" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
