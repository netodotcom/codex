// reader (soul) — scripture text with the golden Name (migrated verbatim from
// reader.jsx). gold = { on, hebrew }.
import React from "react";
import { cxrDivineSegment } from "./divine.js";

export interface Gold {
  on?: boolean;
  hebrew?: boolean;
}

export function CxrText({ text, gold }: { text?: string; gold?: Gold }): React.ReactElement {
  if (!gold || (!gold.on && !gold.hebrew) || !text) {
    return <span className="cxr-text">{text}</span>;
  }
  const segs = cxrDivineSegment(text);
  const first = segs[0];
  if (segs.length === 1 && first && !first.kind) return <span className="cxr-text">{first.t}</span>;
  return (
    <span className="cxr-text">
      {segs.map((s, i) => {
        if (!s.kind) return <React.Fragment key={i}>{s.t}</React.Fragment>;
        if (s.kind === "tetra" && gold.hebrew) {
          return (
            <span key={i} className="cxr-name cxr-name-yhwh" dir="rtl" lang="he"
              title={`יהוה — the Name · rendered for “${s.t}”`}>יהוה</span>
          );
        }
        return <span key={i} className="cxr-name" title="The Name">{s.t}</span>;
      })}
    </span>
  );
}
