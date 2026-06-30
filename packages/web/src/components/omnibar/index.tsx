// omnibar — migrated feature entry. Replaces dist/omnibar.js in the Vite build
// (gen-web-entry maps it). Re-exposes the SAME window global the legacy
// omnibar.jsx did — `window.Omnibar` — so app.jsx / the ⌘K host keep rendering
// it unchanged. The legacy file's only module-load side effect was this
// Object.assign; the guide-mode CSS is injected on first mount (inside the
// component's effect), exactly as before, not at import time.
import { Omnibar } from "./Omnibar.js";

Object.assign(window, { Omnibar });

export { Omnibar };
