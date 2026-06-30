// help — migrated feature entry (Backlog). Replaces dist/help.js in the Vite
// build (gen-web-entry maps it). Re-exposes window.CODEX_HelpWiki — the exact
// same surface the legacy IIFE set — so settings/TweaksPanel keeps rendering the
// Help Wiki. The legacy file had no CSS injection and no plugin registration: the
// `.cx-help-*` skin lives in styles.css ("Help Wiki — Beauty Pass"), so this
// entry only sets the global (importing HelpWiki also runs data.ts's load-time
// SUPPORTED_LANGS capture, exactly as the IIFE did).
import { HelpWiki } from "./HelpWiki.js";

Object.assign(window, { CODEX_HelpWiki: HelpWiki });
