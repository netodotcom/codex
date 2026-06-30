// reader (soul) — Tweaks IO (migrated verbatim from reader.jsx). The same
// codex.tweaks.v1 store + 'tweakchange' event the Settings panel uses (cross-IIFE
// law: storage + window events only). Keys owned by the reader:
//   overlayGnosis · overlayTalmud · overlayCommentary   (bool, default false)
//   divineGold    (bool, default true)  — the Name in covenant gold
//   divineHebrew  (bool, default false) — Tetragrammaton renders as יהוה
import type { SoulTweaks } from "./soul-window.js";

export const CXR_TWEAKS_KEY = "codex.tweaks.v1";

export function cxrTweaks(): SoulTweaks {
  try { return (JSON.parse(localStorage.getItem(CXR_TWEAKS_KEY) || "{}") || {}) as SoulTweaks; }
  catch { return {}; }
}

export function cxrSetTweak(key: string, val: unknown): void {
  try {
    const raw = cxrTweaks();
    raw[key] = val;
    localStorage.setItem(CXR_TWEAKS_KEY, JSON.stringify(raw));
  } catch { /* storage unavailable — ignore */ }
  try { window.dispatchEvent(new CustomEvent("tweakchange", { detail: { [key]: val } })); } catch { /* no window */ }
}
