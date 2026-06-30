// strongs — migrated feature entry. Replaces legacy/deleted/dist/strongs.js in
// the Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's load-time
// side effects: imports helpers (which warm-loads the three modules on eval),
// exposes the exact same three window globals (CODEX_StrongsLookup,
// CODEX_StrongsRenderer, CODEX_StrongsPanel) and self-registers as a CODEX
// plugin via window.CODEX_PLUGINS_API — panel "STRONG'S" (glyph ℋ) plus a
// "Strong's Lookup" verse action — with the same readyState/load fallback.
import React from "react";
import { StrongsPanel, renderInterlinear } from "./StrongsPanel.js";
import { lookup } from "./helpers.js";
import { sw } from "./strongs-window.js";
import type { StrongsPanelProps } from "./strongs-window.js";

// ── Expose globals (same surface as v1) ───────────────────────────────────
sw().CODEX_StrongsLookup = lookup;
sw().CODEX_StrongsRenderer = { renderInterlinear, lookup };
sw().CODEX_StrongsPanel = StrongsPanel;

// ── Verse-action handler ───────────────────────────────────────────────────
function openStrongsForVerse(ctx: unknown): void {
  // Best-effort: dispatch an event app shell could listen for to open the
  // panel; also log so we leave a breadcrumb in the console.
  try {
    window.dispatchEvent(new CustomEvent("codex:open-panel", {
      detail: { pluginId: "strongs-concordance", panelId: "strongs", ctx },
    }));
  } catch { /* no-op */ }
}

// ── Plugin registration ────────────────────────────────────────────────────
function doRegister(): boolean {
  const api = sw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return Boolean(api.register({
    id: "strongs-concordance",
    name: "Strong's Concordance",
    version: "1.0.0",
    panels: [{
      id: "strongs",
      label: "STRONG'S",
      glyph: "ℋ",
      render(ctx: Record<string, unknown>) {
        return React.createElement(StrongsPanel, (ctx || {}) as StrongsPanelProps);
      },
    }],
    verseActions: [{
      label: "Strong's Lookup",
      icon: "ℋ",
      handler(ctx: unknown): void {
        openStrongsForVerse(ctx);
      },
    }],
  }));
}

if (!doRegister()) {
  // Defer until load — plugins.js may evaluate after us in script order.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
