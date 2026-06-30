// observability — logic helpers (faithful port from legacy/observability.js).
//
// Module-level variables replace the IIFE closure variables; declaration order
// and initial values match the original exactly.
// NOTE: preserved from legacy — plain mutable module vars, not a class.
import { CAP } from "./types.js";
import type { CodexError } from "./types.js";
import { ow } from "./observability-window.js";

// ── Module-level state (mirrors IIFE closure) ─────────────────────────────────
let DEV = false;
let mirrored = 0;
let toastEl: HTMLDivElement | null = null;
let lastLen = -1;

// ── Dev gate ──────────────────────────────────────────────────────────────────
/** Detects dev mode: localhost hostname or ?debug in query string.
 * NOTE: preserved from legacy — wrapped in try/catch exactly as original. */
export function detectDev(): boolean {
  try {
    const host = window.location.hostname;
    const qs = window.location.search;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      qs.indexOf("debug") !== -1
    );
  } catch {
    return false;
  }
}

/** Sets the module-level DEV flag (called once at init from index.ts). */
export function setDev(value: boolean): void {
  DEV = value;
}

// ── Ring-buffer cap helper ────────────────────────────────────────────────────
/** Trims __CODEX_ERRORS__ to at most CAP (200) entries, keeping the newest.
 * NOTE: preserved from legacy — splice(0, excess) drops the oldest entries. */
export function clamp(): void {
  try {
    const a = ow().__CODEX_ERRORS__;
    if (a && a.length > CAP) a.splice(0, a.length - CAP);
  } catch { /* never throw */ }
}

// ── Console mirror (always on, prod + dev) ────────────────────────────────────
/** Logs every new entry in __CODEX_ERRORS__ to console.error exactly once.
 * Uses module-level `mirrored` counter so already-logged entries are skipped.
 * NOTE: preserved from legacy — format is "[CODEX] type: message (src)". */
export function mirror(): void {
  try {
    const a = ow().__CODEX_ERRORS__;
    if (!a) return;
    for (; mirrored < a.length; mirrored++) {
      const e: CodexError = a[mirrored] ?? {};
      if (!a[mirrored]) continue;
      try {
        console.error(
          "[CODEX]",
          (e.type || "error") + ":",
          e.message || "",
          e.src ? "(" + e.src + ")" : "",
        );
      } catch { /* never throw */ }
    }
  } catch { /* never throw */ }
}

// ── Dev toast (dev only) ──────────────────────────────────────────────────────
/** Creates (or returns existing) the fixed bottom-right error toast element.
 * Returns null in production (DEV = false) or when document.body is absent.
 * NOTE: preserved from legacy — all style values are verbatim from original. */
export function ensureToast(): HTMLDivElement | null {
  if (!DEV) return null;
  try {
    if (toastEl?.parentNode) return toastEl;
    if (!document.body) return null;
    toastEl = document.createElement("div");
    toastEl.id = "cx-obs-toast";
    const s = toastEl.style;
    s.position = "fixed";
    s.right = "8px";
    s.bottom = "8px";
    s.zIndex = "2147483647";
    s.maxWidth = "min(420px, 90vw)";
    s.maxHeight = "40vh";
    s.overflow = "auto";
    s.padding = "8px 10px";
    s.borderRadius = "8px";
    s.background = "rgba(20,0,0,0.92)";
    s.color = "#ffd7d7";
    s.font = "11px/1.45 ui-monospace, Menlo, Consolas, monospace";
    s.border = "1px solid rgba(255,90,90,0.5)";
    s.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
    s.pointerEvents = "auto";
    s.whiteSpace = "pre-wrap";
    s.wordBreak = "break-word";
    document.body.appendChild(toastEl);
    return toastEl;
  } catch {
    return null;
  }
}

/** Refreshes the dev toast with the most recent (up to 6) errors.
 * NOTE: preserved from legacy — message truncated at 160 chars with "…". */
export function renderToast(): void {
  if (!DEV) return;
  try {
    const a = ow().__CODEX_ERRORS__ || [];
    if (!a.length) {
      if (toastEl) toastEl.style.display = "none";
      return;
    }
    const el = ensureToast();
    if (!el) return;
    el.style.display = "block";
    // Show the most recent (up to 6) entries, newest last.
    const recent = a.slice(Math.max(0, a.length - 6));
    const lines: string[] = [];
    lines.push("[CODEX] " + a.length + " error(s)");
    for (let i = 0; i < recent.length; i++) {
      const e: CodexError = recent[i] ?? {};
      let msg = String(e.message || "");
      if (msg.length > 160) msg = msg.slice(0, 157) + "…";
      const src = e.src ? " " + String(e.src) : "";
      lines.push("• " + (e.type || "error") + ": " + msg + src);
    }
    el.textContent = lines.join("\n");
  } catch { /* never throw */ }
}

// ── Poll for new entries and react ────────────────────────────────────────────
/** Single poll cycle: clamp buffer, then react if length changed.
 * NOTE: preserved from legacy — cheap length diff; no MutationObserver. */
export function tick(): void {
  try {
    clamp();
    const len = (ow().__CODEX_ERRORS__ || []).length;
    if (len !== lastLen) {
      lastLen = len;
      mirror();
      renderToast();
    }
  } catch { /* never throw */ }
}

// ── Test utilities ────────────────────────────────────────────────────────────
/** Resets all mutable module state to initial values. For use in tests only.
 * Also removes any leftover toast element from the document so DOM state does
 * not bleed between tests. */
export function _resetForTest(): void {
  DEV = false;
  mirrored = 0;
  // Remove the element from the DOM before nulling the reference so re-runs
  // don't accumulate duplicate #cx-obs-toast nodes in jsdom.
  if (toastEl?.parentNode) toastEl.parentNode.removeChild(toastEl);
  try {
    // Safety net: also remove any orphaned node left by a previous test.
    const orphan =
      typeof document !== "undefined"
        ? document.getElementById("cx-obs-toast")
        : null;
    if (orphan?.parentNode) orphan.parentNode.removeChild(orphan);
  } catch { /* never throw */ }
  toastEl = null;
  lastLen = -1;
}
