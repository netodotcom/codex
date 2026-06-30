// observability — shared types and constants (faithful port from
// legacy/observability.js).

/** Ring-buffer capacity. NOTE: preserved from legacy — matches CAP = 200. */
export const CAP = 200 as const;

/** Shape of entries in window.__CODEX_ERRORS__.
 * NOTE: preserved from legacy — all properties are optional; type defaults to
 * "error" and message defaults to "" at render time (mirror / renderToast). */
export interface CodexError {
  type?: string;
  message?: string;
  src?: string;
}
