// dictionary — migrated feature entry (Phase 2.4). Replaces
// legacy/deleted/dist/dictionary.js in the Vite build (gen-web-entry maps it).
// Reproduces the legacy IIFE's load-time side effects:
//   · window.CODEX_DictionaryPanel = DictionaryPanel (same surface as v1)
//   · plugin "bible-dictionary" (panel "dictionary", glyph ℵ, verseAction
//     "Look up in Dictionary") registered via window.CODEX_PLUGINS_API.register,
//     deferred to DOMContentLoaded / load if the API isn't ready — identical
//     control flow to v1.
import React from "react";
import { DictionaryPanel } from "./DictionaryPanel.js";
import { dw } from "./dictionary-window.js";
import type { DictionaryPanelProps } from "./DictionaryPanel.js";

// ── Expose the same window global as v1 ──────────────────────────────────
dw().CODEX_DictionaryPanel = DictionaryPanel;

// ── Plugin registration (identical contract to v1) ────────────────────────
function doRegister(): boolean {
  const api = dw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return Boolean(
    api.register({
      id: "bible-dictionary",
      name: "Bible Dictionary",
      version: "1.0.0",
      panels: [
        {
          id: "dictionary",
          label: "DICT",
          glyph: "ℵ",
          render(ctx: unknown) {
            const c = (ctx || {}) as DictionaryPanelProps;
            return React.createElement(DictionaryPanel, {
              book: c.book,
              bookId: c.bookId,
              chapter: c.chapter,
              verse: c.verse,
              translation: c.translation,
            });
          },
        },
      ],
      verseActions: [
        {
          label: "Look up in Dictionary",
          icon: "ℵ",
          handler(verseRef: unknown) {
            // verseRef may be a string or an object — pass along verbatim plus text if present.
            try {
              const vr = verseRef as { ref?: unknown; text?: string } | null;
              const detail =
                vr && typeof vr === "object"
                  ? { ref: vr.ref ?? vr, text: vr.text || "" }
                  : { ref: verseRef, text: "" };
              window.dispatchEvent(new CustomEvent("codex:dict-open", { detail }));
              window.dispatchEvent(
                new CustomEvent("codex:open-panel", {
                  detail: { panelId: "bible-dictionary:dictionary", ctx: detail },
                }),
              );
            } catch { /* ignore */ }
          },
        },
      ],
    }),
  );
}

if (!doRegister()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
