// panels — LinkifyRefs (Backlog 4.1). Migrated from panels.jsx. Scans free-text
// panel bodies for Bible references (via the migrated buildBibleRefRegex) and
// turns each into a clickable link → window.codexJumpToRef.
import React from "react";
import { buildBibleRefRegex } from "./linkify.js";

const RX = buildBibleRefRegex();

interface JumpWindow {
  codexJumpToRef?: (ref: string) => void;
}

export function LinkifyRefs({ text }: { text?: string }): React.ReactElement | null {
  if (!text || typeof text !== "string") return text ? <>{text}</> : null;
  const out: React.ReactNode[] = [];
  let last = 0;
  RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RX.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const ref = m[0];
    out.push(
      <a
        key={`${m.index}-${ref}`}
        className="cx-pl-ref"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          (window as unknown as JumpWindow).codexJumpToRef?.(ref);
        }}
        title={`Open ${ref}`}
      >
        {ref}
      </a>,
    );
    last = m.index + ref.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.length ? out : text}</>;
}
