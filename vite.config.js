import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// pdf.js needs its worker script available as a static asset. The
// `?url` import in src/lib/pdfjsSetup.js handles bundling it; no extra
// Vite config is required for that beyond the default asset handling.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
});
