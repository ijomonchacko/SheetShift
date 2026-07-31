// Fonts bundled in public/fonts/ (copied at build time, no network fetch
// needed at runtime beyond the same-origin static file).
//
// All bundled fonts are freely licensed (SIL OFL / Liberation Font License):
//   Liberation Sans  — metric-compatible with Arial
//   Carlito          — metric-compatible with Calibri
//   Caladea          — metric-compatible with Cambria
//   Liberation Serif — metric-compatible with Times New Roman
//   Liberation Mono  — metric-compatible with Courier New
export const BUILTIN_FONTS = [
  { id: "liberation-sans", label: "Liberation Sans · like Arial", url: "/fonts/LiberationSans-Regular.ttf", bold: false },
  { id: "liberation-sans-bold", label: "Liberation Sans · like Arial (Bold)", url: "/fonts/LiberationSans-Bold.ttf", bold: true },
  { id: "dejavu-sans-bold", label: "DejaVu Sans (Bold)", url: "/fonts/DejaVuSans-Bold.ttf", bold: true },
  { id: "dejavu-sans", label: "DejaVu Sans", url: "/fonts/DejaVuSans.ttf", bold: false },
  { id: "carlito-bold", label: "Carlito · like Calibri (Bold)", url: "/fonts/Carlito-Bold.ttf", bold: true },
  { id: "carlito", label: "Carlito · like Calibri", url: "/fonts/Carlito-Regular.ttf", bold: false },
  { id: "poppins-bold", label: "Poppins (Bold)", url: "/fonts/Poppins-Bold.ttf", bold: true },
  { id: "poppins", label: "Poppins", url: "/fonts/Poppins-Regular.ttf", bold: false },
  { id: "liberation-serif-bold", label: "Liberation Serif · like Times (Bold)", url: "/fonts/LiberationSerif-Bold.ttf", bold: true },
  { id: "liberation-serif", label: "Liberation Serif · like Times", url: "/fonts/LiberationSerif-Regular.ttf", bold: false },
  { id: "caladea-bold", label: "Caladea · like Cambria (Bold)", url: "/fonts/Caladea-Bold.ttf", bold: true },
  { id: "caladea", label: "Caladea · like Cambria", url: "/fonts/Caladea-Regular.ttf", bold: false },
  { id: "dejavu-serif-bold", label: "DejaVu Serif (Bold)", url: "/fonts/DejaVuSerif-Bold.ttf", bold: true },
  { id: "dejavu-serif", label: "DejaVu Serif", url: "/fonts/DejaVuSerif.ttf", bold: false },
  { id: "liberation-mono-bold", label: "Liberation Mono · like Courier (Bold)", url: "/fonts/LiberationMono-Bold.ttf", bold: true },
  { id: "liberation-mono", label: "Liberation Mono · like Courier", url: "/fonts/LiberationMono-Regular.ttf", bold: false },
];

const cache = new Map();

/** Fetch (and cache) a built-in font's bytes as an ArrayBuffer. */
export async function loadBuiltinFont(id) {
  if (cache.has(id)) return cache.get(id);
  const entry = BUILTIN_FONTS.find((f) => f.id === id);
  if (!entry) throw new Error(`Unknown built-in font: ${id}`);
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`Could not load font file: ${entry.url}`);
  const bytes = await res.arrayBuffer();
  cache.set(id, bytes);
  return bytes;
}

/**
 * Local Font Access API support (Chrome / Edge). Lets the user pick a font
 * that's installed on their computer; we read its bytes locally and embed
 * them in the PDF — nothing is uploaded anywhere.
 */
export function supportsLocalFonts() {
  return typeof window !== "undefined" && "queryLocalFonts" in window;
}

/** Returns [{ family, fullName, postscriptName, fontData }] deduped by family (regular style preferred). */
export async function listLocalFonts() {
  const all = await window.queryLocalFonts();
  const byFamily = new Map();
  for (const f of all) {
    const existing = byFamily.get(f.family);
    const isRegular = /^(regular|book|normal)$/i.test(f.style || "");
    if (!existing || (isRegular && !existing.isRegular)) {
      byFamily.set(f.family, { family: f.family, fullName: f.fullName, postscriptName: f.postscriptName, fontData: f, isRegular });
    }
  }
  return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family));
}

/** Read a local font's bytes as an ArrayBuffer. */
export async function loadLocalFontBytes(fontData) {
  const blob = await fontData.blob();
  return blob.arrayBuffer();
}
