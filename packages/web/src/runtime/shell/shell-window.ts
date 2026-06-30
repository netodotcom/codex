// shell — typed window boundary. All runtime global accesses go through
// sw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in observability-window.ts.

// ── Window globals this engine SETS ──────────────────────────────────────────
export interface ShellWindow {
  /** Guard flag — set to true on first boot; prevents double-initialisation.
   * Matches the legacy `window.__CXSHELL = true` side-effect exactly. */
  __CXSHELL?: true;
}

// ── Window globals this engine READS ─────────────────────────────────────────
//   devicePixelRatio — standard Browser API (typed via DOM lib)
//   innerWidth / innerHeight — standard Browser API (typed via DOM lib)
//   matchMedia      — standard Browser API (typed via DOM lib)
//   requestAnimationFrame / cancelAnimationFrame — standard Browser API

export function sw(): ShellWindow {
  return window as unknown as ShellWindow;
}
