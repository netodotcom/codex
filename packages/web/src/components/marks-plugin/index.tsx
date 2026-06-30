// marks-plugin — migrated feature entry (v10 THE MARKS). Replaces
// dist/marks-plugin.js in the Vite build (gen-web-entry maps it). Reproduces
// the legacy IIFE's load-time side effects verbatim:
//   · window.MarksX is set synchronously on module load (Object.assign surface)
//   · plugin "sys-marks" is registered via window.CODEX_PLUGINS_API.register
//     with the identical id / name / version / panel descriptor
//   · if the API isn't ready yet the fallback is document "DOMContentLoaded"
//     (NOT "load") — exactly as the original IIFE coded it
import React from "react";
import { MarksX } from "./MarksX.js";
import { mw } from "./marks-window.js";

// ── Export contract: same global surface as v10 ───────────────────────────
mw().MarksX = MarksX;

// ── Plugin registration (unchanged contract) ──────────────────────────────
function reg(): unknown {
  const api = mw().CODEX_PLUGINS_API;
  if (!api) return false;
  return api.register({
    id: "sys-marks",
    name: "The Marks",
    version: "10.0.0",
    panels: [
      {
        id: "marks",
        label: "MARKS",
        glyph: "⌖",
        render() {
          return React.createElement(MarksX);
        },
      },
    ],
  });
}

// Guard for SSR / non-browser environments (faithfully preserved from v10).
if (typeof window !== "undefined") {
  if (!reg()) {
    document.addEventListener("DOMContentLoaded", reg, { once: true });
  }
}
