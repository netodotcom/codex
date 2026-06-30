// app — module-level constants (migrated from app.jsx). The tweak defaults the
// store seeds from, the mark-highlight palette, and the accent map.
import type { TweakMap } from "../components/settings/store.js";

// Typed view of the tweak values the App reads (the store is a loose map; the
// App casts to this for ergonomic access).
export interface AppTweaks {
  autoTheme: boolean;
  manualDark: boolean;
  primaryTranslation: string;
  fontScale: number;
  scanlines: boolean;
  accent: string;
  scriptureFont: string;
  redLetter: boolean;
  sideBySide: boolean;
  highlightColor: string;
  distractionFree: boolean;
  divineGold: boolean;
  divineHebrew: boolean;
  overlayGnosis: boolean;
  overlayTalmud: boolean;
  overlayCommentary: boolean;
  lang: string;
  caffeinate: boolean;
  notesEnabled: boolean;
  oracleFontScale: number;
  hermeneuticDriftCompensation: boolean;
  bootIntro: boolean;
  provider: string;
  model: string;
  schizo: boolean;
  continuityEnabled: boolean;
  continuityThreshold: number;
  notifyCadence: string;
}

export const TWEAK_DEFAULTS: TweakMap = {
  autoTheme: true,
  manualDark: true,
  primaryTranslation: "kjv",
  fontScale: 22,
  scanlines: true,
  accent: "cyan",
  scriptureFont: "serif",
  redLetter: true,
  sideBySide: false,
  highlightColor: "amber",
  distractionFree: false,
  divineGold: true,
  divineHebrew: false,
  overlayGnosis: false,
  overlayTalmud: false,
  overlayCommentary: false,
  lang: "en",
  caffeinate: false,
  notesEnabled: false,
  oracleFontScale: 14,
  hermeneuticDriftCompensation: false,
  bootIntro: false,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  schizo: false,
  continuityEnabled: true,
  continuityThreshold: 1,
  notifyCadence: "subtle",
};

export const HIGHLIGHT_COLORS: Record<string, { name: string; swatch: string }> = {
  amber: { name: "Amber", swatch: "#ffc46b" },
  cyan: { name: "Cyan", swatch: "#7ee0ff" },
  violet: { name: "Violet", swatch: "#c7a9ff" },
  green: { name: "Green", swatch: "#8de8a8" },
  rose: { name: "Rose", swatch: "#ff8291" },
};

export const ACCENT_MAP: Record<string, { dark: string; light: string; glow: string }> = {
  cyan: { dark: "#7ee0ff", light: "#0a6884", glow: "rgba(126,224,255,.4)" },
  amber: { dark: "#ffc46b", light: "#7a4a05", glow: "rgba(255,196,107,.4)" },
  green: { dark: "#8de8a8", light: "#0b5c2a", glow: "rgba(141,232,168,.4)" },
  violet: { dark: "#c7a9ff", light: "#4a2da8", glow: "rgba(199,169,255,.4)" },
};
