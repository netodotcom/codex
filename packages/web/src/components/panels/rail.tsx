// panels — LeftRailResizer (Backlog 4.1). Migrated from panels.jsx (l.1992).
// Drag the left rail's right edge to resize; width persists in localStorage.
import React, { useEffect } from "react";

function lrailMax(): number {
  return Math.min(360, Math.floor((window.innerWidth || 1280) * 0.34));
}

export function LeftRailResizer(): React.ReactElement {
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem("codex.lrail.width") || "", 10);
      if (Number.isFinite(saved)) {
        const clamped = Math.max(180, Math.min(lrailMax(), saved));
        document.documentElement.style.setProperty("--cx-lrail-w", clamped + "px");
        if (clamped !== saved) {
          try {
            localStorage.setItem("codex.lrail.width", String(clamped));
          } catch {
            /* quota */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    const startX = e.clientX;
    const start = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cx-lrail-w")) || 232;
    const maxW = lrailMax();
    document.body.classList.add("cx-resizing");
    const onMove = (m: MouseEvent): void => {
      const next = Math.max(180, Math.min(maxW, start + (m.clientX - startX)));
      document.documentElement.style.setProperty("--cx-lrail-w", next + "px");
    };
    const onUp = (): void => {
      document.body.classList.remove("cx-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try {
        const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cx-lrail-w"));
        localStorage.setItem("codex.lrail.width", String(w));
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return <div className="cx-rail-resize is-left" onMouseDown={onDown} title="Drag to resize" aria-label="Resize panel" />;
}
