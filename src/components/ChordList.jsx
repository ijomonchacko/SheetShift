import React, { useRef, useState } from "react";
import { isLikelyChord } from "../lib/theory.js";

function isSuspect(item) {
  // A token that doesn't parse as a real chord is almost certainly an OCR
  // misread -- flag it rather than silently passing it through.
  return !isLikelyChord(item.oldText);
}

function isLowConfidence(item) {
  return item.box?.method === "ocr" && (item.box?.confidence ?? 100) < 85;
}

export default function ChordList({ items, onEdit, onDelete }) {
  const [sortMode, setSortMode] = useState("reading"); // reading | confidence
  const listRef = useRef(null);

  const suspectCount = items.filter(isSuspect).length;
  const lowConfCount = items.filter((it) => !isSuspect(it) && isLowConfidence(it)).length;

  const order = items.map((item, i) => ({ item, i }));
  if (sortMode === "confidence") {
    order.sort((a, b) => {
      const sa = isSuspect(a.item) ? -1 : (a.item.box?.confidence ?? 100);
      const sb = isSuspect(b.item) ? -1 : (b.item.box?.confidence ?? 100);
      return sa - sb;
    });
  }

  // Keyboard navigation: ← → move between chips, Enter/Space edits (native).
  function handleListKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const chips = [...listRef.current.querySelectorAll(".chord-chip:not(.is-editing)")];
    const idx = chips.indexOf(document.activeElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = chips[idx + (e.key === "ArrowRight" ? 1 : -1)];
    next?.focus();
  }

  return (
    <div>
      {suspectCount > 0 && (
        <div className="suspect-banner">
          <span className="suspect-dot" aria-hidden="true" />
          {suspectCount} chord{suspectCount === 1 ? "" : "s"} couldn't be read confidently
          (outlined below) — click to fix before generating.
        </div>
      )}
      <div className="list-toolbar">
        <span className="list-toolbar-info">
          {lowConfCount > 0 ? `${lowConfCount} low-confidence read${lowConfCount === 1 ? "" : "s"} marked ⚠` : "Use ← → to move, Enter to edit"}
        </span>
        <label className="list-sort">
          Sort
          <select className="select select-sm" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="reading">Reading order</option>
            <option value="confidence">Lowest confidence first</option>
          </select>
        </label>
      </div>
      <div className="chord-list" role="list" ref={listRef} onKeyDown={handleListKeyDown}>
        {order.map(({ item, i }) => (
          <ChordChip key={i} item={item} index={i} suspect={isSuspect(item)}
                     lowConf={isLowConfidence(item)} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function ChordChip({ item, index, suspect, lowConf, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.oldText);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== item.oldText) {
      onEdit(index, draft.trim());
    } else {
      setDraft(item.oldText);
    }
  }

  if (editing) {
    return (
      <div className="chord-chip is-editing" role="listitem">
        <input
          autoFocus
          className="chord-edit-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(item.oldText); setEditing(false); }
          }}
        />
        <span className="chord-arrow">→</span>
        <span className="chord-new">{item.newText}</span>
        {onDelete && (
          <button
            type="button"
            className="chord-delete-btn"
            title="Delete this chord"
            aria-label="Delete this chord"
            // onMouseDown so it fires before the input's onBlur cancels the edit
            onMouseDown={(e) => { e.preventDefault(); setEditing(false); onDelete(index); }}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  const cls = [
    "chord-chip",
    suspect ? "is-suspect" : "",
    !suspect && lowConf ? "is-lowconf" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cls}
      role="listitem"
      onClick={() => { setDraft(item.oldText); setEditing(true); }}
      title={
        (item.box?.method === "text" ? "Exact text (no OCR)" : `OCR · ${item.box?.confidence ?? "?"}% confidence`) +
        " — click to correct"
      }
    >
      <span className="chord-old">{item.oldText}</span>
      <span className="chord-arrow">→</span>
      <span className="chord-new">{item.newText}</span>
      {!suspect && lowConf && <span className="chord-conf" aria-hidden="true">⚠</span>}
      <span className="chord-edit-hint" aria-hidden="true">✎</span>
    </button>
  );
}
