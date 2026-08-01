import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// pdf.js needs its worker script available as a static asset. The
// `?url` import in src/lib/pdfjsSetup.js handles bundling it; no extra
// Vite config is required for that beyond the default asset handling.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false, // use the existing public/manifest.webmanifest
      workbox: {
        // Precache the app shell only. The heavy OCR models/WASM are cached at
        // runtime on first use so the initial install stays small.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/models/**"],
        navigateFallbackDenylist: [/^\/models\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/models/"),
            handler: "CacheFirst",
            options: {
              cacheName: "sheetshift-ocr-models",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // ONNX Runtime WASM served from jsDelivr — cache for offline use.
            urlPattern: ({ url }) => url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("onnxruntime-web"),
            handler: "CacheFirst",
            options: {
              cacheName: "sheetshift-ort-wasm",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy libraries into their own cacheable chunks so the app
        // shell stays small and vendors are cached across deploys.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("pdfjs-dist")) return "pdfjs";
            if (id.includes("tesseract")) return "tesseract";
            if (id.includes("onnxruntime")) return "onnxruntime";
            if (id.includes("pdf-lib")) return "pdflib";
            if (id.includes("react")) return "react";
          }
          return undefined;
        },
      },
    },
  },
});
