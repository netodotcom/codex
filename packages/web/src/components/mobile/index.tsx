// mobile — migrated feature entry (THE PALM). Replaces dist/mobile.js (keyed
// as legacy/deleted/dist/mobile.js in gen-web-entry). Reproduces the legacy
// IIFE's single load-time side-effect: sets window.CodexMobileShell to the
// React component, exactly as the legacy's Object.assign(window, { CodexMobileShell }).
import { CodexMobileShell } from "./MobileShell.js";
import { mw } from "./mobile-window.js";

// Set the window global — same name, same timing (module load).
mw().CodexMobileShell = CodexMobileShell;
