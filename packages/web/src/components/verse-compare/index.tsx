// verse-compare — migrated feature entry. Replaces dist/verse-compare.js in the
// Vite build (gen-web-entry maps it). Re-exposes the exact same window global
// the legacy IIFE set at module load:
//   · window.VerseCompare  — the React component (same name, same timing)
// No plugin registration and no self-injected CSS: the legacy had neither.
import { VerseCompare } from "./VerseCompare.js";
import { vcw } from "./verse-compare-window.js";

// Expose the component for reuse — identical surface to the legacy global.
vcw().VerseCompare = VerseCompare;
