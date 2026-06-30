// shell — entry. Sets window.__CXSHELL at import time, exactly as
// legacy/shell.js. Replaces that IIFE in the Vite build (gen-web-entry maps
// it).
//
// Side-effects are installed in the same order as the original IIFE:
//   1. Guard check (idempotency) + window.__CXSHELL = true
//   2. document "visibilitychange" → syncWall
//   3. window "resize" → onResize
//   4. mqReduce "change" → syncWall  (addListener fallback for older Safari/Edge)
//   5. window "codex:theme" → readTint (lazy tint refresh on theme swap)
//   6. boot(): applyClass() immediately, or deferred to DOMContentLoaded

import { applyClass, mqReduce, onResize, readTint, syncWall } from "./helpers.js";
import { sw } from "./shell-window.js";

// NOTE: preserved from legacy — idempotency guard. ESM deduplicates module
// evaluation, but window.__CXSHELL is still set so that external observers
// (e.g., the orchestrator parity probe) can verify the shell has booted.
if (!sw().__CXSHELL) {
  sw().__CXSHELL = true;

  document.addEventListener("visibilitychange", syncWall);

  window.addEventListener("resize", onResize);

  if (mqReduce) {
    const onMotionPref = (): void => { syncWall(); };
    // NOTE: preserved from legacy — addListener fallback for older Safari/Edge
    // that predate the EventTarget API on MediaQueryList. Cast to a plain
    // Record to avoid the incompatible DOM-lib signature on the deprecated method.
    const mql = mqReduce as unknown as Record<string, unknown>;
    if (typeof mql["addEventListener"] === "function") {
      mqReduce.addEventListener("change", onMotionPref);
    } else if (typeof mql["addListener"] === "function") {
      (mql["addListener"] as (fn: () => void) => void)(onMotionPref);
    }
  }

  // Theme swaps change --cx-accent; refresh the tint lazily on theme events.
  window.addEventListener("codex:theme", (): void => { readTint(); });

  const boot = (): void => { applyClass(); };
  if (document.body) {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
}
