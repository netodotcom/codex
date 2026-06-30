// sword — migrated feature entry. Replaces legacy/deleted/dist/sword.js in the
// Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's only load-
// time side effect: Object.assign(window, { VerseSword }). No plugin
// registration — the legacy didn't register one.
import { VerseSword } from "./VerseSword.js";
import { sw } from "./sword-window.js";

// ── The frozen export contract (identical to v1) ──────────────────────────
sw().VerseSword = VerseSword;
