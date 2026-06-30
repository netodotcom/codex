// search — entry point. Assigns window.CODEX_SEARCH and window.CODEX_SearchBar
// at module load, exactly as the legacy/search.js IIFEs did. Replaces those
// two IIFEs in the Vite build while the integration layer stays untouched.
import {
  index, ingestPassage, search, clear, stats, ready, searchSemantic,
} from "./helpers.js";
import { SearchBar } from "./SearchBar.js";
import { sw } from "./search-window.js";

// ── CODEX_SEARCH ─────────────────────────────────────────────────────────────
// NOTE: preserved from legacy — guard mirrors the original `if (window.CODEX_SEARCH) return;`
if (!sw().CODEX_SEARCH) {
  sw().CODEX_SEARCH = {
    index, ingestPassage, search, clear, stats, ready, searchSemantic,
  };
}

// ── CODEX_SearchBar ───────────────────────────────────────────────────────────
// In the legacy IIFE the component was registered synchronously if window.React
// was already available, or deferred to DOMContentLoaded otherwise.  Here the
// module is imported by the orchestrator after React is on the page, so a
// direct assignment is always correct.
if (!sw().CODEX_SearchBar) {
  sw().CODEX_SearchBar = SearchBar;
}
