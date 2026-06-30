// light-themes — domain types.

/** Shape of a single palette entry (matches the legacy THEMES array objects). */
export interface LightTheme {
  id: string;
  label: string;
  bg: string;
  fg: string;
  accent: string;
}

/** Public API surface assigned to window.CODEX_LIGHT_THEMES at runtime. */
export interface LightThemesApi {
  list: () => LightTheme[];
  get: () => string;
  set: (name: string) => void;
  DEFAULT: string;
}
