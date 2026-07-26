// Scroll-reveal: elements rise + fade in as they enter the viewport,
// with a light stagger. Respects prefers-reduced-motion.

const SELECTOR = [
  ".step-card", ".feature-card", ".faq details", ".cta-inner",
  ".section .kicker", ".section h2", ".footer-col", ".footer-brandcol",
  ".docs-content section",
].join(", ");

export function initReveal(root = document) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    // Huge top margin: elements scrolled PAST at speed still count as
    // intersecting, so a fast scroll can never leave content stuck hidden.
    { threshold: 0.05, rootMargin: "10000px 0px -6% 0px" }
  );

  let i = 0;
  for (const el of root.querySelectorAll(SELECTOR)) {
    // Already visible content (above the fold) shouldn't wait.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85) continue;
    el.classList.add("reveal");
    el.style.transitionDelay = `${(i++ % 5) * 70}ms`;
    io.observe(el);
  }
  return () => io.disconnect();
}
