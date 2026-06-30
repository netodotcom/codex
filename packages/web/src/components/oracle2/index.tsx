// oracle2 — migrated feature entry. Replaces legacy/deleted/dist/oracle2.js in the
// Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's load-time side
// effects: exposes window.OracleX (same surface as v1), and self-registers the
// sys-oracle plugin via window.CODEX_PLUGINS_API with the same DOMContentLoaded
// fallback as the legacy closure.
import React from "react";
import { OracleX } from "./OracleX.js";
import { ow } from "./oracle2-window.js";

// ── The frozen export contract (unchanged surface) ────────────────────────────
// Object.assign(window, { OracleX }) — same timing, same name.
ow().OracleX = OracleX;

// ── Plugin registration (unchanged contract from the legacy IIFE) ─────────────
function reg(): boolean | void {
  if (!ow().CODEX_PLUGINS_API) return false;
  return ow().CODEX_PLUGINS_API?.register({
    id: "sys-oracle",
    name: "The Oracle",
    version: "11.0.0",
    panels: [
      {
        id: "oracle",
        label: "ORACLE",
        glyph: "◬",
        render() {
          return React.createElement(OracleX);
        },
      },
    ],
  });
}

if (!reg()) {
  document.addEventListener("DOMContentLoaded", reg, { once: true });
}
