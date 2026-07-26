import React from "react";
import { linkTo } from "../Root";

const LogoMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
    <circle cx="12" cy="12" r="4.2" fill="currentColor" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brandcol">
          <a className="brand" href="/" onClick={linkTo("/")}>
            <span className="brand-mark"><LogoMark /></span>
            SheetShift
          </a>
          <p className="footer-blurb">
            Change the key of any PDF chord chart in seconds — free, private,
            and entirely in your browser.
          </p>
          <span className="footer-badge">
            <span className="pill-dot" /> Files never leave your device
          </span>
        </div>

        <nav className="footer-col" aria-label="Product">
          <h4>Product</h4>
          <a href="/app" onClick={linkTo("/app")}>Open the app</a>
          <a href="/#how">How it works</a>
          <a href="/#features">Features</a>
          <a href="/#faq">FAQ</a>
        </nav>

        <nav className="footer-col" aria-label="Resources">
          <h4>Resources</h4>
          <a href="/docs" onClick={linkTo("/docs")}>Documentation</a>
          <a href="/docs#quick-start" onClick={linkTo("/docs#quick-start")}>Quick start</a>
          <a href="/docs#troubleshooting" onClick={linkTo("/docs#troubleshooting")}>Troubleshooting</a>
          <a href="/docs#privacy" onClick={linkTo("/docs#privacy")}>Privacy</a>
        </nav>

        <nav className="footer-col" aria-label="Good to know">
          <h4>Good to know</h4>
          <a href="/docs#how-detection-works" onClick={linkTo("/docs#how-detection-works")}>How detection works</a>
          <a href="/docs#fonts" onClick={linkTo("/docs#fonts")}>Fonts &amp; styling</a>
          <a href="/docs#limitations" onClick={linkTo("/docs#limitations")}>Limitations</a>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} SheetShift · sheetshift.vercel.app</p>
        <p>Chord detection uses OCR on the rendered page — always review before use.</p>
      </div>
    </footer>
  );
}
