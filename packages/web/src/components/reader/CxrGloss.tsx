// reader (soul) — one whisper (migrated verbatim from reader.jsx). Collapsed:
// glyph + a single dimmed line. Tap: unfolds the full text in place. Scripture
// stays serene — this never shouts.
import React from "react";
import type { OverlayKey } from "./gloss.js";
import type { GlossEntry } from "./soul-window.js";

export interface GlossItem {
  ov: OverlayKey;
  e: GlossEntry;
  key: string;
}

export function CxrGloss({ g, open, onToggle }: { g: GlossItem; open: boolean; onToggle: () => void }): React.ReactElement {
  const e = g.e;
  const glyph = g.ov === "gnosis" ? (e.sigil || "⟁") : g.ov === "talmud" ? "ת" : "§";
  const head = e.title || e.heading || e.author || e.ref || "…";
  const meta = g.ov === "talmud" ? (e.ref || "") : g.ov === "comm" ? (e.from || "") : "";
  return (
    <div
      className={`cxr-gloss is-${g.ov} ${open ? "is-open" : ""}`}
      role="button" tabIndex={0}
      aria-expanded={open}
      title={open ? "Fold" : "Unfold"}
      onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); onToggle(); } }}
    >
      <div className="cxr-gloss-h">
        <i aria-hidden>{glyph}</i>
        <b>{head}</b>
        {meta ? <em>{meta}</em> : null}
      </div>
      {open ? (
        <div className="cxr-gloss-body">
          {e.body || ""}
          {e.tag ? <span className="cxr-gloss-tag">{e.tag}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
