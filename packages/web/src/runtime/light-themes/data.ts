// light-themes — static palette catalog.
// Migrated verbatim from legacy/light-themes.js THEMES array + constants.
import type { LightTheme } from "./types.js";

/** localStorage key used to persist the active light-theme choice. */
export const KEY = "codex.lightTheme.v1";

/** Default theme id — matches the bare .cx-app.is-light rule in styles.css. */
export const DEFAULT = "parchment";

// 9 day-mode palettes selectable by user. Order matches legacy exactly.
export const THEMES: LightTheme[] = [
  { id: "parchment", label: "Parchment", bg: "#ece4d2", fg: "#1a1d28", accent: "#0a6884" },
  { id: "vellum",    label: "Vellum",    bg: "#f4e9cd", fg: "#2a2010", accent: "#8a4f1a" },
  { id: "linen",     label: "Linen",     bg: "#f7f5ee", fg: "#161616", accent: "#1f5fbf" },
  { id: "sandstone", label: "Sandstone", bg: "#efd9b8", fg: "#3a2010", accent: "#8c3a14" },
  { id: "sage",      label: "Sage",      bg: "#e6e8d4", fg: "#1c2418", accent: "#4a6b30" },
  { id: "solarized", label: "Solarized", bg: "#fdf6e3", fg: "#073642", accent: "#268bd2" },
  { id: "slate",     label: "Slate",     bg: "#e2e6ec", fg: "#1a2230", accent: "#2a5a8a" },
  { id: "rose",      label: "Rose",      bg: "#f4e2dc", fg: "#2a1216", accent: "#9c2a4a" },
  { id: "old-book",  label: "Old Book",  bg: "#f1e8d2", fg: "#0a0608", accent: "#6a1a08" },
];
