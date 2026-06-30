// winhost — pure helpers (migrated faithfully from winhost.jsx). These four
// functions contain no React; they are testable in isolation and shared
// between WinHostRoot and index.tsx.
import { ww } from "./winhost-window.js";
import type { PluginPanel } from "./winhost-window.js";

export const WINHOST_KEY = "codex.windows.v1";

// ── WinEntry: the shape stored in localStorage and held in React state ─────
export interface WinEntry {
  id: string;
  title?: string;
  glyph?: string;
}

// Load the window list from localStorage; returns [] on any error.
export function winhostLoad(): WinEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WINHOST_KEY) || "[]") as WinEntry[] | null;
    return parsed || [];
  } catch {
    return [];
  }
}

// Persist up to 12 windows; silently drops localStorage errors.
export function winhostSave(list: WinEntry[]): void {
  try {
    localStorage.setItem(WINHOST_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {}
}

// True only when the body carries .cx-os7 AND a fine-pointer viewport ≥ 881 px.
export function winhostDesktop(): boolean {
  try {
    return (
      document.body.classList.contains("cx-os7") &&
      window.matchMedia("(min-width: 881px) and (pointer: fine)").matches
    );
  } catch {
    return false;
  }
}

// Resolve a "plugin:<pluginId>:<panelId>" window id to the live plugin panel
// object. Returns null for non-plugin ids or when the API isn't ready yet.
export function winhostResolve(id: string): PluginPanel | null {
  if (!id || id.indexOf("plugin:") !== 0) return null;
  const parts = id.split(":");
  const api = ww().CODEX_PLUGINS_API;
  if (!api || !api.getPanels) return null;
  try {
    return (
      (api.getPanels() || []).find(
        (p) => p.pluginId === parts[1] && p.id === parts.slice(2).join(":")
      ) || null
    );
  } catch {
    return null;
  }
}
