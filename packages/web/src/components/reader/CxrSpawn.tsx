// reader (soul) — ⧉ spawn a second reader (migrated verbatim from reader.jsx).
// Used in the reader window header (app.jsx renders this through DeskWin
// headerExtra) and mirrored by the dock chip's context menu in wm.js. Cross-IIFE
// law: drives window.codexNewReader and window.codexDisplays only.
import React from "react";
import { sw } from "./soul-window.js";

const { useState, useRef, useEffect } = React;

export function CxrSpawn(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="cxr-spawn" ref={ref}>
      <button
        className="cxr-spawn-btn"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu" aria-expanded={open}
        aria-label="Open another reader"
        title="⧉ open another reader"
      >⧉</button>
      {open ? (
        <span className="cxr-spawn-pop" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); const w = sw(); if (w.codexNewReader) w.codexNewReader(); }}>
            <b>⧉ NEW READER WINDOW</b>
            <span>pinned to its own cursor — study two places at once</span>
          </button>
          <button role="menuitem" onClick={() => {
            setOpen(false);
            // ?surface=reader&ref=… — the satellite boots straight onto the
            // current page (reader.jsx handles the ref param at boot), then
            // follows the shared cursor like every display satellite.
            // Built here (not displays.js — read-only) to carry the ref.
            const w = sw();
            const n = w.CODEX_NOW;
            const ref2 = n && n.ref ? n.ref : (n && n.book ? `${n.book} ${n.chapter}` : "");
            const url = window.location.pathname + "?surface=reader&follow=1"
              + (ref2 ? "&ref=" + encodeURIComponent(ref2) : "");
            try {
              const width = Math.min(1280, (window.screen && window.screen.availWidth) || 1280);
              const height = Math.min(900, (window.screen && window.screen.availHeight) || 900);
              window.open(url, "codex-display-reader", "popup=yes,width=" + width + ",height=" + height);
            } catch { if (w.codexDisplays) w.codexDisplays.open("reader"); }
          }}>
            <b>⧉ READER IN A BROWSER TAB</b>
            <span>second monitor satellite — follows the shared cursor</span>
          </button>
        </span>
      ) : null}
    </span>
  );
}
