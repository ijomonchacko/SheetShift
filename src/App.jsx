import React, { useEffect, useMemo, useRef, useState } from "react";
import Wheel, { keyName, keySemitone, keyIndexOf } from "./components/Wheel.jsx";
import Dropzone from "./components/Dropzone.jsx";
import ChordList from "./components/ChordList.jsx";
import ColorPicker from "./components/ColorPicker.jsx";
import SystemFontPicker from "./components/SystemFontPicker.jsx";
import PdfPreview from "./components/PdfPreview.jsx";
import OverlayReview from "./components/OverlayReview.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { detectChords, planTransposition, replanTransposition } from "./lib/detect.js";
import { overlayTransposedChords } from "./lib/pdfOverlay.js";
import { BUILTIN_FONTS, loadBuiltinFont } from "./lib/fonts.js";
import { keyPrefersFlats, transposeChord, simplifyChord, toNashville, capoSuggestions, isLikelyChord } from "./lib/theory.js";
import { toChordPro } from "./lib/chordpro.js";
import { mergePdfs } from "./lib/pdfMerge.js";
import { printPdf } from "./lib/printPdf.js";
import { saveSession, loadSession, clearSession } from "./lib/session.js";
import { generateDemoChart } from "./lib/demoChart.js";
import { linkTo } from "./Root.jsx";

const STAGES = { EMPTY: "empty", LOADING: "loading", RESULT: "result", DONE: "done", ERROR: "error" };

/** Parse share-link settings from the URL (e.g. /app?mode=key&from=C&to=Eb). */
function shareParams() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (![...q.keys()].length) return null;
    return {
      mode: q.get("mode") === "semitones" ? "semitones" : "key",
      minor: q.get("minor") === "1",
      from: q.get("from"),
      to: q.get("to"),
      semis: q.get("semis"),
      simplify: q.get("simplify") === "1",
      out: q.get("out") === "nashville" ? "nashville" : "transpose",
    };
  } catch {
    return null;
  }
}
const SHARE = shareParams();

