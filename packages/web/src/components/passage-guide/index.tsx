// passage-guide — migrated feature entry. Replaces dist/passage-guide.js in the
// Vite build (gen-web-entry maps it). Re-exposes window.CODEX_PassageGuide (same
// surface as v1 — engines outlive skins) and self-registers as a CODEX plugin
// via window.CODEX_PLUGINS_API with the EXACT same deferral the legacy IIFE used
// (try now; otherwise retry on DOMContentLoaded / load).
import React from "react";
import { PassageGuide } from "./PassageGuide.js";
import { pgw } from "./passage-guide-window.js";

// Expose for reuse (same surface as v1).
pgw().CODEX_PassageGuide = PassageGuide;

// ── Plugin registration ──────────────────────────────────────────────
function doRegister(): unknown {
  const api = pgw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return api.register({
    id: "passage-guide",
    name: "Passage Guide",
    version: "1.0.0",
    panels: [
      {
        id: "guide",
        label: "GUIDE",
        glyph: "❖",
        render(ctx: unknown) {
          return React.createElement(PassageGuide, ctx as Parameters<typeof PassageGuide>[0]);
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
