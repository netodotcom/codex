// word-study — migrated feature entry (Backlog: WORD STUDY plugin). Replaces
// legacy/deleted/dist/word-study.js in the Vite build (gen-web-entry maps it).
// Reproduces the legacy IIFE's load-time side effects: registers the plugin via
// window.CODEX_PLUGINS_API (panel "WORD" glyph Λ + verse action "Word Study"),
// with the same readyState/load fallback as the original. No window globals are
// SET by this module — the plugin is the only external contract.
import React from "react";
import { WordStudyPanel } from "./WordStudyPanel.js";
import { wsw } from "./word-study-window.js";

// ── Plugin registration ───────────────────────────────────────────────────────
function doRegister(): boolean {
  const api = wsw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return Boolean(api.register({
    id: "word-study",
    name: "Word Study",
    version: "1.0.0",
    panels: [{
      id: "word",
      label: "WORD",
      glyph: "Λ",
      render(ctx: unknown) {
        return React.createElement(WordStudyPanel, (ctx as Record<string, unknown> | null) ?? {});
      },
    }],
    verseActions: [{
      label: "Word Study",
      icon: "Λ",
      handler(ctx: unknown) {
        try {
          const c = ctx as { bookId?: string; chapter?: number; verse?: number; text?: string } | null;
          window.dispatchEvent(new CustomEvent("codex:word-study-open", {
            detail: {
              ref: (c && c.bookId ? c.bookId + "." + c.chapter + "." + c.verse : ""),
              text: c && c.text,
            },
          }));
          window.dispatchEvent(new CustomEvent("codex:open-panel", {
            detail: { pluginId: "word-study", panelId: "word", ctx },
          }));
        } catch {}
      },
    }],
  }));
}

if (!doRegister()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
