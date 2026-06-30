// intel — migrated feature entry. Replaces legacy/deleted/dist/intel.js in the
// Vite build (gen-web-entry maps it). Reproduces the exact window globals the
// legacy IIFE set on load — byte-for-intent identical at runtime:
//
//   Object.assign(window, { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp })
//   window.CODEX_INTEL = { ...components, ...helpers, intelCanvas }
//
// No plugin registration (intel.jsx had none). No CSS injection (classes are
// defined in the host stylesheet; no self-injected <style> in the legacy file).
import { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp } from "./components.js";
import {
  intelGrade, intelReducedMotion,
  intelParseJSON, intelFmtYear, intelEscapeHtml, intelEngine, intelErrMessage, intelAI,
} from "./helpers.js";
import { intelCanvas } from "./canvas.js";
import { iw } from "./intel-window.js";

// Replicate: Object.assign(window, { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp })
Object.assign(iw(), { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp });

// Replicate: window.CODEX_INTEL = { ... }
iw().CODEX_INTEL = {
  IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp,
  intelGrade, intelCanvas, intelReducedMotion,
  intelParseJSON, intelFmtYear, intelEscapeHtml, intelEngine, intelErrMessage, intelAI,
};

// Re-export for consumers who import from the package entry directly.
export { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp };
export {
  intelGrade, intelCanvas, intelReducedMotion,
  intelParseJSON, intelFmtYear, intelEscapeHtml, intelEngine, intelErrMessage, intelAI,
};
export type { IntelDecryptProps, IntelBarsProps, IntelBannerProps, IntelTickerProps, IntelStampProps } from "./components.js";
export type { IntelGrade, IntelEngineResult, IntelAIOptions } from "./helpers.js";
export type { IntelCanvasArcOpts, IntelCanvasNodeOpts, IntelCanvasDims } from "./canvas.js";
