import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const MAJ = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
const MORPH_KEYS = ["C", "D", "E♭", "E"];
const BEAT = 2.9;                 // seconds each key is held in the hero plate
const EASE = "power3.out";

/**
 * Wire every landing-page animation inside `root`.
 * Returns a teardown function — call it on unmount.
 */
export function initLanding(root) {
  if (!root) return () => {};

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia?.("(pointer: fine)").matches;
  const q = (sel) => Array.from(root.querySelectorAll(sel));

  // Nothing is hidden until JS is confirmed alive, so a bundle that fails
  // to load leaves a readable page rather than a blank one.
  //
  // Every starting state is set here rather than in CSS: a percentage
  // transform written by a stylesheet reaches GSAP as a resolved pixel
  // matrix, which it cannot read back as `yPercent` — the tween would then
  // animate a percentage that is already zero and leave the pixel offset in
  // place, hiding the element for good.
  if (reduced) return () => {};

  // Skip the two costliest hero effects on phones and low-core machines,
  // which is where the stutter was reported.
  const LOW_POWER =
    window.innerWidth < 900 ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const heroLines = q(".ss-hero .ss-line > span");
  const rise = q("[data-anim='rise']");
  const fade = q("[data-anim='fade']");
  const cleanups = [];

  const ctx = gsap.context(() => {
    gsap.set(heroLines, { yPercent: 105 });
    gsap.set(rise, { y: 26, opacity: 0 });
    gsap.set(fade, { opacity: 0 });
    gsap.set(q("[data-rule]"), { scaleX: 0 });
    gsap.set(q(".ss-steps-rail"), { scaleX: 0 });
    gsap.set(q(".ss-steps-dot"), { opacity: 0 });

    /* ══ hero: line-clip headline, then everything beneath it ═══════ */
    const intro = gsap.timeline({ defaults: { ease: EASE } });

    if (heroLines.length) {
      intro.to(heroLines, { yPercent: 0, duration: 1.15, stagger: 0.085, ease: "expo.out" });
    }
    intro.to(q(".ss-hero [data-anim='rise']"), { y: 0, opacity: 1, duration: 0.9, stagger: 0.09 }, "-=0.78");
    intro.to(q(".ss-hero [data-anim='fade']"), { opacity: 1, duration: 0.9, stagger: 0.07 }, "-=0.85");

    /* hero plate: settle in, then breathe */
    const heroArt = root.querySelector("[data-hero-art]");
    const heroPanel = heroArt?.querySelector(".ss-panel");
    if (heroArt) {
      intro.from(heroArt, { opacity: 0, yPercent: 6, scale: 0.94, duration: 1.4, ease: "expo.out" }, 0.25);
      if (!LOW_POWER) {
        gsap.to(heroArt, { y: -10, duration: 5.5, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.8 });
      }
    }

    /* ══ background plate: drift, spin, playhead, pointer parallax ══ */
    const bg = root.querySelector(".ss-hero-bg");
    const bgIn = bg?.querySelector(".ss-hero-bg-in") || bg;
    if (bg) {
      const staff = bg.querySelector("[data-staff-layer]");
      const rings = bg.querySelector("[data-ring-layer]");
      const notes = Array.from(bg.querySelectorAll("[data-staff-layer] ellipse"));

      // Everything below transforms .ss-hero-bg-in, never .ss-hero-bg —
      // the mask lives on the outer element, and a mask over a element
      // that moves has to be re-rasterised on every single frame.
      gsap.to(bgIn, {
        yPercent: 10,
        ease: "none",
        scrollTrigger: { trigger: ".ss-hero", start: "top top", end: "bottom top", scrub: 0.6 },
      });

      // the staves slide, the fifths rings turn — both continuous, both slow
      // enough to register as atmosphere rather than as motion
      if (staff) gsap.to(staff, { xPercent: -2.5, duration: 24, ease: "sine.inOut", repeat: -1, yoyo: true, force3D: true });
      if (rings) gsap.to(rings, { rotation: 360, transformOrigin: "78% 34%", duration: 420, ease: "none", repeat: -1, force3D: true });

      // playhead: sweeps the staves like a transport cursor, lighting each
      // notehead as it crosses. Driven by `x` (composited) rather than
      // `left` (which would force a layout pass every frame), and the
      // note lookup walks a sorted cursor instead of rescanning the set.
      const play = bg.querySelector(".ss-hero-play");
      if (play && notes.length && !LOW_POWER) {
        const order = notes
          .map((n, i) => ({ n, p: parseFloat(n.getAttribute("cx")) / 1600, i }))
          .sort((a, b) => a.p - b.p);
        const head = { p: 0 };
        let next = 0;
        const width = () => bg.getBoundingClientRect().width;

        gsap.timeline({ repeat: -1, repeatDelay: 4.5 })
          .set(play, { opacity: 0, x: 0 })
          .set(head, { p: 0 })
          .call(() => { next = 0; })
          .to(play, { opacity: 0.85, duration: 0.5 })
          .to(head, {
            p: 1,
            duration: 7,
            ease: "none",
            onUpdate() {
              gsap.set(play, { x: head.p * width() });
              while (next < order.length && order[next].p <= head.p) {
                gsap.fromTo(order[next].n, { opacity: 0.13 },
                  { opacity: 0.7, duration: 0.2, yoyo: true, repeat: 1, ease: "none" });
                next++;
              }
            },
          }, "<")
          .to(play, { opacity: 0, duration: 0.6 }, "-=0.6");
      }

      // pointer parallax — the hero rect is measured once per resize
      // instead of on every mousemove, which was thrashing layout
      if (fine && !LOW_POWER) {
        const hero = root.querySelector(".ss-hero");
        const bgX = gsap.quickTo(bgIn, "x", { duration: 1.4, ease: "power3" });
        const bgY = gsap.quickTo(bgIn, "y", { duration: 1.4, ease: "power3" });
        const tiltX = heroPanel && gsap.quickTo(heroPanel, "rotationX", { duration: 0.9, ease: "power3" });
        const tiltY = heroPanel && gsap.quickTo(heroPanel, "rotationY", { duration: 0.9, ease: "power3" });

        let rect = hero.getBoundingClientRect();
        const remeasure = () => { rect = hero.getBoundingClientRect(); };
        window.addEventListener("resize", remeasure);
        window.addEventListener("scroll", remeasure, { passive: true });

        let queued = false;
        let mx = 0, my = 0;
        const apply = () => {
          queued = false;
          const nx = (mx - rect.left) / rect.width - 0.5;
          const ny = (my - rect.top) / rect.height - 0.5;
          bgX(nx * -24);
          bgY(ny * -16);
          if (tiltX) { tiltX(ny * -6); tiltY(nx * 8); }
        };
        const onMove = (e) => {
          mx = e.clientX; my = e.clientY;
          if (!queued) { queued = true; requestAnimationFrame(apply); }
        };
        const onLeave = () => { bgX(0); bgY(0); if (tiltX) { tiltX(0); tiltY(0); } };
        hero.addEventListener("mousemove", onMove, { passive: true });
        hero.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          hero.removeEventListener("mousemove", onMove);
          hero.removeEventListener("mouseleave", onLeave);
          window.removeEventListener("resize", remeasure);
          window.removeEventListener("scroll", remeasure);
        });
      }
    }

    /* ══ scroll reveals everywhere else ════════════════════════════ */
    ScrollTrigger.batch(rise.filter((el) => !el.closest(".ss-hero")), {
      start: "top 88%",
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, opacity: 1, duration: 0.95, stagger: 0.08, ease: EASE, overwrite: true }),
    });
    ScrollTrigger.batch(fade.filter((el) => !el.closest(".ss-hero")), {
      start: "top 90%",
      onEnter: (batch) => gsap.to(batch, { opacity: 1, duration: 1, stagger: 0.07, overwrite: true }),
    });

    // section hairlines draw out toward the margin
    q("[data-rule]").forEach((el) => {
      gsap.to(el, {
        scaleX: 1,
        duration: 1.1,
        ease: EASE,
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      });
    });

    /* ══ sticky nav hairline ═══════════════════════════════════════ */
    const nav = root.querySelector(".ss-nav");
    if (nav) {
      ScrollTrigger.create({
        start: "top -8",
        end: 99999,
        onUpdate: (self) => nav.classList.toggle("is-stuck", self.scroll() > 8),
      });
    }

    /* ══ logo rail: seamless marquee ═══════════════════════════════ */
    const sets = q(".ss-rail-set");
    if (sets.length) {
      const w = sets[0].getBoundingClientRect().width + 56;
      gsap.to(sets, {
        x: -w,
        duration: 26,
        ease: "none",
        repeat: -1,
        modifiers: { x: (x) => `${parseFloat(x) % w}px` },
      });
    }

    /* ══ how it works: rail draws, a dot walks it, numerals land ═══ */
    const steps = q(".ss-step");
    const rail = root.querySelector(".ss-steps-rail");
    const dot = root.querySelector(".ss-steps-dot");
    if (rail && steps.length) {
      const walk = gsap.timeline({
        scrollTrigger: { trigger: ".ss-steps", start: "top 80%", once: true },
      });
      walk.to(rail, { scaleX: 1, duration: 1.5, ease: "power2.inOut" });
      if (dot) {
        walk.set(dot, { opacity: 1 }, 0)
            .fromTo(dot, { left: "0%" }, { left: "100%", duration: 1.5, ease: "power2.inOut" }, 0)
            .to(dot, { opacity: 0, duration: 0.4 }, 1.35);
      }
      steps.forEach((step, i) => {
        const at = 0.12 + i * 0.36;
        walk.from(step.querySelector(".ss-step-n"),
          { yPercent: 120, opacity: 0, duration: 0.5, ease: "power3.out" }, at);
        walk.from(step.querySelector(".ss-step-ghost"),
          { yPercent: 30, opacity: 0, duration: 0.9, ease: "power3.out" }, at);
      });
    }

    /* ══ circle of fifths: scroll scrubs it, the pointer overrides ══ */
    const wheelWrap = root.querySelector("[data-wheel]");
    if (wheelWrap) {
      const hand = wheelWrap.querySelector("[data-wheel-hand]");
      const core = wheelWrap.querySelector("[data-wheel-core]");
      const svg = wheelWrap.querySelector(".ss-wheel");
      const labels = Array.from(wheelWrap.querySelectorAll("[data-wheel-maj]"));
      const state = { i: 0 };
      let last = -1;
      let pointing = false;

      const show = (idx) => {
        if (idx === last) return;
        last = idx;
        gsap.to(hand, { rotation: idx * 30, duration: 0.5, ease: "power3.out", overwrite: "auto" });
        if (core) {
          core.textContent = MAJ[idx];
          gsap.fromTo(core, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: EASE });
        }
        labels.forEach((l, li) => l.classList.toggle("is-on", li === idx));
        if (labels[idx]) {
          gsap.fromTo(labels[idx], { scale: 0.78 },
            { scale: 1, duration: 0.45, ease: "back.out(3)", transformOrigin: "center" });
        }
      };

      gsap.to(state, {
        i: 11,
        ease: "none",
        scrollTrigger: { trigger: wheelWrap, start: "top 80%", end: "bottom 25%", scrub: 0.8 },
        onUpdate() { if (!pointing) show(Math.round(state.i)); },
      });

      // Point at a key and the hand goes there — the wheel behaves like the
      // control it depicts rather than a diagram that only reacts to scroll.
      if (svg && fine) {
        const onMove = (e) => {
          const r = svg.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          if (Math.hypot(dx, dy) < r.width * 0.1) return;   // dead zone at the hub
          pointing = true;
          const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
          show((Math.round(deg / 30) + 12) % 12);
        };
        const onLeave = () => {
          pointing = false;
          show(Math.round(state.i));
        };
        svg.addEventListener("mousemove", onMove, { passive: true });
        svg.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          svg.removeEventListener("mousemove", onMove);
          svg.removeEventListener("mouseleave", onLeave);
        });
      }
    }

    /* ══ hero plate: the same chart, four keys, chord by chord ═════ */
    const morphs = q("[data-morph]");
    const keyOut = root.querySelector("[data-morph-key]");
    const progress = root.querySelector(".ss-panel-progress");
    if (morphs.length) {
      const tl = gsap.timeline({
        repeat: -1,
        scrollTrigger: { trigger: morphs[0].closest(".ss-panel"), start: "top 95%" },
      });

      for (let k = 0; k < MORPH_KEYS.length; k++) {
        const t = k * BEAT;
        const shown = morphs.filter((m) => +m.dataset.morph === k);
        const hidden = morphs.filter((m) => +m.dataset.morph !== k);
        const incoming = shown.flatMap((m) => Array.from(m.children));

        tl.to(hidden, { opacity: 0, duration: 0.3, ease: "power2.in" }, t)
          .set(shown, { opacity: 1 }, t + 0.28)
          // each chord lifts into place in reading order, so you watch the key
          // change travel across the bar rather than simply blink
          .fromTo(
            incoming,
            { opacity: 0, yPercent: 85, filter: "blur(5px)" },
            { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 0.62, stagger: 0.045, ease: "power3.out" },
            t + 0.3
          );

        if (keyOut) {
          tl.call(() => {
            keyOut.textContent = MORPH_KEYS[k];
            gsap.fromTo(keyOut, { opacity: 0, yPercent: -60 },
              { opacity: 1, yPercent: 0, duration: 0.4, ease: EASE });
          }, null, t + 0.3);
        }
        if (progress) {
          tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: BEAT, ease: "none" }, t);
        }
      }
    }

    /* ══ detection plate: a beam sweeps, then a cursor circles chords ══ */
    const boxes = q("[data-box]");
    const beam = root.querySelector(".ss-panel-beam");
    const cursor = root.querySelector("[data-cursor]");
    const cursorTag = root.querySelector("[data-cursor-tag]");
    if (boxes.length) {
      const plate = boxes[0].closest(".ss-panel");

      gsap.from(boxes, {
        opacity: 0,
        scale: 0.82,
        duration: 0.5,
        stagger: 0.07,
        ease: "back.out(2)",
        scrollTrigger: { trigger: plate, start: "top 88%", once: true },
      });

      // the beam locates the chords once …
      if (beam) {
        const body = beam.closest(".ss-sheet-body") || plate;
        gsap.timeline({ scrollTrigger: { trigger: plate, start: "top 88%", once: true } })
          .set(beam, { top: 0, opacity: 0 })
          .to(beam, { opacity: 0.9, duration: 0.3 })
          .to(beam, { top: () => body.getBoundingClientRect().height, duration: 1.8, ease: "power1.inOut" }, "<")
          .to(beam, { opacity: 0, duration: 0.4 }, "-=0.35");
      }

      // … then a marching-ants cursor circles each one in turn.
      const stage = cursor && cursor.parentElement;
      if (cursor && stage) {
        const PAD = 5;

        // Measured at tween time, not at build time: the panel parallaxes,
        // the webfonts land late, and the layout reflows on resize.
        const boxOf = (el) => {
          const b = el.getBoundingClientRect();
          const s0 = stage.getBoundingClientRect();
          return {
            x: b.left - s0.left - PAD,
            y: b.top - s0.top - PAD,
            width: b.width + PAD * 2,
            height: b.height + PAD * 2,
          };
        };
        const label = (el) => {
          if (!cursorTag) return;
          const conf = el.dataset.conf || "";
          cursorTag.textContent = el.classList.contains("ss-box--flag")
            ? `conf ${conf} — review`
            : `conf ${conf}`;
        };

        const seq = gsap.timeline({
          repeat: -1,
          repeatDelay: 1.2,
          paused: true,
          scrollTrigger: { trigger: plate, start: "top 85%", end: "bottom 15%", toggleActions: "play pause resume pause" },
        });

        boxes.forEach((el, i) => {
          seq.to(cursor, {
            // function-based values are re-read whenever the timeline is
            // invalidated, which onRepeat below does every lap
            x: () => boxOf(el).x,
            y: () => boxOf(el).y,
            width: () => boxOf(el).width,
            height: () => boxOf(el).height,
            opacity: 1,
            duration: i === 0 ? 0.3 : 0.5,
            ease: "power3.inOut",
            onStart: () => label(el),
          }, i === 0 ? 0.4 : ">+0.4");
        });
        seq.to(cursor, { opacity: 0, duration: 0.35 }, ">+0.6");
        seq.eventCallback("onRepeat", () => seq.invalidate());

        // Hovering a chord takes the cursor over manually — the automatic
        // walk is only the idle behaviour.
        let hovering = false;
        const snap = (el) => {
          label(el);
          gsap.to(cursor, { ...boxOf(el), opacity: 1, duration: 0.32, ease: "power3.out", overwrite: true });
        };
        boxes.forEach((el) => {
          const enter = () => { hovering = true; seq.pause(); snap(el); };
          el.addEventListener("mouseenter", enter);
          cleanups.push(() => el.removeEventListener("mouseenter", enter));
        });
        const leave = () => {
          if (!hovering) return;
          hovering = false;
          seq.invalidate().restart(true);
        };
        stage.addEventListener("mouseleave", leave);
        cleanups.push(() => stage.removeEventListener("mouseleave", leave));

        // re-measure after webfonts and on resize
        const refresh = () => seq.invalidate();
        window.addEventListener("resize", refresh);
        cleanups.push(() => window.removeEventListener("resize", refresh));
      }

      const flagged = boxes.filter((b) => b.classList.contains("ss-box--flag"));
      if (flagged.length) {
        gsap.to(flagged, {
          borderColor: "transparent",
          duration: 1.1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 2.2,
        });
      }
    }

    /* ══ feature plates: lean gently as they pass ══════════════════ */
    q(".ss-row-art .ss-panel").forEach((panel) => {
      gsap.fromTo(
        panel,
        { yPercent: 4 },
        {
          yPercent: -4,
          ease: "none",
          scrollTrigger: { trigger: panel, start: "top bottom", end: "bottom top", scrub: 1 },
        }
      );
    });

    /* ══ stat counters ═════════════════════════════════════════════ */
    q("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      const decimals = el.dataset.decimals ? +el.dataset.decimals : 0;
      const o = { v: 0 };
      const write = () => { el.textContent = prefix + o.v.toFixed(decimals) + suffix; };
      gsap.to(o, {
        v: target,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true, onEnter: write },
        onUpdate: write,
      });
    });

    /* ══ magnetic primary buttons ══════════════════════════════════ */
    if (fine) {
      q("[data-magnetic]").forEach((btn) => {
        const xTo = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
        const yTo = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
        const move = (e) => {
          const r = btn.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.42);
        };
        const out = () => { xTo(0); yTo(0); };
        btn.addEventListener("mousemove", move);
        btn.addEventListener("mouseleave", out);
        cleanups.push(() => {
          btn.removeEventListener("mousemove", move);
          btn.removeEventListener("mouseleave", out);
        });
      });
    }

    /* ══ closing module: the drop target invites the first file ═══ */
    const drop = root.querySelector("[data-drop]");
    if (drop) {
      const arrow = drop.querySelector("[data-drop-arrow]");
      if (arrow) {
        // a slow, small bob — enough to read as "put something here",
        // not enough to compete with the headline beside it
        gsap.to(arrow, {
          y: 2.4,
          duration: 1.15,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          transformOrigin: "center",
        });
      }
      const enter = () => gsap.to(arrow, { y: 3.4, duration: 0.25, ease: "power2.out", overwrite: "auto" });
      const leave = () => gsap.to(arrow, { y: 0, duration: 0.3, ease: "power2.out", overwrite: "auto" });
      if (arrow) {
        drop.addEventListener("mouseenter", enter);
        drop.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          drop.removeEventListener("mouseenter", enter);
          drop.removeEventListener("mouseleave", leave);
        });
      }
    }

  }, root);

  // Late-loading webfonts change every measurement — recompute once settled.
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  return () => {
    cleanups.forEach((fn) => fn());
    ctx.revert();
  };
}
