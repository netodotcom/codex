// ai-translate-ui — entry. Assigns window globals at import time, exactly as
// legacy/ai-translate-ui.js's IIFE. Replaces that IIFE in the Vite build (gen-web-entry
// maps it). Initialization order faithfully mirrors the IIFE:
//   1. CODEX_registerStrings exposed for plugins
//   2. install() wraps applyCodexLang (or retries until i18n.js is ready)
//   3. DOM walker installed (deferred to DOMContentLoaded if still loading)
//   4. CODEX_aiTranslateUI public API set
import { install, installDomWalker, registerStrings, createApi } from "./helpers.js";
import { aw } from "./ai-translate-ui-window.js";

// NOTE: preserved from legacy — browser-only guard mirrors the IIFE's first line
if (typeof window !== "undefined") {
  aw().CODEX_registerStrings = registerStrings;

  install();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installDomWalker, { once: true });
  } else {
    installDomWalker();
  }

  aw().CODEX_aiTranslateUI = createApi();
}

export type { CodexAiTranslateUiApi } from "./types.js";
