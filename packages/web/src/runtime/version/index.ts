// version — module entry (replaces legacy/version.js in the Vite build).
//
// Runs the same load-time side-effects as the legacy IIFE script, in the same
// order:
//   1. Assign window.CODEX_VERSION (was `self.CODEX_VERSION = {...}`)
//   2. WHAT'S NEW flash card  (window + document scope only)
//   3. SELF-UPDATE pill       (window + serviceWorker scope only)
import { CODEX_VERSION_DATA, installWhatsNew, installUpdatePill } from "./helpers.js";
import { vw } from "./version-window.js";

// ── 1. Set global ─────────────────────────────────────────────────────────────
// Legacy used `self` (works in both window and worker); this module is
// browser-only so `window` (via the typed accessor) is the correct scope.
vw().CODEX_VERSION = CODEX_VERSION_DATA;

// ── 2. WHAT'S NEW flash ───────────────────────────────────────────────────────
installWhatsNew();

// ── 3. SELF-UPDATE pill ───────────────────────────────────────────────────────
installUpdatePill();
