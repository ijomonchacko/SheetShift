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

// Common chord-symbol ink colors. Maroon is the default.
const PRESETS = [
  { name: "Maroon", rgb: [170, 0, 0] },
  { name: "Black", rgb: [26, 26, 26] },
  { name: "Red", rgb: [224, 36, 36] },
  { name: "Blue", rgb: [47, 111, 224] },
  { name: "Teal", rgb: [13, 148, 136] },
  { name: "Green", rgb: [31, 157, 85] },
  { name: "Purple", rgb: [122, 63, 242] },
];

/**
 * Chord-color control. The default is maroon; clicking "Change" opens an inline
 * picker box (presets, custom color, hex, plus eyedropper / auto-detect from
 * the PDF). Up to 3 colors can be matched at once for detection.
 *
 * Props: file, colors ([[r,g,b],…]), onColorsChange
 */
export default function ColorPicker({ file, colors, onColorsChange }) {
  const canvasRef = useRef(null);
  const imgCanvasRef = useRef(null); // offscreen full-res canvas we sample from
  const [open, setOpen] = useState(false);     // the picker box
  const [eyeOpen, setEyeOpen] = useState(false); // eyedropper page view
  const [loading, setLoading] = useState(false);
  const [detectMsg, setDetectMsg] = useState("");
  const [hexDraft, setHexDraft] = useState(rgbToHex(colors[0]));

  useEffect(() => { setHexDraft(rgbToHex(colors[0])); }, [colors]);

  useEffect(() => {
    if (!eyeOpen || !file) return;
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
      display.getContext("2d").drawImage(canvas, 0, 0, display.width, display.height);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eyeOpen, file]);

  const setPrimary = (rgb) => {
    // Replace the first color, keep any extras the user added.
    onColorsChange([rgb, ...colors.slice(1)].slice(0, 3));
  };
  const addColor = (rgb) => {
    const next = [...colors.filter((c) => rgbToHex(c) !== rgbToHex(rgb)), rgb].slice(-3);
    onColorsChange(next);
  };
  const removeColor = (i) => {
    if (colors.length <= 1) return;
    onColorsChange(colors.filter((_, j) => j !== i));
  };
  const isActive = (rgb) => colors.some((c) => rgbToHex(c) === rgbToHex(rgb));

  const commitHex = () => {
    const v = hexDraft.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) setPrimary(hexToRgb(v.startsWith("#") ? v : "#" + v));
    else setHexDraft(rgbToHex(colors[0]));
  };

  const handleEyedrop = (e) => {
    const display = canvasRef.current;
    const full = imgCanvasRef.current;
    if (!display || !full) return;
    const rect = display.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width) * full.width;
    const dy = ((e.clientY - rect.top) / rect.height) * full.height;
    const [r, g, b] = full.getContext("2d").getImageData(Math.floor(dx), Math.floor(dy), 1, 1).data;
    setPrimary([r, g, b]);
    setEyeOpen(false);
  };

  async function autoDetect() {
    if (!file) return;
    setDetectMsg("Scanning page 1…");
    try {
      const buf = await file.arrayBuffer();
      const pdfDoc = await loadPdf(buf);
      const { canvas } = await renderPageToCanvas(pdfDoc, 1, 1.5);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgb = suggestChordColor(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (rgb) { setPrimary(rgb); setDetectMsg(`Found ${rgbToHex(rgb)}`); }
      else setDetectMsg("No distinct chord color found — pick manually.");
    } catch (err) {
      console.error(err);
      setDetectMsg("Couldn't scan that page.");
    }
    setTimeout(() => setDetectMsg(""), 3500);
  }

  return (
    <div className="colorpick">
      {/* Trigger: current color(s) + Change */}
      <button type="button" className="colorpick-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="colorpick-dots">
          {colors.map((c, i) => <span key={i} className="colorpick-dot" style={{ background: rgbToHex(c) }} />)}
        </span>
        <span className="colorpick-value">{colors.length > 1 ? `${colors.length} colors` : rgbToHex(colors[0])}</span>
        <span className="colorpick-cta">{open ? "Done" : "Change"}</span>
      </button>

      {open && (
        <div className="colorpick-box">
          <div className="colorpick-section">
            <span className="colorpick-heading">Presets</span>
            <div className="colorpick-presets">
              {PRESETS.map((p) => (
                <button key={p.name} type="button"
                        className={`colorpick-preset${isActive(p.rgb) ? " is-active" : ""}`}
                        style={{ background: rgbToHex(p.rgb) }}
                        title={p.name} aria-label={p.name}
                        onClick={() => setPrimary(p.rgb)} />
              ))}
            </div>
          </div>

          <div className="colorpick-section">
            <span className="colorpick-heading">Custom</span>
            <div className="colorpick-custom">
              <label className="colorpick-native" title="Pick any color">
                <input type="color" value={rgbToHex(colors[0])}
                       onChange={(e) => setPrimary(hexToRgb(e.target.value))} />
                <span className="colorpick-native-swatch" style={{ background: rgbToHex(colors[0]) }} />
              </label>
              <input type="text" className="select select-sm colorpick-hex" value={hexDraft}
                     onChange={(e) => setHexDraft(e.target.value)} onBlur={commitHex}
                     onKeyDown={(e) => { if (e.key === "Enter") commitHex(); }} aria-label="Hex color" />
              {file && (
                <>
                  <button type="button" className="eyedropper-btn" onClick={() => setEyeOpen((v) => !v)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 22 1-4 11-11 3 3L6 21l-4 1Z" /><path d="M17 3.5 20.5 7a1.7 1.7 0 0 1 0 2.4L18 12l-6-6 2.6-2.5a1.7 1.7 0 0 1 2.4 0Z" /></svg>
                    Pick
                  </button>
                  <button type="button" className="eyedropper-btn" onClick={autoDetect}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /><circle cx="12" cy="12" r="3.2" /></svg>
                    Auto
                  </button>
                </>
              )}
            </div>
            {detectMsg && <span className="color-detect-msg">{detectMsg}</span>}
          </div>

          {(colors.length > 1 || colors.length < 3) && (
            <div className="colorpick-section">
              <span className="colorpick-heading">Match multiple colors <span className="hint">(optional)</span></span>
              <div className="colorpick-multi">
                {colors.map((c, i) => (
                  <span key={i} className="color-swatch" style={{ background: rgbToHex(c) }} title={rgbToHex(c)}>
                    {colors.length > 1 && (
                      <button type="button" className="color-swatch-x" onClick={() => removeColor(i)}
                              aria-label={`Remove ${rgbToHex(c)}`}>&times;</button>
                    )}
                  </span>
                ))}
                {colors.length < 3 && (
                  <label className="color-add" title="Add another color to match">
                    +
                    <input type="color" hidden onChange={(e) => addColor(hexToRgb(e.target.value))} />
                  </label>
                )}
              </div>
            </div>
          )}

          {eyeOpen && (
            <div className="colorpick-eye">
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
      )}
    </div>
  );
}
