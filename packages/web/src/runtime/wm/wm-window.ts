// wm — typed window boundary. All runtime global accesses go through
// ww() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in shell/shell-window.ts.
import type {
  CodexArrangeApi,
  CodexDesk,
  CodexDeskPanels,
  CodexDisplays,
  CodexNow,
} from "./types.js";

// ── Window globals this engine SETS ──────────────────────────────────────────
// ── Window globals this engine READS ─────────────────────────────────────────
export interface WmWindow {
  // SET by this engine
  /** Guard flag — set to true on first boot; prevents double-initialisation.
   * Matches the legacy `window.__CXWM = true` side-effect exactly. */
  __CXWM?: true;
  /** Public arrange API: layout, save, recall, list. SET by this engine. */
  codexArrange?: CodexArrangeApi;

  // READ — set by app.jsx / other engines
  codexDesk?: CodexDesk;
  codexDeskPanels?: CodexDeskPanels;
  codexDisplays?: CodexDisplays;
  CODEX_NOW?: CodexNow;
  /**
   * CRITICAL: parity probe checks `typeof window.codexJumpToRef === "function"`.
   * Set by app.jsx; this engine only calls it.
   */
  codexJumpToRef?: (ref: string) => void;
  codexOpenOmni?: () => void;
  codexOpenOps?: (ctx: string) => void;
  codexOpenConstellation?: () => void;
  codexOpenPanel?: (id: string) => void;
  codexOpenWindow?: (opts: { id: string }) => void;
}

export function ww(): WmWindow {
  return window as unknown as WmWindow;
}
