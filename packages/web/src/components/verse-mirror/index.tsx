// verse-mirror — migrated feature entry. Replaces legacy/deleted/dist/verse-mirror.js
// in the Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's only
// load-time side effect: Object.assign(window, { VerseMirror }). No plugin
// registration — the legacy didn't register one.
import { VerseMirror } from "./VerseMirror.js";
import { mw } from "./verse-mirror-window.js";

// ── The frozen export contract (identical to v1) ──────────────────────────
mw().VerseMirror = VerseMirror;
