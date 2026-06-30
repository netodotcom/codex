// ops — migrated feature entry. Replaces legacy/deleted/dist/ops.js in the
// Vite build (gen-web-entry maps legacy/deleted/dist/ops.js →
// ./components/ops/index.js). Reproduces the legacy IIFE's load-time side
// effect: sets window.VerseOps — the exact same global the legacy file set
// via `Object.assign(window, { VerseOps })`. No plugin registration: the
// legacy ops.jsx did not register through window.CODEX_PLUGINS_API; instead
// the host (codexOpenOps) mounts VerseOps directly from this global.
import { VerseOps } from "./VerseOps.js";
import { ow } from "./ops-window.js";

// Expose — same surface, same timing (module load), same name.
ow().VerseOps = VerseOps;
