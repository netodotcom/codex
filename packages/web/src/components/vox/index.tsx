// vox — migrated feature entry (Backlog). Replaces dist/vox.js in the Vite build
// (gen-web-entry maps it). Reproduces the legacy IIFE's load-time side effects:
// imports the engine (which subscribes to the OS voice list on load), exposes the
// same two window globals (CODEX_VOX, CODEX_VoxPanel), and self-registers as a
// CODEX plugin via window.CODEX_PLUGINS_API — panel "VOX" (glyph ◉) plus a
// "Read aloud" verse action — with the same readyState/load fallback.
import React from "react";
import { VoxEngine } from "./engine.js";
import { VoxPanel } from "./VoxPanel.js";
import { vw, type VoxCtx } from "./vox-window.js";

vw().CODEX_VOX = VoxEngine;
vw().CODEX_VoxPanel = VoxPanel;

// ───────────────────────────────────────────────────────────────────────
// Plugin registration
// ───────────────────────────────────────────────────────────────────────
function doRegister(): boolean {
  const api = vw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return Boolean(api.register({
    id: "vox",
    name: "VOX — Voice + Prayer",
    version: "1.0.0",
    panels: [{
      id: "vox",
      label: "VOX",
      glyph: "◉",
      render(ctx: unknown) {
        const c = (ctx || {}) as VoxCtx;
        return React.createElement(VoxPanel, {
          book: c.book,
          bookId: c.bookId,
          chapter: c.chapter,
          verse: c.verse,
          translation: c.translation,
        });
      },
    }],
    verseActions: [{
      label: "Read aloud",
      icon: "◉",
      handler(verseRef: unknown) {
        try {
          const vr = verseRef as
            | { text?: string; ref?: string; bookId?: string; chapter?: number | string; verse?: number | string; translation?: string }
            | null;
          const text = (vr && typeof vr === "object" && vr.text) ? vr.text : "";
          const refStr = (vr && typeof vr === "object")
            ? (vr.ref || (vr.bookId && vr.chapter && vr.verse
                ? `${vr.bookId}.${vr.chapter}.${vr.verse}` : null))
            : String(verseRef);
          window.dispatchEvent(new CustomEvent("codex:vox-speak", {
            detail: { text, ref: refStr, lang: vr && vr.translation },
          }));
          window.dispatchEvent(new CustomEvent("codex:open-panel", {
            detail: { panelId: "vox:vox" },
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
