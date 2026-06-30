// winhost — migrated feature entry (Backlog). Replaces
// dist/winhost.js in the Vite build (gen-web-entry maps it). Reproduces
// the legacy IIFE's load-time side effects:
//   · window.WinHostRoot = WinHostRoot   (exact same surface as v1)
//   · self-mounts a React root at #cx-winhost in document.body using
//     window.ReactDOM.createRoot — identical IIFE + readyState guard
//     (wrapped in try/catch so boot never breaks on missing globals)
// The codexOpenWindow / codexOpenPanel globals are set by WinHostRoot itself
// on mount (inside useEffect), exactly as the legacy closure did.
import React from "react";
import { WinHostRoot } from "./WinHostRoot.js";
import { ww } from "./winhost-window.js";

// ── Same window export surface as v1 ──────────────────────────────────────
ww().WinHostRoot = WinHostRoot;

// ── Self-mounting — winhost owns its own root so app.jsx stays untouched ──
(function mountWinhost(): void {
  if (typeof document === "undefined") return;
  const go = (): void => {
    try {
      const el = document.createElement("div");
      el.id = "cx-winhost";
      document.body.appendChild(el);
      const RD = ww().ReactDOM;
      if (!RD) return;
      RD.createRoot(el).render(React.createElement(WinHostRoot));
    } catch {
      /* never break boot */
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", go, { once: true });
  } else {
    go();
  }
})();
