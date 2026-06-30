// reader — reading-view options popover (migrated from components.jsx). One ⊕
// that holds every reader-view toggle: size, scripture face, red-letter,
// side-by-side. Portaled to <body> and viewport-fixed so it can never be clipped
// by an overflow:hidden ancestor.
import React from "react";
import { FaceToggle } from "./FaceToggle.js";
import { tx, rw } from "./reader-window.js";

const { useState, useEffect, useRef } = React;

interface PopPos {
  top: number;
  left: number;
  width: number;
  maxH: number;
}

export function ReaderViewPopover({
  redLetter,
  onToggleRedLetter,
  fontScale,
  onCycleFontSize,
  sideBySide,
  onToggleSideBySide,
}: {
  redLetter: boolean;
  onToggleRedLetter?: () => void;
  fontScale: number;
  onCycleFontSize?: () => void;
  sideBySide: boolean;
  onToggleSideBySide?: () => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopPos | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = (): void => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const W = 240;
      const M = 8;
      const left = Math.max(M, Math.min(r.right - W, window.innerWidth - W - M));
      const top = Math.min(r.bottom + 6, window.innerHeight - 120);
      const maxH = Math.max(140, window.innerHeight - top - 12);
      setPos({ top, left, width: W, maxH });
    };
    measure();
    const onDown = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);
  const anyOn = redLetter || sideBySide || fontScale !== 22;
  const ReactDOM = rw().ReactDOM;
  return (
    <span className="cx-vp" ref={ref}>
      <button
        type="button"
        className={`cx-vp-trigger ${open ? "is-open" : ""} ${anyOn ? "is-tweaked" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="View options"
        aria-label="View options"
        aria-expanded={open}
      >
        <span className="cx-vp-trigger-glyph">Aa</span>
        {anyOn ? <i className="cx-vp-trigger-dot" /> : null}
      </button>
      {open && pos && ReactDOM?.createPortal
        ? ReactDOM.createPortal(
            <div
              ref={popRef}
              className="cx-vp-pop"
              role="dialog"
              aria-label="Reading view options"
              style={{ position: "fixed", top: pos.top + "px", left: pos.left + "px", right: "auto", width: pos.width + "px", maxHeight: pos.maxH + "px", overflowY: "auto" }}
            >
              <div className="cx-vp-row" style={{ minHeight: 44 }}>
                <span className="cx-vp-lbl">{tx("size")}</span>
                <button className="cx-vp-stepper" onClick={onCycleFontSize} title="Cycle text size" style={{ minHeight: 44 }}>
                  <span className="cx-vp-stepper-letter">Aa</span>
                  <span className="cx-vp-stepper-num">{fontScale}</span>
                </button>
              </div>
              <div className="cx-vp-row" style={{ minHeight: 44 }}>
                <span className="cx-vp-lbl">{tx("face")}</span>
                <FaceToggle />
              </div>
              <div className="cx-vp-row" style={{ minHeight: 44, cursor: "pointer" }} onClick={onToggleRedLetter} role="none">
                <span className="cx-vp-lbl">{tx("red_letter")}</span>
                <button
                  type="button"
                  className={`cx-vp-toggle ${redLetter ? "is-on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleRedLetter?.();
                  }}
                  role="switch"
                  aria-checked={redLetter}
                  aria-label="Red letter mode"
                >
                  <i />
                </button>
              </div>
              <div className="cx-vp-row" style={{ minHeight: 44, cursor: "pointer" }} onClick={onToggleSideBySide} role="none">
                <span className="cx-vp-lbl">{tx("side_by_side")}</span>
                <button
                  type="button"
                  className={`cx-vp-toggle ${sideBySide ? "is-on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSideBySide?.();
                  }}
                  role="switch"
                  aria-checked={sideBySide}
                  aria-label="Side by side mode"
                >
                  <i />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
