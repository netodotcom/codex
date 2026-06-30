// crossref — migrated feature entry (Backlog: THE THREAD WEB). Replaces
// dist/crossref.js in the Vite build (gen-web-entry maps it). Re-exposes the
// exact window globals the legacy crossref.jsx IIFE set on load and runs the
// same module-load side-effects:
//   · window.CODEX_CrossRefLookup = { getCrossRefs, formatRef, parseVerseKey }
//   · window.CODEX_CrossRefPanel  = CrossRefPanel
//   · plugin "crossrefs-tsk" (panel "crossrefs") registered via
//     window.CODEX_PLUGINS_API.register, deferred to DOMContentLoaded / load
//     if the API isn't ready yet — identical control flow to v1.
// (The automation hooks window.codexXrefCenter / window.codexXrefState are set
// by the panel itself on mount, exactly as in the legacy closure.)
import React from "react";
import { CrossRefPanel } from "./CrossRefPanel.js";
import { getCrossRefs } from "./data.js";
import { formatRef, parseVerseKey } from "./helpers.js";
import { xw } from "./crossref-window.js";
import type { CrossRefPlugin } from "./crossref-window.js";

// ── The frozen export contract (unchanged surface) ───────────────────────
Object.assign(xw(), {
  CODEX_CrossRefLookup: { getCrossRefs, formatRef, parseVerseKey },
  CODEX_CrossRefPanel: CrossRefPanel,
});

// ── Plugin registration (unchanged contract) ──────────────────────────────
function openCrossRefsForVerse(ctx: { ref: unknown }): void {
  try {
    window.dispatchEvent(
      new CustomEvent("codex:open-panel", {
        detail: { panelId: "crossrefs-tsk:crossrefs", ctx },
      }),
    );
  } catch {}
}

function doRegister(): unknown {
  const api = xw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return api.register({
    id: "crossrefs-tsk",
    name: "TSK Cross-References",
    version: "2.0.0",
    panels: [
      {
        id: "crossrefs",
        label: "CROSS-REFS",
        glyph: "✝",
        render(ctx: Record<string, unknown>) {
          const c = (ctx || {}) as {
            book?: string;
            bookId?: string;
            chapter?: number;
            verse?: number;
            translation?: string;
          };
          return React.createElement(CrossRefPanel, {
            book: c.book,
            bookId: c.bookId || "John",
            chapter: c.chapter || 1,
            verse: c.verse || 1,
            translation: c.translation,
          });
        },
      },
    ],
    verseActions: [
      {
        label: "Cross-References",
        icon: "✝",
        handler(verseRef: unknown) {
          openCrossRefsForVerse({ ref: verseRef });
        },
      },
    ],
  } satisfies CrossRefPlugin);
}

if (!doRegister()) {
  // Defer to window load if the plugin API isn't ready yet.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
