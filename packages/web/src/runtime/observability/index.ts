// observability — migrated engine entry (faithful port of legacy/observability.js).
// Replaces legacy/observability.js in the Vite build.
//
// Importing this module installs the SAME side-effects the legacy IIFE did,
// in the same order:
//   1. Init window.__CODEX_ERRORS__
//   2. Detect DEV flag
//   3. Initial tick()
//   4. setInterval(tick, 1500)
//   5. window.addEventListener("load", …)
//
// Everything is wrapped so a failure here can never break boot.
import { detectDev, setDev, tick } from "./helpers.js";
import { ow } from "./observability-window.js";

try {
  // 1. Preserve any inline-0.0 buffer; create fresh if absent.
  ow().__CODEX_ERRORS__ = ow().__CODEX_ERRORS__ ?? [];

  // 2. Dev-only gate. No existing ?debug/localhost convention — we introduce it.
  try {
    setDev(detectDev());
  } catch {
    setDev(false);
  }

  // 3. Run once now (flush anything the inline 0.0 script already pushed).
  tick();

  // 4. Light polling interval (1 500 ms — matches legacy exactly).
  try {
    setInterval(tick, 1500);
  } catch { /* never throw */ }

  // 5. Also flush immediately after window load (when CDN/boot-contract entries
  //    are most likely to have just been pushed).
  //    NOTE: preserved from legacy — setTimeout(tick, 0) defers one tick so
  //    boot-contract's own load handler has run first; tick() is the fallback
  //    if setTimeout itself throws.
  try {
    window.addEventListener("load", function () {
      try {
        setTimeout(tick, 0);
      } catch {
        tick();
      }
    });
  } catch { /* never throw */ }
} catch {
  // Never throw during boot.
}
