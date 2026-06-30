// constellation — migrated feature entry. Replaces dist/constellation.js in the
// Vite build (gen-web-entry maps it). The legacy constellation.jsx had exactly
// one module-load side-effect: Object.assign(window, { VerseConstellation }).
// We reproduce that here. (CSS injection, the smoke/automation hook, trail +
// flight telemetry, and the codex:now listener are all RUNTIME side-effects of
// the component, fired on mount — preserved inside VerseConstellation, exactly
// as the legacy IIFE did them.)
import { VerseConstellation } from "./VerseConstellation.js";

interface ConstExportWindow {
  VerseConstellation?: typeof VerseConstellation;
}

Object.assign(window as unknown as ConstExportWindow, { VerseConstellation });
