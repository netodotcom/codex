// marketplace — migrated feature entry. Replaces legacy/deleted/dist/marketplace.js
// in the Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's load-time
// side effects:
//   · window.CODEX_MarketplacePanel = MarketplacePanel
//   · self-registers plugin "module-marketplace" (panel "market", glyph "⊞") via
//     window.CODEX_PLUGINS_API.register, with fallback to window load if API not ready.
import React from "react";
import { MarketplacePanel } from "./MarketplacePanel.js";
import { mw } from "./marketplace-window.js";

// ── Same window global as the legacy IIFE set at runtime ─────────────────────
mw().CODEX_MarketplacePanel = MarketplacePanel;

// ── Plugin registration (unchanged contract) ──────────────────────────────────
function doRegister(): boolean {
  if (!mw().CODEX_PLUGINS_API || typeof mw().CODEX_PLUGINS_API!.register !== "function") {
    window.addEventListener("load", doRegister, { once: true });
    return false;
  }
  try {
    mw().CODEX_PLUGINS_API!.register({
      id: "module-marketplace",
      name: "Module Marketplace",
      version: "1.0.0",
      panels: [{
        id: "market",
        label: "MARKET",
        glyph: "⊞",
        icon: "⊞",
        render: () => React.createElement(MarketplacePanel, null),
      }],
    });
    return true;
  } catch (e) {
    console.warn("[marketplace] plugin registration failed:", e);
    return false;
  }
}
doRegister();
