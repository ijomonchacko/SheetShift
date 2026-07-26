// Theme resolution, in priority order:
//   1. an explicit choice the visitor made (persisted in localStorage)
//   2. dark — the site's own default, regardless of OS preference
//
// index.html runs the same resolution in a blocking inline script so the
// first paint is already correct; this module keeps it in sync afterwards.

const KEY = "sheetshift-theme";

function saved() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null; // private browsing
  }
}

export function initTheme() {
  document.documentElement.dataset.theme = saved() || "dark";
}

export function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  return next;
}
