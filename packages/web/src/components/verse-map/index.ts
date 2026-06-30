// verse-map — migrated feature entry (Backlog 4.1). Replaces dist/verse-map.js
// in the Vite build (gen-web-entry maps it). Re-exposes the same window globals
// the legacy did so the rest of the app (and plugins) keep working, and imports
// the feature CSS that the legacy injected at runtime.
import "./verse-map.css";
import { VerseMap } from "./VerseMap.js";
import { BIBLE_SITES, MANUSCRIPT_SITES, PILGRIM_ROUTES } from "./sites.js";

// Web Speech narration — exposed on window so popup-inline onclick handlers
// (which can't reach React closures) can trigger it. (verse-map.jsx l.1633)
function codexSpeak(text: string): void {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = document.documentElement.lang || navigator.language || "en";
    u.rate = 0.98;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch {
    /* TTS is best-effort */
  }
}

Object.assign(window, {
  VerseMap,
  CODEX_BIBLE_SITES: BIBLE_SITES,
  CODEX_MANUSCRIPT_SITES: MANUSCRIPT_SITES,
  CODEX_PILGRIM_ROUTES: PILGRIM_ROUTES,
  codexSpeak,
});

export { VerseMap };
