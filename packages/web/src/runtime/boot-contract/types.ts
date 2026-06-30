// boot-contract — shared types and constants (faithful port from
// legacy/boot-contract.js).

/** Timing for the retry loop.
 * NOTE: preserved from legacy — ~8s comfortably covers cold-start transpile +
 * first React effects. INTERVAL_MS = 150ms between retries. */
export const DEADLINE_MS = 8000 as const;
export const INTERVAL_MS = 150 as const;

/** Minimal shape of a window.__CODEX_ERRORS__ entry.
 * NOTE: preserved from legacy — `when` is the boot-contract-specific timestamp
 * field; type/message/src mirror the observability ring-buffer shape. */
export interface BootCodexError {
  when?: number;
  type?: string;
  message?: string;
  src?: string;
}

/** A single global descriptor in the boot contract manifest. */
export interface BootGlobal {
  /** The property name on window to check. */
  name: string;
  /** 'js' = must exist after synchronous .js parse phase;
   *  'jsx' = only exists after async .jsx (Babel/createRoot) phase. */
  phase: "js" | "jsx";
  /** Returns true when the global has the expected shape. */
  shape: (val: unknown) => boolean;
}

/** The full boot contract manifest exposed as window.CODEX_BOOT_CONTRACT. */
export interface CodexBootContract {
  /** NOTE: preserved from legacy — filled in once the Phase-0 BASE commit exists;
   * null until then. */
  baselineSha: string | null;
  globals: BootGlobal[];
  /** Phase 3 (events.js) adds the 45 verified codex:* event names + payload
   * notes. NOTE: preserved from legacy — intentionally empty for Phase 0. */
  events: unknown[];
}
