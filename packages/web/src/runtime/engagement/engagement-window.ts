// Engagement — typed window boundary. All runtime global accesses go through
// ew() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in gematria-window.ts / data-window.ts.
import type {
  CodexEngage,
  CodexEngagement,
  CodexQuestgen,
} from "./types.js";

// ── Globals this module READS (external engines / browser APIs) ──────────────
export interface EngagementWindowRead {
  /**
   * Optional i18n function supplied by the host. Checked via
   * `typeof window.t === "function"` before each use — never set by this module.
   * (Legacy: safeT() guard.)
   */
  t?: (key: string) => string;
  /** Pre-staged module data keyed by module-id. Checked by _getModuleSync(). */
  CODEX_MODULE_DATA?: Record<string, unknown>;
  /** Module loader injected by the modules engine. */
  CODEX_MODULES?: {
    loadModule?: (id: string) => Promise<unknown>;
  };
  /** IndexedDB may be absent in SSR / test environments without full DOM. */
  indexedDB?: IDBFactory;
}

// ── Full typed window boundary ────────────────────────────────────────────────
export interface EngagementWindow extends EngagementWindowRead {
  // Globals this module SETS
  CODEX_ENGAGE?: CodexEngage;
  CODEX_ENGAGEMENT?: CodexEngagement;
  CODEX_QUESTGEN?: CodexQuestgen;
}

export function ew(): EngagementWindow {
  return window as unknown as EngagementWindow;
}
