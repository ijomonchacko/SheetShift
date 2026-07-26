import React, { useEffect, useState } from "react";
import Landing from "./Landing";
import App from "./App";
import Docs from "./Docs";

/**
 * Tiny history-based router — the site has three pages:
 *   /      → marketing landing page
 *   /app   → the transposition tool
 *   /docs  → documentation
 * Vercel rewrites every path to index.html (see vercel.json), and the
 * Vite dev server does the same, so deep links work in both.
 */
export function navigate(to) {
  const [path, hash] = to.split("#");
  const samePath = window.location.pathname === (path || "/");
  if (!samePath) {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } else if (hash) {
    window.history.replaceState({}, "", to);
  }
  if (hash) {
    // Element may not exist until the new page renders — defer the scroll.
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  } else if (!samePath) {
    window.scrollTo(0, 0);
  }
}

/** Click handler for <a> tags so plain anchors still work without JS-router links. */
export function linkTo(to) {
  return (e) => {
    // Let cmd/ctrl-click, middle-click etc. behave like normal links.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
}

const TITLES = {
  "/app": "SheetShift — Transpose your chord chart",
  "/docs": "Docs — SheetShift",
  "/": "SheetShift — Transpose PDF Chord Charts Online, Free & Private",
};

export default function Root() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.title = path.startsWith("/app") ? TITLES["/app"]
      : path.startsWith("/docs") ? TITLES["/docs"]
      : TITLES["/"];
  }, [path]);

  if (path.startsWith("/app")) return <App />;
  if (path.startsWith("/docs")) return <Docs />;
  return <Landing />;
}
