import React, { useEffect, useState } from "react";
import { listLocalFonts, loadLocalFontBytes, supportsLocalFonts } from "../lib/fonts";

/**
 * Popover that lists fonts installed on the user's computer using the
 * Local Font Access API (Chrome/Edge). The chosen font's bytes are read
 * locally and embedded in the PDF — nothing leaves the device.
 */
export default function SystemFontPicker({ onPick, onClose }) {
  const [fonts, setFonts] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supportsLocalFonts()) {
      setError("Your browser doesn't support reading installed fonts. Try Chrome or Edge, or upload a .ttf/.otf file instead.");
      return;
    }
    (async () => {
      try {
        setFonts(await listLocalFonts());
      } catch (err) {
        console.error(err);
        setError("Couldn't read your fonts — permission may have been denied. You can upload a .ttf/.otf file instead.");
      }
    })();
  }, []);

  const filtered = fonts?.filter((f) => f.family.toLowerCase().includes(query.toLowerCase()));

  async function pick(f) {
    try {
      const bytes = await loadLocalFontBytes(f.fontData);
      onPick({ name: f.fullName || f.family, bytes });
    } catch (err) {
      console.error(err);
      setError(`Couldn't read "${f.family}" — try another font or upload a .ttf/.otf file.`);
    }
  }

  return (
    <div className="fontpicker-pop" role="dialog" aria-label="Choose an installed font">
      <div className="fontpicker-head">
        <span>Fonts on this computer</span>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">&times;</button>
      </div>

      {error ? (
        <p className="fontpicker-error">{error}</p>
      ) : !fonts ? (
        <p className="fontpicker-loading">Reading installed fonts…</p>
      ) : (
        <>
          <input
            autoFocus
            className="select fontpicker-search"
            placeholder={`Search ${fonts.length} fonts…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="fontpicker-list">
            {filtered.map((f) => (
              <li key={f.family}>
                <button type="button" className="fontpicker-item" onClick={() => pick(f)}
                        style={{ fontFamily: `'${f.family}', sans-serif` }}>
                  {f.family}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="fontpicker-none">No fonts match "{query}"</li>}
          </ul>
          <p className="fontpicker-note">Read locally &amp; embedded in your PDF — never uploaded.</p>
        </>
      )}
    </div>
  );
}
