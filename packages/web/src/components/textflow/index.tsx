// textflow — migrated feature entry. Replaces legacy/deleted/dist/textflow.js
// in the Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's
// load-time side effects exactly:
//   · Object.assign(window, { TextFlowRoot, textflowParse }) — same globals,
//     same timing (synchronous at module evaluation)
//   · Mounts <TextFlowRoot /> into a new #cx-textflow div via ReactDOM.createRoot
//     using the same DOMContentLoaded / immediate fallback as the original IIFE
//
// window.codexOpenText is set and cleared by <TextFlowRoot /> itself on
// mount/unmount, exactly as in the legacy (useEffect timing is identical).
import React from "react";
import { TextFlowRoot } from "./TextFlowRoot.js";
import { textflowParse } from "./helpers.js";
import { tfw } from "./textflow-window.js";

// ── Same window globals, same timing as Object.assign(window, {...}) ─────────
Object.assign(tfw(), { TextFlowRoot, textflowParse });

// ── Same mount IIFE ───────────────────────────────────────────────────────────
(function mountTextflow(): void {
  if (typeof document === "undefined") return;
  const go = (): void => {
    try {
      const el = document.createElement("div");
      el.id = "cx-textflow";
      document.body.appendChild(el);
      tfw().ReactDOM?.createRoot(el).render(
        React.createElement(TextFlowRoot),
      );
    } catch {
      // never break boot — mirrors legacy try/catch with no rethrow
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", go, { once: true });
  } else {
    go();
  }
})();
