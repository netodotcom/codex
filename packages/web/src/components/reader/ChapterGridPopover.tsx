// reader — chapter grid popover (migrated from components.jsx). Opened from the
// pager centre "X of Y"; a grid of every chapter in the book, fixed-positioned
// above the anchor, closing on outside-click / Escape.
import React from "react";

const { useEffect, useRef } = React;

export function ChapterGridPopover({
  bookId,
  totalChapters,
  currentChapter,
  anchorRect,
  onPick,
  onClose,
}: {
  bookId: string;
  totalChapters: number;
  currentChapter: number;
  anchorRect: DOMRect | null;
  onPick: (ch: number) => void;
  onClose: () => void;
}): React.ReactElement {
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!popRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const style: React.CSSProperties = anchorRect
    ? {
        position: "fixed",
        left: Math.max(8, Math.min(window.innerWidth - 320, anchorRect.left + anchorRect.width / 2 - 160)),
        bottom: Math.max(8, window.innerHeight - anchorRect.top + 8),
        zIndex: 200,
      }
    : { position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 200 };
  return (
    <div ref={popRef} className="cx-pager-grid-pop" style={style} role="dialog" aria-label={`Chapter grid for ${bookId}`}>
      <div className="cx-pager-grid-h">
        {bookId.toUpperCase()} · {totalChapters} chapters
      </div>
      <div className="cx-pager-grid">
        {Array.from({ length: totalChapters }, (_, i) => i + 1).map((ch) => (
          <button
            key={ch}
            type="button"
            className={`cx-pager-grid-ch ${ch === currentChapter ? "is-current" : ""}`}
            onClick={() => {
              onPick(ch);
              onClose();
            }}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
}
