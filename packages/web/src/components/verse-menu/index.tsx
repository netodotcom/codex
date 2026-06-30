// verse-menu — migrated feature entry. Replaces dist/verse-menu.js in the
// Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's load-time
// side-effects on import:
//   · self-injected CSS (via style.ts, id="cx-vm-min-style") — idempotent
//   · window.VerseMenu set to the React component (same as legacy Object.assign)
// No plugin registration — the legacy had none.
import "./style.js";
import { VerseMenu } from "./VerseMenu.js";
import { vmw } from "./verse-menu-window.js";

// Exact same window global as the legacy `Object.assign(window, { VerseMenu })`.
vmw().VerseMenu = VerseMenu;
