import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./Root";
import { initTheme } from "./lib/theme.js";
import "./styles.css";

initTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// PWA: offline support via service worker (production only — the dev
// server's module graph doesn't play well with SW caching).
if (typeof import.meta.env !== "undefined" && import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
