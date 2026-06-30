// boot-contract — migrated engine entry (faithful port of legacy/boot-contract.js).
// Replaces legacy/boot-contract.js in the Vite build.
//
// Importing this module installs the SAME side-effects the legacy IIFE did,
// in the same order:
//   1. Init window.__CODEX_ERRORS__ (preserve any existing entries; create []
//      if absent).
//   2. Expose window.CODEX_BOOT_CONTRACT (wrapped in inner try/catch exactly
//      as original).
//   3. Register the readiness check: start on 'load', or via setTimeout(start, 0)
//      if document.readyState is already 'complete'.
//
// Everything is wrapped so a failure here can never break boot.
import { CODEX_BOOT_CONTRACT, start } from "./helpers.js";
import { bcw } from "./boot-contract-window.js";

try {
  // 1. Preserve any inline-0.0 / observability error buffer; create fresh if
  //    absent. NOTE: preserved from legacy — || [] kept as ?? [] (same semantics
  //    for null/undefined; arrays are truthy so || and ?? are equivalent here).
  bcw().__CODEX_ERRORS__ = bcw().__CODEX_ERRORS__ ?? [];

  // 2. Expose for the smoke harness / debugging.
  // NOTE: preserved from legacy — inner try/catch identical to original.
  try {
    bcw().CODEX_BOOT_CONTRACT = CODEX_BOOT_CONTRACT;
  } catch { /* never throw */ }

  // 3. Assert starting at 'load' (the .jsx phase is async), then poll until
  //    the effect-set jsx globals land or the deadline passes.
  //    NOTE: preserved from legacy — if already complete, setTimeout(start, 0)
  //    defers one task so any pending microtasks flush first.
  try {
    if (document.readyState === "complete") {
      setTimeout(start, 0);
    } else {
      window.addEventListener("load", function () {
        try { start(); } catch { /* never throw */ }
      });
    }
  } catch { /* never throw */ }
} catch {
  // Never throw during boot.
}

export { CODEX_BOOT_CONTRACT, start, checkOnce, runWithRetry, fail, isFn } from "./helpers.js";
export type { CodexBootContract, BootGlobal, BootCodexError } from "./types.js";
