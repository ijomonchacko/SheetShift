import React, { useEffect, useState } from "react";
import { linkTo } from "../Root";
import { currentTheme, toggleTheme } from "../lib/theme.js";
import { Logo, ArrowUR, Sun, Moon, Menu } from "./art/Marks.jsx";

const LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Features", href: "/#features" },
  { label: "Why it's different", href: "/#why" },
  { label: "FAQ", href: "/#faq" },
  { label: "Docs", href: "/docs" },
];

function ThemeSwitch() {
  const [theme, setTheme] = useState(() =>
    typeof document === "undefined" ? "light" : currentTheme()
  );
  useEffect(() => setTheme(currentTheme()), []);
  return (
    <button
      type="button"
      className="ss-icon-btn"
      onClick={() => setTheme(toggleTheme())}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light" : "Dark"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="ss-nav">
      <div className="ss-wrap ss-nav-in">
        <a className="ss-brand" href="/" onClick={linkTo("/")}>
          <Logo />
          SheetShift
        </a>

        <nav className="ss-nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}
               onClick={l.href.startsWith("/#") ? undefined : linkTo(l.href)}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ss-nav-act">
          <ThemeSwitch />
          <button
            type="button"
            className="ss-icon-btn ss-nav-burger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Menu />
          </button>
          <a className="ss-btn ss-btn--sm" href="/app" onClick={linkTo("/app")}>
            Open the app <ArrowUR className="ss-arrow" />
          </a>
        </div>
      </div>

      {open && (
        <div className="ss-navsheet" onClick={() => setOpen(false)}>
          <nav aria-label="Mobile">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}
                 onClick={l.href.startsWith("/#") ? undefined : linkTo(l.href)}>
                {l.label}
              </a>
            ))}
            <a className="ss-btn" href="/app" onClick={linkTo("/app")}>
              Open the app <ArrowUR className="ss-arrow" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
