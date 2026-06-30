// reader (soul) — overlay glosses: gnosis ⟁ / talmud ת / commentary §
// (migrated verbatim from reader.jsx). Entries from panelData rarely carry
// verse anchors explicitly, but their prose often does ("v. 14 —", "(v. 9)",
// "1:11"). Conservative extraction: a verse hint must exist within the
// chapter's verse range; "ch:v" form must name THIS chapter. Anything
// unanchored becomes a chapter-level margin presence under the title.
import type { GlossEntry } from "./soul-window.js";

export type OverlayKey = "gnosis" | "talmud" | "comm";

export interface OverlayDef {
  k: OverlayKey;
  glyph: string;
  label: string;
  tweak: string;
  hint: string;
}

export function cxrGlossAnchor(entry: GlossEntry, chapter: number | string, maxVerse: number): number | null {
  const hay = [entry.ref, entry.heading, entry.title, entry.body]
    .filter(Boolean).join(" · ");
  const m1 = hay.match(/\bvv?\.?\s*(\d{1,3})\b/i);          // v. 14 / vv. 12–13
  if (m1 && m1[1] != null) { const n = +m1[1]; if (n >= 1 && n <= maxVerse) return n; }
  const m2 = hay.match(/\b(\d{1,3}):(\d{1,3})\b/);          // 1:11
  if (m2 && m2[1] != null && m2[2] != null && +m2[1] === +chapter) {
    const n = +m2[2]; if (n >= 1 && n <= maxVerse) return n;
  }
  return null;
}

export const CXR_OVERLAYS: OverlayDef[] = [
  { k: "gnosis", glyph: "⟁", label: "GNOSIS", tweak: "overlayGnosis",
    hint: "Gnosis overlay — esoteric readings whisper beside the verses they touch" },
  { k: "talmud", glyph: "ת", label: "TALMUD", tweak: "overlayTalmud",
    hint: "Talmud overlay — rabbinic parallels beside the text" },
  { k: "comm", glyph: "§", label: "COMMENTARY", tweak: "overlayCommentary",
    hint: "Commentary overlay — patristic to modern voices beside the text" },
];
