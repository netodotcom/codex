// reels — migrated feature entry. Replaces legacy/deleted/dist/reels.js in
// the build (gen-web-entry maps it). Reproduces the legacy IIFE's load-time
// side effects:
//   · attaches the codex:navigate listener (pre-load hook)
//   · schedules the initial refill via setTimeout(…, 800)
//   · exposes window.CODEX_Reels (same surface as v1)
//   · self-registers as a CODEX plugin via window.CODEX_PLUGINS_API (same
//     readyState/load fallback as the legacy)
import React from "react";
import { rw } from "./reels-window.js";
import { schedulePreload, restoreDeck, refillDeck } from "./data.js";
import { ReelsFeed, ReelsPanel } from "./ReelsPanel.js";
import type { NavCtx } from "./reels-window.js";

// ── Expose for reuse (same surface as v1) ────────────────────────────────────
rw().CODEX_Reels = { ReelsFeed, ReelsPanel, refillDeck, schedulePreload };

// ── Module-load side effects (same as the legacy IIFE) ───────────────────────

// Pre-load hook — fires on every navigation so the deck is stocked when the
// user opens Reels. CustomEvent detail carries the navigation context.
window.addEventListener("codex:navigate", (e: Event) => {
  const detail = (e as CustomEvent<NavCtx>).detail;
  schedulePreload(detail || {});
});

// Kick off once on load too (800 ms debounce matches v1).
setTimeout(() => { restoreDeck(); refillDeck({}, 30).catch(() => {}); }, 800);

// ── Plugin registration ──────────────────────────────────────────────────────
function registerPlugin(): void {
  const api = rw().CODEX_PLUGINS_API;
  if (!api) {
    window.addEventListener("load", registerPlugin, { once: true });
    return;
  }
  try {
    api.register({
      id: "reels",
      name: "Reels",
      version: "1.0.0",
      panels: [
        {
          id: "reels",
          label: "REELS",
          glyph: "▶",
          icon: "⬚",
          render: (ctx: unknown) =>
            React.createElement(ReelsPanel, (ctx ?? {}) as NavCtx),
        },
      ],
      onNavigate: (book: string, chapter: number | string) => {
        schedulePreload({ bookId: book, chapter });
      },
    });
  } catch (e) {
    console.warn("[reels] plugin registration failed:", e);
  }
}
registerPlugin();
