import React from "react";
import { linkTo } from "../Root";
import { Logo } from "./art/Marks.jsx";

const COLS = [
  {
    h: "Product",
    links: [
      ["Open the app", "/app"],
      ["How it works", "/#how"],
      ["Capabilities", "/#features"],
      ["FAQ", "/#faq"],
    ],
  },
  {
    h: "Documentation",
    links: [
      ["Overview", "/docs"],
      ["Quick start", "/docs#quick-start"],
      ["Troubleshooting", "/docs#troubleshooting"],
      ["Privacy", "/docs#privacy"],
    ],
  },
  {
    h: "Good to know",
    links: [
      ["How detection works", "/docs#how-detection-works"],
      ["Fonts & styling", "/docs#fonts"],
      ["Limitations", "/docs#limitations"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="ss-foot">
      <div className="ss-wrap ss-foot-grid">
        <div>
          <a className="ss-brand" href="/" onClick={linkTo("/")}>
            <Logo />
            SheetShift
          </a>
          <p className="ss-foot-blurb">
            Change the key of any PDF chord chart in seconds — free, private,
            and entirely inside your browser.
          </p>
          <span className="ss-foot-badge"><i />Files never leave your device</span>
        </div>

        {COLS.map((c) => (
          <div className="ss-foot-col" key={c.h}>
            <h4>{c.h}</h4>
            <nav aria-label={c.h}>
              {c.links.map(([label, href]) => (
                <a key={href} href={href}
                   onClick={href.startsWith("/#") ? undefined : linkTo(href)}>
                  {label}
                </a>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="ss-wrap ss-foot-bar">
        <span>© {new Date().getFullYear()} SheetShift</span>
        <span>Scanned charts are read with OCR — always review before you play.</span>
      </div>
    </footer>
  );
}
