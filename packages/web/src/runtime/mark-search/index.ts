// mark-search — entry. Assigns window.MarkSearch at module load, exactly as
// the legacy/mark-search.js IIFE did. Replaces that file in the Vite build.
import { rank, clearCache } from "./helpers.js";
import { msw } from "./mark-search-window.js";

// Expose same surface as v1 (engines outlive skins).
msw().MarkSearch = { rank, clearCache };
