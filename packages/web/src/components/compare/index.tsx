// compare — migrated feature entry. Replaces legacy/deleted/dist/compare.js in
// the Vite build (gen-web-entry maps it). Re-exposes the exact window global
// the legacy IIFE set on load and runs the same module-load side-effects:
//   · window.CODEX_ComparePanel = ComparePanel
//   · plugin "compare" (panel "compare") registered via
//     window.CODEX_PLUGINS_API.register, deferred to DOMContentLoaded / load
//     if the API isn't ready yet — identical control flow to v1.
import React from "react";
import { ComparePanel } from "./ComparePanel.js";
import { cw } from "./compare-window.js";

// ── The frozen export contract (unchanged surface) ────────────────────────
cw().CODEX_ComparePanel = ComparePanel;

// ── Plugin registration (unchanged contract) ──────────────────────────────
function doRegister(): unknown {
  const api = cw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return api.register({
    id: "compare",
    name: "How CODEX Compares",
    version: "1.0.0",
    panels: [
      {
        id: "compare",
        label: "COMPARE",
        glyph: "⚖",
        render(ctx: Record<string, unknown>): React.ReactElement {
          return React.createElement(ComparePanel, ctx ?? {});
        },
      },
    ],
  });
}

if (!doRegister()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
