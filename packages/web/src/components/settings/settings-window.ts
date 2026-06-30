// settings — typed window boundary (migrated from tweaks-panel.jsx). Centralises
// the runtime globals the sections/panel read at render time.
import type React from "react";
import type { Translation } from "../reader/types.js";

export interface ModelEntry {
  id: string;
  label: string;
  tier?: string;
}
export interface ProviderReg {
  available: boolean;
  models?: ModelEntry[];
}
export interface LightTheme {
  id: string;
  label: string;
  bg: string;
  fg: string;
  accent: string;
}

export interface SettingsWindow {
  t?: (k: string) => string;
  CODEX_DATA?: { translations?: Translation[]; tweaks?: Record<string, unknown> };
  CODEX_TWEAK_DEFAULTS?: Record<string, unknown>;
  CODEX_MODELS?: Record<string, ModelEntry[]>;
  CODEX_ENGAGE?: { clearProfile?: () => void };
  CODEX_ENGAGEMENT?: { setConfig?: (cfg: { dailyThreshold: number }) => void };
  CODEX_LIGHT_THEMES?: { get(): string; list(): LightTheme[]; set(id: string): void };
  CODEX_HelpWiki?: React.ComponentType;
}

export function sw(): SettingsWindow {
  return window as unknown as SettingsWindow;
}

export function tt(k: string, fb: string): string {
  try {
    const t = sw().t;
    return (t && t(k)) || fb;
  } catch {
    return fb;
  }
}