export default function App() {
  /* ---------------- file queue ---------------- */
  const [files, setFiles] = useState([]);          // File[]
  const [currentIdx, setCurrentIdx] = useState(0);
  const [outputs, setOutputs] = useState([]);      // [{name, bytes} | null] parallel to files
  const file = files[currentIdx] || null;

  /* ---------------- transposition settings ---------------- */
  const [mode, setMode] = useState(SHARE?.mode ?? "key");
  const [minor, setMinor] = useState(SHARE?.minor ?? false);
  const [fromIdx, setFromIdx] = useState(SHARE?.from ? keyIndexOf(SHARE.from, SHARE.minor) : null);
  const [toIdx, setToIdx] = useState(SHARE?.to ? keyIndexOf(SHARE.to, SHARE.minor) : null);
  const [activeTarget, setActiveTarget] = useState("from");
  const [semitones, setSemitones] = useState(SHARE?.semis ?? -2);
  const [hoverIdx, setHoverIdx] = useState(null);

  /* ---------------- detection settings ---------------- */
  const [colors, setColors] = useState([[170, 0, 0]]); // default maroon; user can change
  const [dpi, setDpi] = useState(150);
  const [detectStrength, setDetectStrength] = useState("balanced"); // precise | balanced | aggressive
  // 0 by default: titles are now dropped semantically (isChordCandidate), so we
  // no longer need to blank out the top of the page — doing that used to skip
  // real chords sitting just under the title. Users can still set a margin.
  const [topMargin, setTopMargin] = useState(0);
  const [marginFirstPage, setMarginFirstPage] = useState(true);

  /* ---------------- output settings ---------------- */
  const [fontId, setFontId] = useState(BUILTIN_FONTS[0].id); // Liberation Sans (Arial), regular
  const [customFont, setCustomFont] = useState(null); // { name, bytes }
  const [fontSize, setFontSize] = useState("14");
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [outputMode, setOutputMode] = useState(SHARE?.out ?? "transpose"); // transpose | nashville
  const [enharmonic, setEnharmonic] = useState("auto"); // auto | sharps | flats
  const [simplify, setSimplify] = useState(SHARE?.simplify ?? false);

  /* ---------------- pipeline state ---------------- */
  const [stage, setStage] = useState(STAGES.EMPTY);
  const [loadingText, setLoadingText] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [detectMeta, setDetectMeta] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [resultView, setResultView] = useState("list"); // list | overlay
  const [bulkFind, setBulkFind] = useState("");
  const [bulkReplace, setBulkReplace] = useState("");

  const [originalBytes, setOriginalBytes] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputBytes, setOutputBytes] = useState(null);
  const [outputName, setOutputName] = useState("");
  const [compare, setCompare] = useState(false);
  const [copied, setCopied] = useState("");

  const [sessionOffer, setSessionOffer] = useState(null);

  const customFontInputRef = useRef(null);

  /* ---------------- derived ---------------- */
  const fromKey = useMemo(() => keyName(fromIdx, minor), [fromIdx, minor]);
  const toKey = useMemo(() => keyName(toIdx, minor), [toIdx, minor]);
  const intervalSemitones = useMemo(() => {
    if (fromIdx === null || toIdx === null) return null;
    let diff = (keySemitone(toIdx, minor) - keySemitone(fromIdx, minor) + 12) % 12;
    if (diff > 6) diff -= 12;
    return diff;
  }, [fromIdx, toIdx, minor]);

  const hoverPreview = useMemo(() => {
    if (hoverIdx === null || fromIdx === null || activeTarget !== "to" || mode !== "key") return null;
    let diff = (keySemitone(hoverIdx, minor) - keySemitone(fromIdx, minor) + 12) % 12;
    if (diff > 6) diff -= 12;
    const flats = keyPrefersFlats(keyName(hoverIdx, minor) || "C");
    const sample = minor ? ["Am", "Dm7", "E7"] : ["C", "Am7", "G"];
    // shift the sample into the from-key first so the preview reads naturally
    const base = keySemitone(fromIdx, minor) - (minor ? 9 : 0);
    return sample
      .map((c) => {
        const inFrom = transposeChord(c, base, keyPrefersFlats(fromKey || "C"));
        return `${inFrom}→${transposeChord(inFrom, diff, flats)}`;
      })
      .join(" · ");
  }, [hoverIdx, fromIdx, activeTarget, mode, minor, fromKey]);

  const canPreview = !!file && (mode === "semitones" || (fromIdx !== null && toIdx !== null));
  const missingHint = !file
    ? "Upload a chord chart to get started"
    : mode === "key" && (fromIdx === null || toIdx === null)
      ? "Pick both a From and a To key on the wheel"
      : null;

  /* ---------------- session restore offer ---------------- */
  useEffect(() => {
    if (SHARE) return; // a share link takes precedence
    let cancelled = false;
    loadSession().then((s) => {
      if (!cancelled && s?.plan?.length) setSessionOffer(s);
    });
    return () => { cancelled = true; };
  }, []);

  async function resumeSession() {
    const s = sessionOffer;
    if (!s) return;
    const f = new File([s.fileBlob], s.fileName, { type: "application/pdf" });
    setFiles([f]);
    setCurrentIdx(0);
    setOutputs([null]);
    setPlan(s.plan);
    setDetectMeta(s.detectMeta);
    if (s.settings) {
      setMode(s.settings.mode ?? "key");
      setMinor(s.settings.minor ?? false);
      setFromIdx(s.settings.fromIdx ?? null);
      setToIdx(s.settings.toIdx ?? null);
      setSemitones(s.settings.semitones ?? -2);
    }
    setHistory({ past: [], future: [] });
    setStage(STAGES.RESULT);
    setSessionOffer(null);
  }

  /* ---------------- undo / redo ---------------- */
  function pushHistory(prevPlan) {
    setHistory((h) => ({ past: [...h.past.slice(-49), prevPlan], future: [] }));
  }
  function undo() {
    setHistory((h) => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      setPlan((cur) => { h._redo = cur; return prev; });
      return { past: h.past.slice(0, -1), future: [...h.future, h._redo] };
    });
  }
  function redo() {
    setHistory((h) => {
      if (!h.future.length) return h;
      const next = h.future[h.future.length - 1];
      setPlan((cur) => { h._undo = cur; return next; });
      return { past: [...h.past, h._undo], future: h.future.slice(0, -1) };
    });
  }
  useEffect(() => {
    function onKey(e) {
      if (stage !== STAGES.RESULT) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /* ---------------- plan recomputation ---------------- */
  function planOptions(over = {}) {
    const enh = over.enharmonic ?? enharmonic;
    const sim = over.simplify ?? simplify;
    const out = over.outputMode ?? outputMode;
    const preferFlats = enh === "auto"
      ? (detectMeta?.autoPreferFlats ?? false)
      : enh === "flats";
    return {
      semis: detectMeta?.semitones ?? 0,
      preferFlats,
      simplify: sim,
      nashvilleKey: out === "nashville" ? (detectMeta?.fromKey || fromKey || "C") : null,
    };
  }

  function computeNewText(oldText, over = {}) {
    // Don't transpose non-chords (title/lyric words that happen to start A-G).
    if (!isLikelyChord(oldText)) return oldText;
    const o = planOptions(over);
    const source = o.simplify ? simplifyChord(oldText) : oldText;
    return o.nashvilleKey
      ? toNashville(source, o.nashvilleKey)
      : transposeChord(source, o.semis, o.preferFlats);
  }

  function updateOutputOption(partial) {
    if (partial.enharmonic !== undefined) setEnharmonic(partial.enharmonic);
    if (partial.simplify !== undefined) setSimplify(partial.simplify);
    if (partial.outputMode !== undefined) setOutputMode(partial.outputMode);
    if (plan) {
      const o = planOptions(partial);
      pushHistory(plan);
      setPlan(replanTransposition(plan, o.semis, o.preferFlats, {
        simplify: o.simplify, nashvilleKey: o.nashvilleKey,
      }));
    }
  }

  /* ---------------- handlers ---------------- */
  function selectWedge(i) {
    if (activeTarget === "from") {
      setFromIdx(i);
      if (toIdx === null) setActiveTarget("to");
    } else {
      setToIdx(i);
    }
  }

  function resetResults() {
    setStage(STAGES.EMPTY);
    setPlan(null);
    setDetectMeta(null);
    setHistory({ past: [], future: [] });
    setResultView("list");
    setCompare(false);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setOutputBytes(null);
    setOriginalBytes(null);
  }

  function handleFiles(newFiles) {
    setFiles((prev) => {
      const merged = [...prev, ...newFiles];
      if (!prev.length) setCurrentIdx(0);
      return merged;
    });
    setOutputs((prev) => [...prev, ...newFiles.map(() => null)]);
    resetResults();
  }

  function handleRemoveFile() {
    setFiles((prev) => prev.filter((_, i) => i !== currentIdx));
    setOutputs((prev) => prev.filter((_, i) => i !== currentIdx));
    setCurrentIdx(0);
    resetResults();
  }

  function switchToFile(i) {
    setCurrentIdx(i);
    resetResults();
  }

  async function loadDemo() {
    try {
      // Generated locally with pdf-lib — no fetch, no download, straight
      // into the dropzone.
      const demoFile = await generateDemoChart();
      handleFiles([demoFile]);
      // The demo is in C — preselect C → D so one click previews.
      setMode("key"); setMinor(false);
      setFromIdx(keyIndexOf("C")); setToIdx(keyIndexOf("D"));
    } catch (err) {
      console.error(err);
      setError("Couldn't create the sample chart.");
      setStage(STAGES.ERROR);
    }
  }

  async function handleCustomFontChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(ttf|otf)$/i.test(f.name)) {
      setError("Font must be a .ttf or .otf file.");
      return;
    }
    const bytes = await f.arrayBuffer();
    setCustomFont({ name: f.name, bytes });
    setFontId("__custom__");
  }

  async function handlePreview() {
    if (!file) return;
    setStage(STAGES.LOADING);
    setLoadingText("Reading chord symbols…");
    setLoadingProgress(0.04);
    // Detection can't report fine-grained sub-page progress, so a page-based
    // percentage would sit frozen (e.g. at 50%) on a single-page PDF. Trickle
    // the bar toward a ceiling so it always reads as "working"; real page
    // completions below push it forward, and we snap to 100% when done.
    const trickle = setInterval(() => {
      setLoadingProgress((p) => (p == null ? p : Math.min(0.92, p + (0.92 - p) * 0.08)));
    }, 180);
    try {
      const semis = mode === "semitones" ? Number(semitones) : intervalSemitones;
      if (semis === null || Number.isNaN(semis)) throw new Error("Pick both a From and To key first.");
      const preferFlats = mode === "semitones" ? false : keyPrefersFlats(toKey);

      const arrayBuffer = await file.arrayBuffer();
      const useColors = colors;

      const { boxes, numPages, usedOcr, truncated } = await detectChords(arrayBuffer, useColors, {
        scale: Number(dpi) / 72,
        topMarginRatio: Number(topMargin),
        marginFirstPageOnly: marginFirstPage,
        strength: detectStrength,
        onProgress: (msg, i, n) => {
          setLoadingText(msg);
          // Only ever move the bar forward.
          if (n) setLoadingProgress((p) => Math.max(p ?? 0, i / n));
        },
      });

      const meta = {
        numPages,
        truncated,
        semitones: semis,
        autoPreferFlats: preferFlats,
        fromKey, toKey, usedOcr,
      };
      const o = { simplify, nashvilleKey: outputMode === "nashville" ? (fromKey || "C") : null };
      const effFlats = enharmonic === "auto" ? preferFlats : enharmonic === "flats";
      const planned = planTransposition(boxes, semis, effFlats, o);
      clearInterval(trickle);
      setLoadingProgress(1);
      setPlan(planned);
      setDetectMeta(meta);
      setHistory({ past: [], future: [] });
      setStage(STAGES.RESULT);

      saveSession({
        fileName: file.name,
        fileBlob: file,
        plan: planned,
        detectMeta: meta,
        settings: { mode, minor, fromIdx, toIdx, semitones },
      });
    } catch (err) {
      clearInterval(trickle);
      console.error(err);
      setError(err.message || "Something went wrong reading that PDF.");
      setStage(STAGES.ERROR);
    }
  }

  function handleEditChord(index, correctedOldText) {
    pushHistory(plan);
    setPlan((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        oldText: correctedOldText,
        newText: computeNewText(correctedOldText),
      };
      return next;
    });
  }

  function handleAddChord(box, text) {
    pushHistory(plan);
    setPlan((prev) => [...prev, { box, oldText: text, newText: computeNewText(text) }]);
  }

  function handleDeleteChord(index) {
    pushHistory(plan);
    setPlan((prev) => prev.filter((_, i) => i !== index));
  }

  function applyBulkReplace() {
    const find = bulkFind.trim();
    const repl = bulkReplace.trim();
    if (!find || !repl || !plan) return;
    const hits = plan.filter((p) => p.oldText === find).length;
    if (!hits) { setCopied(`No chords match "${find}"`); setTimeout(() => setCopied(""), 2500); return; }
    pushHistory(plan);
    setPlan((prev) => prev.map((p) => p.oldText === find
      ? { ...p, oldText: repl, newText: computeNewText(repl) }
      : p));
    setBulkFind(""); setBulkReplace("");
  }

  async function handleGenerate() {
    if (!file || !plan) return;
    setStage(STAGES.LOADING);
    setLoadingText("Generating your transposed PDF…");
    setLoadingProgress(null);
    try {
      const fontBytes = fontId === "__custom__" && customFont
        ? customFont.bytes
        : await loadBuiltinFont(fontId);

      const origBytes = await file.arrayBuffer();
      const drawColor = colors[0].map((c) => c / 255);
      const outBytes = await overlayTransposedChords(origBytes, plan, fontBytes, {
        colorRgb: drawColor,
        fontSize: fontSize ? Number(fontSize) : null,
      });

      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = file.name.replace(/\.pdf$/i, "") + "_transposed.pdf";
      setOriginalBytes(origBytes);
      setOutputUrl(url);
      setOutputBytes(outBytes);
      setOutputName(name);
      setOutputs((prev) => prev.map((o, i) => (i === currentIdx ? { name, bytes: outBytes } : o)));
      setStage(STAGES.DONE);
      clearSession();
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong generating the PDF.");
      setStage(STAGES.ERROR);
    }
  }

  /* ---------------- done-state extras ---------------- */
  function downloadChordPro() {
    const meta = { fromKey: detectMeta?.fromKey, toKey: detectMeta?.toKey };
    const text = toChordPro(plan, outputName.replace(/_transposed\.pdf$/i, ""), meta);
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = outputName.replace(/\.pdf$/i, "") + ".cho";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function downloadMerged() {
    const ready = outputs.filter(Boolean);
    const merged = await mergePdfs(ready.map((o) => o.bytes));
    const blob = new Blob([merged], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "setlist_transposed.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function buildShareUrl() {
    const q = new URLSearchParams();
    q.set("mode", mode);
    if (mode === "key") {
      if (minor) q.set("minor", "1");
      if (fromKey) q.set("from", fromKey.replace("♯", "#").replace("♭", "b"));
      if (toKey) q.set("to", toKey.replace("♯", "#").replace("♭", "b"));
    } else {
      q.set("semis", String(semitones));
    }
    if (simplify) q.set("simplify", "1");
    if (outputMode === "nashville") q.set("out", "nashville");
    return `${window.location.origin}/app?${q.toString()}`;
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied("Couldn't copy — clipboard blocked");
    }
    setTimeout(() => setCopied(""), 2500);
  }

  function copyDebugInfo() {
    copyText(JSON.stringify({
      error,
      when: new Date().toISOString(),
      userAgent: navigator.userAgent,
      settings: { mode, minor, fromKey, toKey, semitones, dpi, topMargin, marginFirstPage, colors, outputMode, enharmonic, simplify },
      file: file ? { name: file.name, size: file.size } : null,
    }, null, 2), "Debug info copied");
  }

  const capos = useMemo(
    () => (mode === "key" && outputMode === "transpose" && toKey ? capoSuggestions(toKey, minor) : []),
    [mode, outputMode, toKey, minor]
  );

  const queueRemaining = outputs.some((o, i) => !o && i !== currentIdx);
  const nextPendingIdx = outputs.findIndex((o, i) => !o && i !== currentIdx);

  /* ================= render ================= */
  return (
    <div className="tool">
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="/" onClick={linkTo("/")}>
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
                <circle cx="12" cy="12" r="4.2" fill="currentColor" />
              </svg>
            </span>
            SheetShift
          </a>
          <div className="nav-right">
            <a className="nav-doclink" href="/docs" onClick={linkTo("/docs")}>Docs</a>
            <ThemeToggle />
            <span className="nav-badge">
              <span className="pill-dot" /> Runs locally — nothing is uploaded
            </span>
          </div>
        </div>
      </nav>

      <main className="layout">
        {/* ================= LEFT: upload + settings ================= */}
        <section className="panel panel-settings" aria-label="Upload and settings">
          <div className="card">
            <div className="card-head">
              <h2 className="card-title"><span className="step-num">1</span> Chord chart{files.length > 1 ? "s" : ""}</h2>
              <p className="card-desc">Drop in a PDF chord chart or lead sheet — text-based or scanned.</p>
            </div>
            <Dropzone file={file} onFiles={handleFiles} onRemove={handleRemoveFile} onDemo={loadDemo} />
            {files.length > 1 && (
              <ul className="file-queue" aria-label="Setlist queue">
                {files.map((f, i) => (
                  <li key={i}>
                    <button type="button"
                            className={`file-queue-item${i === currentIdx ? " is-current" : ""}${outputs[i] ? " is-done" : ""}`}
                            onClick={() => switchToFile(i)}>
                      <span className="file-queue-status">{outputs[i] ? "✓" : i === currentIdx ? "▸" : "•"}</span>
                      <span className="file-queue-name">{f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="card-title"><span className="step-num">2</span> Transposition</h2>
              <p className="card-desc">Pick a target key on the wheel, or shift by a set number of semitones.</p>
            </div>

            <div className="segmented" role="tablist" aria-label="Transposition mode">
              <button className={`segmented-btn${mode === "key" ? " is-active" : ""}`}
                      onClick={() => setMode("key")} role="tab" aria-selected={mode === "key"}>By key</button>
              <button className={`segmented-btn${mode === "semitones" ? " is-active" : ""}`}
                      onClick={() => setMode("semitones")} role="tab" aria-selected={mode === "semitones"}>By interval</button>
            </div>

            {mode === "key" ? (
              <div className="wheel-wrap">
                <div className="wheel-toggles">
                  <div className="target-toggle" role="radiogroup" aria-label="Which key the next click sets">
                    <button className={`target-btn${activeTarget === "from" ? " is-active" : ""}`}
                            onClick={() => setActiveTarget("from")}>From <span>{fromKey || "—"}</span></button>
                    <button className={`target-btn${activeTarget === "to" ? " is-active" : ""}`}
                            onClick={() => setActiveTarget("to")}>To <span>{toKey || "—"}</span></button>
                  </div>
                  <label className="quality-toggle">
                    <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
                    <span className="quality-track"><span className="quality-thumb" /></span>
                    <span className="quality-text">{minor ? "Minor" : "Major"}</span>
                  </label>
                </div>

                <Wheel fromIdx={fromIdx} toIdx={toIdx} minor={minor} onSelect={selectWedge} onHover={setHoverIdx} />

                <div className="interval-readout">
                  {hoverPreview ? (
                    <span className="interval-hover">{hoverPreview}</span>
                  ) : fromIdx === null || toIdx === null ? (
                    <span className="interval-empty">Tap the wheel to pick two keys</span>
                  ) : (
                    <>
                      <span id="intervalValue">
                        {intervalSemitones > 0 ? "+" : ""}{intervalSemitones} semitone{Math.abs(intervalSemitones) === 1 ? "" : "s"}
                      </span>
                      <span className="interval-detail">{fromKey} → {toKey}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="field-label" htmlFor="semitoneInput">Semitones (+/-)</label>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => setSemitones((s) => Number(s) - 1)} aria-label="Decrease">{"−"}</button>
                  <input id="semitoneInput" type="number" className="stepper-input" value={semitones}
                         onChange={(e) => setSemitones(e.target.value)} />
                  <button className="stepper-btn" onClick={() => setSemitones((s) => Number(s) + 1)} aria-label="Increase">{"+"}</button>
                </div>
              </div>
            )}
          </div>

          <details className="card card-advanced">
            <summary className="card-title advanced-summary">
              <span className="step-num">3</span> Advanced
              <span className="chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </summary>

            <div className="adv-section">
              <h3 className="adv-heading">Output</h3>
              <div className="field-grid">
                <div className="field field-wide">
                  <label className="field-label" htmlFor="outputModeSelect">Transpose to</label>
                  <select id="outputModeSelect" className="select" value={outputMode}
                          onChange={(e) => updateOutputOption({ outputMode: e.target.value })}>
                    <option value="transpose">Transposed chords</option>
                    <option value="nashville">Nashville numbers</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="enharmonicSelect">Accidentals</label>
                  <select id="enharmonicSelect" className="select" value={enharmonic} title="Sharp/flat spelling"
                          disabled={outputMode === "nashville"}
                          onChange={(e) => updateOutputOption({ enharmonic: e.target.value })}>
                    <option value="auto">♯/♭ auto</option>
                    <option value="sharps">Prefer ♯</option>
                    <option value="flats">Prefer ♭</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Simplify</label>
                  <label className="switch">
                    <input type="checkbox" checked={simplify}
                           onChange={(e) => updateOutputOption({ simplify: e.target.checked })} />
                    <span className="switch-track"><span className="switch-thumb" /></span>
                    <span className="switch-text">Cmaj9 → C</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="adv-section">
              <h3 className="adv-heading">Chord appearance</h3>
              <div className="field-grid">
                <div className="field field-font">
                  <label className="field-label" htmlFor="fontSelect">Font</label>
                  <select id="fontSelect" className="select" value={fontId} onChange={(e) => {
                    if (e.target.value === "__custom__") customFontInputRef.current?.click();
                    else if (e.target.value === "__system__") setFontPickerOpen(true);
                    else setFontId(e.target.value);
                  }}>
                    {BUILTIN_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    {customFont && <option value="__custom__">{customFont.name} (custom)</option>}
                    <option value="__system__">Choose from this computer…</option>
                    <option value="__custom__">Upload a .ttf/.otf file…</option>
                  </select>
                  <input ref={customFontInputRef} type="file" accept=".ttf,.otf" hidden onChange={handleCustomFontChange} />
                  {fontPickerOpen && (
                    <SystemFontPicker
                      onClose={() => setFontPickerOpen(false)}
                      onPick={({ name, bytes }) => {
                        setCustomFont({ name, bytes });
                        setFontId("__custom__");
                        setFontPickerOpen(false);
                      }}
                    />
                  )}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="fontSizeInput">Font size</label>
                  <input id="fontSizeInput" type="text" className="select" placeholder="Auto"
                         value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
                </div>

                <div className="field field-wide">
                  <label className="field-label">Chord color{colors.length > 1 ? "s" : ""} <span className="hint">— ink for the new chords</span></label>
                  <ColorPicker file={file} colors={colors} onColorsChange={setColors} />
                </div>
              </div>
            </div>

            <div className="adv-section">
              <h3 className="adv-heading">Scanned-PDF detection</h3>
              <div className="field-grid">
                <div className="field field-wide">
                  <label className="field-label">Detection strength <span className="hint">— recall vs. precision for OCR</span></label>
                  <div className="segmented segmented-mini" role="tablist" aria-label="Detection strength">
                    {["precise", "balanced", "aggressive"].map((s) => (
                      <button key={s} type="button" role="tab" aria-selected={detectStrength === s}
                              className={`segmented-btn${detectStrength === s ? " is-active" : ""}`}
                              onClick={() => setDetectStrength(s)}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="dpiInput">Scan DPI</label>
                  <input id="dpiInput" type="number" className="select" value={dpi} onChange={(e) => setDpi(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="marginInput">Header margin</label>
                  <input id="marginInput" type="number" step="0.01" className="select" value={topMargin} onChange={(e) => setTopMargin(e.target.value)} />
                </div>

                <div className="field field-wide">
                  <label className="switch">
                    <input type="checkbox" checked={marginFirstPage} onChange={(e) => setMarginFirstPage(e.target.checked)} />
                    <span className="switch-track"><span className="switch-thumb" /></span>
                    <span className="switch-text">Apply header margin to the first page only</span>
                  </label>
                </div>
              </div>
            </div>
          </details>

          <div className="cta-block">
            <button className="btn btn-primary btn-full btn-lg" disabled={!canPreview} onClick={handlePreview}>
              Preview detected chords
            </button>
            {missingHint && <p className="cta-hint">{missingHint}</p>}
            <button type="button" className="share-link-btn" onClick={() => copyText(buildShareUrl(), "Settings link copied")}>
              Copy settings link
            </button>
            {copied && <p className="copied-toast" role="status">{copied}</p>}
          </div>
        </section>

        {/* ================= RIGHT: results ================= */}
        <section className="panel panel-results" aria-label="Detection and output">
          {stage === STAGES.EMPTY && (
            <>
              {sessionOffer && (
                <div className="resume-banner">
                  <div>
                    <strong>Resume last session?</strong>
                    <span> {sessionOffer.fileName} · {sessionOffer.plan.length} chords reviewed</span>
                  </div>
                  <div className="resume-actions">
                    <button className="btn btn-primary btn-xs" onClick={resumeSession}>Resume</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => { clearSession(); setSessionOffer(null); }}>Dismiss</button>
                  </div>
                </div>
              )}
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V6l10-2v11" />
                    <circle cx="6.5" cy="18" r="2.5" />
                    <circle cx="16.5" cy="15" r="2.5" />
                  </svg>
                </div>
                <h3 className="empty-title">Your preview will appear here</h3>
                <p>Upload a chord chart and choose a key, then hit <strong>Preview detected chords</strong>.</p>
              </div>
            </>
          )}

          {stage === STAGES.LOADING && (
            <div className="loading-state">
              <div className="scan-visual" aria-hidden="true">
                <div className="scan-sheet">
                  <div className="scan-row">
                    <span className="scan-chord" style={{ animationDelay: "0s" }} />
                    <span className="scan-chord" style={{ width: 16, animationDelay: ".3s" }} />
                    <span className="scan-chord" style={{ width: 26, marginLeft: "auto", animationDelay: ".6s" }} />
                  </div>
                  <span className="scan-line" style={{ width: "92%" }} />
                  <span className="scan-line" style={{ width: "78%" }} />
                  <div className="scan-row">
                    <span className="scan-chord" style={{ width: 20, animationDelay: ".9s" }} />
                    <span className="scan-chord" style={{ width: 14, marginLeft: 34, animationDelay: "1.2s" }} />
                  </div>
                  <span className="scan-line" style={{ width: "86%" }} />
                  <span className="scan-line" style={{ width: "64%" }} />
                  <span className="scan-beam" />
                </div>
              </div>

              <div className={`scan-progress${loadingProgress === null ? " is-indeterminate" : ""}`}>
                <div className="scan-progress-bar"
                     style={loadingProgress === null ? undefined : { width: `${Math.round(loadingProgress * 100)}%` }} />
              </div>

              <p className="loading-title">
                {loadingText}
                <span className="loading-dots"><i /><i /><i /></span>
              </p>
              {loadingProgress !== null && (
                <span className="scan-percent">{Math.round(loadingProgress * 100)}%</span>
              )}
            </div>
          )}

          {stage === STAGES.RESULT && plan && (
            <div className="result-state">
              <div className="result-header">
                <span className={`badge${detectMeta.usedOcr ? "" : " is-exact"}`}>
                  {detectMeta.usedOcr ? "OCR · rendered page" : "Exact · embedded text"}
                </span>
                <span className="result-count">
                  <strong>{plan.length}</strong> chord symbol{plan.length === 1 ? "" : "s"} across {detectMeta.numPages} page{detectMeta.numPages === 1 ? "" : "s"}
                  {(() => {
                    const low = plan.filter((p) => (p.box?.confidence ?? 100) < 70).length;
                    return low > 0 ? <span className="result-lowconf"> · {low} to review</span> : null;
                  })()}
                </span>
                <div className="result-tools">
                  <button className="tool-btn" onClick={undo} disabled={!history.past.length} title="Undo (Ctrl+Z)">↩</button>
                  <button className="tool-btn" onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Shift+Z)">↪</button>
                  <div className="segmented segmented-mini" role="tablist" aria-label="Review view">
                    <button className={`segmented-btn${resultView === "list" ? " is-active" : ""}`}
                            onClick={() => setResultView("list")} role="tab" aria-selected={resultView === "list"}>List</button>
                    <button className={`segmented-btn${resultView === "overlay" ? " is-active" : ""}`}
                            onClick={() => setResultView("overlay")} role="tab" aria-selected={resultView === "overlay"}>On page</button>
                  </div>
                </div>
              </div>

              {detectMeta.truncated ? (
                <div className="warning-banner">
                  This PDF is long, so only the first <strong>{detectMeta.truncated}</strong> of {detectMeta.numPages} pages
                  were scanned to keep things responsive. Split the file to process the rest.
                </div>
              ) : null}

              {detectMeta.usedOcr ? (
                <div className="warning-banner">
                  Chords were read with OCR from the rendered page — give the list a quick check
                  against your original. Click any chip to correct it.
                </div>
              ) : (
                <div className="info-banner">
                  This PDF has a real text layer, so chords were read <strong>exactly</strong> from the
                  text — no OCR, no color guessing. Symbols are identified by chord spelling and font,
                  so it works across MuseScore, Finale, Sibelius, Dorico and more. A quick skim is still worth it.
                </div>
              )}

              <div className="bulk-bar">
                <input className="select select-sm" placeholder="Find (e.g. Gm?)" value={bulkFind}
                       onChange={(e) => setBulkFind(e.target.value)} />
                <span className="chord-arrow">→</span>
                <input className="select select-sm" placeholder="Replace with" value={bulkReplace}
                       onChange={(e) => setBulkReplace(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") applyBulkReplace(); }} />
                <button className="btn btn-ghost btn-xs" onClick={applyBulkReplace}>Replace all</button>
              </div>

              {resultView === "list" ? (
                <ChordList items={plan} onEdit={handleEditChord} onDelete={handleDeleteChord} />
              ) : (
                <FileOverlay file={file} plan={plan} onEdit={handleEditChord} onAdd={handleAddChord} onDelete={handleDeleteChord} />
              )}

              <button className="btn btn-primary btn-full btn-lg" onClick={handleGenerate}>
                Generate transposed PDF
              </button>
            </div>
          )}

          {stage === STAGES.DONE && (
            <div className="done-state">
              <div className="done-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              </div>
              <h3>Your transposed chart is ready</h3>
              <p className="done-summary">{outputName} · {plan.length} chords</p>

              <div className="done-actions">
                <a className="btn btn-primary" href={outputUrl} download={outputName}>Download PDF</a>
                <button className="btn btn-ghost" onClick={() => printPdf(outputBytes, outputName).catch((e) => { setError(e.message); setStage(STAGES.ERROR); })}>Print</button>
                <button className="btn btn-ghost" onClick={downloadChordPro}>ChordPro (.cho)</button>
                <button className="btn btn-ghost" onClick={() => { handleRemoveFile(); }}>Transpose another</button>
              </div>

              {queueRemaining && (
                <div className="setlist-bar">
                  <span>{outputs.filter(Boolean).length} of {files.length} charts done.</span>
                  <button className="btn btn-primary btn-xs" onClick={() => switchToFile(nextPendingIdx)}>
                    Next chart →
                  </button>
                </div>
              )}
              {outputs.filter(Boolean).length > 1 && (
                <div className="setlist-bar">
                  <span>Merge all {outputs.filter(Boolean).length} transposed charts into one PDF:</span>
                  <button className="btn btn-primary btn-xs" onClick={downloadMerged}>Download setlist</button>
                </div>
              )}

              {capos.length > 0 && (
                <div className="capo-card">
                  <span className="capo-title">🎸 Capo options for {toKey}</span>
                  <ul>
                    {capos.map((c, i) => (
                      <li key={i}>
                        {c.capo === 0
                          ? <>Play open <strong>{c.shape}</strong> shapes — no capo needed</>
                          : <>Capo <strong>{c.capo}</strong>, play <strong>{c.shape}</strong> shapes</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="compare-toggle">
                <label className="checkbox-inline">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                  <span className="checkbox-label">Compare with original side-by-side</span>
                </label>
              </div>

              {compare && originalBytes ? (
                <div className="compare-grid">
                  <div>
                    <p className="compare-label">Original</p>
                    <PdfPreview bytes={originalBytes} />
                  </div>
                  <div>
                    <p className="compare-label">Transposed</p>
                    <PdfPreview bytes={outputBytes} />
                  </div>
                </div>
              ) : (
                <PdfPreview bytes={outputBytes} />
              )}
            </div>
          )}

          {stage === STAGES.ERROR && (
            <div className="error-state" role="alert">
              <div className="error-banner">{error}</div>
              <div className="done-actions">
                <button className="btn btn-ghost" onClick={() => setStage(plan ? STAGES.RESULT : STAGES.EMPTY)}>
                  Back
                </button>
                <button className="btn btn-ghost" onClick={copyDebugInfo}>Copy debug info</button>
              </div>
              {copied && <p className="copied-toast" role="status">{copied}</p>}
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        <p>Runs entirely in your browser — files never leave this device. Review detected chords before use.
           Need help? <a className="foot-link" href="/docs" onClick={linkTo("/docs")}>Read the docs</a>.</p>
      </footer>
    </div>
  );
}

/** Small wrapper that reads the file's bytes once for OverlayReview. */
function FileOverlay({ file, plan, onEdit, onAdd, onDelete }) {
  const [bytes, setBytes] = useState(null);
  useEffect(() => {
    let cancelled = false;
    file?.arrayBuffer().then((b) => { if (!cancelled) setBytes(b); });
    return () => { cancelled = true; };
  }, [file]);
  if (!bytes) return <div className="loading-state" style={{ minHeight: 200 }}><div className="spinner" /></div>;
  return <OverlayReview fileBytes={bytes} plan={plan} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} />;
}
