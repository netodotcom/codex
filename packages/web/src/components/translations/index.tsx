// translations — migrated feature entry. Replaces dist/translations.js in the
// Vite build (gen-web-entry maps it). Sets the EXACT same window global that
// the legacy Object.assign(window, { CodexTranslationsX }) set on load — same
// name, same timing (module import = synchronous, just like the legacy IIFE).
// No plugin registration: the legacy file did not register any CODEX plugin.
import { CodexTranslationsX } from "./TranslationsPanel.js";
import { tw } from "./translations-window.js";

// Replicate: Object.assign(window, { CodexTranslationsX });
tw().CodexTranslationsX = CodexTranslationsX;
