// library2 — migrated feature entry. Replaces dist/library2.js in the Vite
// build (gen-web-entry maps legacy/deleted/dist/library2.js →
// ./components/library2/index.js). Reproduces the legacy IIFE's load-time
// side effects exactly:
//   · window.LibraryX = LibraryX   (same surface as v1)
//   · plugin "sys-library" (panel "library", glyph "☰") registered via
//     window.CODEX_PLUGINS_API.register — with the same DOMContentLoaded
//     fallback the original IIFE used when the API wasn't ready yet.
import React from "react";
import { LibraryX } from "./LibraryX.js";
import { lw } from "./library2-window.js";

// ── Frozen window export (same surface as v1) ─────────────────────────────
lw().LibraryX = LibraryX;

// ── Plugin registration (faithful to the legacy IIFE) ─────────────────────
function reg(): unknown {
  const api = lw().CODEX_PLUGINS_API;
  if (!api) return false;
  return api.register({
    id: "sys-library",
    name: "The Shelves",
    version: "10.0.0",
    panels: [
      {
        id: "library",
        label: "LIBRARY",
        glyph: "☰",
        render(): React.ReactElement {
          return React.createElement(LibraryX);
        },
      },
    ],
  });
}

// The original IIFE guards on typeof window (SSR-safe) then always falls back
// to DOMContentLoaded — no readyState check.  Preserve that exact flow.
if (typeof window !== "undefined") {
  if (!reg()) {
    document.addEventListener("DOMContentLoaded", reg, { once: true });
  }
}
