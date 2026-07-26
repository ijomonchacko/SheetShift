import React from "react";

/* ══════════════════════════════════════════════════════════════════
   Icon + mark set — single-weight line drawings, 24px grid.
   Everything uses currentColor so it inverts cleanly per theme.
   ══════════════════════════════════════════════════════════════════ */

const s = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export const Logo = (p) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="10.2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12" cy="12" r="5.6" stroke="currentColor" strokeWidth="1.3" opacity="0.42" />
    <path d="M12 1.8v4.6M12 17.6v4.6M1.8 12h4.6M17.6 12h4.6" stroke="currentColor" strokeWidth="1.3" opacity="0.42" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" />
  </svg>
);

export const ArrowUR = (p) => (
  <svg {...s} {...p}><path d="M7 17 17 7M8.5 7H17v8.5" /></svg>
);
export const ArrowR = (p) => (
  <svg {...s} {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
);
export const Check = (p) => (
  <svg {...s} {...p}><path d="m4.5 12.5 4.5 4.5L19.5 6.5" /></svg>
);
export const Play = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M8.5 5.4v13.2L19 12 8.5 5.4Z" />
  </svg>
);
export const Bolt = (p) => (
  <svg {...s} {...p}><path d="M13.2 2 4.8 13.4h6.1L10 22l8.4-11.4h-6.1L13.2 2Z" /></svg>
);
export const Sliders = (p) => (
  <svg {...s} {...p}>
    <path d="M5 3.5v5M5 13v7.5M12 3.5v9M12 17v3.5M19 3.5v2.5M19 10.5v10" />
    <circle cx="5" cy="10.8" r="2.1" /><circle cx="12" cy="14.8" r="2.1" /><circle cx="19" cy="8.2" r="2.1" />
  </svg>
);
export const Layers = (p) => (
  <svg {...s} {...p}>
    <path d="m12 2.8 9 4.7-9 4.7-9-4.7 9-4.7Z" />
    <path d="m3 12.4 9 4.7 9-4.7" opacity="0.5" />
    <path d="m3 16.9 9 4.7 9-4.7" opacity="0.28" />
  </svg>
);
export const Lock = (p) => (
  <svg {...s} {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2.4" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    <circle cx="12" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const Eye = (p) => (
  <svg {...s} {...p}>
    <path d="M2.5 12S6.2 5.8 12 5.8 21.5 12 21.5 12 17.8 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const Sun = (p) => (
  <svg {...s} {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
  </svg>
);
export const Moon = (p) => (
  <svg {...s} {...p}><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" /></svg>
);
export const FileDrop = (p) => (
  <svg {...s} {...p}>
    <path d="M13.5 2.8H7a2.2 2.2 0 0 0-2.2 2.2v14a2.2 2.2 0 0 0 2.2 2.2h10a2.2 2.2 0 0 0 2.2-2.2V8.5l-5.7-5.7Z" />
    <path d="M13.4 2.9V8.6h5.7" opacity="0.5" />
    <path d="M12 11.4v5.2M9.7 14.3 12 16.6l2.3-2.3" data-drop-arrow="" />
  </svg>
);

export const Menu = (p) => (
  <svg {...s} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
