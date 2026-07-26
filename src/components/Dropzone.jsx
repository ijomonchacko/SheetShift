import React, { useRef, useState } from "react";

/**
 * Drag-and-drop upload. Accepts MULTIPLE PDFs — the first becomes the
 * current chart, the rest queue up for setlist mode.
 *
 * Props: file (current File|null), onFiles(File[]), onRemove(), onDemo()
 */
export default function Dropzone({ file, onFiles, onRemove, onDemo }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");

  const pick = () => inputRef.current?.click();

  const handleFiles = (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      setFileError("That doesn't look like a PDF — please choose .pdf files.");
      return;
    }
    if (pdfs.length < files.length) {
      setFileError(`Skipped ${files.length - pdfs.length} non-PDF file${files.length - pdfs.length === 1 ? "" : "s"}.`);
    } else {
      setFileError("");
    }
    onFiles(pdfs);
  };

  if (file) {
    return (
      <div className="file-info">
        <div className="file-info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
            <path d="M14 3v5h5" />
          </svg>
        </div>
        <div className="file-info-text">
          <div className="file-name">{file.name}</div>
          <div className="file-meta">{(file.size / 1024 / 1024).toFixed(2)} MB · PDF</div>
        </div>
        <button className="btn-icon" onClick={onRemove} aria-label="Remove file">&times;</button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`dropzone${dragOver ? " is-dragover" : ""}`}
        tabIndex={0}
        role="button"
        aria-label="Upload PDF"
        onClick={pick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept="application/pdf" multiple hidden
               onChange={(e) => handleFiles(e.target.files)} />
        <div className="dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
        </div>
        <p className="dropzone-title">Drop PDFs here, <span className="grad-link">or browse</span></p>
        <p className="dropzone-sub">One chart — or several for a whole setlist</p>
      </div>
      {onDemo && (
        <button type="button" className="demo-link" onClick={onDemo}>
          No chart handy? Try the sample chart →
        </button>
      )}
      {fileError && <p className="dropzone-error" role="alert">{fileError}</p>}
    </>
  );
}
