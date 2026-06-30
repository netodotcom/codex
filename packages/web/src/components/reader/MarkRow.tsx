// reader — bookmark row (migrated from components.jsx). Click opens the mark,
// the swatch shows the colour, pin toggles top-sort, × clears the highlight.
import React from "react";
import { pad } from "./solar.js";
import type { Mark } from "./types.js";

export function MarkRow({
  mark,
  onSelect,
  onClear,
  onTogglePin,
  swatch,
  aiReason,
}: {
  mark: Mark;
  idx?: number;
  onSelect: (m: Mark) => void;
  onClear: (m: Mark) => void;
  onTogglePin?: (m: Mark) => void;
  swatch?: string;
  aiReason?: string;
}): React.ReactElement {
  const onClick = (e: React.MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (target.closest(".cx-bm-del")) return;
    if (target.closest(".cx-bm-pin")) return;
    onSelect(mark);
  };
  const relTs = ((): string => {
    if (!mark.ts) return "";
    const diff = (Date.now() - mark.ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    const d = new Date(mark.ts);
    return `${pad(d.getMonth() + 1)}·${pad(d.getDate())}`;
  })();
  return (
    <li className={`cx-bm-li ${mark.pinned ? "is-pinned" : ""}`}>
      <div className="cx-bm-row" onClick={onClick}>
        <span className="cx-bm-swatch" style={swatch ? { background: swatch } : undefined} aria-hidden title={mark.color} />
        <div className="cx-bm-text">
          <span className="cx-bm-ref">{mark.ref}</span>
          {mark.note ? <span className="cx-bm-note">{mark.note}</span> : null}
          {aiReason ? (
            <span className="cx-bm-reason" title="Why the Oracle ranked this">
              ✦ {aiReason}
            </span>
          ) : null}
        </div>
        <span className="cx-bm-ts">{relTs}</span>
        <button
          className={`cx-bm-pin ${mark.pinned ? "is-on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.(mark);
          }}
          title={mark.pinned ? "Unpin" : "Pin to top"}
          aria-label={mark.pinned ? "Unpin mark" : "Pin mark"}
          aria-pressed={!!mark.pinned}
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
            <g transform="rotate(-30 6 6)">
              <ellipse cx="6" cy="3.5" rx="2.6" ry="1.2" fill={mark.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="0.9" />
              <line x1="6" y1="4.6" x2="6" y2="9.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
              <line x1="4.5" y1="9.6" x2="7.5" y2="9.6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
            </g>
          </svg>
        </button>
        <button
          className="cx-bm-del"
          onClick={(e) => {
            e.stopPropagation();
            onClear(mark);
          }}
          title="Remove mark"
          aria-label="Remove mark"
        >
          ×
        </button>
      </div>
    </li>
  );
}
